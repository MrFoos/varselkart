"""Delte hjelpefunksjoner for NVE varslings-APIer."""
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

import httpx

from ..geo.fylke_lookup import FYLKE_SLUGS, get_fylke_lookup
from ..models import Varsel

logger = logging.getLogger(__name__)

_OSLO = ZoneInfo("Europe/Oslo")


def nve_tid_til_utc(ts: str | None) -> str | None:
    """Normaliserer NVE-tider til UTC Z.

    NVE returnerer ValidFrom/ValidTo/PublishTime uten tidssone (f.eks.
    '2026-06-14T06:59:59') men mener norsk lokaltid — samme respons har
    CreatedTime med +02:00. Uten dette tolker frontend (new Date) naive
    strenger som nettleserens lokaltid, som forskyver tidene for besøkende
    utenfor Norge.
    """
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts)
    except ValueError:
        return ts  # defensivt: la ukjent format stå
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_OSLO)
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


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
    logger.warning("Varsel uten geometri og fylkestilknytning — bruker fallback-punkt (id=%s)", item.get("Id"))
    return {"type": "Point", "coordinates": [10.0, 61.0]}, "punkt"


def parse_nve_warning(item: dict, *, kilde: str, kategori: str, tittel_prefiks: str) -> Varsel | None:
    """Felles parser for NVE flom- og jordskredvarsler (identisk feedstruktur)."""
    warning_id = str(item.get("Id", ""))
    if not warning_id:
        return None

    try:
        aktivitet = int(item.get("ActivityLevel") or 0)
    except (TypeError, ValueError):
        aktivitet = 0

    dedup_id = hashlib.sha256(f"{kilde}:{warning_id}".encode()).hexdigest()[:32]
    fylke_tags = resolve_fylke_tags(item)
    if not fylke_tags:
        logger.warning("%s: varsel %s mangler fylkestilknytning og vises ikke i fylkesfilter", kilde, warning_id)
    geom, geom_type = resolve_geometry(item, fylke_tags)

    omrade = item.get("Area") or item.get("MunicipalityName") or item.get("CountyName") or ""

    return Varsel(
        dedup_id=dedup_id,
        kilde=kilde,
        kilde_kategori=kategori,
        kilde_alvorsetikett=str(aktivitet),  # Bevar kildens skala (0–4) umodifisert
        geometri_type=geom_type,
        geometri_json=json.dumps(geom),
        fylke_tags=fylke_tags,
        tittel=f"{tittel_prefiks} — {omrade}",
        beskrivelse=item.get("MainText") or item.get("ActivityText"),
        utstedt=nve_tid_til_utc(item.get("PublishTime") or item.get("validFrom")),
        gyldig_til=nve_tid_til_utc(item.get("ValidTo") or item.get("validTo")),
        status="aktiv" if aktivitet > 0 else "utlopt",
        lenke="https://www.varsom.no/",
        raw_json=json.dumps(item),
        first_seen="",
        last_seen="",
    )


async def hent_nve_feed(base_url: str) -> list[dict]:
    nå = datetime.now(timezone.utc)
    start = nå.strftime("%Y-%m-%d")
    slutt = (nå + timedelta(days=2)).strftime("%Y-%m-%d")
    url = f"{base_url}/Warning/1/{start}/{slutt}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers={"Accept": "application/json"})
        resp.raise_for_status()
        return resp.json()
