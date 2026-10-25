// Проверка действующего полиса ОСЦПВ. Открытого API у МТСБУ нет (публичная форма защищена капчей), поэтому подключение идёт
// через договор с МТСБУ или партнёра-поставщика. Контракт: GET INSURANCE_API_URL?vin=&plate=&date=YYYY-MM-DD, Bearer INSURANCE_API_KEY
//   -> { status: 'active'|'none'|'pending', insurer?, number?, from?, to?, kind? }
import { cfg } from './config.js';
import { mtsbuEnabled, mtsbuInsurance } from './mtsbu.js';

export const insuranceEnabled = () => mtsbuEnabled() || Boolean(cfg.insuranceUrl);
const TTL = 6 * 3600e3;
const cache = new Map();
const day = (v) => String(v || '').slice(0, 10);

export function normalizeInsurance(j) {
  const st = String(j?.status || '').toLowerCase();
  const status = ['active', 'none', 'pending'].includes(st) ? st : j?.active === true ? 'active' : j?.active === false ? 'none' : 'unknown';
  return { status, insurer: String(j?.insurer || '').slice(0, 80), from: day(j?.from), to: day(j?.to), kind: String(j?.kind || '').slice(0, 30) };
}

export async function checkInsurance({ vin, plate = '' }, { fetchFn = fetch } = {}) {
  if (!insuranceEnabled() || (!vin && !plate)) return null;
  const date = new Date().toISOString().slice(0, 10), key = `${vin}|${plate}|${date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  try {
    if (mtsbuEnabled()) {
      const v = { ...(await mtsbuInsurance({ vin, plate }, { fetchFn })), checkedAt: new Date().toISOString() };
      cache.set(key, { t: Date.now(), v });
      return v;
    }
    const u = new URL(cfg.insuranceUrl);
    if (vin) u.searchParams.set('vin', vin);
    if (plate) u.searchParams.set('plate', plate);
    u.searchParams.set('date', date);
    const r = await fetchFn(u, { headers: { authorization: `Bearer ${cfg.insuranceKey}`, accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('insurance ' + r.status);
    const v = { ...normalizeInsurance(await r.json()), checkedAt: new Date().toISOString() };
    cache.set(key, { t: Date.now(), v });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return v;
  } catch (e) { console.error('insurance failed:', e.message); return null; }
}
