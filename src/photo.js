// Фото модели авто из Wikimedia Commons (свободные лицензии): ищем снимок конкретной модели и, по возможности, года выпуска.
// Это иллюстрация модели, а не этого автомобиля — в интерфейсе так и подписано; автор и лицензия указываются под фото.
// Запросы идут через очередь с паузами, результат (в т.ч. «не найдено») кэшируется в SQLite.
import * as store from './db.js';
import { cfg } from './config.js';

const UA = { 'user-agent': `VINScope/1.1 (${cfg.baseUrl || 'vehicle check service'}; ${cfg.supportEmail || 'contact via site'})`, accept: 'application/json' };
const FOUND_TTL = 90 * 864e5, MISS_TTL = 3 * 864e5;
const OK_IMG = /^https:\/\/(?:upload|thumb)\.wikimedia\.org\//;
const mem = new Map();
let chain = Promise.resolve(), blockedUntil = 0, queued = 0;

// кириллические марки из реестра -> латиница, как они называются на Commons
const BRAND = { ВАЗ: 'VAZ', ЛАДА: 'Lada', ЗАЗ: 'ZAZ', ГАЗ: 'GAZ', УАЗ: 'UAZ', МОСКВИЧ: 'Moskvitch', ІЖ: 'Izh', ИЖ: 'Izh', КРАЗ: 'KrAZ', МАЗ: 'MAZ', БОГДАН: 'Bogdan', ДЕУ: 'Daewoo', ДЕО: 'Daewoo', ТАВРІЯ: 'ZAZ Tavria' };
const TR = { А: 'a', Б: 'b', В: 'v', Г: 'h', Ґ: 'g', Д: 'd', Е: 'e', Є: 'ye', Ж: 'zh', З: 'z', И: 'y', І: 'i', Ї: 'yi', Й: 'y', К: 'k', Л: 'l', М: 'm', Н: 'n', О: 'o', П: 'p', Р: 'r', С: 's', Т: 't', У: 'u', Ф: 'f', Х: 'kh', Ц: 'ts', Ч: 'ch', Ш: 'sh', Щ: 'shch', Ь: '', Ю: 'yu', Я: 'ya', Ы: 'y', Э: 'e', Ё: 'yo', Ъ: '' };
const translit = (s) => [...String(s).toUpperCase()].map((c) => (TR[c] !== undefined ? TR[c] : c.toLowerCase())).join('');

// «LADA (ВАЗ)» -> ['LADA', 'VAZ']; «ВАЗ» -> ['VAZ']
export function brandNames(make) {
  const raw = String(make || '').toUpperCase().replace(/[()]/g, ' ').split(/[\s/,]+/).filter((w) => w.length > 1);
  const out = [];
  for (const w of raw) out.push(BRAND[w] || (/[А-ЯІЇЄҐ]/.test(w) ? translit(w) : w));
  return [...new Set(out.map((x) => x.toLowerCase().replace(/[_-]+/g, ' ')))].slice(0, 3);
}
// «21063» -> ['21063', '2106']; «Accord Sedan» -> ['accord sedan', 'accord']
export function modelNames(model) {
  const m = String(model || '').toLowerCase().replace(/[()]/g, ' ').trim();
  if (!m) return [];
  const first = m.split(/[\s/,-]+/)[0];
  const out = [m, first];
  if (/^\d{5,}$/.test(first)) out.push(first.slice(0, 4));
  return [...new Set(out.map((x) => (/[а-яіїєґ]/i.test(x) ? translit(x) : x).replace(/[_-]+/g, ' ')))];
}

const BAD = /\b(interior|innen|dashboard|cockpit|engine|motor|badge|logo|emblem|wheel|rim|seat|trunk|boot|detail|tail ?light|headlight|steering|gauge|instrument|key|wreck|crash|damaged|toy|model ?car|diecast|scale|lego|brochure|ad\b|poster|stamp|police|taxi)\b/i;
const REAR = /(?<!\p{L})(rear|back|heck|сзади|ззаду|зад)(?!\p{L})/iu;
const norm = (s) => String(s).toLowerCase().replace(/^file:/, '').replace(/[_-]+/g, ' ');

// выбор лучшего файла: марка и модель в имени, без «интерьеров» и деталей, год ближе к нужному
const VEHICLE = /(?<!\p{L})(car|cars|auto|automobile|vehicle|sedan|saloon|hatchback|wagon|estate|coupe|suv|pickup|truck|lorry|van|minivan|bus|coach|motorcycle|motorbike|scooter|tractor|taxi|limousine|convertible|cabriolet|авто|автомобіль|автомобиль|машина|вантажівка|грузовик|автобус|мотоцикл)(?!\p{L})/iu;
const wordIn = (name, w) => new RegExp(`(^|[^\\p{L}\\d])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\d]|$)`, 'iu').test(name);
export function pickFile(pages, { make, model, year }) {
  const brands = brandNames(make), models = modelNames(model);
  let best = null;
  for (const p of pages) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    if (!/image\/(jpeg|png|webp)/.test(ii.mime || 'image/jpeg')) continue;
    const name = norm(p.title);
    if (BAD.test(name)) continue;
    if (REAR.test(name)) continue; // вид сзади: часто виден чужой номер и не узнать модель
    if (!brands.some((b) => wordIn(name, b)) && !(models[0] && /^\d{4}$/.test(models.at(-1)) && name.includes(models.at(-1)))) continue;
    if (!models.length && !VEHICLE.test(name) && !/\d{2,}/.test(name)) continue; // только марка: на фото должен быть транспорт, а не тёзка марки
    const mHit = models.find((m) => new RegExp(`(^|[^a-z0-9])${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(name));
    if (models.length && !mHit) continue;
    const ys = (name.match(/\b(19[5-9]\d|20[0-3]\d)\b/g) || []).map(Number);
    let score = 10 - (p.index || 0) * 0.3 + (mHit === models[0] ? 1 : 0);
    if (year && ys.length) {
      const dy = Math.min(...ys.map((y) => Math.abs(y - year)));
      if (dy > 5) continue;
      score += dy <= 1 ? 4 : dy <= 3 ? 2 : 0;
    }
    if ((ii.thumbwidth || 0) < 600) score -= 2;
    if (/(?<!\p{L})(front|спереди|спереду)(?!\p{L})/iu.test(name)) score += 1;
    if (!best || score > best.score) best = { score, p, ii };
  }
  if (!best) return null;
  const m = best.ii.extmetadata || {};
  const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const url = best.ii.thumburl || best.ii.url;
  if (!OK_IMG.test(url || '')) return null;
  return { url: url.replace(/\?.*$/, ''), title: best.p.title.replace(/^File:/, ''), credit: [strip(m.Artist?.value), strip(m.LicenseShortName?.value)].filter(Boolean).join(', ') };
}

function limited(fn) {
  if (queued >= 20) return Promise.resolve({ blocked: true }); // при наплыве фото просто не показываем
  queued++;
  const run = chain.then(async () => { await new Promise((r) => setTimeout(r, 300)); return fn(); }).finally(() => { queued--; });
  chain = run.catch(() => {});
  return run;
}

async function commons(q) {
  if (Date.now() < blockedUntil) return { blocked: true };
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({ action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrsearch: q, gsrlimit: '15', prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiextmetadatafilter: 'Artist|LicenseShortName', iiurlwidth: '960', maxlag: '5' }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(7000) });
  if (r.status === 429 || r.status === 503) { blockedUntil = Date.now() + (Number(r.headers.get('retry-after')) || 60) * 1000; return { blocked: true }; }
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return Object.values(j?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
}

export async function getPhoto(make, model, year) {
  if (!make) return null;
  const y = Number(year) || null;
  const key = `v6|${make}|${model || ''}|${y ? Math.round(y / 3) * 3 : ''}`.toUpperCase(); // соседние годы делят один снимок
  const hit = mem.get(key);
  if (hit && Date.now() - hit.t < 6 * 3600e3) return hit.v;
  const row = store.getPhotoRow(key);
  if (row && Date.now() - row.ts < (row.url ? FOUND_TTL : MISS_TTL)) {
    const v = row.url && OK_IMG.test(row.url) ? { url: row.url, title: row.page || '', credit: row.title || '' } : null;
    mem.set(key, { t: Date.now(), v }); return v;
  }
  const b = brandNames(make)[0], m = modelNames(model);
  const queries = [...new Set([y && m[0] ? `${y} ${b} ${m.at(-1)}` : '', m[0] ? `${b} ${m[0]}` : '', m.length > 1 ? `${b} ${m.at(-1)}` : ''].filter(Boolean))].slice(0, 3);
  // ступени: точная модель и год → та же модель любого года → любое авто этой марки
  let result = null, blocked = false; const seen = [];
  const run = async (q) => {
    const pages = await limited(() => commons(q));
    if (pages?.blocked) { blocked = true; return []; }
    seen.push(...(pages || []));
    return pages || [];
  };
  try {
    for (const q of queries) { const pages = await run(q); if (blocked) break; result = pickFile(pages, { make, model, year: y }); if (result) break; }
    if (!result && !blocked) result = pickFile(seen, { make, model, year: null });
    if (!result && !blocked) { const pages = await run(`${b} car`); if (!blocked) result = pickFile(pages, { make, model: '', year: null }); }
  } catch { blocked = true; }
  if (!blocked) store.setPhotoRow(key, result?.url || null, result?.title || null, result?.credit || null);
  mem.set(key, { t: Date.now() - (blocked ? 5.9 * 3600e3 : 0), v: result }); // при блокировке повторим скоро
  return result;
}
