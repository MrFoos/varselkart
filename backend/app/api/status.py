from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from ..database import get_connection

router = APIRouter()


class FeedStatusResponse(BaseModel):
    kilde: str
    status: str
    sist_ok: Optional[str]
    sist_forsøkt: Optional[str]
    feilmelding: Optional[str]


@router.get("/status", response_model=list[FeedStatusResponse])
def hent_status():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM feed_status ORDER BY kilde").fetchall()
    conn.close()
    return [
        FeedStatusResponse(
            kilde=r["kilde"],
            status=r["status"],
            sist_ok=r["sist_ok"],
            sist_forsøkt=r["sist_forsøkt"],
            feilmelding=r["feilmelding"],
        )
        for r in rows
    ]
