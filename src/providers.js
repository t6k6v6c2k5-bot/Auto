// Платные поставщики данных по США/Канаде. Подключаются переменными окружения; без них раздел «США» остаётся
// пометкой «планируется» (никаких выдуманных данных).
//   MARKETCHECK_API_KEY  — история онлайн-объявлений по VIN (цены, пробег, дилеры, даты): api.marketcheck.com
//   REPORT_API_URL/KEY   — любой другой поставщик (напр. аукционный) по контракту ниже
// Единая схема результата: { found, queried, providers[], listings[], summary, auction[], odometer[], title, notes[] }
import { cfg } from './config.js';
import * as store from './db.js';

export const providerEnabled = () => Boolean(cfg.marketcheckKey || cfg.reportApiUrl || cfg.apibaraKey);

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(+v) ? null : +v);
const day = (v) => String(v || '').slice(0, 10);
const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : null; } catch { return null; } };

// ---------- MarketCheck: history by VIN ----------
export function normalizeMarketcheck(rows) {
  const seen = new Set(); const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const key = r.id ?? `${r.first_seen_at}|${r.price}|${r.miles}|${r.seller_name}`;
    if (seen.has(key)) continue; seen.add(key);
    out.push({
      firstSeen: day(r.first_seen_at_date), lastSeen: day(r.last_seen_at_date || r.status_date), price: num(r.price) || null, miles: num(r.miles) || null,
      seller: r.seller_name || '', sellerType: r.seller_type || '', inventory: r.inventory_type || '', city: r.city || '', state: r.state || '',
      source: r.source || '', url: safeUrl(r.vdp_url),
    });
  }
  return out.sort((a, b) => (a.firstSeen > b.firstSeen ? 1 : a.firstSeen < b.firstSeen ? -1 : 0));
}

// Сводка + детектор скрутки: пробег по датам не должен уменьшаться (допуск 1500 миль на ошибки ввода в объявлениях)
export function summarize(listings) {
  if (!listings.length) return null;
  const prices = listings.map((l) => l.price).filter(Boolean), miles = listings.filter((l) => l.miles).map((l) => ({ d: l.firstSeen, m: l.miles }));
  let rollback = null, peak = null;
  for (const x of miles) {
    if (peak && peak.m - x.m > 1500 && !rollback) rollback = { from: peak, to: x }; // «пик» пробега до падения и первое заниженное значение
    if (!peak || x.m > peak.m) peak = x;
  }
  return {
    count: listings.length, first: listings[0].firstSeen, last: listings.at(-1).lastSeen || listings.at(-1).firstSeen,
    minPrice: prices.length ? Math.min(...prices) : null, maxPrice: prices.length ? Math.max(...prices) : null, lastPrice: [...listings].reverse().find((l) => l.price)?.price ?? null,
    maxMiles: miles.length ? Math.max(...miles.map((x) => x.m)) : null,
    sellers: new Set(listings.map((l) => l.seller).filter(Boolean)).size, states: [...new Set(listings.map((l) => l.state).filter(Boolean))],
    rollback,
  };
}

async function marketcheck(vin, fetchFn) {
  const u = new URL(`${cfg.marketcheckBase}/v2/history/car/${encodeURIComponent(vin)}`);
  u.searchParams.set('api_key', cfg.marketcheckKey);
  u.searchParams.set('sort_order', 'asc');
  const r = await fetchFn(u, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  if (r.status === 429) throw new Error('marketcheck rate limited');
  if (!r.ok) throw new Error('marketcheck ' + r.status);
  const listings = normalizeMarketcheck(await r.json());
  return { provider: 'MarketCheck', listings };
}

// ---------- универсальный поставщик (REPORT_API_URL) ----------
// GET ?vin=&plan= -> { found, source, sections:{ title:{brand,state,theftRecord,lien}, odometer:[{date,source,km|miles}],
//   auction:[{house,lot,date,primaryDamage,secondaryDamage,estRepairUsd,finalBidUsd,keys,runsDrives,photos,location}] } }
async function generic(vin, plan, fetchFn) {
  const u = new URL(cfg.reportApiUrl); u.searchParams.set('vin', vin); u.searchParams.set('plan', plan);
  const r = await fetchFn(u, { headers: { authorization: `Bearer ${cfg.reportApiKey}`, accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('report provider ' + r.status);
  const j = await r.json(); const s = j.sections || {};
  return { provider: j.source || 'provider', auction: Array.isArray(s.auction) ? s.auction : [], odometer: Array.isArray(s.odometer) ? s.odometer : [], title: s.title || null, found: j.found !== false };
}

// ---------- аукционы Copart/IAAI (Apibara): лоты по VIN, повреждения, цены, пробег, фото ----------
const httpsUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && !/^(localhost|[\d.]+|\[.*\])$/.test(x.hostname) ? x.href : null; } catch { return null; } };
export function normalizeApibara(j) {
  const v = j?.data; if (!v) return null;
  const day = (s) => String(s || '').slice(0, 10);
  const price = (p) => num(p?.last_sold_price_usd) ?? num(p?.sale_price_usd) ?? num(p?.current_bid_usd);
  const main = {
    house: String(v.platform || '').toUpperCase(), date: day(v.auction?.last_sold_day || v.auction?.auction_ended_at || v.auction?.auction_at), lot: String(v.lot_number || ''),
    primaryDamage: v.damage || '', secondaryDamage: '', estRepairUsd: null, finalBidUsd: price(v.pricing), retailUsd: num(v.pricing?.estimated_retail_value_usd),
    keys: null, runsDrives: null, photos: num(v.media?.images_count) ?? (v.media?.photos || []).length, location: v.location?.display || '',
    odometerMi: num(v.odometer?.mi), status: v.auction?.last_sold_status || v.auction?.lot_status || '',
  };
  const rows = [main];
  for (const h of Array.isArray(v.history) ? v.history : []) {
    if (String(h.lot_number || '') === main.lot && day(h.date) === main.date) continue;
    rows.push({ house: String(h.platform || '').toUpperCase(), date: day(h.date), lot: String(h.lot_number ?? ''), primaryDamage: '', finalBidUsd: num(h.price), status: h.status || '', keys: null, runsDrives: null, photos: null });
  }
  for (const l of Array.isArray(v.vin_lots) ? v.vin_lots : []) {
    if (String(l.lot_number || '') === main.lot) continue;
    rows.push({ house: String(l.platform || '').toUpperCase(), date: day(l.auction?.last_sold_day || l.auction?.auction_at), lot: String(l.lot_number ?? ''), primaryDamage: '', finalBidUsd: price(l.pricing), status: l.auction?.last_sold_status || l.auction?.lot_status || '', keys: null, runsDrives: null, photos: null });
  }
  const odometer = main.odometerMi ? [{ date: main.date, source: main.house, miles: main.odometerMi }] : [];
  return { provider: 'auction', auction: rows.sort((a, b) => (a.date < b.date ? 1 : -1)), odometer, photos: (v.media?.photos || []).map(httpsUrl).filter(Boolean).slice(0, 12), title: v.title ? { name: String(v.title).slice(0, 120) } : null, specs: { color: v.color || '', fuel: v.fuel_type || '', transmission: v.transmission || '', drive: v.drive_type || '' } };
}
async function apibara(vin, fetchFn) {
  const r = await fetchFn(`${cfg.apibaraBase}/vehicles/${encodeURIComponent(vin)}?include=history,vin_lots`, { headers: { 'x-api-key': cfg.apibaraKey, accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  if (r.status === 404) return { provider: 'auction', auction: [], odometer: [], photos: [] };
  if (r.status === 429) throw new Error('apibara rate limited');
  if (!r.ok) throw new Error('apibara ' + r.status);
  return normalizeApibara(await r.json()) || { provider: 'auction', auction: [], odometer: [], photos: [] };
}

// ---------- кэш и суточный лимит расходов ----------
const budget = { day: '', n: 0 };
const spend = () => { const d = new Date().toISOString().slice(0, 10); if (budget.day !== d) { budget.day = d; budget.n = 0; } return ++budget.n <= cfg.usaDailyLimit; };

export async function fetchProvider(vin, plan = 'single', _decoded, { fetchFn = fetch } = {}) {
  if (!providerEnabled()) return null;
  const cached = store.getUsaCache(vin);
  if (cached && Date.now() - cached.ts < (cached.json.found ? 7 : 1) * 864e5) return { ...cached.json, cached: true };
  if (!spend()) return { found: false, queried: false, capped: true };
  const parts = await Promise.allSettled([cfg.marketcheckKey ? marketcheck(vin, fetchFn) : null, cfg.reportApiUrl ? generic(vin, plan, fetchFn) : null, cfg.apibaraKey ? apibara(vin, fetchFn) : null].filter(Boolean));
  const ok = parts.filter((p) => p.status === 'fulfilled').map((p) => p.value);
  if (!ok.length) { console.error('usa providers failed:', parts.map((p) => p.reason?.message).join('; ')); return null; } // сбой не кэшируем
  const listings = ok.flatMap((p) => p.listings || []);
  const res = {
    queried: true, providers: ok.map((p) => p.provider), listings, summary: summarize(listings),
    auction: ok.flatMap((p) => p.auction || []), odometer: ok.flatMap((p) => p.odometer || []), title: ok.find((p) => p.title)?.title || null,
    photos: ok.flatMap((p) => p.photos || []).slice(0, 12),
  };
  res.found = Boolean(listings.length || res.auction.length || res.odometer.length || res.title);
  store.setUsaCache(vin, res);
  return res;
}
