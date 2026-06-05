/**
 * Lagdefinisjoner per kilde.
 * Farger representerer kildens egne alvorsskalaer — ingen egenvurdering.
 *
 * MET:           gult nivå / oransje nivå / rødt nivå
 * NVE flom/jord: aktivitetsnivå 1–4 (NVE-skala)
 * NVE snøskred:  faregrad 2–5 (NVE-skala)
 * Vegvesen:      severity (DATEX)
 * Avinor:        D (forsinket) / C (kansellert)
 */

// MapLibre expression som mapper kilde_alvorsetikett → farge
const MET_FARGE = [
  'match', ['get', 'kilde_alvorsetikett'],
  'gult nivå',    '#f5c842',
  'oransje nivå', '#f5800a',
  'rødt nivå',    '#d73027',
  '#999',
];

const NVE_FARGE = [
  'match', ['get', 'kilde_alvorsetikett'],
  '1', '#aadcf5',
  '2', '#2196f3',
  '3', '#1565c0',
  '4', '#0d2f66',
  '#2196f3',
];

const SNOSKRED_FARGE = [
  'match', ['get', 'kilde_alvorsetikett'],
  '2', '#74add1',
  '3', '#f46d43',
  '4', '#d73027',
  '5', '#a50026',
  '#74add1',
];

const VEG_FARGE = '#ff9800';
const FLY_FARGE = [
  'match', ['get', 'kilde_alvorsetikett'],
  'C', '#d73027',
  'D', '#f5800a',
  '#4caf50',
];

// Lag-konfig: id, kildefilter, polygon-farge, sirkel-farge, synlighet-start
const LAG_CONFIG = [
  {
    kilde: 'met',
    polygonFarge: MET_FARGE,
    polygonOpasitet: 0.25,
    sirkelFarge: MET_FARGE,
  },
  {
    kilde: 'nve_flom',
    polygonFarge: NVE_FARGE,
    polygonOpasitet: 0.3,
    sirkelFarge: NVE_FARGE,
  },
  {
    kilde: 'nve_jordskred',
    polygonFarge: NVE_FARGE,
    polygonOpasitet: 0.3,
    sirkelFarge: NVE_FARGE,
  },
  {
    kilde: 'nve_snoskred',
    polygonFarge: SNOSKRED_FARGE,
    polygonOpasitet: 0.3,
    sirkelFarge: SNOSKRED_FARGE,
  },
  {
    kilde: 'vegvesen',
    polygonFarge: VEG_FARGE,
    polygonOpasitet: 0.25,
    sirkelFarge: VEG_FARGE,
  },
  {
    kilde: 'avinor',
    polygonFarge: FLY_FARGE,
    polygonOpasitet: 0.25,
    sirkelFarge: FLY_FARGE,
  },
];

export function leggTilLag(map, kildeId, erSynlig) {
  const cfg = LAG_CONFIG.find(c => c.kilde === kildeId);
  if (!cfg) return;

  const sourceId = `varsler-${kildeId}`;
  const synlighet = erSynlig ? 'visible' : 'none';

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  // Polygon-fill
  if (!map.getLayer(`${kildeId}-fill`)) {
    map.addLayer({
      id: `${kildeId}-fill`,
      type: 'fill',
      source: sourceId,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': cfg.polygonFarge,
        'fill-opacity': cfg.polygonOpasitet,
      },
      layout: { visibility: synlighet },
    });
  }

  // Polygon-outline
  if (!map.getLayer(`${kildeId}-outline`)) {
    map.addLayer({
      id: `${kildeId}-outline`,
      type: 'line',
      source: sourceId,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'line-color': cfg.polygonFarge,
        'line-width': 1.5,
        'line-opacity': 0.7,
      },
      layout: { visibility: synlighet },
    });
  }

  // Punkt-sirkel
  if (!map.getLayer(`${kildeId}-sirkel`)) {
    map.addLayer({
      id: `${kildeId}-sirkel`,
      type: 'circle',
      source: sourceId,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-color': cfg.sirkelFarge,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 5, 10, 10],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.2,
        'circle-opacity': 0.85,
      },
      layout: { visibility: synlighet },
    });
  }
}

export function oppdaterKildeLag(map, kildeId, varsler) {
  const sourceId = `varsler-${kildeId}`;
  const src = map.getSource(sourceId);
  if (!src) return;

  const features = varsler
    .filter(v => v.kilde === kildeId && v.geometri)
    .map(v => ({
      type: 'Feature',
      id: v.id,
      geometry: v.geometri,
      properties: {
        id: v.id,
        tittel: v.tittel,
        kilde: v.kilde,
        kilde_kategori: v.kilde_kategori,
        kilde_alvorsetikett: v.kilde_alvorsetikett || '',
        gyldig_til: v.gyldig_til || '',
        lenke: v.lenke || '',
      },
    }));

  src.setData({ type: 'FeatureCollection', features });
}

export function settLagSynlighet(map, kildeId, synlig) {
  const val = synlig ? 'visible' : 'none';
  for (const suffix of ['-fill', '-outline', '-sirkel']) {
    const id = `${kildeId}${suffix}`;
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', val);
    }
  }
}

export const ALLE_KILDER = LAG_CONFIG.map(c => c.kilde);
