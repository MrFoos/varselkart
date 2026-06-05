"""
NVE Snøskredvarsling ingestor (API v6.3.0).
Henter RegionSummary og matcher mot regionspolygoner.
Polygonformat fra API: liste med én streng "lat,lon lat,lon ..."
"""

import hashlib
import json
import logging
from datetime import datetime, timezone

import httpx

from ..geo.fylke_lookup import get_fylke_lookup
from ..models import Varsel
from .base import BaseIngestor

logger = logging.getLogger(__name__)

# v6.3.0 er versjon med fungerende swagger og korrekte paths
BASE_URL = "https://api01.nve.no/hydrology/forecast/avalanche/v6.3.0/api"

# RegionTypeId=10 er TypeName="A" (hovednivå for Norge)
REGION_TYPE_A = 10

_region_cache: dict[int, dict] | None = None


class NveSnoskredIngestor(BaseIngestor):
    kilde_navn = "nve_snoskred"

    async def hent_varsler(self) -> list[Varsel]:
        nå = datetime.now(timezone.utc)
        dato = nå.strftime("%Y-%m-%d")

        async with httpx.AsyncClient(timeout=30) as client:
            regioner = await _hent_regioner(client)
            summary_url = f"{BASE_URL}/RegionSummary/Simple/1/{dato}/{dato}"
            resp = await client.get(summary_url, headers={"Accept": "application/json"})
            resp.raise_for_status()
            summaries = resp.json()

        lookup = get_fylke_lookup()
        varsler: list[Varsel] = []

        for region_data in summaries:
            region_id = region_data.get("Id")
            warnings = region_data.get("AvalancheWarningList", [])
            if not warnings:
                continue

            # Bruk første varsling (dagens)
            w = warnings[0]
            faregrad_str = str(w.get("DangerLevel", "0"))
            try:
                faregrad = int(faregrad_str)
            except ValueError:
                faregrad = 0

            if faregrad < 2:
                continue

            region_navn = region_data.get("Name", f"Region {region_id}")
            geom = regioner.get(region_id)

            if geom:
                geometri_json = json.dumps(geom)
                geometri_type = "polygon"
                fylke_tags = lookup.geometri_til_fylker(geom)
            else:
                geometri_json = json.dumps({"type": "Point", "coordinates": [15.0, 68.0]})
                geometri_type = "punkt"
                fylke_tags = []

            dedup_id = hashlib.sha256(
                f"nve_snoskred:{region_id}:{w.get('ValidFrom', dato)[:10]}".encode()
            ).hexdigest()[:32]

            varsler.append(Varsel(
                dedup_id=dedup_id,
                kilde="nve_snoskred",
                kilde_kategori="snøskred",
                kilde_alvorsetikett=faregrad_str,
                geometri_type=geometri_type,
                geometri_json=geometri_json,
                fylke_tags=fylke_tags,
                tittel=f"Snøskredvarsel — {region_navn}",
                beskrivelse=w.get("MainText"),
                utstedt=w.get("PublishTime"),
                gyldig_til=w.get("ValidTo"),
                lenke=f"https://varsom.no/snoskredvarsling/varsel/{region_id}/{dato}/",
                raw_json=None,
                first_seen="",
                last_seen="",
            ))

        return varsler


async def _hent_regioner(client: httpx.AsyncClient) -> dict[int, dict]:
    global _region_cache
    if _region_cache is not None:
        return _region_cache

    resp = await client.get(
        f"{BASE_URL}/Region/{REGION_TYPE_A}",
        headers={"Accept": "application/json"},
    )
    resp.raise_for_status()
    data = resp.json()

    _region_cache = {}
    for r in data:
        rid = r.get("Id")
        polygon_list = r.get("Polygon", [])
        if not polygon_list:
            continue
        polygon_str = polygon_list[0] if isinstance(polygon_list, list) else polygon_list
        coords = _polygon_str_til_coords(polygon_str)
        if coords:
            _region_cache[rid] = {"type": "Polygon", "coordinates": [coords]}

    logger.info("nve_snoskred: lastet %d regionspolygoner", len(_region_cache))
    return _region_cache


def _polygon_str_til_coords(text: str) -> list[list[float]]:
    """Konverterer 'lat,lon lat,lon ...' til GeoJSON [[lon, lat], ...]"""
    coords = []
    for pair in text.strip().split():
        parts = pair.split(",")
        if len(parts) >= 2:
            lat, lon = float(parts[0]), float(parts[1])
            coords.append([lon, lat])
    if coords and coords[0] != coords[-1]:
        coords.append(coords[0])
    return coords
