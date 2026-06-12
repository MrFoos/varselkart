"""
MET MetAlerts ingestor.
Henter aktive farevarsler fra RSS-feed. Geometri er inline som georss:polygon —
ingen ekstra CAP-forespørsler nødvendig.
"""

import hashlib
import json
import logging
from email.utils import parsedate_to_datetime
from typing import Optional

import httpx
from lxml import etree

from ..config import settings
from ..geo.fylke_lookup import get_fylke_lookup
from ..models import Varsel
from .base import BaseIngestor

logger = logging.getLogger(__name__)

FEED_URL = "https://api.met.no/weatherapi/metalerts/2.0/current?geographicDomain=land&lang=no"
GEORSS_NS = "http://www.georss.org/georss"

# Kildens egne alvors-tekster (fra title-feltet i RSS)
ALVOR_FARGER = {
    "gult nivå": "gul",
    "oransje nivå": "oransje",
    "rødt nivå": "rød",
}


class MetIngestor(BaseIngestor):
    kilde_navn = "met"

    def __init__(self) -> None:
        self._last_modified: Optional[str] = None

    async def hent_varsler(self) -> list[Varsel] | None:
        headers = {"User-Agent": settings.met_user_agent}
        if self._last_modified:
            headers["If-Modified-Since"] = self._last_modified

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(FEED_URL, headers=headers)

        if resp.status_code == 304:
            logger.debug("met: ingen nye data (304 Not Modified)")
            return None

        resp.raise_for_status()

        last_mod = resp.headers.get("Last-Modified")
        if last_mod:
            self._last_modified = last_mod

        root = etree.fromstring(resp.content)
        lookup = get_fylke_lookup()
        varsler: list[Varsel] = []

        for item in root.findall(".//item"):
            try:
                varsel = _parse_item(item, lookup)
                if varsel:
                    varsler.append(varsel)
            except Exception as exc:
                logger.warning("Feil ved parsing av MET-varsel: %s", exc)

        return varsler


def _parse_item(item, lookup) -> Optional[Varsel]:
    guid = item.findtext("guid") or ""
    if not guid:
        return None

    dedup_id = hashlib.sha256(f"met:{guid}".encode()).hexdigest()[:32]

    # Title-format: "Event, nivå, Område, gyldig_fra, gyldig_til"
    title = item.findtext("title") or ""
    parts = [p.strip() for p in title.split(",")]

    event_navn = parts[0] if parts else ""
    alvor_raw = parts[1] if len(parts) > 1 else ""
    area_navn = parts[2] if len(parts) > 2 else ""
    gyldig_fra_str = parts[3] if len(parts) > 3 else None
    gyldig_til_str = parts[4] if len(parts) > 4 else None

    # Bevar kildens alvors-tekst umodifisert ("gult nivå", "oransje nivå", "rødt nivå")
    kilde_alvorsetikett = alvor_raw

    beskrivelse = item.findtext("description") or ""
    # Strip "Alert: " prefix som MET legger på
    if beskrivelse.startswith("Alert: "):
        beskrivelse = beskrivelse[7:]

    pub_date_str = item.findtext("pubDate") or ""
    utstedt = _rss_date_to_iso(pub_date_str)

    # Geometri — georss:polygon er "lat lon lat lon ..."
    polygon_el = item.find(f"{{{GEORSS_NS}}}polygon")
    fylke_tags: list[str] = []

    coords = _georss_polygon_to_coords(polygon_el.text) if (polygon_el is not None and polygon_el.text) else []
    if coords:
        geom = {"type": "Polygon", "coordinates": [coords]}
        geometri_json = json.dumps(geom)
        geometri_type = "polygon"
        fylke_tags = lookup.geometri_til_fylker(geom)
    else:
        logger.warning("met: varsel %s mangler gyldig geometri — bruker fallback-punkt", guid)
        geom = {"type": "Point", "coordinates": [15.0, 65.0]}
        geometri_json = json.dumps(geom)
        geometri_type = "punkt"

    tittel = f"{event_navn} — {area_navn}" if area_navn else event_navn

    return Varsel(
        dedup_id=dedup_id,
        kilde="met",
        kilde_kategori=event_navn,
        kilde_alvorsetikett=kilde_alvorsetikett,
        geometri_type=geometri_type,
        geometri_json=geometri_json,
        fylke_tags=fylke_tags,
        tittel=tittel,
        beskrivelse=beskrivelse.strip()[:800] if beskrivelse else None,
        utstedt=utstedt,
        gyldig_til=_iso_strip(gyldig_til_str),
        lenke="",
        raw_json=None,
        first_seen="",
        last_seen="",
    )


def _georss_polygon_to_coords(text: str) -> list[list[float]]:
    """GeoRSS polygon er 'lat lon lat lon ...' — GeoJSON vil ha [lon, lat]."""
    tokens = text.strip().split()
    coords = []
    for i in range(0, len(tokens) - 1, 2):
        try:
            lat, lon = float(tokens[i]), float(tokens[i + 1])
        except ValueError:
            logger.warning("met: ugyldig koordinatpar '%s %s' hoppet over", tokens[i], tokens[i + 1])
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            logger.warning("met: koordinat utenfor gyldig område (%s, %s) hoppet over", lat, lon)
            continue
        coords.append([lon, lat])
    if coords and coords[0] != coords[-1]:
        coords.append(coords[0])
    # Et gyldig polygon trenger minst 3 unike punkter + lukkepunkt
    return coords if len(coords) >= 4 else []


def _rss_date_to_iso(rss_date: str) -> Optional[str]:
    if not rss_date:
        return None
    try:
        dt = parsedate_to_datetime(rss_date)
        return dt.isoformat(timespec="seconds").replace("+00:00", "Z")
    except Exception:
        return rss_date


def _iso_strip(ts: Optional[str]) -> Optional[str]:
    """Normaliserer ISO8601-streng til UTC Z-format."""
    if not ts:
        return None
    return ts.replace("+00:00", "Z").strip()
