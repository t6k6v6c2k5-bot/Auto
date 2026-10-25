// Отзывные кампании Transport Canada (открытые данные, без ключа): по марке, модели и году.
const BASE = process.env.CANADA_BASE || 'http://data.tc.gc.ca/v1.3/api/eng/vehicle-recall-database';
const TTL = 12 * 3600e3;
const cache = new Map();

const fields = (row) => Object.fromEntries((row || []).map((f) => [f.Name, f.Value?.Literal]));
async function getJson(path) {
  const r = await fetch(BASE + path, { signal: AbortSignal.timeout(6000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('canada ' + r.status);
  return r.json();
}
const seg = (s) => encodeURIComponent(String(s).trim().toLowerCase());
const cut = (s, n) => { const x = String(s || '').replace(/\s+/g, ' ').trim(); return x.length > n ? x.slice(0, n - 1) + '…' : x; };

export function parseSummary(row) {
  const f = fields(row);
  const m = /Issue:\s*(.*?)\s*(?:Safety Risk:|$)/is.exec(f.COMMENT_ETXT || '');
  const r = /Safety Risk:\s*(.*?)\s*(?:Corrective Actions:|$)/is.exec(f.COMMENT_ETXT || '');
  const plain = String(f.COMMENT_ETXT || '').split(/Correct(?:ive action|ion)s?:/i)[0];
  return { number: f.RECALL_NUMBER_NUM, system: f.SYSTEM_TYPE_ETXT || '', units: Number(f.UNIT_AFFECTED_NBR) || null, issue: cut(m?.[1] || plain, 300), risk: cut(r?.[1], 220) };
}

export async function canadaRecalls(d) {
  if (!d?.trusted || !d.make || !d.model || !d.year) return null;
  const key = `${d.year}|${d.make}|${d.model}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  try {
    const j = await getJson(`/recall/make-name/${seg(d.make)}/model-name/${seg(d.model)}/year-range/${d.year}-${d.year}?format=json`);
    const rows = (j.ResultSet || []).map(fields).filter((x) => x['Recall number']);
    const dates = new Map(rows.map((x) => [x['Recall number'], String(x['Recall date'] || '')]));
    const nums = [...new Set(rows.map((x) => x['Recall number']))].slice(0, 6);
    const sums = await Promise.all(nums.map((n) => getJson(`/recall-summary/recall-number/${n}?format=json`).then((s) => parseSummary(s.ResultSet?.[0])).catch(() => ({ number: n }))));
    const v = { count: new Set(rows.map((x) => x['Recall number'])).size, items: sums.map((s) => ({ ...s, date: (/^(\d+)\/(\d+)\/(\d{4})/.exec(dates.get(s.number)) || []).slice(1) })) };
    v.items = v.items.map((s) => ({ ...s, date: s.date.length ? `${s.date[2]}-${s.date[0].padStart(2, '0')}-${s.date[1].padStart(2, '0')}` : '' })).sort((a, b) => (a.date < b.date ? 1 : -1));
    cache.set(key, { t: Date.now(), v });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return v;
  } catch (e) { console.error('canada failed:', e.message); return null; }
}
