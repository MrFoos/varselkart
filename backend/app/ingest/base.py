"""
BaseIngestor: felles hent → normaliser → lagre → ntfy-loop for alle kilder.
Subklasser implementerer `kilde_navn` og `hent_varsler()`.
"""

import json
import logging
import sqlite3
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional

from ..database import get_connection
from ..models import Varsel
from ..geo.fylke_lookup import FylkeLookup

logger = logging.getLogger(__name__)

_fylke_lookup: Optional[FylkeLookup] = None


def get_fylke_lookup() -> FylkeLookup:
    global _fylke_lookup
    if _fylke_lookup is None:
        _fylke_lookup = FylkeLookup()
    return _fylke_lookup


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class BaseIngestor(ABC):
    @property
    @abstractmethod
    def kilde_navn(self) -> str:
        """Identifikator brukt i database og logging."""

    @abstractmethod
    async def hent_varsler(self) -> list[Varsel]:
        """Henter og normaliserer varsler fra kilden. Kaster ved nett-/parse-feil."""

    async def kjør(self) -> None:
        nå = _utc_now()
        conn = get_connection()
        try:
            varsler = await self.hent_varsler()
            self._lagre_varsler(conn, varsler)
            self._oppdater_feed_status(conn, status="ok", sist_ok=nå, feilmelding=None)
            logger.info("%s: %d varsler hentet", self.kilde_navn, len(varsler))
        except Exception as exc:
            logger.error("%s: feil ved henting — %s", self.kilde_navn, exc)
            self._oppdater_feed_status(conn, status="feil", feilmelding=str(exc))
        finally:
            conn.close()

    def _lagre_varsler(self, conn: sqlite3.Connection, varsler: list[Varsel]) -> None:
        nå = _utc_now()
        med_nye: list[str] = []

        with conn:
            for v in varsler:
                eksisterende = conn.execute(
                    "SELECT id, status FROM varsler WHERE dedup_id = ?", (v.dedup_id,)
                ).fetchone()

                if eksisterende is None:
                    conn.execute(
                        """INSERT INTO varsler
                           (dedup_id, kilde, kilde_kategori, kilde_alvorsetikett,
                            geometri_type, geometri_json, fylke_tags,
                            tittel, beskrivelse, utstedt, gyldig_til,
                            first_seen, last_seen, status, lenke, raw_json)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (
                            v.dedup_id, v.kilde, v.kilde_kategori, v.kilde_alvorsetikett,
                            v.geometri_type, v.geometri_json, json.dumps(v.fylke_tags),
                            v.tittel, v.beskrivelse, v.utstedt, v.gyldig_til,
                            nå, nå, v.status, v.lenke, v.raw_json,
                        ),
                    )
                    med_nye.append(v.dedup_id)
                else:
                    # Oppdater last_seen og eventuelle metadata-endringer
                    conn.execute(
                        """UPDATE varsler SET last_seen=?, kilde_alvorsetikett=?,
                           gyldig_til=?, status=?, raw_json=?
                           WHERE dedup_id=?""",
                        (nå, v.kilde_alvorsetikett, v.gyldig_til, v.status, v.raw_json, v.dedup_id),
                    )

            # Merk varsler som ikke lenger er med i feed-svaret som utløpt
            aktive_ids = [v.dedup_id for v in varsler]
            if aktive_ids:
                placeholders = ",".join("?" * len(aktive_ids))
                conn.execute(
                    f"""UPDATE varsler SET status='utlopt', last_seen=?
                        WHERE kilde=? AND status='aktiv'
                        AND dedup_id NOT IN ({placeholders})""",
                    [nå, self.kilde_navn] + aktive_ids,
                )
            else:
                # Tom respons fra kilden — utløp alle, men IKKE tolk det som «alt rolig»
                # (feed kan være nede — det håndteres via feed_status.status='feil')
                pass

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
