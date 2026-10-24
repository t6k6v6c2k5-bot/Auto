import { createServer } from 'node:http';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';
import { cfg, PLANS, paywallOn, price } from './src/config.js';
import { LANGS, dict } from './src/i18n.js';
import { validateVin } from './src/vin.js';
import { normalizePlate, looksLikePlate } from './src/plate.js';
import { buildReport } from './src/report.js';
import { startWanted, wantedByPlate, state as wantedState } from './src/wanted.js';
import { startRegistry, vinsByPlate, coverage, status as regStatus } from './src/registry.js';
import { ipOf, limited, origin, send, json, redirect, readBody, serveStatic } from './src/http.js';
import * as store from './src/db.js';
import * as stripe from './src/stripe.js';
import * as V from './src/views.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUB = join(ROOT, 'public');
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const NOINDEX = { 'x-robots-tag': 'noindex, nofollow' };
const L = (lang, key) => dict(LANGS.includes(lang) ? lang : 'uk')[key];

const pickLang = (req) => {
  const h = (req.headers['accept-language'] || '').toLowerCase();
  for (const part of h.split(',')) { const l = part.trim().slice(0, 2); if (LANGS.includes(l)) return l; }
  return 'uk';
};
const sha = (s) => createHash('sha256').update(String(s)).digest();

// ---------- fulfilment (идемпотентно, с блокировкой на заказ) ----------
const inflight = new Map();
function fulfil(orderId) {
  if (inflight.has(orderId)) return inflight.get(orderId);
  const p = doFulfil(orderId).finally(() => inflight.delete(orderId));
  inflight.set(orderId, p);
  return p;
}
async function doFulfil(orderId) {
  const o = store.getOrder(orderId);
  if (!o || o.report || !['paid', 'credit'].includes(o.status)) return o;
  let report;
  try { report = await buildReport(o.vin, { withProvider: true, plan: o.plan }); }
  catch (e) { console.error('report build failed', e.message); return o; } // оплачено: отчёт соберётся при открытии страницы
  if (!report.found) {
    // Ноу-хау: автовозврат, если по VIN нет данных ни в одном источнике
    let refunded = !o.payment_intent; // у заказов по коду пакета возвращать в Stripe нечего
    if (o.payment_intent) { try { await stripe.refund(o.payment_intent); refunded = true; } catch (e) { console.error('REFUND FAILED for order', o.id, e.message); } }
    if (o.status === 'credit' && o.credit_code) store.returnCredit(o.credit_code);
    store.updateOrder(o.id, { status: refunded ? 'refunded' : 'refund_failed' }); // refund_failed виден в /admin: вернуть вручную
    return store.getOrder(o.id);
  }
  const f = { report: JSON.stringify(report) };
  const n = PLANS[o.plan]?.count || 1;
  if (n > 1 && !o.credit_code) f.credit_code = store.newCredit(o.plan, n - 1, o.email);
  store.updateOrder(o.id, f);
  return store.getOrder(o.id);
}

// ---------- API ----------
async function api(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/checkout') {
    if (limited('co:' + ipOf(req), 15)) return json(req, res, 429, { error: L('uk', 'err_rate') });
    let b; try { b = JSON.parse(await readBody(req)); } catch (e) { return json(req, res, e.status || 400, { error: L('uk', 'err_bad') }); }
    const lang = LANGS.includes(b.lang) ? b.lang : 'uk';
    const plan = PLANS[b.plan]; const v = validateVin(b.vin);
    if (!plan || !v.ok) return json(req, res, 400, { error: L(lang, 'err_vin') });
    if (!paywallOn()) return json(req, res, 200, { url: `/${lang}/check?q=${v.vin}` }); // режим запуска: отчёт — это страница проверки
    const email = String(b.email || '').trim().slice(0, 200);
    if (!EMAIL.test(email)) return json(req, res, 400, { error: L(lang, 'err_email') });

    if (b.code) { // оплата кодом пакета
      if (limited('code:' + ipOf(req), 5)) return json(req, res, 429, { error: L(lang, 'err_rate') });
      const c = store.getCredit(b.code);
      if (!c || c.remaining < 1 || !store.useCredit(c.code)) return json(req, res, 400, { error: L(lang, 'err_code') });
      const o = store.newOrder({ vin: v.vin, plan: 'single', email, amount: 0, lang, status: 'credit', credit_code: c.code });
      await fulfil(o.id);
      return json(req, res, 200, { url: `/${lang}/report/${o.token}` });
    }
    const o = store.newOrder({ vin: v.vin, plan: b.plan, email, amount: plan.usd, lang });
    try {
      const d = dict(lang).plans[b.plan];
      const s = await stripe.createCheckout({
        order: o, name: `VINScope — ${d[0]}`, description: `VIN ${v.vin}`,
        successUrl: `${origin(req)}/${lang}/success?o=${o.id}`, cancelUrl: `${origin(req)}/${lang}/checkout?plan=${b.plan}&vin=${v.vin}`,
      });
      store.updateOrder(o.id, { stripe_session: s.id });
      return json(req, res, 200, { url: s.url });
    } catch (e) { console.error('stripe', e.message); return json(req, res, 502, { error: L(lang, 'err_pay') }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/notify') {
    if (limited('nt:' + ipOf(req), 8)) return json(req, res, 429, { error: L('uk', 'err_rate') });
    let b; try { b = JSON.parse(await readBody(req)); } catch (e) { return json(req, res, e.status || 400, { error: L('uk', 'err_bad') }); }
    const lang = LANGS.includes(b.lang) ? b.lang : 'uk';
    const email = String(b.email || '').trim().slice(0, 200);
    if (!EMAIL.test(email)) return json(req, res, 400, { error: L(lang, 'err_email') });
    store.addWaitlist(email, lang, String(b.utm || '').slice(0, 200));
    return json(req, res, 200, { ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/status') {
    const c = coverage();
    return json(req, res, 200, { wanted: { loaded: wantedState.loaded, count: wantedState.count, updatedAt: wantedState.updatedAt }, registry: { from: c.from, to: c.to, records: c.records, indexing: c.indexing, ready: c.ready }, paywall: paywallOn() });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/vin/')) {
    if (limited('vin:' + ipOf(req), 20)) return json(req, res, 429, { error: L('uk', 'err_rate') });
    const v = validateVin(url.pathname.slice(9));
    if (!v.ok) return json(req, res, 400, { error: v.error });
    const r = await buildReport(v.vin);
    return json(req, res, 200, { vin: v.vin, region: v.region, decoded: r.decoded, risk: r.risk, wanted: r.wanted.length, registryRecords: r.ua.rows.length });
  }
  return json(req, res, 404, { error: 'Not found' });
}

// ---------- страницы ----------
async function page(req, res, url, lang, rest) {
  const html = (s, code = 200, cache = 'public, max-age=300', extra = {}) => send(req, res, code, s, 'text/html; charset=utf-8', { 'cache-control': cache, ...extra });
  const priv = (s, code = 200) => html(s, code, 'private, no-store', { ...NOINDEX, 'referrer-policy': 'no-referrer' });
  if (rest === '/') return html(V.home(req, lang, { wantedCount: wantedState.count, wantedUpdatedAt: wantedState.updatedAt, registryRecords: coverage().records }));
  if (rest === '/usa') return html(V.usaPage(req, lang));
  if (rest === '/pricing') return html(V.pricingPage(req, lang));
  if (rest === '/sources') return html(V.sourcesPage(req, lang));
  if (rest === '/terms') return html(V.termsPage(req, lang));
  if (rest === '/wanted' || rest === '/plate') return html(V.landingPage(req, lang, rest.slice(1)));

  if (rest === '/check') {
    const raw = url.searchParams.get('q') || url.searchParams.get('vin') || '';
    if (!raw) return redirect(res, `/${lang}/`, 301);
    if (limited('chk:' + ipOf(req), 60)) return priv(V.messagePage(req, lang, L(lang, 'err_rate_h'), L(lang, 'err_rate')), 429);
    const v = validateVin(raw);
    if (v.ok) {
      store.logSearch(v.vin, lang);
      const r = await buildReport(v.vin);
      return priv(V.checkPage(req, lang, r, { full: !paywallOn(), fromPlate: url.searchParams.get('p') || '' }));
    }
    const plate = normalizePlate(raw);
    if (!looksLikePlate(plate)) return redirect(res, `/${lang}/`);
    store.logSearch(plate, lang);
    const hit = vinsByPlate(plate)[0];
    if (hit) return redirect(res, `/${lang}/check?q=${hit.vin}&p=${plate}`);
    return priv(V.plateNotFound(req, lang, plate, coverage(), wantedByPlate(plate)));
  }
  if (rest === '/checkout') {
    const vin = (url.searchParams.get('vin') || '').toUpperCase().slice(0, 23);
    if (!paywallOn()) return redirect(res, vin ? `/${lang}/check?q=${encodeURIComponent(vin)}` : `/${lang}/`);
    const plan = PLANS[url.searchParams.get('plan')] ? url.searchParams.get('plan') : 'single';
    return priv(V.checkoutPage(req, lang, { plan, vin }));
  }
  if (rest === '/success') {
    const o = store.getOrder(url.searchParams.get('o') || '');
    if (!o) return redirect(res, `/${lang}/`);
    try {
      if (o.stripe_session && !o.report && o.status === 'pending') {
        const s = await stripe.getSession(o.stripe_session);
        if (s.payment_status === 'paid' && s.amount_total === o.amount && s.currency === 'usd' && store.claimPaid(o.id, s.payment_intent)) await fulfil(o.id);
      } else if (!o.report) await fulfil(o.id);
    } catch (e) { console.error('success check', e.message); }
    return redirect(res, `/${lang}/report/${o.token}`);
  }
  if (rest.startsWith('/report/')) {
    const o = store.getOrderByToken(rest.slice(8));
    if (!o) return priv(V.notFound(req, lang), 404);
    if (!o.report) await fulfil(o.id).catch(() => {}); // догрузка, если сборка упала
    const fresh = store.getOrder(o.id);
    const pack = fresh.credit_code ? store.getCredit(fresh.credit_code) : null;
    const view = { ...fresh, packLeft: pack && PLANS[fresh.plan]?.count > 1 ? pack.remaining : 0 };
    return priv(V.reportPage(req, lang, view, fresh.report ? JSON.parse(fresh.report) : null));
  }
  return html(V.notFound(req, lang), 404, 'public, max-age=60');
}

// Дата последнего изменения контента — для sitemap
const LASTMOD = new Date(Math.max(...['src/i18n.js', 'src/views.js'].map((f) => statSync(join(ROOT, f)).mtimeMs))).toISOString().slice(0, 10);
function sitemap(req) {
  const base = origin(req); const paths = ['/', '/wanted', '/plate', '/usa', '/sources', '/pricing', '/terms'];
  const loc = (l, p) => `${base}/${l}${p === '/' ? '/' : p}`;
  const urls = paths.flatMap((p) => LANGS.map((l) => `<url><loc>${loc(l, p)}</loc><lastmod>${LASTMOD}</lastmod>${LANGS.map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${loc(a, p)}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${loc('uk', p)}"/></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`;
}

// Админка: HTTP Basic (пароль = ADMIN_KEY), сравнение по хешам, лимит попыток
function admin(req, res) {
  const deny = () => { res.writeHead(401, { 'www-authenticate': 'Basic realm="VINScope admin", charset="UTF-8"', 'cache-control': 'no-store' }); res.end(); };
  if (!cfg.adminKey || cfg.adminKey.length < 16) return send(req, res, 404, 'Not found', 'text/plain');
  if (limited('adm:' + ipOf(req), 10)) return send(req, res, 429, 'Too many attempts', 'text/plain');
  const m = /^Basic (.+)$/.exec(req.headers.authorization || '');
  const pass = m ? Buffer.from(m[1], 'base64').toString('utf8').split(':').slice(1).join(':') : '';
  if (!m || !timingSafeEqual(sha(pass), sha(cfg.adminKey))) return deny();
  const s = store.stats();
  const rows = s.recent.map((r) => `<tr><td>${V.esc(r.id)}</td><td>${V.esc(r.vin)}</td><td>${V.esc(r.plan)}</td><td>${V.esc(r.status)}</td><td>${price(r.amount)}</td><td>${new Date(r.created_at).toISOString().slice(0, 16)}</td></tr>`).join('');
  const c = coverage();
  send(req, res, 200, `<!doctype html><meta charset=utf-8><meta name=robots content=noindex><meta name=referrer content=no-referrer><link rel=stylesheet href=/styles.css><body style="padding:24px"><h1>VINScope admin</h1>
<p><b>Paid orders (Stripe):</b> ${s.paid.c} · <b>Revenue:</b> ${price(s.paid.s)} · <b>Searches:</b> ${s.searches} (7d: ${s.searches7}) · <b>Waitlist:</b> ${s.waitlist}</p>
<p><b>Wanted:</b> ${wantedState.count} (upd ${V.esc(wantedState.updatedAt)}) · <b>Registry:</b> ${V.esc(JSON.stringify(c))} · worker: ${V.esc(JSON.stringify(regStatus))}</p>
<p>${s.byStatus.map((x) => `${V.esc(x.status)}: ${x.c}`).join(' · ')}</p><p>Top VINs: ${s.topVins.map((x) => `${V.esc(x.vin)} (${x.c})`).join(', ')}</p>
<table><tr><th>id<th>vin<th>plan<th>status<th>amount<th>created</tr>${rows}</table>`, 'text/html; charset=utf-8', { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', ...NOINDEX });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let { pathname } = url;
    if (pathname === '/healthz') return send(req, res, 200, 'ok', 'text/plain');
    if (pathname === '/robots.txt') return send(req, res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /*/checkout\nSitemap: ${origin(req)}/sitemap.xml\n`, 'text/plain; charset=utf-8', { 'cache-control': 'public, max-age=3600' });
    if (pathname === '/sitemap.xml') return send(req, res, 200, sitemap(req), 'application/xml; charset=utf-8', { 'cache-control': 'public, max-age=3600' });
    if (pathname === '/admin') return admin(req, res);
    if (pathname === '/webhook/stripe' && req.method === 'POST') {
      const raw = await readBody(req, 1e6);
      if (!stripe.verifyWebhook(raw, req.headers['stripe-signature'])) return send(req, res, 400, 'bad signature', 'text/plain');
      const ev = JSON.parse(raw);
      const so = ev.data?.object;
      if (ev.type === 'checkout.session.completed' && so?.payment_status === 'paid') {
        const o = store.getOrder(so.client_reference_id);
        if (o && so.amount_total === o.amount && so.currency === 'usd' && store.claimPaid(o.id, so.payment_intent)) await fulfil(o.id);
      }
      return send(req, res, 200, 'ok', 'text/plain');
    }
    if (pathname.startsWith('/api/')) return await api(req, res, url);
    if (pathname === '/') return redirect(res, `/${pickLang(req)}/`, 302, { vary: 'Accept-Language', 'cache-control': 'private, max-age=0' });

    const m = pathname.match(/^\/(uk|ru|en)(\/.*)?$/);
    if (m) {
      // каноничные URL: без двойных и хвостовых слэшей, корень языка — /uk/
      let rest = (m[2] || '/').replace(/\/{2,}/g, '/');
      const clean = rest.length > 1 ? rest.replace(/\/$/, '') : rest;
      if (!m[2] || clean !== (m[2] || '/')) return redirect(res, `/${m[1]}${clean}${url.search}`, 301);
      return await page(req, res, url, m[1], clean);
    }
    if (await serveStatic(req, res, PUB, pathname)) return;
    send(req, res, 404, V.notFound(req, pickLang(req)), 'text/html; charset=utf-8', NOINDEX);
  } catch (e) {
    if (e.status === 413) return send(req, res, 413, 'Payload too large', 'text/plain');
    console.error(e);
    if (!res.headersSent) send(req, res, 500, V.messagePage(req, 'uk', L('uk', 'err_500'), L('uk', 'err_500')), 'text/html; charset=utf-8', NOINDEX);
  }
});
server.headersTimeout = 15e3; server.requestTimeout = 30e3; server.keepAliveTimeout = 65e3;
server.listen(cfg.port, '0.0.0.0', () => {
  console.log(`VINScope on :${cfg.port} · paywall=${paywallOn() ? 'on (stripe)' : 'off (launch mode)'}`);
  startWanted(); startRegistry();
  store.purgeOld(); setInterval(() => store.purgeOld(), 24 * 3600e3).unref();
});
