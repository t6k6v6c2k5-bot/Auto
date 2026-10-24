import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { timingSafeEqual } from 'node:crypto';
import { cfg, PLANS, demoPayments, price } from './src/config.js';
import { LANGS } from './src/i18n.js';
import { validateVin } from './src/vin.js';
import { decodeVin, recalls } from './src/nhtsa.js';
import { riskScore } from './src/risk.js';
import { fetchReport, prescan, demoReport } from './src/providers.js';
import * as store from './src/db.js';
import * as stripe from './src/stripe.js';
import * as V from './src/views.js';

const PUB = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

// ---------- helpers ----------
const hits = new Map();
const limited = (ip, max = 60) => {
  const k = ip + ':' + Math.floor(Date.now() / 60000);
  const n = (hits.get(k) || 0) + 1; hits.set(k, n);
  if (hits.size > 5000) for (const key of hits.keys()) { if (!key.endsWith(':' + Math.floor(Date.now() / 60000))) hits.delete(key); }
  return n > max;
};
const ipOf = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const origin = (req) => cfg.baseUrl || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
const readBody = (req, max = 1e5) => new Promise((res, rej) => {
  const chunks = []; let n = 0;
  req.on('data', (c) => { n += c.length; if (n > max) { rej(new Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
  req.on('error', rej);
});
function send(req, res, code, body, type = 'text/html; charset=utf-8', extra = {}) {
  const headers = {
    'content-type': type, 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'SAMEORIGIN', 'strict-transport-security': 'max-age=31536000', ...extra,
  };
  const buf = Buffer.from(body);
  if (buf.length > 1024 && /text|json|xml|svg|javascript/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
    headers['content-encoding'] = 'gzip'; headers.vary = 'Accept-Encoding';
    res.writeHead(code, headers); return res.end(gzipSync(buf));
  }
  res.writeHead(code, headers); res.end(buf);
}
const json = (req, res, code, obj) => send(req, res, code, JSON.stringify(obj), 'application/json; charset=utf-8', { 'cache-control': 'no-store' });
const redirect = (res, to) => { res.writeHead(302, { location: to }); res.end(); };
const pickLang = (req) => {
  const h = (req.headers['accept-language'] || '').toLowerCase();
  for (const part of h.split(',')) { const l = part.trim().slice(0, 2); if (LANGS.includes(l)) return l; }
  return 'uk';
};

// ---------- fulfilment (идемпотентно) ----------
async function fulfil(orderId) {
  const o = store.getOrder(orderId);
  if (!o || o.report || o.status === 'refunded') return o;
  const decoded = await decodeVin(o.vin);
  let report;
  try { report = await fetchReport(o.vin, o.plan, decoded); }
  catch (e) { console.error('report provider failed', e.message); store.updateOrder(o.id, { status: 'paid', paid_at: Date.now() }); return store.getOrder(o.id); } // оплачено, отчёт догрузится при открытии
  if (!report.found) {
    // Ноу-хау №3: автовозврат, если по VIN нет данных
    if (o.payment_intent && !demoPayments()) { try { await stripe.refund(o.payment_intent); } catch (e) { console.error('refund failed', e.message); } }
    store.updateOrder(o.id, { status: 'refunded' });
    return store.getOrder(o.id);
  }
  const f = { report: JSON.stringify(report), status: o.status === 'credit' ? 'credit' : 'paid', paid_at: Date.now() };
  const n = PLANS[o.plan]?.count || 1;
  if (n > 1 && !o.credit_code) f.credit_code = store.newCredit(o.plan, n - 1, o.email);
  store.updateOrder(o.id, f);
  return store.getOrder(o.id);
}

// ---------- routes ----------
async function api(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/checkout') {
    if (limited(ipOf(req), 15)) return json(req, res, 429, { error: 'Too many requests' });
    let b; try { b = JSON.parse(await readBody(req)); } catch { return json(req, res, 400, { error: 'Bad request' }); }
    const lang = LANGS.includes(b.lang) ? b.lang : 'uk';
    const plan = PLANS[b.plan]; const v = validateVin(b.vin);
    const m = { uk: ['Невірний VIN', 'Невірний email', 'Код недійсний або вичерпаний'], ru: ['Неверный VIN', 'Неверный email', 'Код недействителен или исчерпан'], en: ['Invalid VIN', 'Invalid email', 'Code is invalid or used up'] }[lang];
    if (!plan || !v.ok) return json(req, res, 400, { error: m[0] });
    const email = String(b.email || '').trim().slice(0, 200);
    if (!EMAIL.test(email)) return json(req, res, 400, { error: m[1] });

    if (b.code) { // оплата кодом пакета
      const c = store.getCredit(b.code);
      if (!c || c.remaining < 1 || !store.useCredit(c.code)) return json(req, res, 400, { error: m[2] });
      const o = store.newOrder({ vin: v.vin, plan: 'full', email, amount: 0, lang, status: 'credit', credit_code: c.code });
      await fulfil(o.id);
      return json(req, res, 200, { url: `/${lang}/report/${o.token}` });
    }
    const o = store.newOrder({ vin: v.vin, plan: b.plan, email, amount: plan.usd, lang });
    if (demoPayments()) { store.updateOrder(o.id, { status: 'paid', paid_at: Date.now() }); await fulfil(o.id); return json(req, res, 200, { url: `/${lang}/report/${o.token}` }); }
    try {
      const d = (await import('./src/i18n.js')).dict(lang).plans[b.plan];
      const s = await stripe.createCheckout({
        order: o, name: `VINScope — ${d[0]}`, description: `VIN ${v.vin}`,
        successUrl: `${origin(req)}/${lang}/success?o=${o.id}`, cancelUrl: `${origin(req)}/${lang}/checkout?plan=${b.plan}&vin=${v.vin}`,
      });
      store.updateOrder(o.id, { stripe_session: s.id });
      return json(req, res, 200, { url: s.url });
    } catch (e) { console.error('stripe', e.message); return json(req, res, 502, { error: 'Payment provider error' }); }
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/vin/')) {
    const v = validateVin(url.pathname.slice(9));
    if (!v.ok) return json(req, res, 400, { error: v.error });
    return json(req, res, 200, { vin: v.vin, region: v.region, decoded: await decodeVin(v.vin) });
  }
  return json(req, res, 404, { error: 'Not found' });
}

async function page(req, res, url, lang, rest) {
  const html = (s, code = 200, cache = 'public, max-age=300') => send(req, res, code, s, 'text/html; charset=utf-8', { 'cache-control': cache });
  if (rest === '/' || rest === '') return html(V.home(req, lang));
  if (rest === '/usa') return html(V.usaPage(req, lang));
  if (rest === '/pricing') return html(V.pricingPage(req, lang));
  if (rest === '/terms') return html(V.termsPage(req, lang));

  if (rest === '/check') {
    if (limited(ipOf(req), 40)) return send(req, res, 429, 'Too many requests', 'text/plain');
    const v = validateVin(url.searchParams.get('vin'));
    if (!v.ok) return redirect(res, `/${lang}/`);
    store.logSearch(v.vin, lang);
    const decoded = await decodeVin(v.vin);
    const rec = await recalls(decoded);
    const risk = riskScore(decoded, rec.items, decoded.year);
    return html(V.checkPage(req, lang, { vin: v.vin, decoded, rec, risk, pre: prescan(v.vin, decoded) }), 200, 'private, max-age=0');
  }
  if (rest === '/checkout') {
    const plan = PLANS[url.searchParams.get('plan')] ? url.searchParams.get('plan') : 'full';
    return html(V.checkoutPage(req, lang, { plan, vin: (url.searchParams.get('vin') || '').toUpperCase().slice(0, 23) }), 200, 'no-store');
  }
  if (rest === '/success') {
    const o = store.getOrder(url.searchParams.get('o') || '');
    if (!o) return redirect(res, `/${lang}/`);
    try {
      if (o.stripe_session && !o.report) {
        const s = await stripe.getSession(o.stripe_session);
        if (s.payment_status === 'paid') { store.updateOrder(o.id, { payment_intent: s.payment_intent, status: 'paid', paid_at: Date.now() }); await fulfil(o.id); }
      }
    } catch (e) { console.error('success check', e.message); }
    return redirect(res, `/${lang}/report/${o.token}`);
  }
  if (rest === '/sample') {
    const vin = '1HGCM82633A004352'; const decoded = await decodeVin(vin);
    const order = { vin, token: 'sample', status: 'paid', plan: 'full' };
    return html(V.reportPage(req, lang, order, demoReport(vin, 'full', decoded), decoded));
  }
  if (rest.startsWith('/report/')) {
    const o = store.getOrderByToken(rest.slice(8));
    if (!o) return html(V.notFound(req, lang), 404);
    if (!o.report && o.status === 'paid') await fulfil(o.id).catch(() => {}); // догрузка, если поставщик был недоступен
    const fresh = store.getOrder(o.id);
    const decoded = await decodeVin(fresh.vin);
    const pack = fresh.credit_code ? store.getCredit(fresh.credit_code) : null;
    const view = { ...fresh, packLeft: pack && PLANS[fresh.plan]?.count > 1 ? pack.remaining : 0 };
    return html(V.reportPage(req, lang, view, fresh.report ? JSON.parse(fresh.report) : null, decoded), 200, 'private, no-store');
  }
  return html(V.notFound(req, lang), 404);
}

function sitemap(req) {
  const base = origin(req); const paths = ['/', '/usa', '/pricing', '/terms'];
  const urls = paths.flatMap((p) => LANGS.map((l) => `<url><loc>${base}/${l}${p}</loc>${LANGS.map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${base}/${a}${p}"/>`).join('')}<changefreq>weekly</changefreq><priority>${p === '/' ? '1.0' : '0.7'}</priority></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`;
}

function admin(req, res, url) {
  const key = url.searchParams.get('key') || '';
  const a = Buffer.from(key), b = Buffer.from(cfg.adminKey);
  if (!cfg.adminKey || a.length !== b.length || !timingSafeEqual(a, b)) return send(req, res, 404, 'Not found', 'text/plain');
  const s = store.stats();
  const rows = s.recent.map((r) => `<tr><td>${V.esc(r.id)}</td><td>${V.esc(r.vin)}</td><td>${V.esc(r.plan)}</td><td>${V.esc(r.status)}</td><td>${price(r.amount)}</td><td>${new Date(r.created_at).toISOString().slice(0, 16)}</td></tr>`).join('');
  send(req, res, 200, `<!doctype html><meta charset=utf-8><meta name=robots content=noindex><link rel=stylesheet href=/styles.css><body style="padding:24px"><h1>VINScope admin</h1>
<p><b>Paid orders (Stripe):</b> ${s.paid.c} · <b>Revenue:</b> ${price(s.paid.s)} · <b>Searches:</b> ${s.searches} (7d: ${s.searches7})</p>
<p>${s.byStatus.map((x) => `${V.esc(x.status)}: ${x.c}`).join(' · ')}</p><p>Top VINs: ${s.topVins.map((x) => `${V.esc(x.vin)} (${x.c})`).join(', ')}</p>
<table><tr><th>id<th>vin<th>plan<th>status<th>amount<th>created</tr>${rows}</table>`, 'text/html; charset=utf-8', { 'cache-control': 'no-store' });
}

async function serveStatic(req, res, pathname) {
  const p = normalize(join(PUB, pathname));
  if (!p.startsWith(PUB)) return false;
  try {
    const st = await stat(p); if (!st.isFile()) return false;
    const type = MIME[extname(p)] || 'application/octet-stream';
    send(req, res, 200, await readFile(p), type + (type.startsWith('text') ? '; charset=utf-8' : ''), { 'cache-control': 'public, max-age=86400' });
    return true;
  } catch { return false; }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const { pathname } = url;
    if (pathname === '/healthz') return send(req, res, 200, 'ok', 'text/plain');
    if (pathname === '/robots.txt') return send(req, res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /*/check\nDisallow: /*/report/\nDisallow: /*/checkout\nSitemap: ${origin(req)}/sitemap.xml\n`, 'text/plain');
    if (pathname === '/sitemap.xml') return send(req, res, 200, sitemap(req), 'application/xml');
    if (pathname === '/admin') return admin(req, res, url);
    if (pathname === '/webhook/stripe' && req.method === 'POST') {
      const raw = await readBody(req, 1e6);
      if (!stripe.verifyWebhook(raw, req.headers['stripe-signature'])) return send(req, res, 400, 'bad signature', 'text/plain');
      const ev = JSON.parse(raw);
      if (ev.type === 'checkout.session.completed' && ev.data.object.payment_status === 'paid') {
        const id = ev.data.object.client_reference_id;
        if (store.getOrder(id)) { store.updateOrder(id, { payment_intent: ev.data.object.payment_intent, status: 'paid', paid_at: Date.now() }); await fulfil(id); }
      }
      return send(req, res, 200, 'ok', 'text/plain');
    }
    if (pathname.startsWith('/api/')) return await api(req, res, url);
    if (pathname === '/') return redirect(res, `/${pickLang(req)}/`);
    const m = pathname.match(/^\/(uk|ru|en)(\/.*)?$/);
    if (m) return await page(req, res, url, m[1], (m[2] || '/').replace(/(.)\/$/, '$1'));
    if (await serveStatic(req, res, pathname)) return;
    send(req, res, 404, V.notFound(req, pickLang(req)));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(req, res, 500, 'Internal error', 'text/plain');
  }
});
server.listen(cfg.port, '0.0.0.0', () => console.log(`VINScope on :${cfg.port} · payments=${demoPayments() ? 'DEMO' : 'stripe'}`));
