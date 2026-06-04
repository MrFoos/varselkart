"""
Avinor flydata ingestor.
Henter forsinkelser og kanselleringer per flyplass via XML feed.
Prøver services.avinor.no uten nøkkel; bruker AVINOR_API_KEY om satt.
"""

import hashlib
import json
import logging
from typing import Optional

import httpx
from lxml import etree

from ..config import settings
from ..geo.fylke_lookup import get_fylke_lookup
from ..models import Varsel
from .base import BaseIngestor

logger = logging.getLogger(__name__)

FEED_BASE = "https://services.avinor.no/XmlFeed/v1.0"

# Alle Avinor-flyplasser med regulær rutetrafikk (ICAO/IATA-koder)
FLYPLASSER = [
    ("OSL", "Oslo Gardermoen", 11.1004, 60.1939, "akershus"),
    ("BGO", "Bergen Flesland", 5.2181, 60.2934, "vestland"),
    ("TRD", "Trondheim Værnes", 10.9260, 63.4578, "trondelag"),
    ("SVG", "Stavanger Sola", 5.6378, 58.8768, "rogaland"),
    ("TOS", "Tromsø", 18.9189, 69.6833, "troms"),
    ("BOO", "Bodø", 14.3653, 67.2692, "nordland"),
    ("KRS", "Kristiansand Kjevik", 8.0853, 58.2042, "agder"),
    ("AES", "Ålesund Vigra", 6.1197, 62.5602, "more-og-romsdal"),
    ("ALF", "Alta", 23.3608, 69.9760, "finnmark"),
    ("EVE", "Harstad/Narvik Evenes", 16.6781, 68.4913, "nordland"),
    ("HAU", "Haugesund Karmøy", 5.2086, 59.3453, "rogaland"),
    ("MOL", "Molde", 7.2625, 62.7447, "more-og-romsdal"),
    ("KSU", "Kristiansund Kvernberget", 7.8247, 63.1118, "more-og-romsdal"),
    ("LKL", "Lakselv Banak", 24.9737, 70.0688, "finnmark"),
    ("LYR", "Longyearbyen Svalbard", 15.4656, 78.2461, "troms"),
    ("SDN", "Sandane", 6.1058, 61.8300, "vestland"),
    ("SOG", "Sogndal", 7.1378, 61.1561, "vestland"),
    ("FRO", "Florø", 5.0247, 61.5836, "vestland"),
    ("OSY", "Namsos", 11.5786, 64.4722, "trondelag"),
    ("NTB", "Notodden", 9.2133, 59.5667, "telemark"),
    ("RRS", "Røros", 11.3422, 62.5783, "innlandet"),
    ("SKE", "Skien Geiteryggen", 9.5669, 59.1850, "telemark"),
    ("ANX", "Andøya", 16.1442, 69.2925, "nordland"),
    ("VDS", "Vardø Svartnes", 30.0483, 70.3553, "finnmark"),
    ("VAW", "Vadsø", 29.8447, 70.0653, "finnmark"),
    ("HMR", "Hamar Stafsberg", 11.0681, 60.8181, "innlandet"),
    ("BVG", "Berlevåg", 29.0342, 70.8714, "finnmark"),
    ("BJF", "Båtsfjord", 29.6939, 70.6003, "finnmark"),
    ("HAA", "Hasvik", 22.1397, 70.4867, "finnmark"),
    ("HFT", "Hammerfest", 23.6686, 70.6797, "finnmark"),
    ("MEH", "Mehamn", 27.8267, 71.0297, "finnmark"),
    ("SOJ", "Sørkjosen", 20.9594, 69.7867, "troms"),
    ("TRF", "Sandefjord Torp", 10.2586, 59.1867, "vestfold"),
    ("RYG", "Moss Rygge", 10.7856, 59.3789, "ostfold"),
    ("FBU", "Oslo Fornebu (historisk)", 10.6256, 59.8989, "akershus"),
]


class AvinorIngestor(BaseIngestor):
    kilde_navn = "avinor"

    async def hent_varsler(self) -> list[Varsel]:
        headers = {}
        if settings.avinor_api_key:
            headers["Ocp-Apim-Subscription-Key"] = settings.avinor_api_key

        varsler: list[Varsel] = []
        lookup = get_fylke_lookup()

        async with httpx.AsyncClient(timeout=30) as client:
            for iata, navn, lon, lat, fylke_slug in FLYPLASSER:
                try:
                    flyvninger = await _hent_flyplass(client, iata, headers)
                    for fly in flyvninger:
                        v = _parse_flight(fly, iata, navn, lon, lat, fylke_slug)
                        if v:
                            varsler.append(v)
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code == 401:
                        logger.warning(
                            "Avinor: 401 for %s — trenger API-nøkkel fra api2-developer.avinor.no", iata
                        )
                    else:
                        logger.warning("Avinor %s: HTTP %s", iata, exc.response.status_code)
                except Exception as exc:
                    logger.warning("Avinor %s: %s", iata, exc)

        return varsler


async def _hent_flyplass(client: httpx.AsyncClient, iata: str, headers: dict) -> list[dict]:
    url = f"{FEED_BASE}?airport={iata}&TimeFrom=0&TimeTo=6&direction=D"
    resp = await client.get(url, headers=headers)
    resp.raise_for_status()
    root = etree.fromstring(resp.content)

    flights = []
    for f in root.findall(".//flight"):
        status_el = f.find("status")
        if status_el is None:
            continue
        code = status_el.get("code", "")
        # Vis kun forsinkelser (D) og kanselleringer (C)
        if code not in ("D", "C"):
            continue
        flights.append({
            "flight_id": f.find("flight_id").text if f.find("flight_id") is not None else "",
            "schedule_time": f.find("schedule_time").text if f.find("schedule_time") is not None else "",
            "status_code": code,
            "status_time": status_el.get("time", ""),
            "airline": f.find("airline").text if f.find("airline") is not None else "",
            "airport": iata,
        })
    return flights


def _parse_flight(fly: dict, iata: str, navn: str, lon: float, lat: float, fylke_slug: str) -> Optional[Varsel]:
    flight_id = fly.get("flight_id", "")
    schedule = fly.get("schedule_time", "")
    if not flight_id or not schedule:
        return None

    dedup_id = hashlib.sha256(f"avinor:{flight_id}:{schedule}:{iata}".encode()).hexdigest()[:32]
    status_code = fly["status_code"]
    status_tekst = "Kansellert" if status_code == "C" else "Forsinket"

    geom = {"type": "Point", "coordinates": [lon, lat]}

    return Varsel(
        dedup_id=dedup_id,
        kilde="avinor",
        kilde_kategori="flyforsinkelse" if status_code == "D" else "flykanselering",
        kilde_alvorsetikett=status_code,
        geometri_type="punkt",
        geometri_json=json.dumps(geom),
        fylke_tags=[fylke_slug],
        tittel=f"{status_tekst} — {flight_id} fra {navn}",
        beskrivelse=f"Planlagt avgang: {schedule}. Status: {status_tekst}.",
        utstedt=fly.get("status_time") or schedule,
        gyldig_til=None,
        lenke=f"https://avinor.no/flyplass/{iata.lower()}/",
        raw_json=json.dumps(fly),
        first_seen="",
        last_seen="",
    )
