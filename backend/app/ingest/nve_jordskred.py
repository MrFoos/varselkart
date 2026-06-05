"""NVE Jordskredvarsling — identisk struktur som flomvarsling."""

import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta

import httpx

from ..geo.fylke_lookup import FYLKE_SLUGS, get_fylke_lookup
from ..models import Varsel
from .base import BaseIngestor

logger = logging.getLogger(__name__)

BASE_URL = "https://api01.nve.no/hydrology/forecast/landslide/v1.0.10/api"


class NveJordskredIngestor(BaseIngestor):
    kilde_navn = "nve_jordskred"

    async def hent_varsler(self) -> list[Varsel]:
        nå = datetime.now(timezone.utc)
        start = nå.strftime("%Y-%m-%d")
        slutt = (nå + timedelta(days=2)).strftime("%Y-%m-%d")

        url = f"{BASE_URL}/Warning/1/{start}/{slutt}"

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers={"Accept": "application/json"})
            resp.raise_for_status()
            data = resp.json()

        return [v for item in data if (v := _parse(item)) is not None]


def _parse(item: dict) -> Varsel | None:
    warning_id = str(item.get("Id", ""))
    if not warning_id:
        return None

    aktivitet = item.get("ActivityLevel", 0)
    if aktivitet == 0:
        return None

    dedup_id = hashlib.sha256(f"nve_jordskred:{warning_id}".encode()).hexdigest()[:32]
    fylke_nr = str(item.get("CountyId", "")).zfill(2)
    slug = FYLKE_SLUGS.get(fylke_nr)
    fylke_tags = [slug] if slug else []

    lat = item.get("Lat") or item.get("latitude")
    lon = item.get("Lon") or item.get("longitude")
    if lat and lon:
        geom = {"type": "Point", "coordinates": [float(lon), float(lat)]}
        geom_type = "punkt"
    elif slug:
        fylke_geom = get_fylke_lookup().hent_polygon(slug)
        geom = fylke_geom if fylke_geom else {"type": "Point", "coordinates": [10.0, 61.0]}
        geom_type = "polygon" if fylke_geom else "punkt"
    else:
        geom = {"type": "Point", "coordinates": [10.0, 61.0]}
        geom_type = "punkt"

    municipality = item.get("MunicipalityName", "")
    county_name = item.get("CountyName", "")

    return Varsel(
        dedup_id=dedup_id,
        kilde="nve_jordskred",
        kilde_kategori="jordskred",
        kilde_alvorsetikett=str(aktivitet),
        geometri_type=geom_type,
        geometri_json=json.dumps(geom),
        fylke_tags=fylke_tags,
        tittel=f"Jordskredvarsel — {municipality or county_name}",
        beskrivelse=item.get("MainText") or item.get("ActivityText"),
        utstedt=item.get("PublishTime"),
        gyldig_til=item.get("ValidTo"),
        lenke="https://varsom.no/flom-og-jordskredvarsling/jordskredvarsling/",
        raw_json=json.dumps(item),
        first_seen="",
        last_seen="",
    )
