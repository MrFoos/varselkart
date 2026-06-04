#!/usr/bin/env python3
"""
Laster ned fylkespolygoner fra GeoNorge og konverterer fra EPSG:25833 til WGS84.
Kjøres én gang: python scripts/hent_fylker.py
Output: backend/data/fylker-2024.geojson
"""

import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

from pyproj import Transformer

GEONORGE_URL = (
    "https://nedlasting.geonorge.no/geonorge/Basisdata/Fylker/GEOJSON/"
    "Basisdata_0000_Norge_25833_Fylker_GEOJSON.zip"
)

OUTPUT = Path(__file__).parent.parent / "data" / "fylker-2024.geojson"

# EPSG:25833 (UTM 33N) → EPSG:4326 (WGS84)
transformer = Transformer.from_crs("EPSG:25833", "EPSG:4326", always_xy=True)


def konverter_koordinater(coords: list, dimensjon: int = 2) -> list:
    """Rekursiv konvertering av koordinatlister."""
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        # Enkelt koordinatpar
        lon, lat = transformer.transform(coords[0], coords[1])
        return [round(lon, 7), round(lat, 7)]
    return [konverter_koordinater(c, dimensjon) for c in coords]


def konverter_geometri(geom: dict) -> dict:
    return {**geom, "coordinates": konverter_koordinater(geom["coordinates"])}


def main():
    print(f"Laster ned fylkespolygoner fra GeoNorge...")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    with urllib.request.urlopen(GEONORGE_URL) as response:
        data = response.read()

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        # Finn GeoJSON-fil i zip
        geojson_navn = [n for n in zf.namelist() if n.endswith(".geojson") or n.endswith(".json")]
        if not geojson_navn:
            print("Fant ingen GeoJSON-filer i zip:", zf.namelist())
            sys.exit(1)

        with zf.open(geojson_navn[0]) as f:
            raw = json.load(f)

    # GeoNorge pakker FeatureCollection i et navngitt objekt, f.eks. {"Fylke": {...}}
    if "features" not in raw:
        fc = next(iter(raw.values()))
    else:
        fc = raw

    print(f"Konverterer {len(fc['features'])} fylker fra EPSG:25833 til WGS84...")

    for feat in fc["features"]:
        feat["geometry"] = konverter_geometri(feat["geometry"])
        # Behold kun relevante properties
        props = feat.get("properties", {})
        # Hent kort norsk navn fra administrativenhetnavn (rekkefolge=0 eller 1, sprak=nor)
        navn = props.get("fylkesnavn", "").split(" - ")[0].strip()
        if not navn:
            for n in props.get("administrativenhetnavn", []):
                if n.get("sprak") == "nor":
                    navn = n.get("navn", "")
                    break
        feat["properties"] = {
            "fylkesnummer": str(props.get("fylkesnummer") or "").zfill(2),
            "navn": navn,
        }

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Skrevet til {OUTPUT}")
    print("Fylker funnet:")
    for feat in fc["features"]:
        p = feat["properties"]
        print(f"  {p['fylkesnummer']} — {p['navn']}")


if __name__ == "__main__":
    main()
