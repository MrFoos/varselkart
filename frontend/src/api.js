const BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8300'
  : '';

let _varselEtag = null;
let _varselCache = null;

export async function hentVarsler(params = {}) {
  const qs = new URLSearchParams({ status: 'aktiv', limit: 500, ...params });
  const headers = {};
  if (_varselEtag) headers['If-None-Match'] = _varselEtag;

  const resp = await fetch(`${BASE}/api/varsler?${qs}`, { headers });

  if (resp.status === 304 && _varselCache) return _varselCache;
  if (resp.status === 304) {
    _varselEtag = null;
    const resp2 = await fetch(`${BASE}/api/varsler?${qs}`);
    if (!resp2.ok) throw new Error(`API feil: ${resp2.status}`);
    const etag2 = resp2.headers.get('ETag');
    if (etag2) _varselEtag = etag2;
    _varselCache = await resp2.json();
    return _varselCache;
  }
  if (!resp.ok) throw new Error(`API feil: ${resp.status}`);

  const etag = resp.headers.get('ETag');
  if (etag) _varselEtag = etag;

  _varselCache = await resp.json();
  return _varselCache;
}

export async function hentStatus() {
  const resp = await fetch(`${BASE}/api/status`);
  if (!resp.ok) throw new Error(`API feil: ${resp.status}`);
  return resp.json();
}

export async function hentFylker() {
  const resp = await fetch(`${BASE}/api/fylker`);
  if (!resp.ok) throw new Error(`API feil: ${resp.status}`);
  return resp.json();
}
