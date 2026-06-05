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
    const dotKlasse = f.status === 'ok' ? 'feed-ok'
      : f.status === 'feil' ? 'feed-feil'
      : 'feed-ukjent';
    const label = KILDE_LABEL[f.kilde] || f.kilde;
    const tid = f.sist_ok ? ` ${_kortTid(f.sist_ok)}` : '';
    const tittel = f.feilmelding ? ` title="${f.feilmelding}"` : '';
    return `<span class="feed-item"${tittel}><span class="feed-dot ${dotKlasse}"></span>${label}${tid}</span>`;
  }).join('');
}

function _kortTid(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
