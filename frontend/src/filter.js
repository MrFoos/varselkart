// Fylkefilter: «Hva ser jeg nå?» — adskilt fra abonnering («Hva varsles jeg om?»).

import { FYLKER, ferskhetsState } from './data.js';

const LS_FILTER = 'vk_filter';

export function lastFylkeFilter() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_FILTER) || '[]')); }
  catch { return new Set(); }
}

export function lagreFylkeFilter(filter) {
  localStorage.setItem(LS_FILTER, JSON.stringify([...filter]));
}

export function byggFylkeFilter(container, { fylkeFilter, alleVarsler, onToggle, onNullstill, onÅpneSubs }) {
  if (!container) return;

  // Tell aktive varsler per fylke
  const teller = {};
  for (const v of (alleVarsler || [])) {
    if (ferskhetsState(v.gyldig_til) === 'expired') continue;
    for (const slug of (v.fylke_tags || [])) {
      teller[slug] = (teller[slug] || 0) + 1;
    }
  }

  const aktiv = fylkeFilter.size > 0;
  const valgtNavn = [...fylkeFilter]
    .map(slug => FYLKER.find(f => f.slug === slug)?.navn)
    .filter(Boolean);

  const filtrerteAntall = aktiv
    ? (alleVarsler || []).filter(v =>
        ferskhetsState(v.gyldig_til) !== 'expired' &&
        (v.fylke_tags || []).some(s => fylkeFilter.has(s))
      ).length
    : 0;

  container.innerHTML = `
    <div class="ff-wrap">
      ${aktiv ? `
        <div class="ff-active-bar">
          <span class="ff-active-label">
            Viser: <strong>${valgtNavn.join(', ')}</strong>
            <span class="ff-active-count">(${filtrerteAntall} ${filtrerteAntall === 1 ? 'varsel' : 'varsler'})</span>
          </span>
          <div class="ff-active-actions">
            ${onÅpneSubs ? `<button class="ff-crosslink" title="Abonnér på varsling for disse fylkene">Følg fylker</button>` : ''}
            <button class="ff-nullstill">Vis hele landet</button>
          </div>
        </div>
      ` : ''}
      <div class="ff-header-row">
        <span class="ff-header-label">Filtrer etter fylke</span>
      </div>
      <div class="ff-fylke-chips">
        ${FYLKER.map(fy => {
          const on = fylkeFilter.has(fy.slug);
          const cnt = teller[fy.slug] || 0;
          return `<button class="ff-chip${on ? ' on' : ''}" data-slug="${fy.slug}" aria-pressed="${on}">
            ${fy.navn}${cnt > 0 ? `<span class="ff-chip-count">${cnt}</span>` : ''}
          </button>`;
        }).join('')}
      </div>
    </div>
  `;

  container.querySelector('.ff-nullstill')?.addEventListener('click', onNullstill);
  container.querySelector('.ff-crosslink')?.addEventListener('click', onÅpneSubs);

  container.querySelectorAll('.ff-chip').forEach(chip => {
    chip.addEventListener('click', () => onToggle(chip.dataset.slug));
  });
}
