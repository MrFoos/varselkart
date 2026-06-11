// Varselkart-merkevare: mark (diamant + punkt) og ordmerke.

export function lagVKMark(size = 22, color = 'currentColor') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.style.display = 'block';
  svg.style.flexShrink = '0';

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '4');
  rect.setAttribute('y', '4');
  rect.setAttribute('width', '16');
  rect.setAttribute('height', '16');
  rect.setAttribute('rx', '5');
  rect.setAttribute('transform', 'rotate(45 12 12)');
  rect.setAttribute('stroke', color);
  rect.setAttribute('stroke-width', '2.2');

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '3.2');
  circle.setAttribute('fill', color);

  svg.appendChild(rect);
  svg.appendChild(circle);
  return svg;
}

// Gjengir wordmark i et gitt element.
// Forventer at CSS-variabler (--text, --accent, --faint) er definert på :root.
export function gjengiWordmark(container, { size = 20 } = {}) {
  container.style.gap = `${Math.round(size * 0.42)}px`;

  const mark = lagVKMark(Math.round(size * 1.18), 'var(--accent)');

  const tekst = document.createElement('span');
  tekst.style.cssText = `font-family:var(--font-display);font-weight:var(--display-weight);font-size:${size}px;letter-spacing:-.02em;line-height:1;white-space:nowrap`;

  const varsel = document.createElement('span');
  varsel.style.color = 'var(--text)';
  varsel.textContent = 'varsel';

  const kart = document.createElement('span');
  kart.style.color = 'var(--accent)';
  kart.textContent = 'kart';

  const no = document.createElement('span');
  no.style.cssText = `color:var(--dim);font-size:${Math.round(size * 0.62)}px;font-weight:600;letter-spacing:0;margin-left:1px`;
  no.textContent = '.no';

  tekst.appendChild(varsel);
  tekst.appendChild(kart);
  tekst.appendChild(no);

  container.innerHTML = '';
  container.appendChild(mark);
  container.appendChild(tekst);
}
