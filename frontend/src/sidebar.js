/**
 * Varsel-liste i sidebar / bottom sheet.
 * Kobler kart ↔ liste: klikk på kart → scroll i liste, klikk i liste → fly til kart.
 */

const KILDE_LABEL = {
  met: 'MET',
  nve_flom: 'NVE Flom',
  nve_jordskred: 'NVE Jordskred',
  nve_snoskred: 'NVE Snøskred',
  vegvesen: 'Statens vegvesen',
  avinor: 'Avinor',
};

const KILDE_LENKE = {
  met: 'https://www.yr.no/nb/varsler',
  nve_flom: 'https://varsom.no/flom-og-jordskredvarsling/flomvarsling/',
  nve_jordskred: 'https://varsom.no/flom-og-jordskredvarsling/jordskredvarsling/',
  nve_snoskred: 'https://varsom.no/snoskredvarsling/',
  vegvesen: 'https://www.vegvesen.no/trafikkinformasjon/',
  avinor: 'https://avinor.no',
};

function badgeKlasse(v) {
  const a = (v.kilde_alvorsetikett || '').toLowerCase();
  if (v.kilde === 'met') {
    if (a.includes('gult')) return 'badge-gul';
    if (a.includes('oransje')) return 'badge-oransje';
    if (a.includes('rødt')) return 'badge-rod';
  }
  if (v.kilde.startsWith('nve')) {
    const n = parseInt(a, 10);
    return n >= 3 ? 'badge-nve-dim' : 'badge-nve';
  }
  if (v.kilde === 'vegvesen') return 'badge-veg';
  if (v.kilde === 'avinor') return a === 'c' ? 'badge-rod' : 'badge-veg';
  return 'badge-ukjent';
}

function badgeTekst(v) {
  if (v.kilde_alvorsetikett) return v.kilde_alvorsetikett;
  return v.kilde_kategori || '–';
}

function formaterTid(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('no-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso.slice(0, 16);
  }
}

export function byggSidebar(varsler, { onVelgVarsel }) {
  const liste = document.getElementById('varsel-list');
  const tom = document.getElementById('tom-melding');
  const count = document.getElementById('varsel-count');

  const aktive = varsler.filter(v => v.status === 'aktiv');
  count.textContent = aktive.length
    ? `${aktive.length} aktiv${aktive.length !== 1 ? 'e' : ''}`
    : 'Ingen aktive varsler';

  // Fjern eksisterende kort (behold tom-melding)
  liste.querySelectorAll('.varsel-kort').forEach(el => el.remove());

  if (!aktive.length) {
    tom.style.display = 'block';
    return;
  }
  tom.style.display = 'none';

  // Sorter: rødt/høy faregrad øverst
  const sortert = [...aktive].sort((a, b) => alvorRang(b) - alvorRang(a));

  for (const v of sortert) {
    const kort = document.createElement('div');
    kort.className = 'varsel-kort';
    kort.dataset.id = v.id;

    const kildeUrl = v.lenke || KILDE_LENKE[v.kilde] || '#';
    const kildeNavn = KILDE_LABEL[v.kilde] || v.kilde;
    const gyldigTil = v.gyldig_til ? `Gyldig til ${formaterTid(v.gyldig_til)}` : '';

    kort.innerHTML = `
      <span class="alvor-badge ${badgeKlasse(v)}">${badgeTekst(v)}</span>
      <div class="tittel">${v.tittel || '(uten tittel)'}</div>
      <div class="meta">
        <a href="${kildeUrl}" target="_blank" rel="noopener">${kildeNavn}</a>
        ${gyldigTil ? `<span>·</span><span>${gyldigTil}</span>` : ''}
      </div>
    `;

    kort.addEventListener('click', () => {
      document.querySelectorAll('.varsel-kort').forEach(k => k.classList.remove('aktiv'));
      kort.classList.add('aktiv');
      onVelgVarsel(v);
      // Åpne bottom sheet på mobil
      document.getElementById('sidebar').classList.add('open');
    });

    liste.appendChild(kort);
  }
}

export function markerVarselIListe(varselId) {
  const alle = document.querySelectorAll('.varsel-kort');
  alle.forEach(k => k.classList.remove('aktiv'));
  const mål = document.querySelector(`.varsel-kort[data-id="${varselId}"]`);
  if (mål) {
    mål.classList.add('aktiv');
    mål.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    document.getElementById('sidebar').classList.add('open');
  }
}

function alvorRang(v) {
  const a = (v.kilde_alvorsetikett || '').toLowerCase();
  if (a.includes('rødt') || a === '4' || a === '5' || a === 'c') return 3;
  if (a.includes('oransje') || a === '3') return 2;
  if (a.includes('gult') || a === '2' || a === 'd') return 1;
  return 0;
}
