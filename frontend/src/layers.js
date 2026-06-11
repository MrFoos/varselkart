/** Lagdefinisjoner per kilde — derivert fra KILDE_REGISTRY i data.js. */

import { DATEX_KATEGORI, KILDE_REGISTRY } from './data.js';
import { ikonData } from './icons.js';

const LAG_CONFIG = Object.entries(KILDE_REGISTRY).map(([kilde, cfg]) => ({
  kilde,
  polygonFarge: cfg.ident,
  polygonOpasitet: cfg.polygonOpasitet,
  sirkelFarge: cfg.ident,
}));


const LAG_SUFFIKSER = ['-fill', '-outline', '-sirkel', '-ikoner', '-fill-valgt', '-outline-valgt', '-sirkel-valgt'];

function buildVegIkonUttrykk() {
  const arms = [];
  for (const [kat, { ikon }] of Object.entries(DATEX_KATEGORI)) {
    arms.push(kat, `vv-${ikon}`);
  }
  return ['match', ['get', 'kilde_kategori'], ...arms, 'vv-alert'];
}

export async function registrerVegvesenIkoner(map) {
  const uniqIkoner = [...new Set(Object.values(DATEX_KATEGORI).map(k => k.ikon))];
  if (!uniqIkoner.includes('alert')) uniqIkoner.push('alert');

  await Promise.all(uniqIkoner.map(navn => new Promise(resolve => {
    const { path, viewBox } = ikonData(navn);
    const size = 24;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" fill="none" stroke="rgba(0,0,0,0.82)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image(size, size);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!map.hasImage(`vv-${navn}`)) map.addImage(`vv-${navn}`, img, { pixelRatio: 2 });
      resolve();
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
    img.src = url;
  })));
}

/** Oppretter alle MapLibre-lag for en kilde (source må eksistere). */
function opprettLag(map, kildeId, cfg, synlighet) {
  const sourceId = `varsler-${kildeId}`;

  if (!map.getLayer(`${kildeId}-fill`)) {
    map.addLayer({
      id: `${kildeId}-fill`,
      type: 'fill',
      source: sourceId,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': cfg.polygonFarge, 'fill-opacity': cfg.polygonOpasitet },
      layout: { visibility: synlighet },
    });
  }

  if (!map.getLayer(`${kildeId}-outline`)) {
    map.addLayer({
      id: `${kildeId}-outline`,
      type: 'line',
      source: sourceId,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'line-color': cfg.polygonFarge, 'line-width': 2, 'line-opacity': 1.0 },
      layout: { visibility: synlighet },
    });
  }

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

  if (!map.getLayer(`${kildeId}-sirkel-valgt`)) {
    map.addLayer({
      id: `${kildeId}-sirkel-valgt`,
      type: 'circle',
      source: sourceId,
      filter: ['==', ['get', 'id'], '__NONE__'],
      paint: {
        'circle-color': '#fff',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 8, 10, 14],
        'circle-stroke-color': cfg.sirkelFarge,
        'circle-stroke-width': 2.5,
        'circle-opacity': 1.0,
      },
      layout: { visibility: synlighet },
    });
  }

  if (!map.getLayer(`${kildeId}-fill-valgt`)) {
    map.addLayer({
      id: `${kildeId}-fill-valgt`,
      type: 'fill',
      source: sourceId,
      filter: ['==', ['get', 'id'], '__NONE__'],
      paint: { 'fill-color': cfg.polygonFarge, 'fill-opacity': 0.55 },
      layout: { visibility: synlighet },
    });
  }

  if (!map.getLayer(`${kildeId}-outline-valgt`)) {
    map.addLayer({
      id: `${kildeId}-outline-valgt`,
      type: 'line',
      source: sourceId,
      filter: ['==', ['get', 'id'], '__NONE__'],
      paint: { 'line-color': cfg.polygonFarge, 'line-width': 3, 'line-opacity': 1.0 },
      layout: { visibility: synlighet },
    });
  }

  if (kildeId === 'vegvesen' && !map.getLayer('vegvesen-ikoner')) {
    map.addLayer({
      id: 'vegvesen-ikoner',
      type: 'symbol',
      source: sourceId,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'icon-image': buildVegIkonUttrykk(),
        'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 1.0],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        visibility: synlighet,
      },
    });
  }
}

export function leggTilLag(map, kildeId, erSynlig) {
  const cfg = LAG_CONFIG.find(c => c.kilde === kildeId);
  if (!cfg) return;

  const sourceId = `varsler-${kildeId}`;
  const synlighet = erSynlig ? 'visible' : 'none';

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  }

  opprettLag(map, kildeId, cfg, synlighet);
}

export function oppdaterKildeLag(map, kildeId, situasjoner) {
  const sourceId = `varsler-${kildeId}`;
  const src = map.getSource(sourceId);
  if (!src) return;

  const features = situasjoner
    .filter(s => s.src === kildeId && s.geometri)
    .map(s => ({
      type: 'Feature',
      geometry: s.geometri,
      properties: {
        id: s.id,
        tittel: s.tittel || '',
        kilde: kildeId,
        kilde_kategori: s.kilde_kategori || '',
        kilde_alvorsetikett: s.kilde_alvorsetikett || '',
        gyldig_til: s.gyldigTil || '',
        lenke: s.lenke || '',
      },
    }));

  src.setData({ type: 'FeatureCollection', features });
}

export function settLagSynlighet(map, kildeId, synlig) {
  const val = synlig ? 'visible' : 'none';
  for (const s of LAG_SUFFIKSER) {
    const id = `${kildeId}${s}`;
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', val);
  }
}

export const ALLE_KILDER = LAG_CONFIG.map(c => c.kilde);

export function settValgtVarsel(map, v) {
  for (const kilde of ALLE_KILDER) {
    for (const s of ['-sirkel-valgt', '-fill-valgt', '-outline-valgt']) {
      const id = `${kilde}${s}`;
      if (map.getLayer(id)) map.setFilter(id, ['==', ['get', 'id'], '__NONE__']);
    }
  }
  if (!v) return;
  const kilde = v.kilde || v.src;
  for (const s of ['-sirkel-valgt', '-fill-valgt', '-outline-valgt']) {
    const id = `${kilde}${s}`;
    if (map.getLayer(id)) map.setFilter(id, ['==', ['get', 'id'], v.id]);
  }
}
