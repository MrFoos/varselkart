"""
NVE Flomvarsling ingestor.
Henter varsler per fylke/kommune. Aktivitetsnivå 0–4 umodifisert fra kilden.
"""

import hashlib
import json
import logging

from ..models import Varsel
from .base import BaseIngestor
from .nve_base import hent_nve_feed, resolve_fylke_tags, resolve_geometry

logger = logging.getLogger(__name__)

BASE_URL = "https://api01.nve.no/hydrology/forecast/flood/v1.0.10/api"

AKTIVITETSNIVÅ = {0: "Ikke vurdert", 1: "Liten", 2: "Moderat", 3: "Betydelig", 4: "Stor"}

# Fylkesnumre → API-id
FYLKE_ID_MAP = {
    "03": 3, "31": 31, "32": 32, "33": 33, "34": 34,
    "39": 39, "40": 40, "42": 42, "11": 11, "46": 46,
    "15": 15, "50": 50, "18": 18, "55": 55, "56": 56,
}


class NveFlomIngestor(BaseIngestor):
    kilde_navn = "nve_flom"

    async def hent_varsler(self) -> list[Varsel]:
        data = await hent_nve_feed(BASE_URL)
        varsler: list[Varsel] = []
        for item in data:
            varsel = _parse_warning(item)
            if varsel:
                varsler.append(varsel)
        return varsler


def _parse_warning(item: dict) -> Varsel | None:
    warning_id = str(item.get("Id", ""))
    if not warning_id:
        return None

    dedup_id = hashlib.sha256(f"nve_flom:{warning_id}".encode()).hexdigest()[:32]
    aktivitet = int(item.get("ActivityLevel", 0))

    municipality = item.get("MunicipalityName", "")
    county_name = item.get("CountyName", "")
    area = item.get("Area", "")

    fylke_tags = resolve_fylke_tags(item)
    geom, geom_type = resolve_geometry(item, fylke_tags)

    alvorsetikett = str(aktivitet)  # Bevar kildens skala (0–4) umodifisert
    tittel = f"Flomvarsel — {area or municipality or county_name}"

    utstedt = item.get("PublishTime") or item.get("validFrom")
    gyldig_til = item.get("ValidTo") or item.get("validTo")

    return Varsel(
        dedup_id=dedup_id,
        kilde="nve_flom",
        kilde_kategori="flom",
        kilde_alvorsetikett=alvorsetikett,
        geometri_type=geom_type,
        geometri_json=json.dumps(geom),
        fylke_tags=fylke_tags,
        tittel=tittel,
        beskrivelse=item.get("MainText") or item.get("ActivityText"),
        utstedt=utstedt,
        gyldig_til=gyldig_til,
        status="aktiv" if aktivitet > 0 else "utlopt",
        lenke="https://www.varsom.no/",
        raw_json=json.dumps(item),
        first_seen="",
        last_seen="",
    )
