// Розыск транспортных средств: открытые данные Национальной полиции Украины (data.gov.ua), обновляются ежедневно.
import { normalizeVin } from './vin.js';
import { normalizePlate } from './plate.js';

const PKG = 'ac1a3a9d-512b-446b-9b0c-1383d38ce474';
const FALLBACK = 'https://data.gov.ua/dataset/2cd12755-834b-4c43-9026-fe356ce93af5/resource/2d69d196-02f1-49b9-97fa-0fb69077e05f/download/carswanted.json';
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; VINScope/1.0)', accept: 'application/json' };

export const state = { loaded: false, count: 0, updatedAt: null, sourceModified: null, error: null };
let byVin = new Map(), byPlate = new Map();

async function resolveUrl() {
  try {
    const r = await fetch(`https://data.gov.ua/api/3/action/package_show?id=${PKG}`, { headers: UA, signal: AbortSignal.timeout(20000) });
    const res = (await r.json()).result.resources.find((x) => /carswanted\.json$/i.test(x.url) || x.name === 'CarsWanted.json');
    if (res) return { url: res.url, modified: res.last_modified };
  } catch { /* fallback */ }
  return { url: FALLBACK, modified: null };
}

export async function refreshWanted() {
  try {
    const { url, modified } = await resolveUrl();
    const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rows = await r.json();
    const v = new Map(), p = new Map();
    const push = (m, k, rec) => { if (k.length >= 5) { const a = m.get(k); if (a) a.push(rec); else m.set(k, [rec]); } };
    for (const x of rows) {
      const rec = {
        brand: x.brand, model: x.model, type: x.cartype, color: x.color, plate: x.vehiclenumber || '', vin: x.bodynumber || '',
        chassis: x.chassisnumber || '', engine: x.enginenumber || '', seized: (x.illegalseizuredate || '').slice(0, 10), added: (x.insertdate || '').slice(0, 10), unit: x.organunit || '',
      };
      push(v, normalizeVin(x.bodynumber), rec); push(v, normalizeVin(x.chassisnumber), rec);
      if (x.vehiclenumber) push(p, normalizePlate(x.vehiclenumber), rec);
    }
    byVin = v; byPlate = p;
    Object.assign(state, { loaded: true, count: rows.length, updatedAt: new Date().toISOString(), sourceModified: modified, error: null });
    console.log(`wanted: ${rows.length} records indexed`);
  } catch (e) { state.error = e.message; console.error('wanted refresh failed:', e.message); }
}
export const wantedByVin = (vin) => byVin.get(vin) || [];
export const wantedByPlate = (plate) => byPlate.get(plate) || [];
export function startWanted() {
  refreshWanted();
  setInterval(refreshWanted, 6 * 3600e3).unref();
}
