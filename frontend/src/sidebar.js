// Varsel-liste og detaljvisning for B2 (Uttrykksfull/Varm) layout.

import { KILDE_META, FAREGRAD, MET_LEVEL, FYLKER, DATEX_KATEGORI, adaptVarsel, ferskhetsState, varselLifecycle, buildVinduer, formaterDatoLokal, vkUntil, alvorsFarge, alvorRang, formaterDato, formaterKlokke, formaterRelativ } from './data.js';
import { ikonHTML } from './icons.js';

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Shared badge/pill helpers ────────────────────────────────────────────

function severityBadgeHTML(v, big = false) {
  const fs = big ? 13 : 12;
  const pad = big ? '5px 11px 5px 7px' : '3px 9px 3px 5px';
  const style = `display:inline-flex;align-items:center;gap:7px;padding:${pad};border-radius:var(--pill);background:var(--chip-bg);font-family:var(--font-ui);font-size:${fs}px;font-weight:600;color:var(--text);line-height:1;border:1px solid var(--line)`;

  if (v.src === 'met' && v.metLevel) {
    const lv = MET_LEVEL[v.metLevel];
    if (!lv) return '';
    return `<span style="${style}"><span style="width:13px;height:13px;border-radius:3px;background:${lv.col};flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)"></span>${lv.navn}</span>`;
  }
  if (v.faregrad) {
    const fg = FAREGRAD[v.faregrad];
    if (!fg) return '';
    const darkTxt = v.faregrad <= 2;
    return `<span style="${style}"><span style="width:17px;height:17px;border-radius:4px;background:${fg.col};color:${darkTxt ? '#1a1206' : '#fff'};display:inline-flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:11px;font-weight:700;flex-shrink:0">${v.faregrad}</span>Faregrad ${v.faregrad} · ${fg.navn}</span>`;
  }
  if (v.src === 'vegvesen') {
    const kat = DATEX_KATEGORI[v.kilde_kategori];
    const navn = kat?.navn || v.kilde_kategori || 'Trafikkinformasjon';
    const ikonNavn = kat?.ikon || 'alert';
    const meta = KILDE_META[v.src];
    const ident = meta?.ident || '#999';
    return `<span style="${style}">${ikonHTML(ikonNavn, { size: big ? 16 : 14, color: ident, strokeWidth: 1.9 })}${navn}</span>`;
  }
  const meta = KILDE_META[v.src];
  const ident = meta?.ident || '#999';
  return `<span style="${style}"><span style="width:9px;height:9px;border-radius:99px;background:${ident};flex-shrink:0"></span>${v.severityText}</span>`;
}

function freshnessPillHTML(v) {
  const { state, label } = varselLifecycle(v);
  const map = {
    planned:   { fg: 'var(--dim)',       bg: 'var(--chip-bg)',   dot: false },
    active:    { fg: 'var(--ok-color)',  bg: 'var(--fresh-bg)',  dot: true  },
    ending:    { fg: 'var(--ending-fg)', bg: 'var(--ending-bg)', dot: true  },
    suspended: { fg: 'var(--ending-fg)', bg: 'var(--ending-bg)', dot: false },
    expired:   { fg: 'var(--dim)',       bg: 'var(--chip-bg)',   dot: false },
    paused:    { fg: 'var(--dim)',       bg: 'var(--chip-bg)',   dot: false },
  }[state] || { fg: 'var(--dim)', bg: 'var(--chip-bg)', dot: false };
  const dot = map.dot ? `<span style="width:6px;height:6px;border-radius:99px;background:${map.fg};flex-shrink:0"></span>` : '';
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:var(--pill);background:${map.bg};color:${map.fg};font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:.03em;text-transform:uppercase">${dot}${label}</span>`;
}

function sourceTagHTML(kilde) {
  const meta = KILDE_META[kilde];
  if (!meta) return '';
  return `<span style="display:inline-flex;align-items:center;gap:6px;color:var(--dim);font-family:var(--font-mono);font-size:11px;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap"><span style="width:7px;height:7px;border-radius:99px;background:${meta.ident};flex-shrink:0"></span>${meta.navn}</span>`;
}

// ── Warning row (liste-element) ─────────────────────────────────────────

function lagVarselKort(v, { onVelg }) {
  const el = document.createElement('button');
  el.className = 'varsel-kort';
  el.dataset.id = v.id;
  const { state } = varselLifecycle(v);
  if (state === 'expired') el.classList.add('expired');

  const tidTekst = state === 'planned'
    ? `Starter ${formaterDato(v.startTid || v.gyldigTil)}`
    : `Gyldig til ${formaterDato(v.gyldigTil)}`;

  const subLinje = state === 'planned' && v.startTid
    ? `<div class="vk-row-sublinje">Starter ${vkUntil(v.startTid)}</div>`
    : state === 'ending'
    ? `<div class="vk-row-sublinje">Utløper ${vkUntil(v.gyldigTil)}</div>`
    : '';

  const facetChips = v.facets?.length > 1
    ? `<div class="vk-fasett-chips">${
        v.facets.map(f => {
          const navn = DATEX_KATEGORI[f.kilde_kategori]?.navn || f.kilde_kategori || '';
          return navn ? `<span class="vk-fasett-chip">${navn}</span>` : '';
        }).filter(Boolean).join('')
      }</div>`
    : '';

  el.innerHTML = `
    <div class="vk-row-top">
      ${severityBadgeHTML(v)}
      ${freshnessPillHTML(v)}
    </div>
    <div class="vk-row-tittel">${esc(v.tittel)}${v.omrade ? ` <span class="vk-row-omrade">— ${esc(v.omrade)}</span>` : ''}</div>
    ${facetChips}
    ${subLinje}
    <div class="vk-row-meta">
      ${sourceTagHTML(v.src)}
      <span class="vk-dot-sep">·</span>
      <span class="vk-tid">${tidTekst}</span>
    </div>
  `;

  el.addEventListener('click', () => onVelg(v));
  return el;
}

// ── Timeline ─────────────────────────────────────────────────────────────

function _formaterDager(dager) {
  const norsk = { monday:'man', tuesday:'tir', wednesday:'ons', thursday:'tor', friday:'fre', saturday:'lør', sunday:'søn' };
  if (!dager?.length) return '';
  return dager.map(d => norsk[d.toLowerCase()] || d).join(', ');
}

function tidslinjeHTML(v) {
  const startIso = v.startTid || v.utstedt;
  if (!startIso || !v.gyldigTil) return '';
  const start = new Date(startIso).getTime();
  const end = new Date(v.gyldigTil).getTime();
  const now = Date.now();
  if (end <= start) return '';

  const { state } = varselLifecycle(v);
  const nowPct = state === 'planned' ? 0
    : Math.round(Math.max(0, Math.min(1, (now - start) / (end - start))) * 100);

  const hasPerioder = v.perioder?.length > 0;
  const vinduer = hasPerioder ? buildVinduer(v) : [];
  let trackContent = '';
  if (hasPerioder) {
    const span = end - start;
    trackContent = vinduer.map(win => {
      const left  = Math.max(0, (win.start.getTime() - start) / span);
      const right = Math.min(1, (win.slutt.getTime() - start) / span);
      const width = right - left;
      if (width <= 0) return '';
      return `<div class="wd-tl-segment" style="left:${Math.round(left*100)}%;width:${Math.round(width*100)}%"></div>`;
    }).join('');
  } else {
    const fillCol = state === 'planned' || state === 'expired' ? 'var(--dim)'
      : state === 'ending' ? '#b4791b'
      : 'var(--accent)';
    trackContent = `<div class="wd-tl-fill" style="width:${nowPct}%;background:${fillCol}"></div>`;
  }

  const perioderHTML = (() => {
    if (!hasPerioder || !vinduer.length) return '';
    const merged = [{ start: vinduer[0].start, slutt: vinduer[0].slutt }];
    for (let i = 1; i < vinduer.length; i++) {
      const last = merged[merged.length - 1];
      if (vinduer[i].start.getTime() - last.slutt.getTime() <= 60000) {
        last.slutt = new Date(Math.max(last.slutt.getTime(), vinduer[i].slutt.getTime()));
      } else {
        merged.push({ start: vinduer[i].start, slutt: vinduer[i].slutt });
      }
    }
    const seen = new Set();
    const pats = [];
    for (const w of merged) {
      const k = `${formaterKlokke(w.start)}-${formaterKlokke(w.slutt)}`;
      if (!seen.has(k)) { seen.add(k); pats.push(`${formaterKlokke(w.start)}–${formaterKlokke(w.slutt)}`); }
    }
    const dagerTekst = v.perioder[0]?.dager?.length ? ` (${_formaterDager(v.perioder[0].dager)})` : '';
    return `<div class="wd-tl-perioder">Berørt ${pats.join(', ')}${dagerTekst}</div>`;
  })();

  return `
    <div class="wd-tidslinje">
      <div class="wd-tl-label">Varighet</div>
      <div class="wd-tl-track">
        ${trackContent}
        <div class="wd-tl-naa" style="left:${nowPct}%"></div>
      </div>
      <div class="wd-tl-ankre">
        <span>${formaterDato(startIso)}</span>
        <span>${formaterDato(v.gyldigTil)}</span>
      </div>
      ${perioderHTML}
    </div>
  `;
}

// ── Relaterte varsler ─────────────────────────────────────────────────────

function relaterteVarslerHTML(v, alleSituasjoner) {
  const relaterte = alleSituasjoner
    .filter(s => s.src === v.src && s.id !== v.id)
    .filter(s => {
      if (!v.fylker?.length || !s.fylker?.length) return true;
      return s.fylker.some(f => v.fylker.includes(f));
    })
    .slice(0, 3);

  if (!relaterte.length) return '';

  const rader = relaterte.map(r => `
    <button class="wd-rel-kort" data-id="${r.id}" type="button">
      <span class="wd-rel-tittel">${esc(r.tittel)}</span>
      <span class="wd-rel-meta">Gyldig til ${formaterDato(r.gyldigTil)}</span>
    </button>
  `).join('');

  return `
    <div class="wd-relaterte">
      <div class="wd-relaterte-label">Relaterte varsler</div>
      ${rader}
    </div>
  `;
}

// ── Warning detail ──────────────────────────────────────────────────────

function kommentarHTML(raw) {
  if (!raw) return '';
  const setninger = raw.split(/\s*[|\n]+\s*/).map(s => s.trim()).filter(Boolean);
  return setninger.map(s => `<p class="wd-beskrivelse">${esc(s)}</p>`).join('');
}

function byggDetalj(v, container, { onLukk, rawVarsler = [], onVelgRelater }) {
  const meta = KILDE_META[v.src] || {};
  const lenke = v.lenke || meta.lenke || '#';

  const norm = s => s.trim().replace(/\s+/g, ' ');
  const seen = new Set();
  if (v.beskrivelse) seen.add(norm(v.beskrivelse));

  const fasettHTML = v.facets?.length > 1
    ? `<div class="wd-fasetter">
        <div class="wd-fasetter-label">Hendelsestyper</div>
        ${v.facets.map(f => {
          const txt = f.beskrivelse?.trim();
          const unique = txt && !seen.has(norm(txt));
          if (unique) seen.add(norm(txt));
          return `<div class="wd-fasett-rad">
            ${severityBadgeHTML(f)}
            ${unique ? kommentarHTML(txt) : ''}
          </div>`;
        }).join('')}
      </div>`
    : '';

  container.innerHTML = `
    <div class="wd-wrap">
      <div class="wd-header">
        <div class="wd-nav-row">
          <button class="wd-tilbake">${ikonHTML('back', { size: 15, color: 'var(--dim)' })} <span>Alle varsler</span></button>
          ${freshnessPillHTML(v)}
        </div>
        ${severityBadgeHTML(v, true)}
        <h2 class="wd-tittel">${esc(v.tittel)}</h2>
        ${v.omrade ? `<div class="wd-omrade">${ikonHTML('pin', { size: 15, color: 'var(--dim)' })} <span>${esc(v.omrade)}</span></div>` : ''}
      </div>
      <div class="wd-body">
        ${kommentarHTML(v.beskrivelse)}
        ${v.instruks ? `<div class="wd-instruks"><div class="wd-instruks-label">Kildens råd</div><div class="wd-instruks-tekst">${v.instruks}</div></div>` : ''}
        ${fasettHTML}
        <div class="wd-meta-tabell">
          ${(() => {
            const starterVindu = v.perioder?.length ? buildVinduer(v)[0]?.start : null;
            return starterVindu
              ? `<div class="wd-meta-rad"><span>Starter</span><span>${formaterDatoLokal(starterVindu)}</span></div>`
              : v.startTid
              ? `<div class="wd-meta-rad"><span>Starter</span><span>${formaterDato(v.startTid)}</span></div>`
              : '';
          })()}
          ${v.gyldigTil ? `<div class="wd-meta-rad"><span>Slutter</span><span>${formaterDato(v.gyldigTil)}</span></div>` : ''}
          ${v.utstedt ? `<div class="wd-meta-rad"><span>Publisert</span><span>${formaterDato(v.utstedt)}</span></div>` : ''}
          ${v.fylker?.length ? `<div class="wd-meta-rad"><span>Fylke${v.fylker.length > 1 ? 'r' : ''}</span><span>${v.fylker.map(s => FYLKER.find(f => f.slug === s)?.navn || s).join(', ')}</span></div>` : ''}
        </div>
        ${tidslinjeHTML(v)}
        <div class="wd-kilde-row">
          <span class="wd-kilde-dot" style="background:${meta.ident || '#999'}"></span>
          <div class="wd-kilde-info">
            <div class="wd-kilde-org">${meta.org || meta.navn || v.src}</div>
            <div class="wd-kilde-attr">${meta.attr || ''}</div>
          </div>
        </div>
        <a href="${lenke}" target="_blank" rel="noopener noreferrer" class="wd-lenke-btn">
          Åpne offisielt varsel ${ikonHTML('ext', { size: 16, color: 'var(--on-accent)' })}
        </a>
        ${relaterteVarslerHTML(v, rawVarsler)}
        <p class="disclaimer-note">varselkart.no samler offisielle varsler fra MET, NVE og Statens vegvesen på ett kart, og gjengir dem slik de er publisert. Vi vurderer ikke alvorlighetsgrad selv. Ved akutt fare — ring 110/112 og følg offisielle kanaler. Dette er ikke en nødtjeneste.</p>
      </div>
    </div>
  `;

  container.querySelector('.wd-tilbake')?.addEventListener('click', onLukk);
  container.querySelectorAll('.wd-rel-kort[data-id]').forEach(btn => {
    const sit = rawVarsler.find(s => String(s.id) === btn.dataset.id);
    if (sit) btn.addEventListener('click', () => onVelgRelater?.(sit));
  });
}

// ── Public API ──────────────────────────────────────────────────────────

function _byggListeInnhold(container, { paagang, planlagt, utlopt, visGruppeLabels, onVelgVarsel }) {
  container.innerHTML = '';
  if (visGruppeLabels) {
    const lbl = document.createElement('div');
    lbl.className = 'rail-gruppe-label';
    lbl.textContent = 'Pågår nå';
    container.appendChild(lbl);
  }
  for (const v of paagang) {
    container.appendChild(lagVarselKort(v, { onVelg(varsel) { markerVarselIListe(varsel.id); onVelgVarsel(varsel); } }));
  }
  if (visGruppeLabels) {
    const lbl = document.createElement('div');
    lbl.className = 'rail-gruppe-label';
    lbl.textContent = 'Planlagt';
    container.appendChild(lbl);
  }
  for (const v of planlagt) {
    container.appendChild(lagVarselKort(v, { onVelg(varsel) { markerVarselIListe(varsel.id); onVelgVarsel(varsel); } }));
  }
  for (const v of utlopt) {
    container.appendChild(lagVarselKort(v, { onVelg(varsel) { markerVarselIListe(varsel.id); onVelgVarsel(varsel); } }));
  }
}

let _varselCache = [];

export function byggVarselListe(situasjoner, { onVelgVarsel, fylkeFilter }) {
  _varselCache = situasjoner;
  const unikke = situasjoner;

  // Sortering innen pågående: farevarsel > alvor > soonest expiry
  function sorterPaagang(a, b) {
    const gaFare = KILDE_META[a.src]?.gruppe === 'Farevarsler';
    const gbFare = KILDE_META[b.src]?.gruppe === 'Farevarsler';
    if (gaFare !== gbFare) return gaFare ? -1 : 1;
    const rangDiff = alvorRang(b) - alvorRang(a);
    if (rangDiff !== 0) return rangDiff;
    return new Date(a.gyldigTil || 0).getTime() - new Date(b.gyldigTil || 0).getTime();
  }

  // Sortering innen planlagt: soonest next-relevant time first
  // For paused: next window start; for planned: startTid
  function nesteRelevantTid(v) {
    if (varselLifecycle(v).state === 'paused') {
      const now = new Date();
      const neste = buildVinduer(v).find(w => w.start > now);
      return neste ? neste.start.getTime() : new Date(v.gyldigTil || 0).getTime();
    }
    return new Date(v.startTid || v.gyldigTil || 0).getTime();
  }

  function sorterPlanlagt(a, b) {
    return nesteRelevantTid(a) - nesteRelevantTid(b);
  }

  const paagang  = unikke.filter(v => { const s = varselLifecycle(v).state; return s === 'active' || s === 'ending' || s === 'suspended'; }).sort(sorterPaagang);
  const planlagt = unikke.filter(v => { const s = varselLifecycle(v).state; return s === 'planned' || s === 'paused'; }).sort(sorterPlanlagt);
  const utlopt = unikke.filter(v => varselLifecycle(v).state === 'expired');

  const deduplisert = [...paagang, ...planlagt, ...utlopt];
  const aktive = [...paagang, ...planlagt];

  const header = document.getElementById('rail-header');
  const liste = document.getElementById('varsel-list');
  const disclaimer = document.getElementById('disclaimer');
  if (!header || !liste) return;

  // Tom-tilstand når filter er aktivt men ingen aktive varsler i valgte fylker
  if (aktive.length === 0 && fylkeFilter?.size > 0) {
    const namn = [...fylkeFilter]
      .map(slug => FYLKER.find(f => f.slug === slug)?.navn)
      .filter(Boolean);

    header.innerHTML = `
      <div class="rail-section-head">
        <h2 class="rail-section-tittel">Aktive varsler</h2>
        <span class="rail-section-count">0 aktive</span>
      </div>
    `;
    liste.innerHTML = `
      <div class="ff-tom-tilstand">
        <p>Ingen aktive varsler i <strong>${namn.join(', ')}</strong> akkurat nå.</p>
      </div>
    `;
    if (disclaimer) disclaimer.innerHTML = '';

    const mobileHeader = document.getElementById('mobile-rail-header');
    const mobileList = document.getElementById('mobile-varsel-list');
    const mobileDisclaimer = document.getElementById('mobile-disclaimer');
    if (mobileHeader) mobileHeader.innerHTML = header.innerHTML;
    if (mobileList) mobileList.innerHTML = liste.innerHTML;
    if (mobileDisclaimer) mobileDisclaimer.innerHTML = '';
    return;
  }

  const countTekst = planlagt.length > 0
    ? `${paagang.length} pågår · ${planlagt.length} planlagt`
    : `${paagang.length} aktive`;

  header.innerHTML = `
    <div class="rail-section-head">
      <h2 class="rail-section-tittel">Aktive varsler</h2>
      <span class="rail-section-count">${countTekst}</span>
    </div>
  `;

  const visGruppeLabels = paagang.length > 0 && planlagt.length > 0;

  const listeOpts = { paagang, planlagt, utlopt, visGruppeLabels, onVelgVarsel };
  _byggListeInnhold(liste, listeOpts);

  if (disclaimer) {
    disclaimer.innerHTML = `<p class="disclaimer-note">varselkart.no samler offisielle varsler fra MET, NVE og Statens vegvesen på ett kart, og gjengir dem slik de er publisert. Vi vurderer ikke alvorlighetsgrad selv. Ved akutt fare — ring 110/112 og følg offisielle kanaler. Dette er ikke en nødtjeneste.</p>`;
  }

  // Speil til mobil-kolonne
  const mobileHeader = document.getElementById('mobile-rail-header');
  const mobileList = document.getElementById('mobile-varsel-list');
  const mobileDisclaimer = document.getElementById('mobile-disclaimer');
  if (mobileHeader) mobileHeader.innerHTML = header.innerHTML;
  if (mobileList) _byggListeInnhold(mobileList, listeOpts);
  if (mobileDisclaimer) mobileDisclaimer.innerHTML = disclaimer?.innerHTML || '';
}

function _settSkelettInnhold(header, liste, mobileHeader, mobileList, skjelettHTML) {
  if (header) header.innerHTML = `
    <div class="rail-section-head">
      <h2 class="rail-section-tittel">Aktive varsler</h2>
      <span class="rail-section-count">
        <span class="laster-spinner" aria-hidden="true"></span>Laster …
      </span>
    </div>`;
  if (liste) liste.innerHTML = skjelettHTML;
  if (mobileHeader && header) mobileHeader.innerHTML = header.innerHTML;
  if (mobileList) mobileList.innerHTML = skjelettHTML;
}

export function visSkelettListe(n = 4) {
  const header = document.getElementById('rail-header');
  const liste = document.getElementById('varsel-list');
  const mobileHeader = document.getElementById('mobile-rail-header');
  const mobileList = document.getElementById('mobile-varsel-list');

  const skjelettHTML = Array.from({ length: n }, () => `
    <div class="varsel-kort-skeleton" aria-hidden="true">
      <div class="sk-row-top">
        <div class="sk-line sk-line--badge"></div>
        <div class="sk-line sk-line--pill"></div>
      </div>
      <div class="sk-line sk-line--wide"></div>
      <div class="sk-line sk-line--med"></div>
      <div class="sk-line sk-line--smal"></div>
    </div>`).join('');

  _settSkelettInnhold(header, liste, mobileHeader, mobileList, skjelettHTML);
}

export function visFeilListe(onPrøvIgjen) {
  const header = document.getElementById('rail-header');
  const liste = document.getElementById('varsel-list');
  const mobileHeader = document.getElementById('mobile-rail-header');
  const mobileList = document.getElementById('mobile-varsel-list');

  const headerHTML = `
    <div class="rail-section-head">
      <h2 class="rail-section-tittel">Aktive varsler</h2>
    </div>`;
  const feilHTML = `
    <div class="last-feil">
      <p class="last-feil-tekst">Kunne ikke hente varsler</p>
      <button class="last-feil-btn" type="button">Prøv igjen</button>
    </div>`;

  if (header) header.innerHTML = headerHTML;
  if (mobileHeader) mobileHeader.innerHTML = headerHTML;

  const settFeil = (container) => {
    if (!container) return;
    container.innerHTML = feilHTML;
    container.querySelector('.last-feil-btn')?.addEventListener('click', onPrøvIgjen);
  };
  settFeil(liste);
  settFeil(mobileList);
}

export function visVarselDetalj(varsel, { onLukk, alleVarsler = [], onVelgRelater }) {
  // Aksepterer både rå API-respons og allerede-adaptert objekt
  const adapted = varsel.src ? varsel : adaptVarsel(varsel);

  if (window.innerWidth > 700) {
    // Desktop: erstatt liste med detalj i left-rail
    const railList = document.getElementById('rail-list-wrap');
    const railDetail = document.getElementById('rail-detail');
    if (railList) railList.hidden = true;
    if (railDetail) {
      railDetail.hidden = false;
      byggDetalj(adapted, railDetail, {
        onLukk: () => { skjulDetalj(); onLukk?.(); },
        rawVarsler: alleVarsler,
        onVelgRelater,
      });
    }
  } else {
    // Mobil: åpne bottom sheet
    const sheetDetail = document.getElementById('sheet-detail');
    if (sheetDetail) {
      byggDetalj(adapted, sheetDetail, {
        onLukk: () => { lukkSheet('sheet-detail'); onLukk?.(); },
        rawVarsler: alleVarsler,
        onVelgRelater,
      });
    }
    åpneSheet('sheet-detail');
  }
}

export function skjulDetalj() {
  if (window.innerWidth > 700) {
    const railList = document.getElementById('rail-list-wrap');
    const railDetail = document.getElementById('rail-detail');
    if (railList) railList.hidden = false;
    if (railDetail) {
      railDetail.hidden = true;
      railDetail.innerHTML = '';
    }
  } else {
    lukkSheet('sheet-detail');
  }
  document.querySelectorAll('.varsel-kort').forEach(k => k.classList.remove('aktiv'));
}

export function markerVarselIListe(varselId) {
  document.querySelectorAll('.varsel-kort').forEach(k => {
    k.classList.toggle('aktiv', String(k.dataset.id) === String(varselId));
  });
  const mål = document.querySelector(`.varsel-kort[data-id="${varselId}"]`);
  mål?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export function markerVarslerIListe(ids) {
  const idSet = new Set(ids.map(String));
  document.querySelectorAll('.varsel-kort').forEach(k => {
    k.classList.toggle('aktiv', idSet.has(String(k.dataset.id)));
  });
  const første = ids[0] && document.querySelector(`.varsel-kort[data-id="${ids[0]}"]`);
  første?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ── Sheet helpers ───────────────────────────────────────────────────────

export function åpneSheet(id) {
  const el = document.getElementById(id);
  const scrim = document.getElementById('scrim');
  if (el) el.classList.add('open');
  if (scrim) scrim.classList.add('open');
}

export function lukkSheet(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
  // Lukk scrim bare hvis ingen sheets er åpne
  const åpne = document.querySelectorAll('.sheet.open');
  if (!åpne.length) {
    document.getElementById('scrim')?.classList.remove('open');
  }
}
