// Feed-helse som horisontale kilde-chips over kartet (B2-layout).

import { KILDE_REGISTRY, ferskhetsState } from './data.js';

const KILDE_META = KILDE_REGISTRY;

function byggKildeGrupper() {
  const gruppeMap = new Map();
  for (const [kildeId, cfg] of Object.entries(KILDE_REGISTRY)) {
    if (!gruppeMap.has(cfg.gruppe)) gruppeMap.set(cfg.gruppe, []);
    gruppeMap.get(cfg.gruppe).push(kildeId);
  }
  return [...gruppeMap.entries()].map(([label, kilder]) => ({ label, kilder }));
}
const KILDE_GRUPPER = byggKildeGrupper();

// Oppdaterer chip-raden i #chip-bar.
// layers: Set av kildeId-er som er synlige.
// status: array fra /api/status — [{ kilde, status, sist_ok, feilmelding }]
function oppdaterDividerVisibilitet(bar) {
  const groups = bar.querySelectorAll('.chip-group');
  for (let i = 1; i < groups.length; i++) {
    const divider = groups[i].querySelector('.chip-group-divider');
    if (divider) divider.hidden = groups[i].offsetTop !== groups[i - 1].offsetTop;
  }
}

let chipBarRO = null;

// varsler: array av API-varsler (for telling per kilde)
export function byggLayerChips(layers, status, varsler, { onToggle }) {
  const bar = document.getElementById('chip-bar');
  if (!bar) return;

  const feedMap = {};
  for (const f of (status || [])) feedMap[f.kilde] = f;

  bar.innerHTML = '';
  let harNedeFeed = false;

  KILDE_GRUPPER.forEach((gruppe, gi) => {
    const group = document.createElement('div');
    group.className = 'chip-group';

    if (gi > 0) {
      const div = document.createElement('span');
      div.className = 'chip-group-divider';
      div.setAttribute('aria-hidden', 'true');
      group.appendChild(div);
    }

    const label = document.createElement('span');
    label.className = 'chip-group-prefix';
    label.textContent = gruppe.label;
    group.appendChild(label);

    for (const kildeId of gruppe.kilder) {
      const meta = KILDE_META[kildeId];
      if (!meta) continue;

      const feed = feedMap[kildeId] || {};
      const on = layers.has(kildeId);
      const cnt = (varsler || []).filter(v => v.kilde === kildeId && ferskhetsState(v.gyldig_til) !== 'expired').length;
      const down = feed.status === 'feil';
      const stale = feed.status === 'ukjent';
      if (down) harNedeFeed = true;

      let statusTekst = '';
      if (down) statusTekst = `<span class="chip-nede">· ingen data</span>`;
      else if (stale) statusTekst = `<span class="chip-forsinket">· forsinket</span>`;
      else statusTekst = `<span class="chip-count${cnt === 0 ? ' chip-count--zero' : ''}">· ${cnt}</span>`;

      const kort = document.createElement('button');
      kort.className = `lag-chip${on ? ' on' : ''}`;
      kort.dataset.kilde = kildeId;
      kort.innerHTML = `
        <span class="chip-dot" style="background:${on ? meta.ident : 'var(--dim)'}"></span>
        <span class="chip-navn">${meta.navn.replace('NVE ', '').replace(' Farevarsel', '')}</span>
        ${statusTekst}
      `;
      kort.addEventListener('click', () => onToggle(kildeId));
      group.appendChild(kort);
    }

    bar.appendChild(group);
  });

  oppdaterDividerVisibilitet(bar);
  if (!chipBarRO) {
    chipBarRO = new ResizeObserver(() => oppdaterDividerVisibilitet(bar));
    chipBarRO.observe(bar);
  }

  const note = document.getElementById('no-data-note');
  if (note) {
    note.hidden = !harNedeFeed;
    if (harNedeFeed) {
      note.innerHTML = `
        <div class="no-data-row">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--down-color)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M10 4l7 12H3l7-12z"/><path d="M10 9v3M10 14.2v.1"/></svg>
          <span><b>Ingen data ≠ alt rolig.</b> Én eller flere feeder er nede — vi vet ikke om det finnes varsler fra kilden akkurat nå.</span>
        </div>
      `;
    }
  }
}
