"""
MET MetAlerts ingestor.
Henter aktive farevarsler fra api.met.no i CAP XML-format.
Returnerer polygon-geometri fra kilden direkte (ikke aggregert til fylke).
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from lxml import etree

from ..config import settings
from ..geo.fylke_lookup import get_fylke_lookup
from ..models import Varsel
from .base import BaseIngestor

logger = logging.getLogger(__name__)

CAP_NS = "urn:oasis:names:tc:emergency:cap:1.2"
FEED_URL = "https://api.met.no/weatherapi/metalerts/2.0/current?geographicDomain=land&lang=no"

# Kildens alvorsetiketter — brukes umodifisert
AWARENESS_LEVEL_MAP = {
    "2; yellow; Moderate": "gul",
    "3; orange; Severe": "oransje",
    "4; red; Extreme": "rød",
}


class MetIngestor(BaseIngestor):
    kilde_navn = "met"

    async def hent_varsler(self) -> list[Varsel]:
        headers = {"User-Agent": settings.met_user_agent}

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(FEED_URL, headers=headers)
            resp.raise_for_status()

        root = etree.fromstring(resp.content)
        varsler: list[Varsel] = []
        lookup = get_fylke_lookup()

        # RSS-innpakking: hvert <item> er en CAP-peker; vi henter selve CAP
        # Fra /current.rss → parse CAP-link per item
        # Merk: /current returnerer RSS med lenker til individuelle CAP-dokumenter
        # Vi parser RSS og henter CAP per varsel for å få geometri
        items = root.findall(".//item")
        if not items:
            # Prøv direkte CAP-feed
            items = root.findall(f".//{{{CAP_NS}}}alert")

        async with httpx.AsyncClient(timeout=30) as client:
            for item in items:
                try:
                    varsel = await _parse_item(item, client, headers, lookup)
                    if varsel:
                        varsler.append(varsel)
                except Exception as exc:
                    logger.warning("Feil ved parsing av MET-varsel: %s", exc)

        return varsler


async def _parse_item(item, client: httpx.AsyncClient, headers: dict, lookup) -> Optional[Varsel]:
    # Hent CAP-URL fra RSS-item
    link_el = item.find("link")
    if link_el is None or not link_el.text:
        return None

    cap_url = link_el.text.strip()
    resp = await client.get(cap_url, headers=headers)
    resp.raise_for_status()

    cap = etree.fromstring(resp.content)
    ns = CAP_NS

    identifier = cap.findtext(f"{{{ns}}}identifier") or ""
    dedup_id = hashlib.sha256(f"met:{identifier}".encode()).hexdigest()[:32]

    sent = cap.findtext(f"{{{ns}}}sent")
    status_cap = cap.findtext(f"{{{ns}}}status")
    if status_cap == "Test":
        return None

    info = cap.find(f"{{{ns}}}info")
    if info is None:
        return None

    event = info.findtext(f"{{{ns}}}event") or ""
    headline = info.findtext(f"{{{ns}}}headline") or ""
    description = info.findtext(f"{{{ns}}}description") or ""
    onset = info.findtext(f"{{{ns}}}onset")
    expires = info.findtext(f"{{{ns}}}expires")
    web = info.findtext(f"{{{ns}}}web")

    # Hent awareness_level fra <parameter>
    awareness_raw = ""
    for param in info.findall(f"{{{ns}}}parameter"):
        vname = param.findtext(f"{{{ns}}}valueName") or ""
        if vname == "awareness_level":
            awareness_raw = param.findtext(f"{{{ns}}}value") or ""
            break

    alvorsetikett = AWARENESS_LEVEL_MAP.get(awareness_raw, awareness_raw)

    # Geometri: polygon fra <area>
    area = info.find(f"{{{ns}}}area")
    geometri_json: Optional[str] = None
    geometri_type = "polygon"
    fylke_tags: list[str] = []

    if area is not None:
        polygon_text = area.findtext(f"{{{ns}}}polygon")
        if polygon_text:
            coords = _cap_polygon_to_geojson_coords(polygon_text)
            geom = {"type": "Polygon", "coordinates": [coords]}
            geometri_json = json.dumps(geom)
            fylke_tags = lookup.geometri_til_fylker(geom)

    if geometri_json is None:
        geometri_json = json.dumps({"type": "Point", "coordinates": [10.0, 59.9]})
        geometri_type = "punkt"

    return Varsel(
        dedup_id=dedup_id,
        kilde="met",
        kilde_kategori=event,
        kilde_alvorsetikett=alvorsetikett,
        geometri_type=geometri_type,
        geometri_json=geometri_json,
        fylke_tags=fylke_tags,
        tittel=headline,
        beskrivelse=description[:1000] if description else None,
        utstedt=_iso_to_utc(sent),
        gyldig_til=_iso_to_utc(expires),
        lenke=web or cap_url,
        raw_json=None,  # Ikke lagre rå CAP i prod (stor)
        first_seen="",  # Settes av BaseIngestor
        last_seen="",
    )


def _cap_polygon_to_geojson_coords(polygon_text: str) -> list[list[float]]:
    """CAP-polygon er 'lat,lon lat,lon ...' — GeoJSON vil ha [lon, lat]."""
    coords = []
    for pair in polygon_text.strip().split():
        parts = pair.split(",")
        if len(parts) >= 2:
            lat, lon = float(parts[0]), float(parts[1])
            coords.append([lon, lat])
    # Lukk polygon
    if coords and coords[0] != coords[-1]:
        coords.append(coords[0])
    return coords


def _iso_to_utc(ts: Optional[str]) -> Optional[str]:
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except Exception:
        return ts
