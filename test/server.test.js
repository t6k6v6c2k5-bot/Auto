import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { ipOf, origin } from '../src/http.js';
import { plural, dict } from '../src/i18n.js';
import { photoFits } from '../src/report.js';
import { normalizeVin } from '../src/vin.js';

test('ipOf: берётся последний элемент X-Forwarded-For (первые подконтрольны клиенту)', () => {
  assert.equal(ipOf({ headers: { 'x-forwarded-for': '9.9.9.9, 1.2.3.4' }, socket: {} }), '1.2.3.4');
  assert.equal(ipOf({ headers: {}, socket: { remoteAddress: '5.5.5.5' } }), '5.5.5.5');
});

test('origin: недопустимый Host не попадает в абсолютные ссылки', () => {
  assert.equal(origin({ headers: { host: 'evil.com/<script>' } }), 'http://localhost');
  assert.equal(origin({ headers: { host: 'vinscope.example' } }), 'https://vinscope.example');
});

test('plural: склонение по числу в uk/ru/en', () => {
  const uk = dict('uk').t_reg_n, ru = dict('ru').t_recalls_n, en = dict('en').t_reg_n;
  assert.deepEqual([1, 2, 5, 11, 21, 24, 25].map((n) => plural('uk', n, uk)), ['1 запис', '2 записи', '5 записів', '11 записів', '21 запис', '24 записи', '25 записів']);
  assert.equal(plural('ru', 22, ru), '22 кампании');
  assert.equal(plural('ru', 12, ru), '12 кампаний');
  assert.equal(plural('en', 1, en), '1 record');
  assert.equal(plural('en', 2, en), '2 records');
});

test('photoFits: фото другого поколения (год в имени файла) не подходит', () => {
  const u = (y) => ({ url: `https://thumb.wikimedia.org/x/960px-${y}_Honda_Accord.jpg` });
  assert.equal(photoFits(u(2023), 2003), null);
  assert.ok(photoFits(u(2023), 2020));
  assert.ok(photoFits({ url: 'https://thumb.wikimedia.org/x/Skoda_Octavia.jpg' }, 2003)); // года в имени нет — доверяем
  assert.equal(photoFits(null, 2020), null);
});

test('Подпись вебхука Stripe: несколько v1, окно времени, мусор', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  const { cfg } = await import('../src/config.js');
  cfg.stripeWebhookSecret = 'whsec_test';
  const { verifyWebhook } = await import('../src/stripe.js');
  const body = '{"id":"evt_1"}', t = Math.floor(Date.now() / 1000);
  const sig = (ts, s = 'whsec_test') => createHmac('sha256', s).update(`${ts}.${body}`).digest('hex');
  assert.equal(verifyWebhook(body, `t=${t},v1=${sig(t)}`), true);
  assert.equal(verifyWebhook(body, `t=${t},v1=${sig(t, 'old')},v1=${sig(t)}`), true); // ротация секрета
  assert.equal(verifyWebhook(body, `t=${t},v1=${sig(t, 'wrong')}`), false);
  assert.equal(verifyWebhook(body, `t=${t - 1000},v1=${sig(t - 1000)}`), false);      // старше 5 минут
  assert.equal(verifyWebhook(body, `t=abc,v1=${sig(t)}`), false);
  assert.equal(verifyWebhook(body, ''), false);
});

test('normalizeVin убирает пробелы и разделители', () => {
  assert.equal(normalizeVin(' 1hgcm-826 33a004352 '), '1HGCM82633A004352');
});

test('monobank: подпись вебхука (ECDSA) и проверка оплаты', async () => {
  const { generateKeyPairSync, createSign } = await import('node:crypto');
  const { verifyWith, isPaid } = await import('../src/mono.js');
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const body = JSON.stringify({ invoiceId: 'p2_x', status: 'success', amount: 9900, ccy: 980, reference: 'o1' });
  const sig = createSign('SHA256').update(body).sign(privateKey).toString('base64');
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  assert.ok(verifyWith(pem, body, sig));
  assert.ok(!verifyWith(pem, body.replace('9900', '1'), sig));
  assert.ok(isPaid(JSON.parse(body), { id: 'o1', amount: 9900 }));
  assert.ok(!isPaid({ ...JSON.parse(body), amount: 100 }, { id: 'o1', amount: 9900 }));
  assert.ok(!isPaid({ ...JSON.parse(body), status: 'processing' }, { id: 'o1', amount: 9900 }));
});

test('Lemon Squeezy: подпись вебхука и проверка оплаты', async () => {
  const { createHmac } = await import('node:crypto');
  const { cfg } = await import('../src/config.js');
  const lemon = await import('../src/lemon.js');
  cfg.lemonSecret = 'whsec'; cfg.lemonCurrency = 'USD';
  const ev = { meta: { event_name: 'order_created', custom_data: { order_id: 'o1' } }, data: { id: 42, attributes: { status: 'paid', currency: 'USD', subtotal: 240, total: 240 } } };
  const raw = JSON.stringify(ev); const sig = createHmac('sha256', 'whsec').update(raw).digest('hex');
  assert.ok(lemon.verifyWebhook(raw, sig)); assert.ok(!lemon.verifyWebhook(raw, sig.replace(/.$/, '0')));
  assert.deepEqual(lemon.paidOrder(ev, 240), { orderId: 'o1', lemonId: '42' });
  assert.equal(lemon.paidOrder(ev, 300), null); // заплатили меньше выставленного
  assert.equal(lemon.paidOrder({ ...ev, data: { ...ev.data, attributes: { ...ev.data.attributes, status: 'pending' } } }, 240), null);
  cfg.lemonSecret = '';
});

test('гайды: статьи есть на трёх языках, с разметкой Article, без названий источников', async () => {
  const { GUIDES, GG } = await import('../src/guides.js');
  const { guidePage, guidesHub } = await import('../src/guides-views.js');
  const req = { headers: { host: 'vinscope.example' } };
  for (const lang of ['uk', 'ru', 'en']) {
    assert.match(guidesHub(req, lang), /"@type":"ItemList"/);
    for (const g of GUIDES) {
      assert.ok(GG[lang].a[g], `${lang}/${g} есть в словаре`);
      const h = guidePage(req, lang, g);
      assert.match(h, /"@type":"Article"/);
      assert.match(h, /rel="canonical" href="https:\/\/vinscope.example\/\w\w\/guides\//);
      assert.doesNotMatch(h, /NHTSA|Apibara|Copart|IAAI|data\.gov\.ua/i);
    }
  }
});
