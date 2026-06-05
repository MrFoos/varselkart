const KILDE_LABEL = {
  met: 'MET',
  nve_flom: 'NVE Flom',
  nve_jordskred: 'NVE Jordskred',
  nve_snoskred: 'NVE Snøskred',
  vegvesen: 'Vegvesen',
  avinor: 'Avinor',
};

export function oppdaterStatusBar(feeds) {
  const container = document.getElementById('feed-status-items');
  if (!feeds.length) { container.textContent = 'Ingen feeddata'; return; }

  container.innerHTML = feeds.map(f => {
    const erOk = f.status === 'ok';
    const erFeil = f.status === 'feil';
    const dotKlasse = erOk
      ? (f.antall_aktive > 0 ? 'feed-ok' : 'feed-ok-tom')
      : erFeil ? 'feed-feil'
      : 'feed-ukjent';
    const label = KILDE_LABEL[f.kilde] || f.kilde;
    const count = erOk
      ? (f.antall_aktive > 0 ? ` (${f.antall_aktive})` : '')
      : '';
    const tooltipFeil = f.feilmelding ? f.feilmelding : '';
    const tooltipTid = f.sist_ok ? `Sist ok: ${_kortTid(f.sist_ok)}` : 'Ikke hentet ennå';
    const tittel = [tooltipTid, tooltipFeil].filter(Boolean).join(' — ');
    return `<span class="feed-item" title="${tittel}"><span class="feed-dot ${dotKlasse}"></span>${label}${count}</span>`;
  }).join('');
}

function _kortTid(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
