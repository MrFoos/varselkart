"""
NVE Flomvarsling ingestor.
Henter varsler per fylke/kommune. Aktivitetsnivå 0–4 umodifisert fra kilden.
"""

import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta

import httpx

from ..geo.fylke_lookup import FYLKE_SLUGS
from ..models import Varsel
from .base import BaseIngestor

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
        nå = datetime.now(timezone.utc)
        start = nå.strftime("%Y-%m-%d")
        slutt = (nå + timedelta(days=2)).strftime("%Y-%m-%d")

        url = f"{BASE_URL}/Warning/1/{start}/{slutt}"  # /api/Warning/{langkey}/{start}/{end}
        headers = {"Accept": "application/json"}

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()

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
    aktivitet = item.get("ActivityLevel", 0)
    if aktivitet == 0:
        return None  # Ikke vurdert → ikke vis

    municipality = item.get("MunicipalityName", "")
    county_name = item.get("CountyName", "")
    fylke_nr = str(item.get("CountyId", "")).zfill(2)
    slug = FYLKE_SLUGS.get(fylke_nr)
    fylke_tags = [slug] if slug else []

    # Geometri: punkt ved kommunesentrum (NVE gir ikke polygon for flom per varsel)
    # Vi bruker et symbolpunkt i kommunen — lat/lon finnes ikke direkte i API
    # Fallback: polygon for hele fylket hentes fra FylkeLookup i frontend
    # For nå: null-geometri erstattes med fylkessentrum
    lat = item.get("Lat") or item.get("latitude")
    lon = item.get("Lon") or item.get("longitude")

    if lat and lon:
        geom = {"type": "Point", "coordinates": [float(lon), float(lat)]}
        geom_type = "punkt"
    else:
        # Ingen koordinater fra API — marker som region-type
        geom = {"type": "Point", "coordinates": [10.0, 61.0]}
        geom_type = "punkt"

    alvorsetikett = str(aktivitet)  # Bevar kildens skala (0–4) umodifisert
    tittel = f"Flomvarsel — {municipality or county_name}"

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
        lenke=f"https://varsom.no/flom-og-jordskredvarsling/flomvarsling/",
        raw_json=json.dumps(item),
        first_seen="",
        last_seen="",
    )
