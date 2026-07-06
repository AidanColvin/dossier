"""ssrf guard for outbound http requests.

every connector targets a fixed public api, but a redirect could still point
at a private, loopback, or link-local address (for example the cloud metadata
endpoint at 169.254.169.254). assert_public_url rejects non-http(s) schemes and
any host that resolves to a non-public ip.
"""
import ipaddress
import socket
from urllib.parse import urlparse


class UnsafeURLError(ValueError):
    """raised when a url is not safe to fetch (bad scheme or private host)."""


def _resolve_ips(host: str) -> list[str]:
    """
    given a host name
    return every ip address it resolves to
    raise UnsafeURLError when resolution fails
    """
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise UnsafeURLError(f"dns resolution failed for {host!r}") from exc
    return [info[4][0] for info in infos]


def ip_is_public(ip: str) -> bool:
    """
    given an ip address string
    return true only when it is globally routable and not reserved
    """
    addr = ipaddress.ip_address(ip)
    return not (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    )


def assert_https_scheme(url: str) -> None:
    """
    given a url
    raise UnsafeURLError unless its scheme is http or https
    """
    scheme = urlparse(url).scheme
    if scheme not in ("http", "https"):
        raise UnsafeURLError(f"scheme not allowed: {scheme!r}")


def assert_public_url(url: str) -> None:
    """
    given a url
    raise UnsafeURLError unless it is http(s) and every resolved ip is public
    """
    assert_https_scheme(url)
    host = urlparse(url).hostname
    if not host:
        raise UnsafeURLError("missing host")
    for ip in _resolve_ips(host):
        if not ip_is_public(ip):
            raise UnsafeURLError(f"host {host!r} resolves to non-public ip {ip}")
