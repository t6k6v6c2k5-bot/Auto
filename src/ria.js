// Рыночные цены в Украине по открытому API объявлений: медиана, диапазон и число объявлений для марки/модели/года.
// Запросы бесплатные, но мы бережём лимит: списки марок и моделей и цены кэшируются, есть общий суточный потолок.
import { cfg } from './config.js';
import * as store from './db.js';

const BASE = 'https://developers.ria.com/auto';
const UA = 'VINScope/1.0 (+https://vinscope.com.ua; vehicle check service)'; // честное имя клиента
const LIST_TTL = 30 * 864e5, PRICE_TTL = 24 * 3600e3, MISS_TTL = 3 * 864e5;
let chain = Promise.resolve(), last = 0, spent = { day: '', n: 0 }, hour = { h: -1, n: 0 }, pausedUntil = 0;

export const norm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-zа-яіїєґ0-9]/g, '');

// «TOYOTA» -> id марки; сравнение по нормализованному названию, запасной вариант — по префиксу
export function findMark(list, make) {
  const n = norm(make); if (!n) return null;
  const items = list.map((x) => ({ id: x.value, n: norm(x.name) }));
  return (items.find((x) => x.n === n) || items.find((x) => x.n && n.startsWith(x.n) && x.n.length >= 3) || null)?.id ?? null;
}
// «Camry Hybrid» -> «Camry»: точное совпадение, затем самая длинная модель-префикс, затем самый короткий вариант, начинающийся с нашего названия
export function findModel(list, model) {
  const n = norm(model); if (!n) return null;
  const items = list.map((x) => ({ id: x.value, n: norm(x.name) })).filter((x) => x.n);
  const exact = items.find((x) => x.n === n); if (exact) return exact.id;
  const pre = items.filter((x) => n.startsWith(x.n) && x.n.length >= 2).sort((a, b) => b.n.length - a.n.length)[0]; if (pre) return pre.id;
  const wider = items.filter((x) => x.n.startsWith(n) && n.length >= 3).sort((a, b) => a.n.length - b.n.length)[0];
  return wider ? wider.id : null;
}
export function stats(prices) {
  const a = prices.filter((p) => Number.isFinite(p) && p >= 300 && p < 2e6).sort((x, y) => x - y);
  if (a.length < 3) return null;
  const q = (f) => { const i = (a.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
  return { total: a.length, median: Math.round(q(0.5)), p25: Math.round(q(0.25)), p75: Math.round(q(0.75)), min: a[0], max: a.at(-1), mean: Math.round(a.reduce((s, v) => s + v, 0) / a.length) };
}

async function call(path, params = {}) {
  const day = new Date().toISOString().slice(0, 10); if (spent.day !== day) spent = { day, n: 0 };
  if (spent.n >= cfg.riaDailyLimit) throw new Error('ria daily limit');
  if (Date.now() < pausedUntil) throw new Error('ria paused'); // источник сообщил о превышении лимита: не стучимся, пока не пройдёт пауза
  const h = Math.floor(Date.now() / 3600e3); if (hour.h !== h) hour = { h, n: 0 };
  if (hour.n >= cfg.riaHourlyLimit) throw new Error('ria hourly limit');
  const run = chain.then(async () => {
    const wait = 350 - (Date.now() - last); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now(); spent.n++; hour.n++;
    const u = new URL(BASE + path); u.searchParams.set('api_key', cfg.riaKey); Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
    if (r.status === 429) { pausedUntil = Date.now() + 15 * 60e3; throw new Error('ria over limit'); }
    if (!r.ok) throw new Error('ria ' + r.status);
    const t = await r.text(); if (t.trimStart().startsWith('<')) throw new Error('ria refused'); // сервис ответил не JSON: не повторяем и не обходим
    const j = JSON.parse(t);
    if (j && !Array.isArray(j) && j.error) { if (j.error_type === 'HourOverlimit') pausedUntil = Date.now() + 15 * 60e3; throw new Error('ria error response'); } // отказ защиты приходит JSON-ом с полем error: это сбой, а не «нет объявлений»
    return j;
  });
  chain = run.catch(() => {});
  return run;
}
async function cached(key, ttl, load) {
  const row = store.getRia(key);
  if (row && Date.now() - row.ts < (row.json === 'null' ? MISS_TTL : ttl)) return JSON.parse(row.json);
  const v = await load(); store.setRia(key, JSON.stringify(v ?? null)); return v ?? null;
}

// { median, p25, p75, mean, total, years: '2012' | '2011–2013' } или null (нет ключа, марка/модель не найдены, мало объявлений)
export async function marketPrice(veh) {
  const year = Number(veh?.year);
  if (!cfg.riaKey || !veh?.make || !veh?.model || !(year >= 1980 && year <= new Date().getFullYear() + 1)) return null;
  try {
    const marks = await cached('marks', LIST_TTL, () => call('/categories/1/marks'));
    const markId = marks && findMark(marks, veh.make); if (!markId) return null;
    const models = await cached('models:' + markId, LIST_TTL, () => call(`/categories/1/marks/${markId}/models`));
    const modelId = models && findModel(models, veh.model); if (!modelId) return null;
    return await cached(`price:${markId}:${modelId}:${year}`, PRICE_TTL, async () => {
      const one = async (y) => { const j = await call('/average_price', { main_category: 1, marka_id: markId, model_id: modelId, yers: y }); if (!Array.isArray(j?.prices)) throw new Error('ria bad price response'); return j.prices; };
      let prices = await one(year), years = String(year);
      if (prices.length < 8) { prices = [...prices, ...(await one(year - 1)), ...(await one(year + 1))]; years = `${year - 1}–${year + 1}`; } // мало объявлений: берём соседние годы
      const s = stats(prices); return s ? { ...s, years } : null;
    });
  } catch (e) { console.error('market price', e.message); return null; }
}

// прогрев при старте: список марок в кэш, чтобы первый отчёт не ждал лишних запросов
export const warmRia = () => { if (!cfg.riaKey) return; store.dropRiaMisses(); cached('marks', LIST_TTL, () => call('/categories/1/marks')).catch(() => {}); };
