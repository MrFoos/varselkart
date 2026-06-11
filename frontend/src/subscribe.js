// Abonnements-panel: "Følg fylker" med per-fylke ntfy-varsling.

import { FYLKER } from './data.js';
import { ikonHTML } from './icons.js';

const LS_SUBS = 'vk_subs';
const LS_PUSH = 'vk_push';

export function lastSubs() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_SUBS) || '[]')); }
  catch { return new Set(); }
}

export function lagreSubs(subs) {
  localStorage.setItem(LS_SUBS, JSON.stringify([...subs]));
}

export function lastPush() {
  return localStorage.getItem(LS_PUSH) === '1';
}

export function lagrePush(val) {
  localStorage.setItem(LS_PUSH, val ? '1' : '0');
}

export function byggSubscribePanel(container, varsler, { subs, pushOn, onToggleSub, onTogglePush, onLukk, onÅpneFilter }) {
  const count = subs.size;

  container.innerHTML = `
    <div class="sp-wrap">
      <div class="sp-header">
        <div class="sp-title-row">
          <div class="sp-title-group">
            <span class="sp-bell-icon">${ikonHTML('bell', { size: 19, color: 'var(--accent)' })}</span>
            <div>
              <h2 class="sp-title">Følg fylker</h2>
              <div class="sp-subtitle">${count ? `${count} fylke${count > 1 ? 'r' : ''} valgt` : 'Ingen valgt ennå'}</div>
            </div>
          </div>
          <button class="sp-close-btn" aria-label="Lukk">${ikonHTML('close', { size: 18, color: 'var(--dim)' })}</button>
        </div>
        <p class="sp-intro">Få et nøytralt varsel når et nytt offisielt varsel gjelder fylkene du følger. Vi sender type, område, kildens egen etikett, tidspunkt og lenke — ingen prioritering, ingen alarm.</p>
        ${onÅpneFilter ? `<p class="sp-crosslink-note">Vil du bare se disse fylkene på kartet nå? <button class="sp-crosslink-btn" data-åpne-filter>Bruk filteret</button></p>` : ''}
      </div>

      <div class="sp-push-row">
        <div class="sp-push-inner ${pushOn ? 'sp-push-on' : ''}">
          <div class="sp-push-text">
            <div class="sp-push-label">${pushOn ? 'Varsling på i nettleseren' : 'Slå på varsling i nettleseren'}</div>
            <div class="sp-push-note">Web Push via ntfy.varselkart.no. Safari spiller ikke lyd.</div>
          </div>
          <button class="vk-switch ${pushOn ? 'on' : ''}" data-push="1" aria-pressed="${pushOn}" aria-label="Slå varsling av/på">
            <span class="vk-switch-thumb"></span>
          </button>
        </div>
      </div>

      <div class="sp-list-label">15 fylker · 2024-inndelingen</div>
      <div class="sp-fylke-list">
        ${FYLKER.map(fy => {
          const on = subs.has(fy.slug);
          const cnt = varsler.filter(v => (v.fylke_tags || []).includes(fy.slug)).length;
          return `
            <div class="sp-fylke-row" data-slug="${fy.slug}">
              <div class="sp-fylke-info">
                <div class="sp-fylke-name-row">
                  <span class="sp-fylke-navn">${fy.navn}</span>
                  ${cnt > 0 ? `<span class="sp-fylke-count">${cnt} nå</span>` : ''}
                </div>
                <div class="sp-fylke-topic">varsling-${fy.slug}</div>
              </div>
              <button class="vk-switch ${on ? 'on' : ''}" data-sub="${fy.slug}" aria-pressed="${on}" aria-label="Følg ${fy.navn}">
                <span class="vk-switch-thumb"></span>
              </button>
            </div>
          `;
        }).join('')}
      </div>

      <div class="sp-footer">
        Varsling leveres via selvhostet ntfy på ntfy.varselkart.no. Åpen abonnering, ingen konto. Valgene lagres på denne enheten.
      </div>
    </div>
  `;

  container.querySelector('.sp-close-btn')?.addEventListener('click', onLukk);

  container.querySelector('[data-åpne-filter]')?.addEventListener('click', () => {
    onLukk?.();
    onÅpneFilter?.();
  });

  container.querySelector('[data-push]')?.addEventListener('click', e => {
    onTogglePush(!pushOn);
  });

  container.querySelectorAll('[data-sub]').forEach(btn => {
    btn.addEventListener('click', () => onToggleSub(btn.dataset.sub));
  });
}
