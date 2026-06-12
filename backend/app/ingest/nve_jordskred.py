"""NVE Jordskredvarsling — identisk struktur som flomvarsling."""

import logging

from ..models import Varsel
from .base import BaseIngestor
from .nve_base import hent_nve_feed, parse_nve_warning

logger = logging.getLogger(__name__)

BASE_URL = "https://api01.nve.no/hydrology/forecast/landslide/v1.0.10/api"


class NveJordskredIngestor(BaseIngestor):
    kilde_navn = "nve_jordskred"

    async def hent_varsler(self) -> list[Varsel]:
        data = await hent_nve_feed(BASE_URL)
        return [
            v for item in data
            if (v := parse_nve_warning(item, kilde="nve_jordskred", kategori="jordskred", tittel_prefiks="Jordskredvarsel")) is not None
        ]
