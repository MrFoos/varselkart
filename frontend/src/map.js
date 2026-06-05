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
          attribution: '© <a href="https://kartverket.no">Kartverket</a>',
          minzoom: 0,
          maxzoom: 18,
        },
      },
      layers: [{ id: 'basemap', type: 'raster', source: 'kartverket' }],
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    },
    center: [15.0, 65.5],
    zoom: 4.5,
    minZoom: 3,
    maxZoom: 16,
  });

  return map;
}

export function settinnFylkerLag(map, geojson) {
  if (map.getSource('fylker')) return;
  map.addSource('fylker', { type: 'geojson', data: geojson });
  map.addLayer({
    id: 'fylker-grenser',
    type: 'line',
    source: 'fylker',
    paint: {
      'line-color': 'rgba(255,255,255,0.15)',
      'line-width': 0.8,
    },
  });
}
