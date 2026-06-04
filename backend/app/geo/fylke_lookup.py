"""
Romlig oppslag fra punkt/polygon til fylke-slugs.
Laster fylker-2024.geojson (WGS84) og bygger en STRtree for effektiv interseksjon.
"""

import json
from pathlib import Path
from typing import Optional

from shapely.geometry import shape, Point, mapping
from shapely.strtree import STRtree


# 15 fylker per 2024-inndelingen
FYLKE_SLUGS: dict[str, str] = {
    "03": "oslo",
    "31": "ostfold",
    "32": "akershus",
    "33": "buskerud",
    "34": "innlandet",
    "39": "vestfold",   # GeoNorge bruker 39, ikke 38
    "40": "telemark",
    "42": "agder",
    "11": "rogaland",
    "46": "vestland",
    "15": "more-og-romsdal",
    "50": "trondelag",
    "18": "nordland",
    "55": "troms",
    "56": "finnmark",
}

DATA_PATH = Path(__file__).parent.parent.parent / "data" / "fylker-2024.geojson"


class FylkeLookup:
    def __init__(self, geojson_path: Path = DATA_PATH) -> None:
        with open(geojson_path, encoding="utf-8") as f:
            fc = json.load(f)

        self._geometries: list = []
        self._slugs: list[str] = []

        for feat in fc["features"]:
            props = feat.get("properties", {})
            # GeoNorge bruker "fylkesnummer" eller "kommunenummer" — prøv begge
            nr = str(props.get("fylkesnummer") or props.get("FYLKESNR") or "").zfill(2)
            slug = FYLKE_SLUGS.get(nr)
            if slug is None:
                # Fallback: prøv navn-matching
                navn = str(props.get("navn") or props.get("NAVN") or "").lower()
                slug = _navn_til_slug(navn)
            if slug:
                geom = shape(feat["geometry"])
                self._geometries.append(geom)
                self._slugs.append(slug)

        self._tree = STRtree(self._geometries)

    def punkt_til_fylker(self, lon: float, lat: float) -> list[str]:
        pt = Point(lon, lat)
        kandidater = self._tree.query(pt)
        return [
            self._slugs[i]
            for i in kandidater
            if self._geometries[i].contains(pt)
        ]

    def geometri_til_fylker(self, geojson_geometry: dict) -> list[str]:
        """Returnerer alle fylker som overlapper med gitt GeoJSON-geometri."""
        geom = shape(geojson_geometry)
        kandidater = self._tree.query(geom)
        treff: list[str] = []
        for i in kandidater:
            if self._geometries[i].intersects(geom):
                slug = self._slugs[i]
                if slug not in treff:
                    treff.append(slug)
        return treff


def _navn_til_slug(navn: str) -> Optional[str]:
    mapping_tabell = {
        "oslo": "oslo",
        "østfold": "ostfold",
        "akershus": "akershus",
        "buskerud": "buskerud",
        "innlandet": "innlandet",
        "vestfold": "vestfold",
        "telemark": "telemark",
        "agder": "agder",
        "rogaland": "rogaland",
        "vestland": "vestland",
        "møre og romsdal": "more-og-romsdal",
        "trøndelag": "trondelag",
        "nordland": "nordland",
        "troms": "troms",
        "finnmark": "finnmark",
    }
    return mapping_tabell.get(navn)
