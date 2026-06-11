// Inline SVG-ikoner.
// Egne ikoner: 20×20 viewBox (strenger).
// Lucide-ikoner (MIT): 24×24 viewBox (objekter med { viewBox, path }).

const PATHS = {
  // ── Egne 20×20 ──────────────────────────────────────────────────────────
  close:  '<path d="M5 5l10 10M15 5L5 15"/>',
  bell:   '<path d="M10 3a4.5 4.5 0 00-4.5 4.5c0 4-1.5 5-1.5 5h12s-1.5-1-1.5-5A4.5 4.5 0 0010 3z"/><path d="M8.5 16.5a1.6 1.6 0 003 0"/>',
  ext:    '<path d="M8 4H4v12h12v-4"/><path d="M12 3h5v5M17 3l-7 7"/>',
  chevR:  '<path d="M7 4l6 6-6 6"/>',
  chevD:  '<path d="M4 7l6 6 6-6"/>',
  layers: '<path d="M10 3l7 4-7 4-7-4 7-4z"/><path d="M3 11l7 4 7-4"/>',
  pin:    '<path d="M10 17s5-4.6 5-9A5 5 0 005 8c0 4.4 5 9 5 9z"/><circle cx="10" cy="8" r="1.8"/>',
  clock:  '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 1.5"/>',
  alert:  '<path d="M10 4l7 12H3l7-12z"/><path d="M10 9v3M10 14.2v.1"/>',
  back:   '<path d="M12 4l-6 6 6 6"/>',
  sun:    '<circle cx="10" cy="10" r="4"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"/>',
  moon:   '<path d="M16 11.5A6 6 0 119 4a5 5 0 007 7.5z"/>',

  // ── Lucide 24×24 (MIT licence, lucide.dev) ───────────────────────────────
  wrench: {
    viewBox: '0 0 24 24',
    path: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
  },
  construction: {
    viewBox: '0 0 24 24',
    path: '<rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/>',
  },
  merge: {
    viewBox: '0 0 24 24',
    path: '<path d="m8 6 4-4 4 4"/><path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22"/><path d="m20 22-5-5"/>',
  },
  'arrows-h': {
    viewBox: '0 0 24 24',
    path: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  },
  gauge: {
    viewBox: '0 0 24 24',
    path: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  },
  flag: {
    viewBox: '0 0 24 24',
    path: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
  },
  'cloud-snow': {
    viewBox: '0 0 24 24',
    path: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 15h.01"/><path d="M8 19h.01"/><path d="M12 17h.01"/><path d="M12 21h.01"/><path d="M16 15h.01"/><path d="M16 19h.01"/>',
  },
  bus: {
    viewBox: '0 0 24 24',
    path: '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  },
  cog: {
    viewBox: '0 0 24 24',
    path: '<path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 2v2"/><path d="M12 22v-2"/><path d="m17 20.66-1-1.73"/><path d="M11 10.27 7 3.34"/><path d="m20.66 17-1.73-1"/><path d="m3.34 7 1.73 1"/><path d="M14 12h8"/><path d="M2 12h2"/><path d="m20.66 7-1.73 1"/><path d="m3.34 17 1.73-1"/><path d="m17 3.34-1 1.73"/><path d="m11 13.73-4 6.93"/>',
  },
};

function _resolve(name) {
  const entry = PATHS[name];
  if (!entry) return { path: '', viewBox: '0 0 20 20' };
  if (typeof entry === 'string') return { path: entry, viewBox: '0 0 20 20' };
  return { path: entry.path, viewBox: entry.viewBox };
}

export function lagIkon(name, { size = 18, color = 'currentColor', strokeWidth = 1.8 } = {}) {
  const { path, viewBox } = _resolve(name);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', color);
  svg.setAttribute('stroke-width', strokeWidth);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.display = 'block';
  svg.style.flexShrink = '0';
  svg.innerHTML = path;
  return svg;
}

export function ikonData(name) {
  return _resolve(name);
}

// Returnerer SVG som HTML-streng (for bruk i innerHTML).
export function ikonHTML(name, { size = 18, color = 'currentColor', strokeWidth = 1.8 } = {}) {
  const { path, viewBox } = _resolve(name);
  return `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none"
    stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"
    style="display:block;flex-shrink:0">${path}</svg>`;
}
