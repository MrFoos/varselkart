from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Varsel:
    dedup_id: str
    kilde: str
    geometri_type: str
    geometri_json: str          # GeoJSON geometry string
    first_seen: str
    last_seen: str
    kilde_kategori: Optional[str] = None
    kilde_alvorsetikett: Optional[str] = None
    fylke_tags: list[str] = field(default_factory=list)
    tittel: Optional[str] = None
    beskrivelse: Optional[str] = None
    utstedt: Optional[str] = None
    gyldig_til: Optional[str] = None
    status: str = "aktiv"
    lenke: Optional[str] = None
    raw_json: Optional[str] = None


@dataclass
class FeedStatus:
    kilde: str
    status: str                 # ok | feil | ukjent
    sist_forsøkt: str
    sist_ok: Optional[str] = None
    feilmelding: Optional[str] = None
