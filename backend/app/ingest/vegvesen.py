"""
Statens vegvesen DATEX II v3.1 ingestor.
Henter situasjoner (stengninger, ulykker, uvær på vei).
Krever DATEX_USERNAME + DATEX_PASSWORD i .env.
"""

import hashlib
import json
import logging
from typing import Optional

import httpx
from lxml import etree

from ..config import settings
from ..geo.fylke_lookup import get_fylke_lookup
from ..models import Varsel
from .base import BaseIngestor

logger = logging.getLogger(__name__)

SITUATION_URL = (
    "https://datex-server-get-v3-1.atlas.vegvesen.no"
    "/datexapi/GetSituation/pullsnapshotdata"
)

# DATEX XML namespaces
D2_NS = "http://datex2.eu/schema/3/common"


class VegvesenIngestor(BaseIngestor):
    kilde_navn = "vegvesen"

    async def hent_varsler(self) -> list[Varsel]:
        if not settings.datex_username:
            logger.warning("DATEX_USERNAME ikke satt — hopper over vegvesen-ingest")
            return []

        auth = (settings.datex_username, settings.datex_password)

        async with httpx.AsyncClient(timeout=45, auth=auth) as client:
            resp = await client.get(SITUATION_URL)
            resp.raise_for_status()

        root = etree.fromstring(resp.content)
        lookup = get_fylke_lookup()
        varsler: list[Varsel] = []

        for situation in root.iter(f"{{{D2_NS}}}situation"):
            try:
                varsel = _parse_situation(situation, lookup)
                if varsel:
                    varsler.append(varsel)
            except Exception as exc:
                logger.warning("Feil ved parsing av DATEX-situasjon: %s", exc)

        return varsler


def _parse_situation(situation, lookup) -> Optional[Varsel]:
    sit_id = situation.get("id") or situation.get("Id")
    if not sit_id:
        return None

    dedup_id = hashlib.sha256(f"vegvesen:{sit_id}".encode()).hexdigest()[:32]

    # Hent første SituationRecord
    record = situation.find(".//{*}situationRecord")
    if record is None:
        return None

    # Kategori fra recordtype
    kategori = record.get("{http://www.w3.org/2001/XMLSchema-instance}type", "")
    kategori = kategori.split(":")[-1] if ":" in kategori else kategori

    # Alvorlighet — DATEX bruker severity
    severity = record.findtext(".//{*}severity") or ""

    # Tidspunkt
    start_time = record.findtext(".//{*}startOfPeriod") or record.findtext(".//{*}publicationTime")
    end_time = record.findtext(".//{*}endOfPeriod")

    # Geometri — punkt fra koordinater
    lat_el = record.find(".//{*}latitude")
    lon_el = record.find(".//{*}longitude")

    geometri_type = "punkt"
    fylke_tags: list[str] = []

    if lat_el is not None and lon_el is not None:
        lat, lon = float(lat_el.text), float(lon_el.text)
        geom = {"type": "Point", "coordinates": [lon, lat]}
        geometri_json = json.dumps(geom)
        fylke_tags = lookup.punkt_til_fylker(lon, lat)
    else:
        geom = {"type": "Point", "coordinates": [10.0, 60.0]}
        geometri_json = json.dumps(geom)

    # Beskrivelse
    beskrivelse_el = record.find(".//{*}generalPublicComment/{*}comment/{*}values/{*}value")
    beskrivelse = beskrivelse_el.text if beskrivelse_el is not None else None

    tittel_el = record.find(".//{*}roadOrCarriagewayOrLaneManagementType")
    tittel = f"Vegvesen — {kategori}" + (f": {tittel_el.text}" if tittel_el is not None else "")

    return Varsel(
        dedup_id=dedup_id,
        kilde="vegvesen",
        kilde_kategori=kategori,
        kilde_alvorsetikett=severity,
        geometri_type=geometri_type,
        geometri_json=geometri_json,
        fylke_tags=fylke_tags,
        tittel=tittel,
        beskrivelse=beskrivelse,
        utstedt=start_time,
        gyldig_til=end_time,
        lenke="https://www.vegvesen.no/trafikkinformasjon/",
        raw_json=None,
        first_seen="",
        last_seen="",
    )
