import { hentVarsler, hentStatus, hentFylker } from './api.js';
import { initMap, settinnFylkerLag } from './map.js';
import { leggTilLag, oppdaterKildeLag, settLagSynlighet, ALLE_KILDER } from './layers.js';
import { byggSidebar, markerVarselIListe } from './sidebar.js';
import { oppdaterStatusBar } from './status.js';

const POLL_INTERVALL = 60_000; // ms

let map;
let alleVarsler = [];
let aktiveLag = new Set(['met', 'nve_flom', 'nve_jordskred', 'nve_snoskred']);

async function init() {
  map = initMap();

  map.on('load', async () => {
    // Fylkesgrenser som referanselag
    try {
      const fylker = await hentFylker();
      settinnFylkerLag(map, fylker);
    } catch (e) {
      console.warn('Fylker ikke tilgjengelig:', e);
    }

    // Legg til alle lag (tomme til å begynne med)
    for (const kilde of ALLE_KILDER) {
      leggTilLag(map, kilde, aktiveLag.has(kilde));
    }

    // Kart-klikk → marker i liste
    for (const kilde of ALLE_KILDER) {
      for (const suffix of ['-fill', '-sirkel']) {
        const lagId = `${kilde}${suffix}`;
        map.on('click', lagId, e => {
          const feat = e.features?.[0];
          if (feat) markerVarselIListe(feat.properties.id);
        });
        map.on('mouseenter', lagId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', lagId, () => { map.getCanvas().style.cursor = ''; });
      }
    }

    // Første henting
    await oppdater();

    // Poll
    setInterval(oppdater, POLL_INTERVALL);
  });

  // Lag-toggles
  document.querySelectorAll('[data-lag]').forEach(input => {
    input.addEventListener('change', e => {
      const kilde = e.target.dataset.lag;
      const synlig = e.target.checked;
      synlig ? aktiveLag.add(kilde) : aktiveLag.delete(kilde);
      settLagSynlighet(map, kilde, synlig);
    });
  });

  // Bottom sheet handle (mobil)
  const handle = document.getElementById('sidebar-handle');
  const sidebar = document.getElementById('sidebar');
  handle?.addEventListener('click', () => sidebar.classList.toggle('open'));
}

async function oppdater() {
  try {
    const [varsler, status] = await Promise.all([hentVarsler(), hentStatus()]);
    alleVarsler = varsler;

    // Oppdater kartlag
    for (const kilde of ALLE_KILDER) {
      oppdaterKildeLag(map, kilde, varsler);
    }

    // Oppdater sidebar
    byggSidebar(varsler, {
      onVelgVarsel(v) {
        if (!v.geometri) return;
        const geom = v.geometri;
        if (geom.type === 'Point') {
          map.flyTo({ center: geom.coordinates, zoom: Math.max(map.getZoom(), 8) });
        } else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
          const bbox = bboxFraGeom(geom);
          if (bbox) map.fitBounds(bbox, { padding: 40, maxZoom: 10 });
        }
      },
    });

    // Oppdater statusbar
    oppdaterStatusBar(status);

  } catch (e) {
    console.error('Feil ved oppdatering:', e);
  }
}

function bboxFraGeom(geom) {
  const coords = flattenCoords(geom);
  if (!coords.length) return null;
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

function flattenCoords(geom) {
  if (geom.type === 'Point') return [geom.coordinates];
  if (geom.type === 'Polygon') return geom.coordinates.flat();
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat(2);
  return [];
}

init();
