// Официальный курс НБУ (открытый API bank.gov.ua, без ключа), кэш 6 часов
let cache = { t: 0, v: null };
export async function nbuRate(cc = 'EUR') {
  if (cache.v && Date.now() - cache.t < 6 * 3600e3) return cache.v;
  try {
    const r = await fetch(`https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=${cc}&json`, { signal: AbortSignal.timeout(4000) });
    const j = (await r.json())[0];
    if (!(j?.rate > 0)) throw new Error('no rate');
    const [d, m, y] = String(j.exchangedate).split('.');
    cache = { t: Date.now(), v: { rate: j.rate, date: `${y}-${m}-${d}` } };
  } catch (e) { console.error('nbu failed:', e.message); }
  return cache.v;
}
