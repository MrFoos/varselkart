import sqlite3
from pathlib import Path

from .config import settings

SCHEMA_VERSION = 1

DDL = """
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS varsler (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    dedup_id            TEXT NOT NULL UNIQUE,
    kilde               TEXT NOT NULL,
    kilde_kategori      TEXT,
    kilde_alvorsetikett TEXT,
    geometri_type       TEXT,
    geometri_json       TEXT NOT NULL,
    fylke_tags          TEXT NOT NULL DEFAULT '[]',
    tittel              TEXT,
    beskrivelse         TEXT,
    utstedt             TEXT,
    gyldig_til          TEXT,
    first_seen          TEXT NOT NULL,
    last_seen           TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'aktiv',
    lenke               TEXT,
    raw_json            TEXT,
    notified_at         TEXT,
    published_topics    TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS feed_status (
    kilde         TEXT PRIMARY KEY,
    sist_ok       TEXT,
    sist_forsøkt  TEXT,
    status        TEXT DEFAULT 'ukjent',
    feilmelding   TEXT
);

CREATE INDEX IF NOT EXISTS idx_varsler_status  ON varsler(status);
CREATE INDEX IF NOT EXISTS idx_varsler_kilde   ON varsler(kilde);
CREATE INDEX IF NOT EXISTS idx_varsler_utstedt ON varsler(utstedt DESC);
"""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.database_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    path = Path(settings.database_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    conn = get_connection()
    with conn:
        conn.executescript(DDL)
        row = conn.execute("SELECT version FROM schema_version").fetchone()
        if row is None:
            conn.execute("INSERT INTO schema_version VALUES (?)", (SCHEMA_VERSION,))
    conn.close()
