"""
Publiserer varsler til ntfy per fylke-emne.
Idempotent: sjekker notified_at før publisering.
"""

import json
import logging
import sqlite3
from datetime import datetime, timezone

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

KILDE_EMOJI = {
    "met": "🌩",
    "nve_snoskred": "🏔",
    "nve_flom": "🌊",
    "nve_jordskred": "⛰",
    "vegvesen": "🚧",
    "avinor": "✈",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


async def publiser_nye_varsler(conn: sqlite3.Connection) -> None:
    if not settings.ntfy_token:
        return

    rows = conn.execute(
        "SELECT * FROM varsler WHERE notified_at IS NULL AND status = 'aktiv'"
    ).fetchall()

    if not rows:
        return

    async with httpx.AsyncClient(timeout=15) as client:
        for row in rows:
            fylke_tags = json.loads(row["fylke_tags"] or "[]")
            if not fylke_tags:
                continue

            for slug in fylke_tags:
                topic = f"varsling-{slug}"
                await _send(client, row, topic)

            nå = _utc_now()
            conn.execute(
                "UPDATE varsler SET notified_at=?, published_topics=? WHERE id=?",
                (nå, json.dumps([f"varsling-{s}" for s in fylke_tags]), row["id"]),
            )
        conn.commit()


async def _send(client: httpx.AsyncClient, row, topic: str) -> None:
    emoji = KILDE_EMOJI.get(row["kilde"], "⚠")
    tittel = row["tittel"] or row["kilde_kategori"] or "Varsel"
    alvorlighet = row["kilde_alvorsetikett"] or ""
    kilde_visning = row["kilde"].replace("_", " ").title()
    utstedt = (row["utstedt"] or "")[:16].replace("T", " ")

    body = f"{alvorlighet} · {kilde_visning} · {utstedt}".strip(" ·")

    payload = {
        "topic": topic,
        "title": f"{emoji} {tittel}",
        "message": body,
    }
    if row["lenke"]:
        payload["click"] = row["lenke"]

    try:
        resp = await client.post(
            f"{settings.ntfy_base_url}",
            json=payload,
            headers={"Authorization": f"Bearer {settings.ntfy_token}"},
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("ntfy publisering feilet for %s: %s", topic, exc)
