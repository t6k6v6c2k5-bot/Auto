// Упоминания авто в интернете через лицензированный поисковый API (Brave Search). Сохраняем только данные об авто:
// домен, заголовок без контактов, тип и дату. Телефоны, e-mail, имена и сам текст страниц не копируются.
import { cfg } from './config.js';
import * as store from './db.js';

export const mentionsEnabled = () => Boolean(cfg.searchKey);

const CYR = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', I: 'І', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У' };
export const plateCyr = (p) => [...p].map((c) => CYR[c] || c).join('');
const squash = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9А-ЯІЇЄҐ]/g, '');

// убираем всё, что похоже на контакты, и режем длину
export function scrub(title) {
  return String(title || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '')
    .replace(/(?:\+?\d[\s().-]?){9,}/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, 140);
}

const SALE = /(olx|auto\.ria|ria\.com|rst\.ua|autobazar|avtobazar|autoua|ab\.ua|cars\.com|autotrader|cargurus|ebay|mobile\.de|autoscout|otomoto|bazos)/i;
const AUCTION = /(copart|iaai|iaa\.com|bidfax|poctra|autobidmaster|carfast|salvagebid|stat\.vin|bid\.cars|autoauctions|sca\.auction)/i;
const ACCIDENT = /(дтп|аварі|авари|розбит|битий|accident|crash|collision|damage|salvage|total loss)/i;
const WANTED = /(розшук|розыск|угон|викрад|stolen|theft)/i;
export function classify(domain, text) {
  if (WANTED.test(text)) return 'wanted';
  if (AUCTION.test(domain)) return 'auction';
  if (SALE.test(domain)) return 'sale';
  if (ACCIDENT.test(text)) return 'accident';
  return 'other';
}

// только результаты, где идентификатор реально присутствует в заголовке/описании/адресе (поисковик может отдавать неточные совпадения)
export function normalizeResults(json, ids) {
  const want = ids.map(squash).filter((x) => x.length >= 5);
  const out = []; const seen = new Set();
  for (const r of json?.web?.results || []) {
    const url = String(r.url || ''); let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { continue; }
    if (!/^https?:/.test(url) || seen.has(url)) continue;
    const text = `${r.title || ''} ${r.description || ''} ${url}`;
    if (!want.some((w) => squash(text).includes(w))) continue;
    seen.add(url);
    out.push({ url, domain: host, title: scrub(r.title), kind: classify(host, text), published: String(r.page_age || r.age || '').slice(0, 10) });
  }
  return out.slice(0, 20);
}

const budget = { day: '', n: 0 };
const spend = () => { const d = new Date().toISOString().slice(0, 10); if (budget.day !== d) { budget.day = d; budget.n = 0; } return ++budget.n <= cfg.searchDailyLimit; };

async function search(q, fetchFn) {
  const u = new URL(cfg.searchBase + '/web/search');
  u.searchParams.set('q', q); u.searchParams.set('count', '20'); u.searchParams.set('country', 'ua'); u.searchParams.set('spellcheck', '0');
  const r = await fetchFn(u, { headers: { accept: 'application/json', 'x-subscription-token': cfg.searchKey }, signal: AbortSignal.timeout(6000) });
  if (r.status === 429) throw new Error('search rate limited');
  if (!r.ok) throw new Error('search ' + r.status);
  return r.json();
}

// ids: { vin, plate? } -> { items, checkedAt, cached }; ключ кэша — VIN (или номер, если VIN неизвестен)
export async function findMentions({ vin, plate = '' }, { fetchFn = fetch } = {}) {
  if (!mentionsEnabled()) return null;
  const key = vin || plate;
  const chk = store.mentionCheck(key);
  if (chk && Date.now() - chk.ts < (chk.n ? 14 : 3) * 864e5) return { items: store.getMentions(key), checkedAt: chk.ts, cached: true };
  if (!spend()) return chk ? { items: store.getMentions(key), checkedAt: chk.ts, cached: true } : null;
  try {
    const queries = [vin && `"${vin}"`, plate && `"${plate}" OR "${plateCyr(plate)}"`].filter(Boolean);
    const found = [];
    for (const q of queries) found.push(...normalizeResults(await search(q, fetchFn), [vin, plate, plateCyr(plate)].filter(Boolean)));
    const uniq = [...new Map(found.map((x) => [x.url, x])).values()];
    store.saveMentions(key, uniq);
    return { items: store.getMentions(key), checkedAt: Date.now(), cached: false };
  } catch (e) { console.error('mentions failed:', e.message); return chk ? { items: store.getMentions(key), checkedAt: chk.ts, cached: true } : null; }
}
