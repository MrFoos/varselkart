"""
NVE Flomvarsling ingestor.
Henter varsler per fylke/kommune. Aktivitetsnivå 0–4 umodifisert fra kilden.
"""

import logging

from ..models import Varsel
from .base import BaseIngestor
from .nve_base import hent_nve_feed, parse_nve_warning

logger = logging.getLogger(__name__)

BASE_URL = "https://api01.nve.no/hydrology/forecast/flood/v1.0.10/api"


class NveFlomIngestor(BaseIngestor):
    kilde_navn = "nve_flom"

    async def hent_varsler(self) -> list[Varsel]:
        data = await hent_nve_feed(BASE_URL)
        return [
            v for item in data
            if (v := parse_nve_warning(item, kilde="nve_flom", kategori="flom", tittel_prefiks="Flomvarsel")) is not None
        ]
