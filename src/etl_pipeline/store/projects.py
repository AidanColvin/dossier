"""the projects store: save, list, fetch, and delete finished runs.

one json file, one list of project objects. no sql, no server, no schema
migration: the whole store is a single `json.load`/`json.dump` round trip
guarded by a file lock, which is the correct amount of machinery for a
single-instance deployment's local save feature. the payload field holds
the finished run verbatim, so reopening a project needs no re-fetch.
"""
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

try:
    import fcntl
except ImportError:  # noqa: BLE001 - fcntl is posix-only; windows skips locking
    fcntl = None

DEFAULT_STORE_PATH = Path("out") / "projects.json"

MODES = frozenset({"company", "sector", "partnership"})


def _load(handle) -> list[dict]:
    """
    given an open, already-locked file handle
    return its parsed project list, or an empty list for an empty or
    corrupt file — a bad store must never take the app down
    """
    handle.seek(0)
    raw = handle.read()
    if not raw:
        return []
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return []


def _save(handle, projects: list[dict]) -> None:
    """
    given the same locked handle and the full project list
    overwrite the file's contents
    """
    handle.seek(0)
    handle.truncate()
    json.dump(projects, handle)


def _read_all(path: Path) -> list[dict]:
    """
    given the store path
    return every stored project, locked for the read so it can never
    observe another writer's half-written file
    """
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as handle:
        if fcntl is not None:
            fcntl.flock(handle, fcntl.LOCK_SH)
        try:
            return _load(handle)
        finally:
            if fcntl is not None:
                fcntl.flock(handle, fcntl.LOCK_UN)


def _update(path: Path, mutate) -> list[dict]:
    """
    given the store path and a function old-projects -> new-projects
    apply it under one exclusive lock held across the read and the write,
    and return the new list

    the lock has to span both halves: a lock that only wraps the write (as
    a naive read-then-write-under-lock does) still lets two callers read
    the same stale snapshot before either writes, so the second write
    silently discards the first caller's change. holding the lock from
    before the read to after the write is what makes save-then-list a
    single atomic step.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a+", encoding="utf-8") as handle:
        if fcntl is not None:
            fcntl.flock(handle, fcntl.LOCK_EX)
        try:
            current = _load(handle)
            updated = mutate(current)
            _save(handle, updated)
            return updated
        finally:
            if fcntl is not None:
                fcntl.flock(handle, fcntl.LOCK_UN)


def save_project(name: str, mode: str, subject: str, payload: dict,
                 path: Optional[Path] = None) -> dict:
    """
    given a name, a mode, a subject, and the finished run payload
    write one project entry and return its listing entry
    raise ValueError for a mode the store does not know
    """
    if mode not in MODES:
        raise ValueError(f"unknown project mode: {mode!r}")
    entry = {
        "id": uuid.uuid4().hex,
        "name": name.strip() or subject,
        "mode": mode,
        "subject": subject,
        "saved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    _update(path or DEFAULT_STORE_PATH,
           lambda projects: projects + [{**entry, "payload": payload}])
    return entry


def list_projects(path: Optional[Path] = None) -> list[dict]:
    """
    takes an optional store path
    return every project's listing entry, newest first, payloads excluded
    """
    projects = _read_all(path or DEFAULT_STORE_PATH)
    ordered = sorted(projects, key=lambda p: p["saved_at"], reverse=True)
    return [{"id": p["id"], "name": p["name"], "mode": p["mode"],
             "subject": p["subject"], "saved_at": p["saved_at"]}
            for p in ordered]


def get_project(project_id: str, path: Optional[Path] = None) -> Optional[dict[str, Any]]:
    """
    given a project id
    return the full project including its payload, or None when absent
    """
    for project in _read_all(path or DEFAULT_STORE_PATH):
        if project["id"] == project_id:
            return project
    return None


def delete_project(project_id: str, path: Optional[Path] = None) -> bool:
    """
    given a project id
    delete its entry and return whether anything was deleted
    """
    deleted = False

    def mutate(projects: list[dict]) -> list[dict]:
        nonlocal deleted
        remaining = [p for p in projects if p["id"] != project_id]
        deleted = len(remaining) != len(projects)
        return remaining

    _update(path or DEFAULT_STORE_PATH, mutate)
    return deleted
