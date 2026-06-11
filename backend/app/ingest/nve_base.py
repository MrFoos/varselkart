"""Delte hjelpefunksjoner for NVE varslings-APIer."""
from datetime import datetime, timezone, timedelta

import httpx

from ..geo.fylke_lookup import FYLKE_SLUGS, get_fylke_lookup


def resolve_fylke_tags(item: dict) -> list[str]:
    county_list = item.get("CountyList") or []
    fylke_tags: list[str] = []
    for county in county_list:
        county_id = str(county.get("Id", "")).zfill(2)
        slug = FYLKE_SLUGS.get(county_id)
        if slug and slug not in fylke_tags:
            fylke_tags.append(slug)
    if not fylke_tags:
        fylke_nr = str(item.get("CountyId", "")).zfill(2)
        slug = FYLKE_SLUGS.get(fylke_nr)
        if slug:
            fylke_tags = [slug]
    return fylke_tags


def resolve_geometry(item: dict, fylke_tags: list[str]) -> tuple[dict, str]:
    lat = item.get("Lat") or item.get("latitude")
    lon = item.get("Lon") or item.get("longitude")
    if lat is not None and lon is not None:
        return {"type": "Point", "coordinates": [float(lon), float(lat)]}, "punkt"
    if fylke_tags:
        fylke_geom = get_fylke_lookup().hent_polygon(fylke_tags[0])
        if fylke_geom:
            return fylke_geom, "polygon"
    return {"type": "Point", "coordinates": [10.0, 61.0]}, "punkt"


async def hent_nve_feed(base_url: str) -> list[dict]:
    nå = datetime.now(timezone.utc)
    start = nå.strftime("%Y-%m-%d")
    slutt = (nå + timedelta(days=2)).strftime("%Y-%m-%d")
    url = f"{base_url}/Warning/1/{start}/{slutt}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers={"Accept": "application/json"})
        resp.raise_for_status()
        return resp.json()
