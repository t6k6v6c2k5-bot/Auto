import { createServer } from 'node:http';
import { lookupPlate, looksLikeNlPlate } from './src/rdw.js';
import { toolsHub, toolPage } from './src/tools-views.js';
import { TOOLS } from './src/tools-i18n.js';
import { nbuRate } from './src/nbu.js';
import { getPhoto } from './src/photo.js';
const within = (p, ms) => Promise.race([p.catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';
import { cfg, PLANS, paywallOn, price, CURRENCY, payProvider } from './src/config.js';
import * as mono from './src/mono.js';
import * as lemon from './src/lemon.js';
import { LANGS, dict } from './src/i18n.js';
import { validateVin } from './src/vin.js';
import { normalizePlate, looksLikePlate } from './src/plate.js';
import { buildReport } from './src/report.js';
import { startWanted, wantedByPlate, state as wantedState } from './src/wanted.js';
import { startRegistry, vinsByPlate, historyByPlate, coverage, plateCoverage, totalCoverage, status as regStatus } from './src/registry.js';
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
    if (o.payment_intent) { try { await (o.payment_intent.startsWith('pi_') ? stripe.refund(o.payment_intent) : o.payment_intent.startsWith('ls_') ? lemon.refund(o.payment_intent.slice(3)) : mono.cancel(o.payment_intent)); refunded = true; } catch (e) { console.error('REFUND FAILED for order', o.id, e.message); } }
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
// POST только как application/json с того же origin (защита от CSRF-спама простыми формами)
function postGuard(req, res) {
  const ct = String(req.headers['content-type'] || '');
  const origin = req.headers.origin;
  let sameOrigin = true;
  if (origin) { try { sameOrigin = new URL(origin).host === req.headers.host; } catch { sameOrigin = false; } }
  if (!/^application\/json/i.test(ct) || !sameOrigin) { json(req, res, ct ? 403 : 415, { error: L('uk', 'err_bad') }); return false; }
  return true;
}

async function api(req, res, url) {
  if (req.method === 'POST' && (url.pathname === '/api/checkout' || url.pathname === '/api/notify') && !postGuard(req, res)) return;
  if (req.method === 'POST' && url.pathname === '/api/checkout') {
    if (limited('co:' + ipOf(req), 15)) return json(req, res, 429, { error: L('uk', 'err_rate') });
    let b; try { b = JSON.parse(await readBody(req)); } catch (e) { return json(req, res, e.status || 400, { error: L('uk', 'err_bad') }); }
    const lang = LANGS.includes(b.lang) ? b.lang : 'uk';
    const plan = PLANS[b.plan]; const v = validateVin(b.vin);
    if (!plan || !v.ok) return json(req, res, 400, { error: L(lang, 'err_vin'), field: 'vin' });
    if (!paywallOn()) return json(req, res, 200, { url: `/${lang}/check?q=${v.vin}` }); // режим запуска: отчёт — это страница проверки
    const email = String(b.email || '').trim().slice(0, 200);
    if (!EMAIL.test(email)) return json(req, res, 400, { error: L(lang, 'err_email'), field: 'email' });

    if (b.code) { // оплата кодом пакета
      if (limited('code:' + ipOf(req), 5)) return json(req, res, 429, { error: L(lang, 'err_rate') });
      const c = store.getCredit(b.code);
      if (!c || c.remaining < 1 || !store.useCredit(c.code)) return json(req, res, 400, { error: L(lang, 'err_code'), field: 'code' });
      const o = store.newOrder({ vin: v.vin, plan: 'single', email, amount: 0, lang, status: 'credit', credit_code: c.code });
      await fulfil(o.id);
      return json(req, res, 200, { url: `/${lang}/report/${o.token}` });
    }
    const o = store.newOrder({ vin: v.vin, plan: b.plan, email, amount: plan.amount, lang });
    try {
      const d = dict(lang).plans[b.plan];
      if (payProvider() === 'lemon') {
        const c = await lemon.createCheckout({ order: o, name: `VINScope — ${d[0]}, VIN ${v.vin}`, redirectUrl: `${origin(req)}/${lang}/success?o=${o.id}&s=${o.secret}` });
        store.updateOrder(o.id, { stripe_session: `ls:${c.cents}` }); // ожидаемая сумма в валюте магазина
        return json(req, res, 200, { url: c.url });
      }
      if (payProvider() === 'mono') {
        const inv = await mono.createInvoice({
          order: o, destination: `VINScope — ${d[0]}, VIN ${v.vin}`,
          redirectUrl: `${origin(req)}/${lang}/success?o=${o.id}&s=${o.secret}`, webHookUrl: `${origin(req)}/webhook/mono`,
        });
        store.updateOrder(o.id, { stripe_session: inv.invoiceId }); // id платежа у провайдера (колонка общая)
        return json(req, res, 200, { url: inv.pageUrl });
      }
      const s = await stripe.createCheckout({
        order: o, name: `VINScope — ${d[0]}`, description: `VIN ${v.vin}`,
        successUrl: `${origin(req)}/${lang}/success?o=${o.id}&s=${o.secret}`, cancelUrl: `${origin(req)}/${lang}/checkout?plan=${b.plan}&vin=${v.vin}`,
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
    if (!EMAIL.test(email)) return json(req, res, 400, { error: L(lang, 'err_email'), field: 'email' });
    store.addWaitlist(email, lang, String(b.utm || '').slice(0, 200));
    return json(req, res, 200, { ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/status') {
    const c = coverage();
    const pc = plateCoverage();
    return json(req, res, 200, { wanted: { loaded: wantedState.loaded, count: wantedState.count, updatedAt: wantedState.updatedAt }, registry: { from: c.from, to: c.to, records: c.records, indexing: c.indexing, ready: c.ready }, plateArchive: { from: pc.from, to: pc.to, records: pc.records }, paywall: paywallOn() });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/vin/')) {
    const lg = LANGS.includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'uk';
    if (limited('vin:' + ipOf(req), 20)) return json(req, res, 429, { error: L(lg, 'err_rate') });
    const v = validateVin(url.pathname.slice(9));
    if (!v.ok) return json(req, res, 400, { error: L(lg, 'err_vin'), reason: v.error });
    const r = await buildReport(v.vin);
    return json(req, res, 200, { vin: v.vin, region: v.region, decoded: r.decoded, risk: r.risk, wanted: r.wanted.length, registryRecords: r.ua.rows.length });
  }
  // фото аукционного лота: отдаём через себя (адрес берётся только из нашего кэша по VIN, наружу ключи не уходят)
  if (url.pathname === '/api/lotimg' && req.method === 'GET') {
    const vin = String(url.searchParams.get('v') || '').toUpperCase().slice(0, 17), i = Number(url.searchParams.get('i'));
    const src = store.getUsaCache(vin)?.json?.photos?.[i];
    if (!src || !/^https:\/\//.test(src)) return send(req, res, 404, 'not found', 'text/plain; charset=utf-8');
    if (limited('img:' + ipOf(req), 120)) return send(req, res, 429, 'slow down', 'text/plain; charset=utf-8');
    try {
      const r = await fetch(src, { signal: AbortSignal.timeout(10000), redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; VINScope/1.1)', accept: 'image/avif,image/webp,image/*' } });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !/^image\/(jpeg|png|webp)/.test(type)) return send(req, res, 404, 'not found', 'text/plain; charset=utf-8');
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 6e6) return send(req, res, 413, 'too large', 'text/plain; charset=utf-8');
      res.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=604800, immutable', 'x-content-type-options': 'nosniff' });
      return res.end(buf);
    } catch { return send(req, res, 502, 'unavailable', 'text/plain; charset=utf-8'); }
  }
  return json(req, res, 404, { error: L('uk', 'err_bad') });
}

// ---------- страницы ----------
async function page(req, res, url, lang, rest) {
  const html = (s, code = 200, cache = 'public, max-age=300', extra = {}) => send(req, res, code, s, 'text/html; charset=utf-8', { 'cache-control': cache, ...extra });
  const priv = (s, code = 200) => html(s, code, 'private, no-store', { ...NOINDEX, 'referrer-policy': 'no-referrer' });
  if (rest === '/') {
    const stats = { wantedCount: wantedState.count, wantedUpdatedAt: wantedState.updatedAt, registryRecords: totalCoverage().records };
    const q = (url.searchParams.get('q') || '').slice(0, 40);
    if (q) return html(V.home(req, lang, stats, { q, err: url.searchParams.get('e') || 'bad' }), 200, 'private, no-store', NOINDEX);
    return html(V.home(req, lang, stats));
  }
  if (rest === '/tools') return html(toolsHub(req, lang));
  if (rest.startsWith('/tools/') && TOOLS.includes(rest.slice(7))) {
    const id = rest.slice(7);
    return html(toolPage(req, lang, id, { rate: id === 'customs' ? await nbuRate() : null }));
  }
  if (rest === '/usa') return html(V.usaPage(req, lang));
  if (rest === '/pricing') return html(V.pricingPage(req, lang));
  if (rest === '/sources') return redirect(res, `/${lang}/`, 301);
  if (rest === '/terms') return html(V.termsPage(req, lang));
  if (rest === '/wanted' || rest === '/plate') return html(V.landingPage(req, lang, rest.slice(1)));

  if (rest === '/check') {
    const raw = url.searchParams.get('q') || url.searchParams.get('vin') || '';
    if (!raw) return redirect(res, `/${lang}/`, 301);
    if (limited('chk:' + ipOf(req), 60)) return priv(V.messagePage(req, lang, L(lang, 'err_rate_h'), L(lang, 'err_rate')), 429);
    const v = validateVin(raw);
    if (v.ok) {
      store.logSearch(v.vin, lang);
      const fromPlate = normalizePlate(url.searchParams.get('p') || '');
      const r = await buildReport(v.vin, { withProvider: false, plate: looksLikePlate(fromPlate) ? fromPlate : '' }); // платные источники — только в оплаченном отчёте
      // пришли по номеру: добавим записи из архивов до 2021 года (без VIN), если они совпадают с этим авто по марке и году
      let early = [], unverified = false;
      if (fromPlate && looksLikePlate(fromPlate)) {
        const veh = r.ua.summary?.vehicle || {};
        const b4 = (x) => String(x || '').toUpperCase().replace(/[^A-ZА-ЯІЇЄҐ]/g, '').slice(0, 3);
        const groups = historyByPlate(fromPlate).groups;
        // есть запись реестра с VIN — показываем только совпавшие по марке/году группы; иначе показываем все, но с пометкой «не сверено»
        if (veh.brand) early = groups.filter((g) => b4(g.summary.vehicle.brand) === b4(veh.brand) && (!veh.year || !g.summary.vehicle.year || veh.year === g.summary.vehicle.year));
        else { early = groups; unverified = true; }
      }
      return priv(V.checkPage(req, lang, r, { full: !paywallOn(), fromPlate: fromPlate && looksLikePlate(fromPlate) ? fromPlate : '', early, unverified }));
    }
    const plate = normalizePlate(raw);
    if (!looksLikePlate(plate) && !looksLikeNlPlate(plate)) return redirect(res, `/${lang}/?q=${encodeURIComponent(raw.slice(0, 40))}&e=${v.error || 'bad'}`);
    store.logSearch(plate, lang);
    const hit = vinsByPlate(plate)[0];
    if (hit) return redirect(res, `/${lang}/check?q=${hit.vin}&p=${plate}`);
    const hist = historyByPlate(plate);
    if (hist.rows.length) {
      const v0 = hist.groups[0]?.summary.vehicle || {};
      const photo = v0.brand ? await within(getPhoto(v0.brand, v0.model, v0.year), 5000) : null;
      return priv(V.plateReport(req, lang, plate, hist, plateCoverage(), wantedByPlate(plate), photo));
    }
    const nl = await lookupPlate(plate);
    if (nl) {
      nl.photo = await within(getPhoto(nl.brand, nl.model, Number(String(nl.firstAdmission).slice(0, 4)) || null), 5000);
      return priv(V.rdwReport(req, lang, plate, nl, wantedByPlate(plate)));
    }
    return priv(V.plateNotFound(req, lang, plate, totalCoverage(), wantedByPlate(plate)));
  }
  if (rest === '/checkout') {
    const vin = (url.searchParams.get('vin') || '').toUpperCase().slice(0, 23);
    if (!paywallOn()) return redirect(res, vin ? `/${lang}/check?q=${encodeURIComponent(vin)}` : `/${lang}/`);
    const plan = PLANS[url.searchParams.get('plan')] ? url.searchParams.get('plan') : 'single';
    let fx = null; // Lemon Squeezy берёт оплату в валюте магазина: показываем сумму заранее
    if (payProvider() === 'lemon' && cfg.lemonCurrency !== 'UAH') { try { fx = { cur: cfg.lemonCurrency, cents: await lemon.chargeCents(PLANS[plan].amount) }; } catch { /* курс недоступен */ } }
    return priv(V.checkoutPage(req, lang, { plan, vin, fx }));
  }
  if (rest === '/success') {
    const o = store.getOrder(url.searchParams.get('o') || '');
    const sec = url.searchParams.get('s') || '';
    if (!o || !o.success_secret || sec.length !== o.success_secret.length || !timingSafeEqual(Buffer.from(sec), Buffer.from(o.success_secret))) return redirect(res, `/${lang}/`);
    try {
      if (o.stripe_session?.startsWith('ls:')) { /* Lemon Squeezy: оплату подтверждает вебхук */ } else if (o.stripe_session && !o.report && o.status === 'pending' && !o.stripe_session.startsWith('cs_')) {
        const st = await mono.invoiceStatus(o.stripe_session); // вебхук может прийти позже — проверяем статус сами
        if (mono.isPaid(st, o) && store.claimPaid(o.id, st.invoiceId || o.stripe_session)) await fulfil(o.id);
      } else if (o.stripe_session && !o.report && o.status === 'pending') {
        const s = await stripe.getSession(o.stripe_session);
        if (s.payment_status === 'paid' && s.amount_total === o.amount && s.currency === CURRENCY && store.claimPaid(o.id, s.payment_intent)) await fulfil(o.id);
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
  const base = origin(req); const paths = ['/', '/tools', ...TOOLS.map((t) => '/tools/' + t), '/wanted', '/plate', '/usa', '/pricing', '/terms'];
  const loc = (l, p) => `${base}/${l}${p === '/' ? '/' : p}`;
  const urls = paths.flatMap((p) => LANGS.map((l) => `<url><loc>${loc(l, p)}</loc><lastmod>${LASTMOD}</lastmod>${LANGS.map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${loc(a, p)}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${loc('uk', p)}"/></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`;
}

// Админка: HTTP Basic (пароль = ADMIN_KEY), сравнение по хешам, лимит попыток
function adminAuth(req, res) {
  const deny = () => send(req, res, 401, 'Unauthorized', 'text/plain; charset=utf-8', { 'www-authenticate': 'Basic realm="VINScope admin", charset="UTF-8"', 'cache-control': 'no-store' });
  if (!cfg.adminKey || cfg.adminKey.length < 16) { send(req, res, 404, 'Not found', 'text/plain'); return false; }
  if (limited('adm:' + ipOf(req), 30)) { send(req, res, 429, 'Too many attempts', 'text/plain'); return false; }
  const m = /^Basic (.+)$/.exec(req.headers.authorization || '');
  const pass = m ? Buffer.from(m[1], 'base64').toString('utf8').split(':').slice(1).join(':') : '';
  if (!m || !timingSafeEqual(sha(pass), sha(cfg.adminKey))) { deny(); return false; }
  return true;
}
// полный отчёт с платными источниками для владельца (проверка поставщиков без оплаты)
async function adminReport(req, res, url) {
  if (!adminAuth(req, res)) return;
  const v = validateVin(url.searchParams.get('vin') || '');
  const lang = LANGS.includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'uk';
  if (!v.ok) return send(req, res, 400, 'Bad VIN', 'text/plain; charset=utf-8');
  const r = await buildReport(v.vin, { withProvider: true });
  return send(req, res, 200, V.checkPage(req, lang, r, { full: true }), 'text/html; charset=utf-8', { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', ...NOINDEX });
}

function admin(req, res) {
  if (!adminAuth(req, res)) return;
  const s = store.stats();
  const rows = s.recent.map((r) => `<tr><td>${V.esc(r.id)}</td><td>${V.esc(r.vin)}</td><td>${V.esc(r.plan)}</td><td>${V.esc(r.status)}</td><td>${price(r.amount)}</td><td>${new Date(r.created_at).toISOString().slice(0, 16)}</td></tr>`).join('');
  const c = coverage();
  send(req, res, 200, `<!doctype html><meta charset=utf-8><meta name=robots content=noindex><meta name=referrer content=no-referrer><link rel=stylesheet href=/styles.css><body style="padding:24px"><h1>VINScope admin</h1>
<p><b>Paid orders (Stripe):</b> ${s.paid.c} · <b>Revenue:</b> ${price(s.paid.s)} · <b>Searches:</b> ${s.searches} (7d: ${s.searches7}) · <b>Waitlist:</b> ${s.waitlist}</p>
<p><b>Wanted:</b> ${wantedState.count} (upd ${V.esc(wantedState.updatedAt)}) · <b>Registry:</b> ${V.esc(JSON.stringify(c))} · worker: ${V.esc(JSON.stringify(regStatus))}</p>
<p>${s.byStatus.map((x) => `${V.esc(x.status)}: ${x.c}`).join(' · ')}</p><p>Top VINs: ${s.topVins.map((x) => `${V.esc(x.vin)} (${x.c})`).join(', ')}</p>
<form action=/admin/report method=get style="margin:16px 0"><b>Полный (платный) отчёт:</b> <input name=vin placeholder=VIN maxlength=17 style="font:16px monospace;padding:6px"> <button>Открыть</button> <small>тратит запросы платных поставщиков</small></form>
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
    if (pathname === '/admin/report') return adminReport(req, res, url);
    if (pathname === '/webhook/lemon' && req.method === 'POST') {
      const raw = await readBody(req, 1e6);
      if (!lemon.verifyWebhook(raw, req.headers['x-signature'])) return send(req, res, 400, 'bad signature', 'text/plain');
      const ev = JSON.parse(raw);
      const id = ev?.meta?.custom_data?.order_id;
      const o = id ? store.getOrder(id) : null;
      const expect = Number(String(o?.stripe_session || '').replace(/^ls:/, '')) || Infinity;
      const p = o && lemon.paidOrder(ev, expect);
      if (p && p.orderId === o.id && store.claimPaid(o.id, 'ls_' + p.lemonId)) await fulfil(o.id);
      return send(req, res, 200, 'ok', 'text/plain');
    }
    if (pathname === '/webhook/mono' && req.method === 'POST') {
      const raw = await readBody(req, 1e6);
      if (!cfg.monoToken || !(await mono.verifyWebhook(raw, req.headers['x-sign']))) return send(req, res, 400, 'bad signature', 'text/plain');
      const ev = JSON.parse(raw);
      const o = ev.reference ? store.getOrder(ev.reference) : null;
      if (o && o.stripe_session === ev.invoiceId && mono.isPaid(ev, o) && store.claimPaid(o.id, ev.invoiceId)) await fulfil(o.id);
      return send(req, res, 200, 'ok', 'text/plain');
    }
    if (pathname === '/webhook/stripe' && req.method === 'POST') {
      const raw = await readBody(req, 1e6);
      if (!stripe.verifyWebhook(raw, req.headers['stripe-signature'])) return send(req, res, 400, 'bad signature', 'text/plain');
      const ev = JSON.parse(raw);
      const so = ev.data?.object;
      if (ev.type === 'checkout.session.completed' && so?.payment_status === 'paid') {
        const o = store.getOrder(so.client_reference_id);
        if (o && so.amount_total === o.amount && so.currency === CURRENCY && store.claimPaid(o.id, so.payment_intent)) await fulfil(o.id);
      }
      return send(req, res, 200, 'ok', 'text/plain');
    }
    if (pathname.startsWith('/api/')) return await api(req, res, url);
    if (pathname === '/') return redirect(res, `/${pickLang(req)}/`, 302, { vary: 'Accept-Language', 'cache-control': 'private, max-age=0' });

    const m = pathname.match(/^\/(uk|ru|en)(\/.*)?$/);
    if (m) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405, 'Method Not Allowed', 'text/plain; charset=utf-8', { allow: 'GET, HEAD' });
      // каноничные URL: без двойных и хвостовых слэшей, корень языка — /uk/
      let rest = (m[2] || '/').replace(/\/{2,}/g, '/');
      const clean = rest.length > 1 ? rest.replace(/\/$/, '') : rest;
      if (!m[2] || clean !== (m[2] || '/')) return redirect(res, `/${m[1]}${clean}${url.search}`, 301);
      return await page(req, res, url, m[1], clean);
    }
    if (await serveStatic(req, res, PUB, pathname)) return;
    if (pathname === '/favicon.ico') return redirect(res, '/favicon.svg', 301, { 'cache-control': 'public, max-age=86400' });
    if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return send(req, res, 404, 'Not found', 'text/plain; charset=utf-8', { 'cache-control': 'public, max-age=300' }); // не отдаём HTML-страницу на каждый промах статики
    send(req, res, 404, V.notFound(req, pickLang(req)), 'text/html; charset=utf-8', NOINDEX);
  } catch (e) {
    if (e.status === 413) return send(req, res, 413, 'Payload too large', 'text/plain');
    console.error(e);
    if (!res.headersSent) send(req, res, 500, V.messagePage(req, 'uk', L('uk', 'err_500'), L('uk', 'err_500')), 'text/html; charset=utf-8', NOINDEX);
  }
});
// корректная остановка при деплое: дожидаемся текущих запросов (до 8 с), новые не принимаем
let stopping = false;
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  if (stopping) return; stopping = true;
  console.log(`${sig}: graceful shutdown`);
  server.close(() => process.exit(0));
  server.closeIdleConnections?.();
  setTimeout(() => process.exit(0), 8000).unref();
});
server.headersTimeout = 15e3; server.requestTimeout = 30e3; server.keepAliveTimeout = 65e3;
server.listen(cfg.port, '0.0.0.0', () => {
  console.log(`VINScope on :${cfg.port} · paywall=${paywallOn() ? `on (${payProvider()})` : 'off (launch mode)'}`);
  startWanted(); startRegistry();
  store.purgeOld(); setInterval(() => store.purgeOld(), 24 * 3600e3).unref();
});
