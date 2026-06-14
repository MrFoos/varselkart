// Tema-veksling for Om-siden.
// Egen fil (ikke inline) fordi prod-CSP-en ikke tillater 'unsafe-inline' for script-src.
const root = document.documentElement;
const btn = document.getElementById('dark-toggle');
const ac = 'var(--accent)';
const sunSvg = `<svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="${ac}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0"><circle cx="10" cy="10" r="4"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"/></svg>`;
const moonSvg = `<svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="${ac}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0"><path d="M16 11.5A6 6 0 119 4a5 5 0 007 7.5z"/></svg>`;

function applyTheme(dark) {
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  btn.innerHTML = dark ? sunSvg : moonSvg;
}

// Deler vk_dark-nøkkel med kartsiden så temaet huskes på tvers av sider
const stored = localStorage.getItem('vk_dark');
let dark = stored === '1';
applyTheme(dark);

btn.addEventListener('click', () => {
  dark = !dark;
  localStorage.setItem('vk_dark', dark ? '1' : '0');
  applyTheme(dark);
});
