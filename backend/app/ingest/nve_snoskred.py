"""
NVE Snøskredvarsling ingestor.
Bruker egne varslingsregioner (ikke administrative fylker).
Henter regionpolygoner og intersekterer med fylkespolygoner.
"""

import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta

import httpx

from ..geo.fylke_lookup import get_fylke_lookup
from ..models import Varsel
from .base import BaseIngestor

logger = logging.getLogger(__name__)

BASE_URL = "https://api01.nve.no/hydrology/forecast/avalanche/v6.3.2/api"

FAREGRAD_TEKST = {
    0: "Ikke vurdert",
    1: "Liten",
    2: "Begrenset",
    3: "Betydelig",
    4: "Stor",
    5: "Meget stor",
}

# Varslingsregion-polygoner hentes fra NVE én gang og caches i prosessen
_region_polygoner: dict[int, dict] | None = None


async def _hent_region_polygoner(client: httpx.AsyncClient) -> dict[int, dict]:
    """Henter GeoJSON-polygoner for alle snøskredvarslingsregioner."""
    global _region_polygoner
    if _region_polygoner is not None:
        return _region_polygoner

    # NVE Varsom API — regiongeometri
    # Swagger-dokumentasjon verifiseres mot: BASE_URL/../swagger/
    region_url = "https://api01.nve.no/hydrology/forecast/avalanche/v6.3.2/api/Region/Summary/0"
    try:
        resp = await client.get(region_url, headers={"Accept": "application/json"})
        resp.raise_for_status()
        data = resp.json()
        _region_polygoner = {
            int(r["Id"]): _build_polygon(r)
            for r in data
            if r.get("Id") and r.get("Polygon")
        }
    except Exception as exc:
        logger.warning("Kunne ikke hente snøskredregioner: %s", exc)
        _region_polygoner = {}

    return _region_polygoner


def _build_polygon(region: dict) -> dict:
    """Konverterer NVE polygon-format til GeoJSON."""
    coords = []
    for pt in region.get("Polygon", []):
        coords.append([float(pt.get("Longitude", 0)), float(pt.get("Latitude", 0))])
    if coords and coords[0] != coords[-1]:
        coords.append(coords[0])
    return {"type": "Polygon", "coordinates": [coords]}


class NveSnoskredIngestor(BaseIngestor):
    kilde_navn = "nve_snoskred"

    async def hent_varsler(self) -> list[Varsel]:
        nå = datetime.now(timezone.utc)
        dato = nå.strftime("%Y-%m-%d")

        # Hent daglig varsel for alle regioner
        url = f"{BASE_URL}/AvalancheForecast/Detail/0/1/{dato}/{dato}"

        async with httpx.AsyncClient(timeout=30) as client:
            region_polygoner = await _hent_region_polygoner(client)
            resp = await client.get(url, headers={"Accept": "application/json"})
            resp.raise_for_status()
            data = resp.json()

        lookup = get_fylke_lookup()
        varsler: list[Varsel] = []

        for item in data:
            faregrad = item.get("DangerLevel", 0)
            if faregrad < 2:  # Viser kun faregrad 2 og over
                continue
            varsel = _parse(item, region_polygoner, lookup)
            if varsel:
                varsler.append(varsel)

        return varsler


def _parse(item: dict, region_polygoner: dict, lookup) -> Varsel | None:
    region_id = item.get("RegionId")
    dato = item.get("ValidFrom", "")[:10]
    if not region_id:
        return None

    dedup_id = hashlib.sha256(f"nve_snoskred:{region_id}:{dato}".encode()).hexdigest()[:32]
    faregrad = item.get("DangerLevel", 0)
    region_navn = item.get("RegionName", f"Region {region_id}")

    geom = region_polygoner.get(int(region_id))
    if geom and geom.get("coordinates") and geom["coordinates"][0]:
        geometri_type = "polygon"
        geometri_json = json.dumps(geom)
        fylke_tags = lookup.geometri_til_fylker(geom)
    else:
        # Fallback til punkt
        geometri_type = "punkt"
        geometri_json = json.dumps({"type": "Point", "coordinates": [15.0, 68.0]})
        fylke_tags = []

    return Varsel(
        dedup_id=dedup_id,
        kilde="nve_snoskred",
        kilde_kategori="snøskred",
        kilde_alvorsetikett=str(faregrad),
        geometri_type=geometri_type,
        geometri_json=geometri_json,
        fylke_tags=fylke_tags,
        tittel=f"Snøskredvarsel — {region_navn}",
        beskrivelse=item.get("MainText"),
        utstedt=item.get("PublishTime"),
        gyldig_til=item.get("ValidTo"),
        lenke=f"https://varsom.no/snoskredvarsling/varsel/{region_id}/{dato}/",
        raw_json=json.dumps({k: v for k, v in item.items() if k != "AvalancheProblems"}),
        first_seen="",
        last_seen="",
    )
