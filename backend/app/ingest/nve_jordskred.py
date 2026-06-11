"""NVE Jordskredvarsling — identisk struktur som flomvarsling."""

import hashlib
import json
import logging

from ..models import Varsel
from .base import BaseIngestor
from .nve_base import hent_nve_feed, resolve_fylke_tags, resolve_geometry

logger = logging.getLogger(__name__)

BASE_URL = "https://api01.nve.no/hydrology/forecast/landslide/v1.0.10/api"


class NveJordskredIngestor(BaseIngestor):
    kilde_navn = "nve_jordskred"

    async def hent_varsler(self) -> list[Varsel]:
        data = await hent_nve_feed(BASE_URL)
        return [v for item in data if (v := _parse(item)) is not None]


def _parse(item: dict) -> Varsel | None:
    warning_id = str(item.get("Id", ""))
    if not warning_id:
        return None

    aktivitet = int(item.get("ActivityLevel", 0))

    dedup_id = hashlib.sha256(f"nve_jordskred:{warning_id}".encode()).hexdigest()[:32]
    fylke_tags = resolve_fylke_tags(item)
    geom, geom_type = resolve_geometry(item, fylke_tags)

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
        status="aktiv" if aktivitet > 0 else "utlopt",
        lenke="https://www.varsom.no/",
        raw_json=json.dumps(item),
        first_seen="",
        last_seen="",
    )
