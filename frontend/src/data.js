// Delte konstanter og hjelpe-funksjoner for B2-designet.
// Kildens egne alvorsskalaer vises alltid umodifisert — ingen egenvurdering.

export const KILDE_REGISTRY = {
  met:           { short: 'MET', navn: 'MET Farevarsel',   org: 'Meteorologisk institutt', ident: '#E8762C', attr: 'api.met.no · MetAlerts (CAP)',   lenke: 'https://www.yr.no/nb/farevarsler',                   polygonOpasitet: 0.25, cluster: false, defaultVisible: true,  gruppe: 'Farevarsler'   },
  nve_flom:      { short: 'NVE', navn: 'NVE Flom',         org: 'NVE / Varsom',            ident: '#4F9BD9', attr: 'api.nve.no · Varsom',            lenke: 'https://www.varsom.no/',                         polygonOpasitet: 0.3,  cluster: false, defaultVisible: true,  gruppe: 'Farevarsler'   },
  nve_jordskred: { short: 'NVE', navn: 'NVE Jordskred',    org: 'NVE / Varsom',            ident: '#9A63D1', attr: 'api.nve.no · Varsom',            lenke: 'https://www.varsom.no/',                         polygonOpasitet: 0.3,  cluster: false, defaultVisible: true,  gruppe: 'Farevarsler'   },
  nve_snoskred:  { short: 'NVE', navn: 'NVE Snøskred',     org: 'NVE / Varsom',            ident: '#18A89A', attr: 'Varsom · varslingsregioner',     lenke: 'https://varsom.no/snoskredvarsling/',             polygonOpasitet: 0.3,  cluster: false, defaultVisible: true,  gruppe: 'Farevarsler'   },
  vegvesen:      { short: 'SVV', navn: 'Statens vegvesen', org: 'Statens vegvesen',        ident: '#F5C518', attr: 'DATEX II v3.1 · NLOD',          lenke: 'https://www.vegvesen.no/trafikkinformasjon/',     polygonOpasitet: 0.25, cluster: false, defaultVisible: false, gruppe: 'Trafikk & veg' },
};

export const KILDE_META = KILDE_REGISTRY;

export const KILDE_ORDEN = Object.keys(KILDE_REGISTRY);

export const FAREGRAD = {
  1: { col: '#6BBF59', navn: 'Liten' },
  2: { col: '#F4D03F', navn: 'Moderat' },
  3: { col: '#E8821E', navn: 'Betydelig' },
  4: { col: '#D9362B', navn: 'Stor' },
  5: { col: '#8E1B1B', navn: 'Meget stor' },
};

export const MET_LEVEL = {
  gul:     { col: '#F5C518', navn: 'Gult nivå' },
  oransje: { col: '#E8762C', navn: 'Oransje nivå' },
  rod:     { col: '#D23B3B', navn: 'Rødt nivå' },
};

export const FYLKE_NR_TIL_SLUG = {
  '03': 'oslo',    '31': 'ostfold',        '32': 'akershus',  '33': 'buskerud',
  '34': 'innlandet', '39': 'vestfold',     '40': 'telemark',  '42': 'agder',
  '11': 'rogaland',  '46': 'vestland',     '15': 'more-og-romsdal',
  '50': 'trondelag', '18': 'nordland',     '55': 'troms',     '56': 'finnmark',
};

export const FYLKER = [
  { navn: 'Østfold',         slug: 'ostfold' },
  { navn: 'Akershus',        slug: 'akershus' },
  { navn: 'Oslo',            slug: 'oslo' },
  { navn: 'Buskerud',        slug: 'buskerud' },
  { navn: 'Innlandet',       slug: 'innlandet' },
  { navn: 'Vestfold',        slug: 'vestfold' },
  { navn: 'Telemark',        slug: 'telemark' },
  { navn: 'Agder',           slug: 'agder' },
  { navn: 'Rogaland',        slug: 'rogaland' },
  { navn: 'Vestland',        slug: 'vestland' },
  { navn: 'Møre og Romsdal', slug: 'more-og-romsdal' },
  { navn: 'Trøndelag',       slug: 'trondelag' },
  { navn: 'Nordland',        slug: 'nordland' },
  { navn: 'Troms',           slug: 'troms' },
  { navn: 'Finnmark',        slug: 'finnmark' },
];

// DATEX II-kategorier fra Statens vegvesen → norsk navn + ikon.
export const DATEX_KATEGORI = {
  MaintenanceWorks:                 { navn: 'Vedlikehold',          ikon: 'wrench' },
  ConstructionWorks:                { navn: 'Anleggsarbeid',        ikon: 'construction' },
  RoadOrCarriagewayOrLaneManagement:{ navn: 'Vegregulering',        ikon: 'merge' },
  GeneralNetworkManagement:         { navn: 'Vegforvaltning',       ikon: 'merge' },
  NetworkManagement:                { navn: 'Vegforvaltning',       ikon: 'merge' },
  ReroutingManagement:              { navn: 'Omkjøring',            ikon: 'arrows-h' },
  SpeedManagement:                  { navn: 'Fartsbegrensning',     ikon: 'gauge' },
  PublicEvent:                      { navn: 'Arrangement',          ikon: 'flag' },
  TransitInformation:               { navn: 'Kollektivinfo',        ikon: 'bus' },
  WeatherRelatedRoadConditions:     { navn: 'Vær og føre',          ikon: 'cloud-snow' },
  PoorEnvironmentConditions:        { navn: 'Dårlige forhold',      ikon: 'cloud-snow' },
  EnvironmentalObstruction:         { navn: 'Miljøhindring',        ikon: 'cloud-snow' },
  NonWeatherRelatedRoadConditions:  { navn: 'Vegforhold',           ikon: 'merge' },
  Accident:                         { navn: 'Ulykke',               ikon: 'alert' },
  VehicleObstruction:               { navn: 'Kjøretøyhindring',     ikon: 'alert' },
  GeneralObstruction:               { navn: 'Hindring på veg',      ikon: 'alert' },
  InfrastructureDamageObstruction:  { navn: 'Skade på veg',         ikon: 'construction' },
  AnimalPresenceObstruction:        { navn: 'Dyr i vegbanen',       ikon: 'alert' },
  EquipmentOrSystemFault:           { navn: 'Teknisk feil',         ikon: 'cog' },
  GeneralInstructionOrMessageToRoadUsers: { navn: 'Melding til trafikanter', ikon: 'alert' },
  RoadsideAssistance:               { navn: 'Veihjelp',             ikon: 'wrench' },
  AbnormalTraffic:                  { navn: 'Unormal trafikk',      ikon: 'arrows-h' },
  WinterDrivingManagement:          { navn: 'Vinterkjøring',        ikon: 'cloud-snow' },
  ServiceDisruption:                { navn: 'Driftsforstyrrelse',   ikon: 'cog' },
};

// ── Situasjonsgruppering (Statens vegvesen DATEX II) ─────────────────────

const CAUSE_PRIORITY = ['accident', 'maintenance', 'construction', 'laneManagement', 'rerouting'];

const RECORD_TYPE_MAP = {
  Accident: 'accident', VehicleObstruction: 'accident', AbnormalTraffic: 'accident',
  GeneralObstruction: 'accident', AnimalPresenceObstruction: 'accident',
  MaintenanceWorks: 'maintenance',
  ConstructionWorks: 'construction', InfrastructureDamageObstruction: 'construction',
  RoadOrCarriagewayOrLaneManagement: 'laneManagement', GeneralNetworkManagement: 'laneManagement',
  NetworkManagement: 'laneManagement', SpeedManagement: 'laneManagement',
  ReroutingManagement: 'rerouting',
};

function _recordTypePriority(kilde_kategori) {
  const idx = CAUSE_PRIORITY.indexOf(RECORD_TYPE_MAP[kilde_kategori] || '');
  return idx === -1 ? 99 : idx;
}

function _maxDefined(isoArr) {
  const ts = isoArr.filter(Boolean).map(s => new Date(s).getTime());
  return ts.length ? new Date(Math.max(...ts)).toISOString() : null;
}

function _minDefined(isoArr) {
  const ts = isoArr.filter(Boolean).map(s => new Date(s).getTime());
  return ts.length ? new Date(Math.min(...ts)).toISOString() : null;
}

const _OSLO = 'Europe/Oslo';
const _fmtClock = (d) => new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: _OSLO }).format(new Date(d));
const _fmtDate  = (d) => {
  const parts = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'numeric', timeZone: _OSLO }).formatToParts(new Date(d));
  const day   = parts.find(p => p.type === 'day')?.value.padStart(2, '0') || '';
  const month = parts.find(p => p.type === 'month')?.value.padStart(2, '0') || '';
  return `${day}.${month}.`;
};
const _fmtDT    = (d) => `${_fmtDate(d)} ${_fmtClock(d)}`;

function _unionFylker(records) {
  return [...new Set(records.flatMap(r => r.fylker || []))];
}

function _buildSituation(records) {
  const sorted = [...records].sort(
    (a, b) => _recordTypePriority(a.kilde_kategori) - _recordTypePriority(b.kilde_kategori)
  );
  const primary = sorted[0];
  const fylker = _unionFylker(records);
  const gyldigTil = _maxDefined(records.map(r => r.gyldigTil));
  return {
    ...primary,
    kilde: primary.src,
    gyldigTil,
    gyldig_til: gyldigTil,   // compat med status.js (ferskhetsState)
    startTid: _minDefined(records.map(r => r.startTid)),
    fylker,
    fylke_tags: fylker,
    facets: sorted,
  };
}

export function groupBySituation(adaptedVarsler) {
  const byKey = new Map();
  for (const v of adaptedVarsler) {
    const key = v.situationId || v.dedup_id;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(v);
  }
  return [...byKey.values()].map(_buildSituation);
}

// Adapter: mapper API-respons-felt til B2-displayformat.
export function adaptVarsel(v) {
  const kilde = v.kilde;
  let metLevel = null;
  let faregrad = null;

  if (kilde === 'met' && v.kilde_alvorsetikett) {
    const a = v.kilde_alvorsetikett.toLowerCase();
    if (a.includes('gult') || a.includes('gul')) metLevel = 'gul';
    else if (a.includes('oransje')) metLevel = 'oransje';
    else if (a.includes('rødt') || a.includes('rod')) metLevel = 'rod';
  } else if (kilde.startsWith('nve') && v.kilde_alvorsetikett) {
    const n = parseInt(v.kilde_alvorsetikett, 10);
    if (n >= 1 && n <= 5) faregrad = n;
  }

  return {
    id: v.id,
    src: kilde,
    tittel: v.tittel || '(uten tittel)',
    omrade: v.omrade || null,
    dedup_id: v.dedup_id,
    beskrivelse: v.beskrivelse || '',
    instruks: null,
    kilde_alvorsetikett: v.kilde_alvorsetikett || '',
    kilde_kategori: v.kilde_kategori || '',
    metLevel,
    faregrad,
    gyldigTil: v.gyldig_til || null,
    utstedt: v.utstedt || null,
    startTid: v.start_tid || null,
    validityStatus: v.validity_status || null,
    perioder: (() => {
      if (!v.perioder_json) return [];
      try { return JSON.parse(v.perioder_json); } catch { return []; }
    })(),
    firstSeen: v.first_seen || null,
    fylker: v.fylke_tags || [],
    lenke: v.lenke || '',
    geometri: v.geometri || null,
    situationId: v.situation_id || null,
    severityText: v.kilde_alvorsetikett || v.kilde_kategori || '–',
  };
}

// Beregner ferskhetsstate basert på gyldigTil (brukes i status.js med raw API-felt).
export function ferskhetsState(gyldigTil) {
  if (!gyldigTil) return 'active';
  const now = Date.now();
  const end = new Date(gyldigTil).getTime();
  if (now >= end) return 'expired';
  if ((end - now) / 60000 < 120) return 'ending';
  return 'active';
}

// Full livssyklus for et adaptert varsel-objekt — returnerer {state, label}.
// state: 'planned' | 'active' | 'ending' | 'suspended' | 'expired' | 'paused'
export function varselLifecycle(v, now = new Date()) {
  const start = v.startTid ? new Date(v.startTid) : null;
  const end   = v.gyldigTil ? new Date(v.gyldigTil) : null;

  if (v.validityStatus === 'suspended') return { state: 'suspended', label: 'Midl. opphevet' };
  if (end && now >= end)                return { state: 'expired',   label: 'Utløpt' };
  if (start && now < start)             return { state: 'planned',   label: 'Planlagt' };

  if (v.perioder?.length) {
    const vinduer = buildVinduer(v);
    const iVindu = vinduer.find(win => now >= win.start && now < win.slutt);
    if (iVindu) {
      if ((iVindu.slutt - now) / 60000 < 120) return { state: 'ending', label: 'Utløper snart' };
      return { state: 'active', label: 'Pågår nå' };
    }
    const neste = vinduer.find(win => win.start > now);
    return { state: 'paused', label: neste ? `Neste vindu ${_clockHM(neste.start)}` : 'Pause' };
  }

  if (end && (end - now) / 60000 < 120) return { state: 'ending',   label: 'Utløper snart' };
  return { state: 'active', label: 'Pågår nå' };
}

function _clockHM(date) { return _fmtClock(date); }

export function formaterDatoLokal(date) {
  return _fmtDT(date instanceof Date ? date : new Date(date));
}

const _DAY_NUM = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };

function _osloDate(baseDate, h, m) {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: _OSLO }).format(baseDate);
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone: _OSLO, timeZoneName: 'longOffset'
  }).formatToParts(baseDate).find(p => p.type === 'timeZoneName').value;
  const off = tzName.replace('GMT', '') || '+00:00';
  return new Date(`${ymd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00${off}`);
}

// Bygg konkrete berøringsvinduer fra perioder + overordnet gyldighet.
// Returnerer [{start: Date, slutt: Date}] sortert etter start.
// Ikke-periodisk varsel (perioder tom) → ett vindu = hele gyldigheten.
export function buildVinduer(v) {
  const overallEnd = v.gyldigTil ? new Date(v.gyldigTil) : null;
  if (!overallEnd) return [];
  const overallStart = v.startTid ? new Date(v.startTid) : (v.utstedt ? new Date(v.utstedt) : null);
  if (!overallStart) return [{ start: overallEnd, slutt: overallEnd }];

  if (!v.perioder?.length) return [{ start: overallStart, slutt: overallEnd }];

  const vinduer = [];
  let cursor = _osloDate(overallStart, 0, 0);
  const endDay = _osloDate(overallEnd, 0, 0);

  while (cursor <= endDay) {
    const osloWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: _OSLO }).format(cursor).toLowerCase();
    const dow = _DAY_NUM[osloWeekday] ?? -1;
    for (const p of v.perioder) {
      const filter = p.dager?.map(d => _DAY_NUM[d.toLowerCase()]).filter(n => n !== undefined);
      if (filter?.length && !filter.includes(dow)) continue;

      const [sh, sm] = p.start.split(':').map(Number);
      const [eh, em] = p.end.split(':').map(Number);

      const winStart = _osloDate(cursor, sh, sm);
      let winEnd = _osloDate(cursor, eh, em);
      if (winEnd <= winStart) {
        const nesteDag = new Date(cursor.getTime() + 86400_000);
        winEnd = _osloDate(nesteDag, eh, em);
      }

      const clipped = {
        start: new Date(Math.max(winStart.getTime(), overallStart.getTime())),
        slutt: new Date(Math.min(winEnd.getTime(), overallEnd.getTime())),
      };
      if (clipped.slutt > clipped.start) vinduer.push(clipped);
    }
    cursor = new Date(cursor.getTime() + 86400_000);
  }

  return vinduer.sort((a, b) => a.start - b.start);
}

// Fremtidsrelativ tid — speil til formaterRelativ.
export function vkUntil(iso) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'nå';
  const min = Math.round(ms / 60000);
  if (min < 60) return `om ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `om ${h} ${h === 1 ? 'time' : 'timer'}`;
  const d = Math.round(h / 24);
  return `om ${d} ${d === 1 ? 'dag' : 'dager'}`;
}

// Returnerer alvorsfarge for et varsel (kildens egne kategorier).
export function alvorsFarge(varsel) {
  if (varsel.src === 'met' && varsel.metLevel) return MET_LEVEL[varsel.metLevel]?.col || '#999';
  if (varsel.faregrad) return FAREGRAD[varsel.faregrad]?.col || '#999';
  return KILDE_META[varsel.src]?.ident || '#999';
}

// Rangering for sortering (høyest alvor øverst).
export function alvorRang(varsel) {
  if (varsel.src === 'met') {
    const m = varsel.metLevel;
    if (m === 'rod') return 5;
    if (m === 'oransje') return 4;
    if (m === 'gul') return 3;
  }
  if (varsel.faregrad) return varsel.faregrad; // 1–5
  const a = (varsel.kilde_alvorsetikett || '').toLowerCase();
  if (a === 'highest') return 5;
  if (a === 'high')    return 4;
  if (a === 'medium')  return 3;
  if (a === 'low')     return 2;
  if (a === 'lowest')  return 1;
  return 1;
}

export function formaterDato(iso) {
  if (!iso) return '';
  return _fmtDT(iso);
}

export function formaterKlokke(date) {
  return _fmtClock(date instanceof Date ? date : new Date(date));
}

export function formaterRelativ(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'nå nettopp';
  if (min < 60) return `for ${min} min siden`;
  const h = Math.round(min / 60);
  if (h < 24) return `for ${h} ${h === 1 ? 'time' : 'timer'} siden`;
  const d = Math.round(h / 24);
  return `for ${d} ${d === 1 ? 'dag' : 'dager'} siden`;
}
