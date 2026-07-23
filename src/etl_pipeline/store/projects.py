"""the projects table: save, list, fetch, and delete finished runs.

standard-library sqlite only, one table, parameterized statements
throughout. the payload column holds the finished run as json verbatim,
so reopening a project needs no re-fetch and no reassembly; the listing
columns exist so the index view never has to parse a payload.
"""
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

DEFAULT_DB_PATH = Path("out") / "projects.sqlite"

MODES = frozenset({"company", "sector", "partnership"})

_CREATE = (
    "CREATE TABLE IF NOT EXISTS projects ("
    "id TEXT PRIMARY KEY, name TEXT NOT NULL, mode TEXT NOT NULL, "
    "subject TEXT NOT NULL, saved_at TEXT NOT NULL, payload TEXT NOT NULL)"
)


def _connect(path: Path) -> sqlite3.Connection:
    """
    given the database path
    return an open connection with the projects table present
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(path))
    connection.execute(_CREATE)
    return connection


def save_project(name: str, mode: str, subject: str, payload: dict,
                 path: Optional[Path] = None) -> dict:
    """
    given a name, a mode, a subject, and the finished run payload
    write one project row and return its listing entry
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
    connection = _connect(path or DEFAULT_DB_PATH)
    try:
        connection.execute(
            "INSERT INTO projects (id, name, mode, subject, saved_at, payload) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (entry["id"], entry["name"], entry["mode"], entry["subject"],
             entry["saved_at"], json.dumps(payload)))
        connection.commit()
    finally:
        connection.close()
    return entry


def list_projects(path: Optional[Path] = None) -> list[dict]:
    """
    takes an optional database path
    return every project's listing entry, newest first, payloads excluded
    """
    connection = _connect(path or DEFAULT_DB_PATH)
    try:
        rows = connection.execute(
            "SELECT id, name, mode, subject, saved_at FROM projects "
            "ORDER BY saved_at DESC").fetchall()
    finally:
        connection.close()
    return [{"id": r[0], "name": r[1], "mode": r[2], "subject": r[3],
             "saved_at": r[4]} for r in rows]


def get_project(project_id: str, path: Optional[Path] = None) -> Optional[dict[str, Any]]:
    """
    given a project id
    return the full project including its payload, or None when absent
    """
    connection = _connect(path or DEFAULT_DB_PATH)
    try:
        row = connection.execute(
            "SELECT id, name, mode, subject, saved_at, payload FROM projects "
            "WHERE id = ?", (project_id,)).fetchone()
    finally:
        connection.close()
    if row is None:
        return None
    return {"id": row[0], "name": row[1], "mode": row[2], "subject": row[3],
            "saved_at": row[4], "payload": json.loads(row[5])}


def delete_project(project_id: str, path: Optional[Path] = None) -> bool:
    """
    given a project id
    delete its row and return whether anything was deleted
    """
    connection = _connect(path or DEFAULT_DB_PATH)
    try:
        cursor = connection.execute("DELETE FROM projects WHERE id = ?",
                                    (project_id,))
        connection.commit()
        return cursor.rowcount > 0
    finally:
        connection.close()
