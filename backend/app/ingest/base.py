"""
BaseIngestor: felles hent → normaliser → lagre → ntfy-loop for alle kilder.
Subklasser implementerer `kilde_navn` og `hent_varsler()`.
"""

import json
import logging
import sqlite3
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional  # noqa: F401

from ..database import get_connection
from ..models import Varsel
from ..geo.fylke_lookup import get_fylke_lookup  # noqa: F401 (re-eksportert for bakoverkompatibilitet)

logger = logging.getLogger(__name__)


def _chunks(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class BaseIngestor(ABC):
    @property
    @abstractmethod
    def kilde_navn(self) -> str:
        """Identifikator brukt i database og logging."""

    @abstractmethod
    async def hent_varsler(self) -> list[Varsel] | None:
        """Henter og normaliserer varsler fra kilden. Returnerer None ved 304. Kaster ved nett-/parse-feil."""

    async def kjør(self) -> None:
        nå = _utc_now()
        conn = get_connection()
        try:
            varsler = await self.hent_varsler()
            if varsler is None:
                logger.debug("%s: ingen endringer (304)", self.kilde_navn)
                return
            self._lagre_varsler(conn, varsler)
            self._oppdater_feed_status(conn, status="ok", sist_ok=nå, feilmelding=None)
            logger.info("%s: %d varsler hentet", self.kilde_navn, len(varsler))
        except Exception as exc:
            logger.error("%s: feil ved henting — %s", self.kilde_navn, exc)
            self._oppdater_feed_status(conn, status="feil", feilmelding=str(exc))
        finally:
            conn.close()

    def _lagre_varsler(self, conn: sqlite3.Connection, varsler: list[Varsel]) -> None:
        if not varsler:
            # Tom respons — ikke utløp eksisterende varsler (feed kan være nede)
            return

        nå = _utc_now()

        # Fjern duplikater innen samme batch (siste vinner)
        varsler = list({v.dedup_id: v for v in varsler}.values())

        with conn:
            eksisterende_ids: set[str] = set()
            for chunk in _chunks([v.dedup_id for v in varsler], 500):
                ph = ",".join("?" * len(chunk))
                eksisterende_ids.update(
                    row[0] for row in conn.execute(
                        f"SELECT dedup_id FROM varsler WHERE dedup_id IN ({ph})", chunk
                    )
                )

            for v in varsler:
                if v.dedup_id not in eksisterende_ids:
                    conn.execute(
                        """INSERT INTO varsler
                           (dedup_id, kilde, kilde_kategori, kilde_alvorsetikett,
                            geometri_type, geometri_json, fylke_tags,
                            tittel, beskrivelse, omrade, utstedt, gyldig_til,
                            start_tid, validity_status, perioder_json, situation_id,
                            first_seen, last_seen, status, lenke, raw_json)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (
                            v.dedup_id, v.kilde, v.kilde_kategori, v.kilde_alvorsetikett,
                            v.geometri_type, v.geometri_json, json.dumps(v.fylke_tags),
                            v.tittel, v.beskrivelse, v.omrade, v.utstedt, v.gyldig_til,
                            v.start_tid, v.validity_status, v.perioder_json, v.situation_id,
                            nå, nå, v.status, v.lenke, v.raw_json,
                        ),
                    )
                else:
                    # Oppdater last_seen og eventuelle metadata-endringer
                    conn.execute(
                        """UPDATE varsler SET last_seen=?, kilde_alvorsetikett=?,
                           geometri_type=?, geometri_json=?, fylke_tags=?,
                           tittel=?, beskrivelse=?, omrade=?, gyldig_til=?, status=?, raw_json=?,
                           start_tid=?, validity_status=?, perioder_json=?, situation_id=?
                           WHERE dedup_id=?""",
                        (
                            nå, v.kilde_alvorsetikett,
                            v.geometri_type, v.geometri_json, json.dumps(v.fylke_tags),
                            v.tittel, v.beskrivelse, v.omrade, v.gyldig_til, v.status, v.raw_json,
                            v.start_tid, v.validity_status, v.perioder_json, v.situation_id,
                            v.dedup_id,
                        ),
                    )

            # Merk varsler fra denne kilden som ikke er i feed-svaret som utløpt
            aktive_ids = [v.dedup_id for v in varsler]
            conn.execute("CREATE TEMP TABLE IF NOT EXISTS _aktive_ids (dedup_id TEXT PRIMARY KEY)")
            conn.execute("DELETE FROM _aktive_ids")
            conn.executemany("INSERT OR IGNORE INTO _aktive_ids VALUES (?)", [(d,) for d in aktive_ids])
            conn.execute(
                """UPDATE varsler SET status='utlopt', last_seen=?
                   WHERE kilde=? AND status='aktiv'
                   AND dedup_id NOT IN (SELECT dedup_id FROM _aktive_ids)""",
                [nå, self.kilde_navn],
            )

    def _oppdater_feed_status(
        self,
        conn: sqlite3.Connection,
        status: str,
        sist_ok: Optional[str] = None,
        feilmelding: Optional[str] = None,
    ) -> None:
        nå = _utc_now()
        with conn:
            conn.execute(
                """INSERT INTO feed_status (kilde, sist_ok, sist_forsøkt, status, feilmelding)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(kilde) DO UPDATE SET
                       sist_forsøkt=excluded.sist_forsøkt,
                       status=excluded.status,
                       feilmelding=excluded.feilmelding,
                       sist_ok=COALESCE(excluded.sist_ok, feed_status.sist_ok)""",
                (self.kilde_navn, sist_ok, nå, status, feilmelding),
            )
