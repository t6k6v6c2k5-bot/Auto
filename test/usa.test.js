import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// изолированная база для кэша, чтобы тесты не зависели от прошлых запусков
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'vs-usa-')), 'o.db');
const { cfg } = await import('../src/config.js');
const { normalizeMarketcheck, summarize, fetchProvider } = await import('../src/providers.js');
const { riskScore } = await import('../src/risk.js');

// образец в формате документации MarketCheck (GET /v2/history/car/{vin}: массив записей)
const SAMPLE = [
  { id: 'a1', price: 14990, miles: 61200, first_seen_at_date: '2023-03-02T10:00:00.000Z', last_seen_at_date: '2023-04-10T10:00:00.000Z', seller_name: 'City Honda', seller_type: 'dealer', inventory_type: 'used', city: 'Austin', state: 'TX', source: 'cityhonda.com', vdp_url: 'https://cityhonda.com/vdp/1' },
  { id: 'a2', price: 13900, miles: 61900, first_seen_at_date: '2023-05-02T10:00:00.000Z', last_seen_at_date: '2023-06-01T10:00:00.000Z', seller_name: 'Auto Mart', seller_type: 'dealer', inventory_type: 'used', city: 'Dallas', state: 'TX', source: 'automart.com', vdp_url: 'javascript:alert(1)' },
  { id: 'a2', price: 13900, miles: 61900, first_seen_at_date: '2023-05-02T10:00:00.000Z', seller_name: 'dup' },
  { id: 'a3', price: 12500, miles: 48000, first_seen_at_date: '2024-01-15T10:00:00.000Z', last_seen_at_date: '2024-02-01T10:00:00.000Z', seller_name: 'Cars4U', seller_type: 'dealer', inventory_type: 'used', city: 'Miami', state: 'FL', source: 'cars4u.com', vdp_url: 'https://cars4u.com/x' },
];

test('MarketCheck: нормализация, дубликаты, небезопасные ссылки', () => {
  const l = normalizeMarketcheck(SAMPLE);
  assert.equal(l.length, 3);
  assert.equal(l[0].firstSeen, '2023-03-02');
  assert.equal(l[1].url, null, 'javascript: отбрасывается');
  assert.equal(l[0].price, 14990);
  assert.deepEqual(normalizeMarketcheck({ error: 'x' }), []);
});

test('Сводка: диапазон цен, продавцы, детектор скрутки пробега', () => {
  const s = summarize(normalizeMarketcheck(SAMPLE));
  assert.equal(s.count, 3); assert.equal(s.minPrice, 12500); assert.equal(s.maxPrice, 14990); assert.equal(s.sellers, 3);
  assert.equal(s.rollback.from.m, 61900); assert.equal(s.rollback.to.m, 48000);
  const clean = summarize(normalizeMarketcheck([SAMPLE[0], { ...SAMPLE[1], id: 'z', miles: 61000 }]));
  assert.equal(clean.rollback, null, 'погрешность до 1500 миль не считается скруткой');
  assert.equal(summarize([]), null);
});

test('Риск: скрутка добавляет 40 баллов, сумма весов равна баллу', () => {
  const usa = { summary: summarize(normalizeMarketcheck(SAMPLE)) };
  const r = riskScore({ decoded: { found: true, trusted: true, year: 2019 }, recalls: [], wanted: [], ua: null, region: 'US', complaints: {}, mismatch: [], usa });
  assert.ok(r.factors.some((f) => f.key === 'f_rollback' && f.pts === 40));
  assert.equal(r.factors.reduce((a, f) => a + f.pts, 0), r.score);
});

test('fetchProvider: ключ в query, кэш, сбой не кэшируется, суточный лимит', async () => {
  cfg.marketcheckKey = 'k_test'; cfg.reportApiUrl = ''; cfg.usaDailyLimit = 3;
  let calls = 0, url = '';
  const ok = async (u) => { calls++; url = String(u); return { ok: true, status: 200, json: async () => SAMPLE }; };
  const vin = '1HGCM82633A004352';
  const a = await fetchProvider(vin, 'single', null, { fetchFn: ok });
  assert.ok(a.found && a.listings.length === 3 && a.providers[0] === 'MarketCheck');
  assert.match(url, /\/v2\/history\/car\/1HGCM82633A004352\?api_key=k_test/);
  const b = await fetchProvider(vin, 'single', null, { fetchFn: ok });
  assert.equal(calls, 1, 'второй запрос из кэша'); assert.equal(b.cached, true);
  const bad = async () => ({ ok: false, status: 500 });
  assert.equal(await fetchProvider('2HGCM82633A004353', 'single', null, { fetchFn: bad }), null);
  const empty = async () => ({ ok: true, status: 200, json: async () => [] });
  const e = await fetchProvider('3HGCM82633A004354', 'single', null, { fetchFn: empty });
  assert.equal(e.found, false);
  const capped = await fetchProvider('4HGCM82633A004355', 'single', null, { fetchFn: ok });
  assert.equal(capped.capped, true, 'после лимита платные запросы не уходят');
});

test('Apibara: лоты Copart/IAAI по VIN', async () => {
  const { normalizeApibara } = await import('../src/providers.js');
  const r = normalizeApibara({ data: { platform: 'copart', lot_number: '123', title: '2018 TOYOTA CAMRY SE', damage: 'FRONT END', odometer: { mi: 45210 }, auction: { last_sold_day: '2024-05-02', last_sold_status: 'sold' }, pricing: { last_sold_price_usd: 6200, estimated_retail_value_usd: 18500 }, location: { display: 'CA - SAN DIEGO' }, media: { images_count: 2, photos: ['https://cs.copart.com/a.jpg', 'http://127.0.0.1/x.jpg'] }, history: [{ platform: 'iaai', lot_number: 777, date: '2023-01-10', price: 9000, status: 'not sold' }] } });
  assert.equal(r.auction.length, 2); assert.equal(r.auction[0].house, 'COPART'); assert.equal(r.auction[0].finalBidUsd, 6200); assert.equal(r.auction[0].primaryDamage, 'FRONT END');
  assert.equal(r.auction[1].house, 'IAAI'); assert.deepEqual(r.photos, ['https://cs.copart.com/a.jpg']); assert.equal(r.odometer[0].miles, 45210);
});

test('Apibara: фото из media.items (реальный формат ответа)', async () => {
  const { normalizeApibara } = await import('../src/providers.js');
  const r = normalizeApibara({ data: { platform: 'iaai', lot_number: '44031493', odometer: { mi: 196983 }, auction: { state: 'open', auction_at: '2026-10-26T13:30:00+00:00' }, pricing: { buy_now_usd: 1700 }, media: { items: [{ type: 'image', thumb: 'https://vis.iaai.com/resizer?k=1&width=400', large: 'https://vis.iaai.com/resizer?k=1&width=845' }] }, history: [{ platform: 'iaai', lot_number: 44031493, date: '2026-10-19', price: 925, status: 'Sold on Approval' }] } });
  assert.deepEqual(r.photos, ['https://vis.iaai.com/resizer?k=1&width=845']); assert.equal(r.auction.length, 2); assert.equal(r.auction.find((x) => x.status === 'open').buyNowUsd, 1700);
});
