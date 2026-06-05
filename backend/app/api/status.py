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
    antall_aktive: int


@router.get("/status", response_model=list[FeedStatusResponse])
def hent_status():
    conn = get_connection()
    rows = conn.execute("""
        SELECT fs.kilde, fs.status, fs.sist_ok, fs.sist_forsøkt, fs.feilmelding,
               COALESCE(SUM(CASE WHEN v.status = 'aktiv' THEN 1 ELSE 0 END), 0) AS antall_aktive
        FROM feed_status fs
        LEFT JOIN varsler v ON v.kilde = fs.kilde
        GROUP BY fs.kilde
        ORDER BY fs.kilde
    """).fetchall()
    conn.close()
    return [
        FeedStatusResponse(
            kilde=r["kilde"],
            status=r["status"],
            sist_ok=r["sist_ok"],
            sist_forsøkt=r["sist_forsøkt"],
            feilmelding=r["feilmelding"],
            antall_aktive=r["antall_aktive"],
        )
        for r in rows
    ]
