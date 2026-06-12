import { hentVarsler, hentStatus, hentFylker } from './api.js';
import { initMap, settinnFylkerLag, NorgeKontroll } from './map.js';
import { leggTilLag, oppdaterKildeLag, settLagSynlighet, registrerVegvesenIkoner, ALLE_KILDER, settValgtVarsel } from './layers.js';
import { byggVarselListe, visVarselDetalj, skjulDetalj, markerVarselIListe, åpneSheet, lukkSheet, visSkelettListe, visFeilListe } from './sidebar.js';
import { byggLayerChips } from './status.js';
import { byggSubscribePanel, lastSubs, lagreSubs, lastPush, lagrePush } from './subscribe.js';
import { byggFylkeFilter, lastFylkeFilter, lagreFylkeFilter } from './filter.js';
import { gjengiWordmark } from './brand.js';
import { lagIkon } from './icons.js';
import { KILDE_REGISTRY, adaptVarsel, groupBySituation, FYLKE_NR_TIL_SLUG } from './data.js';

const POLL_INTERVALL = 120_000;

let map;
let fylkerGeo = null;
let alleVarsler = [];
let alleSituasjoner = [];
let sisteStatus = [];
const STANDARD_LAG = Object.keys(KILDE_REGISTRY).filter(k => KILDE_REGISTRY[k].defaultVisible);
function lastAktiveLag() {
  try {
    const lagret = localStorage.getItem('vk_lag');
    if (lagret) return new Set(JSON.parse(lagret));
  } catch {}
  return new Set(STANDARD_LAG);
}
let aktiveLag = lastAktiveLag();
let valgtVarsel = null;
let subs = lastSubs();
let pushOn = lastPush();
let darkMode = localStorage.getItem('vk_dark') === '1';
let fylkeFilter = lastFylkeFilter();

// ── Init ────────────────────────────────────────────────────────────────

async function init() {
  // Sett tema
  settTema(darkMode);

  // Tegn merkevare
  gjengiWordmark(document.getElementById('brand'), { size: 40 });

  // Mørk-modus-knapp
  const darkBtn = document.getElementById('dark-toggle');
  oppdaterDarkKnapp(darkBtn);
  darkBtn?.addEventListener('click', () => {
    darkMode = !darkMode;
    localStorage.setItem('vk_dark', darkMode ? '1' : '0');
    settTema(darkMode);
    oppdaterDarkKnapp(darkBtn);
  });

  // SKJULT I v1 — ntfy-varsling. Behold for senere versjon. Se docs/ntfy-parkert.md.
  // const bellBtn = document.getElementById('bell-btn');
  // const bellIkon = lagIkon('bell', { size: 17, color: 'var(--accent)' });
  // bellBtn?.prepend(bellIkon);
  // oppdaterBellCount();
  // bellBtn?.addEventListener('click', () => åpneBell());

  // Scrim-klikk lukker alle sheets
  document.getElementById('scrim')?.addEventListener('click', lukkAllSheets);

  // Kart
  map = initMap();
  map.addControl(new NorgeKontroll(() => {
    map.fitBounds([[-1.5, 57.0], [30.5, 71.5]], { padding: 32 });
    nullstillFylkeFilter();
  }), 'bottom-right');
  map.on('load', async () => {
    try {
      const fylker = await hentFylker();
      fylkerGeo = fylker;
      settinnFylkerLag(map, fylker);
    } catch (e) {
      console.warn('Fylker ikke tilgjengelig:', e);
    }

    await registrerVegvesenIkoner(map);
    for (const kilde of ALLE_KILDER) {
      leggTilLag(map, kilde, aktiveLag.has(kilde));
    }

    // Kart-klikk → velg varsel
    for (const kilde of ALLE_KILDER) {
      for (const suffix of ['-fill', '-sirkel', ...(kilde === 'vegvesen' ? ['-ikoner'] : [])]) {
        const lagId = `${kilde}${suffix}`;
        map.on('click', lagId, e => {
          const feat = e.features?.[0];
          if (!feat) return;
          const id = feat.properties.id;
          const sit = alleSituasjoner.find(s => s.id === id);
          if (sit) velgVarsel(sit);
        });
        map.on('mouseenter', lagId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', lagId, () => { map.getCanvas().style.cursor = ''; });
      }
    }

    oppdaterFylkeFilter();
    await oppdater(true);
    setInterval(oppdater, POLL_INTERVALL);
  });
}

// ── Oppdater-loop ───────────────────────────────────────────────────────

async function oppdater(visLoading = false) {
  let skjelettTimer = null;
  const hentStart = Date.now();

  if (visLoading) {
    skjelettTimer = setTimeout(() => visSkelettListe(), 300);
  }

  try {
    const [varsler, status] = await Promise.all([hentVarsler(), hentStatus()]);

    if (skjelettTimer) clearTimeout(skjelettTimer);

    if (visLoading) {
      const elapsed = Date.now() - hentStart;
      // Skeleton was shown (300ms guard passed) — hold for at least 500ms total display
      if (elapsed >= 300) {
        const remaining = 800 - elapsed;
        if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
      }
    }

    alleVarsler = varsler;
    sisteStatus = status;
    oppdaterVisning();
  } catch (e) {
    if (skjelettTimer) clearTimeout(skjelettTimer);
    console.error('Feil ved oppdatering:', e);
    if (visLoading || alleVarsler.length === 0) {
      visFeilListe(() => oppdater(true));
    }
  }
}

function oppdaterVisning() {
  const adapted = alleVarsler.map(adaptVarsel);
  alleSituasjoner = groupBySituation(adapted);

  const fylkeFiltrerte = fylkeFilter.size > 0
    ? alleSituasjoner.filter(s => s.fylker.some(f => fylkeFilter.has(f)))
    : alleSituasjoner;

  for (const kilde of ALLE_KILDER) {
    oppdaterKildeLag(map, kilde, fylkeFiltrerte);
  }

  const filtrerte = fylkeFiltrerte.filter(s => aktiveLag.has(s.src));
  byggVarselListe(filtrerte, { onVelgVarsel: velgVarsel, fylkeFilter });
  byggLayerChips(aktiveLag, sisteStatus, alleSituasjoner, { onToggle: toggleLag });
  oppdaterFylkeFilter();
}

// ── Lag-toggle ──────────────────────────────────────────────────────────

function toggleLag(kildeId) {
  const synlig = !aktiveLag.has(kildeId);
  synlig ? aktiveLag.add(kildeId) : aktiveLag.delete(kildeId);
  localStorage.setItem('vk_lag', JSON.stringify([...aktiveLag]));
  settLagSynlighet(map, kildeId, synlig);
  oppdaterVisning();
}

// ── Fylkefilter ─────────────────────────────────────────────────────────

function toggleFylkeFilter(slug) {
  fylkeFilter.has(slug) ? fylkeFilter.delete(slug) : fylkeFilter.add(slug);
  lagreFylkeFilter(fylkeFilter);
  oppdaterVisning();
  if (fylkeFilter.size === 1) {
    const bbox = bboxFraFylkerGeo(fylkerGeo, [...fylkeFilter][0]);
    if (bbox) map.fitBounds(bbox, { padding: 64, maxZoom: 9 });
  }
}

function nullstillFylkeFilter() {
  fylkeFilter.clear();
  lagreFylkeFilter(fylkeFilter);
  oppdaterVisning();
  map.fitBounds([[-1.5, 57.0], [30.5, 71.5]], { padding: 32 });
}

function oppdaterFylkeFilter() {
  const kildeFiltrerte = alleSituasjoner.filter(s => aktiveLag.has(s.src));
  const opts = {
    fylkeFilter,
    alleVarsler: kildeFiltrerte,
    onToggle: toggleFylkeFilter,
    onNullstill: nullstillFylkeFilter,
    onÅpneSubs: null, // SKJULT I v1 — ntfy-varsling
  };
  byggFylkeFilter(document.getElementById('fylke-filter'), opts);
  byggFylkeFilter(document.getElementById('mobile-fylke-filter'), opts);
}

// ── Varsel-valg ─────────────────────────────────────────────────────────

function velgVarsel(v) {
  valgtVarsel = v;
  settValgtVarsel(map, v);
  markerVarselIListe(v.id);

  visVarselDetalj(v, {
    onLukk: () => fjerneValg(),
    alleVarsler: alleSituasjoner,
    onVelgRelater: relW => velgVarsel(relW),
  });

  // Fly til geometri
  const geom = v.geometri;
  if (!geom) return;
  if (geom.type === 'Point') {
    map.flyTo({ center: geom.coordinates, zoom: Math.max(map.getZoom(), 12) });
  } else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
    const bbox = bboxFraGeom(geom);
    if (bbox) map.fitBounds(bbox, { padding: 40, maxZoom: 10 });
  }
}

function fjerneValg() {
  valgtVarsel = null;
  settValgtVarsel(map, null);
  skjulDetalj();
}

// ── Bell / abonnement ───────────────────────────────────────────────────

function åpneBell() {
  const container = document.getElementById('sheet-bell');
  if (!container) return;
  byggSubscribePanel(container, alleVarsler, {
    subs,
    pushOn,
    onToggleSub(slug) {
      subs.has(slug) ? subs.delete(slug) : subs.add(slug);
      lagreSubs(subs);
      oppdaterBellCount();
      // Re-render panelet
      åpneBell();
    },
    onTogglePush(val) {
      pushOn = val;
      lagrePush(val);
      åpneBell();
    },
    onLukk: () => lukkSheet('sheet-bell'),
    onÅpneFilter: () => {
      lukkSheet('sheet-bell');
      document.getElementById('fylke-filter')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  });
  åpneSheet('sheet-bell');
}

function lukkAllSheets() {
  lukkSheet('sheet-detail');
  lukkSheet('sheet-bell');
  document.getElementById('scrim')?.classList.remove('open');
}

function oppdaterBellCount() {
  const bellBtn = document.getElementById('bell-btn');
  if (!bellBtn) return;
  const eksisterende = bellBtn.querySelector('.bell-count');
  eksisterende?.remove();
  if (subs.size > 0) {
    const badge = document.createElement('span');
    badge.className = 'bell-count';
    badge.textContent = subs.size;
    bellBtn.appendChild(badge);
  }
}

// ── Tema ────────────────────────────────────────────────────────────────

function settTema(mørk) {
  document.documentElement.dataset.theme = mørk ? 'dark' : 'light';
}

function oppdaterDarkKnapp(btn) {
  if (!btn) return;
  btn.innerHTML = '';
  const ikon = lagIkon(darkMode ? 'sun' : 'moon', { size: 17, color: 'var(--accent)' });
  btn.appendChild(ikon);
}

// ── Geometri-helpers ────────────────────────────────────────────────────

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

function bboxFraFylkerGeo(geo, slug) {
  if (!geo?.features) return null;
  for (const feat of geo.features) {
    const props = feat.properties || {};
    const nr = String(props.fylkesnummer || props.FYLKESNR || '').padStart(2, '0');
    if (FYLKE_NR_TIL_SLUG[nr] === slug) return bboxFraGeom(feat.geometry);
  }
  return null;
}

init();
