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

D2_NS = "http://datex2.eu/schema/3/situation"

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

class VegvesenIngestor(BaseIngestor):
    kilde_navn = "vegvesen"

    def __init__(self) -> None:
        self._last_modified: Optional[str] = None

    async def hent_varsler(self) -> list[Varsel] | None:
        if not settings.datex_username:
            logger.warning("DATEX_USERNAME ikke satt — hopper over vegvesen-ingest")
            return []

        # Serveren returnerer text/xml — accept application/xml gir 406
        headers: dict[str, str] = {}
        if self._last_modified:
            headers["If-Modified-Since"] = self._last_modified

        auth = (settings.datex_username, settings.datex_password.get_secret_value())

        async with httpx.AsyncClient(timeout=45, auth=auth) as client:
            resp = await client.get(SITUATION_URL, headers=headers)

        if resp.status_code == 304:
            logger.debug("vegvesen: ingen nye data (304 Not Modified)")
            return None

        resp.raise_for_status()

        last_mod = resp.headers.get("Last-Modified")
        if last_mod:
            self._last_modified = last_mod

        root = etree.fromstring(resp.content)
        lookup = get_fylke_lookup()
        varsler: list[Varsel] = []

        for situation in root.iter(f"{{{D2_NS}}}situation"):
            situation_id = situation.get("id") or None
            for record in situation.findall(".//{*}situationRecord"):
                try:
                    varsel = _parse_record(record, lookup, situation_id)
                    if varsel:
                        varsler.append(varsel)
                except Exception as exc:
                    logger.warning("Feil ved parsing av DATEX-record: %s", exc)

        return varsler


def _parse_record(record, lookup, situation_id: Optional[str] = None) -> Optional[Varsel]:
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

    # Sjekk om situasjonen er utløpt; ta vare på tidspunktet som gyldig_til
    end_el = record.find(".//{*}overallEndTime")
    overall_end_time = None
    if end_el is not None and end_el.text:
        try:
            end_dt = datetime.fromisoformat(end_el.text.replace("Z", "+00:00"))
            if end_dt < datetime.now(timezone.utc):
                return None
            overall_end_time = end_el.text
        except ValueError:
            pass

    # Kategori (intern — brukes kun for fallback-tittel og logging)
    xsi_type = record.get("{http://www.w3.org/2001/XMLSchema-instance}type", "")
    kategori = xsi_type.split(":")[-1] if ":" in xsi_type else xsi_type

    # Alvorlighet — DATEX-skala umodifisert
    severity = record.findtext(".//{*}severity") or ""

    # Publiseringstid (når varselet ble utstedt/oppdatert)
    publish_time = record.findtext(".//{*}situationRecordVersionTime")

    # Faktisk starttid for situasjonen (kan ligge frem i tid for planlagte arbeider)
    start_tid = record.findtext(".//{*}overallStartTime")

    # Validitetsstatus fra SVV (active / suspended / definedByValidityTimeSpec)
    validity_status = record.findtext(".//{*}validityStatus")

    # Periodiske tids-vinduer (f.eks. natt-arbeid 22:00–06:00 ti/on)
    perioder_json = _hent_perioder(record)

    # Norsk fritekst fra generalPublicComment
    norsk_tekst = _hent_norsk_tekst(record)

    kategori_norsk = KATEGORI_NORSK.get(kategori, "Trafikkinformasjon")
    tittel = kategori_norsk
    beskrivelse = norsk_tekst or None

    road_number = record.findtext(".//{*}roadNumber") or ""
    road_name = record.findtext(".//{*}roadName") or ""
    if road_number and road_name:
        omrade = f"{road_number} {road_name}"
    elif road_number:
        omrade = road_number
    elif road_name:
        omrade = road_name
    else:
        omrade = None

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
        utstedt=publish_time,
        gyldig_til=overall_end_time,
        start_tid=start_tid,
        validity_status=validity_status,
        perioder_json=perioder_json,
        omrade=omrade,
        situation_id=situation_id,
        lenke="https://www.vegvesen.no/trafikkinformasjon/",
        raw_json=None,
        first_seen="",
        last_seen="",
    )


def _hent_perioder(record) -> Optional[str]:
    """Returnerer JSON-streng med periodiske tids-vinduer, f.eks. natt-arbeid 22:00–06:00."""
    perioder = []
    # Iterer per validPeriod-blokk for å holde tidsvindu og dager sammen
    for valid_period in record.findall(".//{*}validPeriod"):
        time_el = valid_period.find(".//{*}recurringTimePeriodOfDay")
        if time_el is None:
            continue
        start = time_el.findtext(".//{*}startTimeOfPeriod")
        end = time_el.findtext(".//{*}endTimeOfPeriod")
        if not start or not end:
            continue
        start_hm = start[:5] if len(start) >= 5 else start
        end_hm = end[:5] if len(end) >= 5 else end

        dager: list[str] = []
        for dag_el in valid_period.findall(".//{*}applicableDay"):
            if dag_el.text:
                dag = dag_el.text.strip()
                if dag not in dager:
                    dager.append(dag)

        perioder.append({"start": start_hm, "end": end_hm, "dager": dager})

    if not perioder:
        return None
    return json.dumps(perioder, ensure_ascii=False)


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
