"""
Statens vegvesen DATEX II v3.1 ingestor.
Henter situasjoner (stengninger, ulykker, uvær på vei).
Krever DATEX_USERNAME + DATEX_PASSWORD i .env.

Compliance:
- Tittel og beskrivelse hentes fra generalPublicComment (norsk fritekst)
- Engelske DATEX-typekoder vises aldri i UI
- Kredentialer videresendes aldri til frontend
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

SITUATION_URL = (
    "https://datex-server-get-v3-1.atlas.vegvesen.no"
    "/datexapi/GetSituation/pullsnapshotdata"
)

D2_NS = "http://datex2.eu/schema/3/common"

# Brukes kun internt for logging og fallback-tittel — vises aldri som typekode i UI
KATEGORI_NORSK: dict[str, str] = {
    "Accident": "Ulykke",
    "MaintenanceWorks": "Vedlikeholdsarbeid",
    "ConstructionWorks": "Anleggsarbeid",
    "WeatherRelatedRoadConditions": "Vær og føreforhold",
    "RoadOrCarriagewayOrLaneManagement": "Vegregulering",
    "VehicleObstruction": "Kjøretøyhindring",
    "PoorEnvironmentConditions": "Dårlige miljøforhold",
    "NonWeatherRelatedRoadConditions": "Vegforhold",
    "WinterDrivingManagement": "Vinterkjøring",
    "GeneralObstruction": "Hindring på veg",
    "InfrastructureDamageObstruction": "Skade på infrastruktur",
    "GeneralInstructionOrMessageToRoadUsers": "Melding til trafikanter",
    "AbnormalTraffic": "Unormal trafikk",
    "AnimalPresenceObstruction": "Dyr i vegbanen",
    "SpeedManagement": "Fartsbegrensning",
    "RoadsideAssistance": "Veihjelp",
    "PublicEvent": "Arrangement",
    "NetworkManagement": "Nettverksforvaltning",
    "GeneralNetworkManagement": "Nettverksforvaltning",
    "ReroutingManagement": "Omkjøring",
    "ServiceDisruption": "Driftsforstyrrelse",
    "EnvironmentalObstruction": "Miljøhindring",
    "TransitInformation": "Kollektivinformasjon",
}

# If-Modified-Since: bevares mellom scheduler-kjøringer for å unngå unødige re-hentinger
_last_modified: Optional[str] = None


class VegvesenIngestor(BaseIngestor):
    kilde_navn = "vegvesen"

    async def hent_varsler(self) -> list[Varsel]:
        global _last_modified

        if not settings.datex_username:
            logger.warning("DATEX_USERNAME ikke satt — hopper over vegvesen-ingest")
            return []

        headers: dict[str, str] = {"Accept": "application/xml"}
        if _last_modified:
            headers["If-Modified-Since"] = _last_modified

        auth = (settings.datex_username, settings.datex_password)

        async with httpx.AsyncClient(timeout=45, auth=auth) as client:
            resp = await client.get(SITUATION_URL, headers=headers)

        if resp.status_code == 304:
            logger.debug("vegvesen: ingen nye data (304 Not Modified)")
            return []

        resp.raise_for_status()

        last_mod = resp.headers.get("Last-Modified")
        if last_mod:
            _last_modified = last_mod

        root = etree.fromstring(resp.content)
        lookup = get_fylke_lookup()
        varsler: list[Varsel] = []

        for situation in root.iter(f"{{{D2_NS}}}situation"):
            for record in situation.findall(".//{*}situationRecord"):
                try:
                    varsel = _parse_record(record, lookup)
                    if varsel:
                        varsler.append(varsel)
                except Exception as exc:
                    logger.warning("Feil ved parsing av DATEX-record: %s", exc)

        return varsler


def _parse_record(record, lookup) -> Optional[Varsel]:
    rec_id = record.get("id") or ""
    if not rec_id:
        return None

    # Koordinater — hopp over records uten geometri
    lat_el = record.find(".//{*}latitude")
    lon_el = record.find(".//{*}longitude")
    if lat_el is None or lon_el is None:
        return None

    try:
        lat, lon = float(lat_el.text), float(lon_el.text)
    except (TypeError, ValueError):
        return None

    # Sjekk om situasjonen er utløpt
    end_el = record.find(".//{*}overallEndTime")
    if end_el is not None and end_el.text:
        try:
            end_dt = datetime.fromisoformat(end_el.text.replace("Z", "+00:00"))
            if end_dt < datetime.now(timezone.utc):
                return None
        except ValueError:
            pass

    # Kategori (intern — brukes kun for fallback-tittel og logging)
    xsi_type = record.get("{http://www.w3.org/2001/XMLSchema-instance}type", "")
    kategori = xsi_type.split(":")[-1] if ":" in xsi_type else xsi_type

    # Alvorlighet — DATEX-skala umodifisert
    severity = record.findtext(".//{*}severity") or ""

    # Tidspunkt
    start_time = (
        record.findtext(".//{*}startOfPeriod")
        or record.findtext(".//{*}situationRecordVersionTime")
    )
    end_time = record.findtext(".//{*}endOfPeriod")

    # Norsk fritekst fra generalPublicComment
    norsk_tekst = _hent_norsk_tekst(record)

    # Tittel: norsk fritekst, aldri engelsk typekode
    tittel_base = norsk_tekst or KATEGORI_NORSK.get(kategori, "Trafikkinformasjon")
    # Klipp langt fritekst til tittel (maks 100 tegn), behold full tekst som beskrivelse
    if len(tittel_base) > 100:
        tittel = f"Vegvesen — {tittel_base[:97]}…"
    else:
        tittel = f"Vegvesen — {tittel_base}"

    beskrivelse = norsk_tekst if norsk_tekst and len(norsk_tekst) > 100 else None

    geom = {"type": "Point", "coordinates": [lon, lat]}
    fylke_tags = lookup.punkt_til_fylker(lon, lat)

    dedup_id = hashlib.sha256(f"vegvesen:{rec_id}".encode()).hexdigest()[:32]

    return Varsel(
        dedup_id=dedup_id,
        kilde="vegvesen",
        kilde_kategori=kategori,
        kilde_alvorsetikett=severity,
        geometri_type="punkt",
        geometri_json=json.dumps(geom),
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


def _hent_norsk_tekst(record) -> Optional[str]:
    """Returnerer norsk fritekst fra generalPublicComment, foretrekker lang=no/nb/nn."""
    verdier = record.findall(
        ".//{*}generalPublicComment/{*}comment/{*}values/{*}value"
    )
    for el in verdier:
        if el.get("lang", "no") in ("no", "nb", "nn", ""):
            text = el.text
            return text.strip() if text else None
    # Fallback: første value uavhengig av språk
    if verdier:
        text = verdier[0].text
        return text.strip() if text else None
    return None
