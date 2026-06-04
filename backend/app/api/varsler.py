import json
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ..database import get_connection

router = APIRouter()


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
    utstedt: Optional[str]
    gyldig_til: Optional[str]
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
        utstedt=row["utstedt"],
        gyldig_til=row["gyldig_til"],
        first_seen=row["first_seen"],
        last_seen=row["last_seen"],
        status=row["status"],
        lenke=row["lenke"],
    )


@router.get("/varsler", response_model=list[VarselResponse])
def hent_varsler(
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
    params.append(limit)

    rows = conn.execute(
        f"SELECT * FROM varsler v {where_sql} ORDER BY utstedt DESC LIMIT ?",
        params,
    ).fetchall()
    conn.close()

    return [_row_to_response(r) for r in rows]


@router.get("/varsler/{varsel_id}", response_model=VarselResponse)
def hent_varsel(varsel_id: int):
    from fastapi import HTTPException
    conn = get_connection()
    row = conn.execute("SELECT * FROM varsler WHERE id = ?", (varsel_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Varsel ikke funnet")
    return _row_to_response(row)
