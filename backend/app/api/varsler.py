import hashlib
import json
from typing import Optional

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel

from ..database import get_connection

router = APIRouter()


def _safe_url(url: str | None) -> str | None:
    if not url:
        return None
    return url if url.startswith(("https://", "http://")) else None


def _strip_weak(etag: str) -> str:
    return etag[2:] if etag.startswith("W/") else etag


class VarselResponse(BaseModel):
    id: int
    dedup_id: str
    kilde: str
    kilde_kategori: Optional[str]
    kilde_alvorsetikett: Optional[str]
    geometri_type: Optional[str]
    geometri: Optional[dict]
    fylke_tags: list[str]
    tittel: Optional[str]
    beskrivelse: Optional[str]
    omrade: Optional[str]
    utstedt: Optional[str]
    gyldig_til: Optional[str]
    start_tid: Optional[str]
    validity_status: Optional[str]
    perioder_json: Optional[str]
    situation_id: Optional[str]
    first_seen: str
    last_seen: str
    status: str
    lenke: Optional[str]


def _row_to_response(row) -> VarselResponse:
    return VarselResponse(
        id=row["id"],
        dedup_id=row["dedup_id"],
        kilde=row["kilde"],
        kilde_kategori=row["kilde_kategori"],
        kilde_alvorsetikett=row["kilde_alvorsetikett"],
        geometri_type=row["geometri_type"],
        geometri=json.loads(row["geometri_json"]) if row["geometri_json"] else None,
        fylke_tags=json.loads(row["fylke_tags"]) if row["fylke_tags"] else [],
        tittel=row["tittel"],
        beskrivelse=row["beskrivelse"],
        omrade=row["omrade"],
        utstedt=row["utstedt"],
        gyldig_til=row["gyldig_til"],
        start_tid=row["start_tid"],
        validity_status=row["validity_status"],
        perioder_json=row["perioder_json"],
        situation_id=row["situation_id"],
        first_seen=row["first_seen"],
        last_seen=row["last_seen"],
        status=row["status"],
        lenke=_safe_url(row["lenke"]),
    )


@router.get("/varsler", response_model=list[VarselResponse])
def hent_varsler(
    request: Request,
    response: Response,
    status: str = Query(default="aktiv"),
    kilde: Optional[str] = Query(default=None),
    fylke: Optional[str] = Query(default=None),
    limit: int = Query(default=500, le=2000),
):
    conn = get_connection()
    params: list = []
    where: list[str] = []

    if status != "alle":
        where.append("v.status = ?")
        params.append(status)

    if kilde:
        kilder = [k.strip() for k in kilde.split(",")]
        placeholders = ",".join("?" * len(kilder))
        where.append(f"v.kilde IN ({placeholders})")
        params.extend(kilder)

    # Fylkefilter via SQLite JSON-funksjon
    if fylke:
        fylker = [f.strip() for f in fylke.split(",")]
        fylke_conditions = " OR ".join(
            ["EXISTS (SELECT 1 FROM json_each(v.fylke_tags) WHERE value = ?)"] * len(fylker)
        )
        where.append(f"({fylke_conditions})")
        params.extend(fylker)

    where_sql = "WHERE " + " AND ".join(where) if where else ""

    per_kilde = limit if kilde else 300

    # Hent data og ETag i én atomisk spørring via window-funksjon.
    # CTE begrenser til de per_kilde nyeste hendelsene per kilde for å unngå
    # at én kilde med mange fremtidige hendelser (f.eks. vegvesen) fyller hele grensen.
    try:
        rows = conn.execute(
            f"""WITH ranked AS (
                  SELECT v.*,
                    ROW_NUMBER() OVER (PARTITION BY v.kilde ORDER BY v.utstedt DESC) AS _rn
                  FROM varsler v {where_sql}
                )
                SELECT *, max(last_seen) OVER () AS _ml
                FROM ranked
                WHERE _rn <= ?
                ORDER BY utstedt DESC
                LIMIT ?""",
            params + [per_kilde, limit],
        ).fetchall()
    finally:
        conn.close()

    ml = rows[0]["_ml"] if rows else None
    etag = '"' + hashlib.md5((ml or "").encode()).hexdigest() + '"'

    if _strip_weak(request.headers.get("if-none-match", "")) == etag:
        return Response(status_code=304, headers={"ETag": etag, "Cache-Control": "public, max-age=0, must-revalidate"})

    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "public, max-age=0, must-revalidate"
    return [_row_to_response(r) for r in rows]


@router.get("/varsler/{varsel_id}", response_model=VarselResponse)
def hent_varsel(varsel_id: int):
    from fastapi import HTTPException
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM varsler WHERE id = ?", (varsel_id,)).fetchone()
    finally:
        conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Varsel ikke funnet")
    return _row_to_response(row)
