const BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : '';

export async function hentVarsler(params = {}) {
  const qs = new URLSearchParams({ status: 'aktiv', limit: 500, ...params });
  const resp = await fetch(`${BASE}/api/varsler?${qs}`);
  if (!resp.ok) throw new Error(`API feil: ${resp.status}`);
  return resp.json();
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
