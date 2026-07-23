"""edge defenses for the http api: rate limits, body caps, and headers.

everything here is standard library. the limiter is an in-memory sliding
window per client and route family, which is per-instance by design: the
point is to keep one abusive client from monopolizing a free deployment,
not to bill anyone precisely. a real multi-instance deployment would move
this state to a shared store.
"""
import threading
import time

MAX_BODY_BYTES = 16 * 1024

# route family -> requests allowed per minute. the sector scan is the most
# expensive thing the api does, so it gets the tightest cap.
RATE_LIMITS: dict[str, int] = {
    "/sector": 3,
    "/run": 10,
    "/partnerships": 20,
    "/directory": 30,
    "/projects": 30,
}
DEFAULT_LIMIT_PER_MINUTE = 60
WINDOW_SECONDS = 60.0

SECURITY_HEADERS: dict[str, str] = {
    # the api serves json only, so the strictest csp costs nothing.
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "no-store",
}


def route_family(path: str) -> str:
    """
    given a request path
    return the rate-limit family it belongs to, matching on prefix so
    /sector/stream and /projects/{id} share their family's budget
    """
    for prefix in RATE_LIMITS:
        if path == prefix or path.startswith(f"{prefix}/") or path.startswith(f"{prefix}."):
            return prefix
    return "*"


class RateLimiter:
    """a sliding-window counter per (client, route family).

    thread-safe because the api serves requests from a thread pool. old
    windows are pruned on every check, so memory stays bounded by the
    number of active clients.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: dict[tuple[str, str], list[float]] = {}

    def allow(self, client: str, path: str) -> bool:
        """
        given a client id and a request path
        record the hit and return whether it is inside the family's budget
        """
        family = route_family(path)
        limit = RATE_LIMITS.get(family, DEFAULT_LIMIT_PER_MINUTE)
        key = (client, family)
        now = time.monotonic()
        with self._lock:
            hits = [t for t in self._hits.get(key, []) if now - t < WINDOW_SECONDS]
            if len(hits) >= limit:
                self._hits[key] = hits
                return False
            hits.append(now)
            self._hits[key] = hits
            return True

    def reset(self) -> None:
        """
        takes nothing
        forget every recorded hit, mainly for tests
        """
        with self._lock:
            self._hits.clear()


def body_too_large(content_length: str) -> bool:
    """
    given a request's content-length header value
    return whether the declared body exceeds the cap; an unparseable
    declaration counts as too large rather than waving the body through
    """
    if not content_length:
        return False
    try:
        return int(content_length) > MAX_BODY_BYTES
    except ValueError:
        return True
