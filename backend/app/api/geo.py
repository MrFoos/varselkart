import json
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

_FYLKER_PATH = Path(__file__).parent.parent.parent / "data" / "fylker-2024.geojson"
_cache: dict | None = None


@router.get("/fylker")
def hent_fylker():
    global _cache
    if _cache is None and _FYLKER_PATH.exists():
        with open(_FYLKER_PATH, encoding="utf-8") as f:
            _cache = json.load(f)
    return JSONResponse(content=_cache or {"type": "FeatureCollection", "features": []})
