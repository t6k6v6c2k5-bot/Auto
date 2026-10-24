// Иллюстрация модели авто из Wikipedia (CC-лицензии). Это фото модели, а не конкретного автомобиля — в интерфейсе так и подписано.
// Запросы идут через очередь с паузами, результат (в т.ч. «не найдено») кэшируется в SQLite.
import * as store from './db.js';

const UA = { 'user-agent': 'VINScope/1.0 (vehicle check; contact: support@vinscope.example)', accept: 'application/json' };
const CAR_RE = /\b(car|automobile|vehicle|suv|crossover|truck|pickup|van|minivan|sedan|hatchback|coupe|coupé|wagon|estate|convertible|roadster|motorcycle|bus|model)\b/i;
const FOUND_TTL = 90 * 864e5, MISS_TTL = 7 * 864e5;
const mem = new Map();
let chain = Promise.resolve(), blockedUntil = 0;

const titleCase = (s) => s.toLowerCase().replace(/(^|[\s-])([a-zа-яіїєґ])/g, (_, a, b) => a + b.toUpperCase());
const brandVariants = (b) => {
  const base = titleCase(b), up = b.toUpperCase();
  return [...new Set([base, b.length <= 3 ? up : base])];
};
const modelVariant = (m) => m.split(/\s+/).map((w) => (/\d/.test(w) ? w.toUpperCase() : titleCase(w))).join(' ');

function candidates(make, model) {
  const out = [];
  const models = [];
  if (model) {
    const m = String(model).trim();
    models.push(m, m.split(/\s+/)[0], m.split(/[\s-]/)[0]);
  }
  for (const m of [...new Set(models)].filter(Boolean)) for (const b of brandVariants(String(make))) out.push(`${b} ${modelVariant(m)}`);
  return [...new Set(out)].slice(0, 4);
}

function limited(fn) {
  const run = chain.then(async () => { await new Promise((r) => setTimeout(r, 250)); return fn(); });
  chain = run.catch(() => {});
  return run;
}

async function summary(title) {
  if (Date.now() < blockedUntil) return { blocked: true };
  const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`, { headers: UA, signal: AbortSignal.timeout(6000) });
  if (r.status === 429) { blockedUntil = Date.now() + (Number(r.headers.get('retry-after')) || 30) * 1000; return { blocked: true }; }
  if (!r.ok) return null;
  const j = await r.json();
  if (j.type !== 'standard' || !(j.thumbnail || j.originalimage)) return null;
  if (!CAR_RE.test(`${j.description || ''} ${(j.extract || '').slice(0, 300)}`)) return null;
  let url = j.thumbnail?.source || j.originalimage.source;
  url = url.replace(/\/\d+px-/, '/960px-');
  return { url, page: j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, title: j.title };
}

export async function getPhoto(make, model) {
  if (!make) return null;
  const key = `${make}|${model || ''}`.toUpperCase();
  const hit = mem.get(key);
  if (hit && Date.now() - hit.t < 6 * 3600e3) return hit.v;
  const row = store.getPhotoRow(key);
  if (row && Date.now() - row.ts < (row.url ? FOUND_TTL : MISS_TTL)) { const v = row.url ? { url: row.url, page: row.page, title: row.title } : null; mem.set(key, { t: Date.now(), v }); return v; }
  let result = null, blocked = false;
  for (const title of candidates(make, model)) {
    try {
      const r = await limited(() => summary(title));
      if (r?.blocked) { blocked = true; break; }
      if (r) { result = r; break; }
    } catch { blocked = true; break; }
  }
  if (!blocked) store.setPhotoRow(key, result?.url || null, result?.page || null, result?.title || null);
  mem.set(key, { t: Date.now() - (blocked ? 5.9 * 3600e3 : 0), v: result }); // при блокировке повторим скоро
  return result;
}
