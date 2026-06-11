// MapLibre GL oppsett med Kartverket topograatone (gråtone) som basekart

// TileMatrixSet "webmercator" med WMTS-rekkefølge {z}/{TileRow}/{TileCol} = {z}/{y}/{x}
const KARTVERKET_TILES = [
  'https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png',
];

export function initMap() {
  const map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        kartverket: {
          type: 'raster',
          tiles: KARTVERKET_TILES,
          tileSize: 256,
          attribution: '© <a href="https://kartverket.no">Kartverket</a> · Data under <a href="https://data.norge.no/nlod/no/2.0">NLOD 2.0</a>',
          minzoom: 0,
          maxzoom: 18,
        },
      },
      layers: [{ id: 'basemap', type: 'raster', source: 'kartverket' }],
      glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    },
    center: [15.0, 65.5],
    zoom: 4.5,
    minZoom: 3,
    maxZoom: 16,
  });

  map.addControl(new ZoomKontroll(), 'bottom-right');

  return map;
}

export class ZoomKontroll {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    const mkBtn = (act, glyph, label) => {
      const btn = document.createElement('button');
      btn.className = 'vk-zoom-btn';
      btn.setAttribute('aria-label', label);
      btn.innerHTML = `<span class="glyph">${glyph}</span>`;
      btn.addEventListener('click', () => act === 'in' ? map.zoomIn() : map.zoomOut());
      return btn;
    };

    this._container.appendChild(mkBtn('in',  '+',  'Zoom inn'));
    this._container.appendChild(mkBtn('out', '−', 'Zoom ut'));
    return this._container;
  }
  onRemove() { this._container.remove(); }
}

export class NorgeKontroll {
  constructor(onKlikk) { this._onKlikk = onKlikk; }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const btn = document.createElement('button');
    btn.title = 'Vis hele landet';
    btn.setAttribute('aria-label', 'Vis hele landet');
    btn.className = 'vk-zoom-btn';
    btn.innerHTML = `<span class="glyph"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4"/></svg></span>`;
    btn.addEventListener('click', () => this._onKlikk());
    this._container.appendChild(btn);
    return this._container;
  }

  onRemove() { this._container.remove(); }
}

export function settinnFylkerLag(map, geojson) {
  if (map.getSource('fylker')) return;
  map.addSource('fylker', { type: 'geojson', data: geojson });
  map.addLayer({
    id: 'fylker-grenser',
    type: 'line',
    source: 'fylker',
    paint: {
      'line-color': 'rgba(80,60,40,.35)',
      'line-width': 0.8,
    },
  });
}
