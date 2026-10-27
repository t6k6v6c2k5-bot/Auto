import { createServer } from 'node:http';
import { lookupPlate, looksLikeNlPlate } from './src/rdw.js';
import { toolsHub, toolPage } from './src/tools-views.js';
import { TOOLS } from './src/tools-i18n.js';
import { guidesHub, guidePage } from './src/guides-views.js';
import { warmRia, adIdFromUrl, adById, marketPrice } from './src/ria.js';
import * as cm from './src/comments.js';
import * as wt from './src/watch.js';
import { GUIDES, GG } from './src/guides.js';
import { nbuRate } from './src/nbu.js';
import { getPhoto } from './src/photo.js';
const within = (p, ms) => Promise.race([p.catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';
import { cfg, PLANS, paywallOn, CURRENCY, payProvider } from './src/config.js';
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
import { track, purgeHits, waitlistAll, fmtTs, isBotReq, resetStats } from './src/analytics.js';
import { adminPage } from './src/admin-views.js';

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
  if (rest === '/comments') return html(cm.commentsPage(req, lang), 200, 'public, max-age=60', NOINDEX);
  if (rest === '/guides') return html(guidesHub(req, lang));
  if (rest.startsWith('/guides/') && GUIDES.includes(rest.slice(8))) return html(guidePage(req, lang, rest.slice(8)));
  if (rest === '/usa') return html(V.usaPage(req, lang));
  if (rest === '/pricing') return html(V.pricingPage(req, lang));
  if (rest === '/sources') return redirect(res, `/${lang}/`, 301);
  if (rest === '/terms') return html(V.termsPage(req, lang));
  if (rest === '/wanted' || rest === '/plate') return html(V.landingPage(req, lang, rest.slice(1)));

  if (rest === '/check') {
    const raw = url.searchParams.get('q') || url.searchParams.get('vin') || '';
    if (!raw) return redirect(res, `/${lang}/`, 301);
    if (limited('chk:' + ipOf(req), 60)) { req.evNote = 'limited'; return priv(V.messagePage(req, lang, L(lang, 'err_rate_h'), L(lang, 'err_rate')), 429); }
    const adId = adIdFromUrl(raw);
    if (adId) { // ссылка на объявление: достаём VIN из карточки (если продавец его указал) и ведём на обычную проверку
      req.evNote = 'ad';
      const a = isBotReq(req) ? null : await adById(adId);
      if (a?.vin) return redirect(res, `/${lang}/check?q=${a.vin}&ad=${adId}`);
      return redirect(res, `/${lang}/?q=${encodeURIComponent(raw.slice(0, 200))}&e=${a ? 'adnovin' : 'adfail'}`);
    }
    const v = validateVin(raw);
    if (v.ok) {
      req.evNote = 'vin';
      if (!isBotReq(req)) store.logSearch(v.vin, lang); // запросы ботов и скриптов в статистику проверок не идут
      const fromPlate = normalizePlate(url.searchParams.get('p') || '');
      const r = await buildReport(v.vin, { withProvider: false, plate: looksLikePlate(fromPlate) ? fromPlate : '', market: !isBotReq(req) }); // платные источники — только в оплаченном отчёте
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
      const adId2 = /^\d{6,10}$/.test(url.searchParams.get('ad') || '') ? url.searchParams.get('ad') : '';
      const adLink = adId2 && !isBotReq(req) ? await adById(adId2) : null; // пришли по ссылке: цену из их объявления показываем сразу
      return priv(V.checkPage(req, lang, adLink?.vin === v.vin ? { ...r, adLink } : r, { full: !paywallOn(), fromPlate: fromPlate && looksLikePlate(fromPlate) ? fromPlate : '', early, unverified }));
    }
    const plate = normalizePlate(raw);
    if (!looksLikePlate(plate) && !looksLikeNlPlate(plate)) { req.evNote = 'invalid'; return redirect(res, `/${lang}/?q=${encodeURIComponent(raw.slice(0, 40))}&e=${v.error || 'bad'}`); }
    req.evNote = 'plate';
    if (!isBotReq(req)) store.logSearch(plate, lang);
    const hit = vinsByPlate(plate)[0];
    if (hit) return redirect(res, `/${lang}/check?q=${hit.vin}&p=${plate}${url.searchParams.get('c') ? '&c=' + encodeURIComponent(url.searchParams.get('c')).slice(0, 12) : ''}`);
    const hist = historyByPlate(plate);
    if (hist.rows.length) {
      const v0 = hist.groups[0]?.summary.vehicle || {};
      const photo = v0.brand ? await within(getPhoto(v0.brand, v0.model, v0.year), 5000) : null;
      const mk = v0.brand && v0.model && v0.year && !isBotReq(req) ? await within(marketPrice({ make: v0.brand, model: v0.model, year: v0.year }), 3500) : null;
      const fx = mk ? await within(nbuRate('USD').catch(() => null), 2000) : null;
      return priv(V.plateReport(req, lang, plate, hist, plateCoverage(), wantedByPlate(plate), photo, mk ? { ...mk, uah: fx?.rate || null } : null));
    }
    const nl = await lookupPlate(plate);
    if (nl) {
      req.evNote = 'plate-nl';
      nl.photo = await within(getPhoto(nl.brand, nl.model, Number(String(nl.firstAdmission).slice(0, 4)) || null), 5000);
      return priv(V.rdwReport(req, lang, plate, nl, wantedByPlate(plate)));
    }
    req.evNote = 'plate-nf';
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
// Краткое описание сайта для ИИ-поиска и ассистентов (llms.txt)
function llmsTxt(req) {
  const b = origin(req); const G = GG.uk;
  return `# VINScope\n\n> Безкоштовна перевірка авто за VIN і держномером в Україні: розшук, історія реєстрацій, відкличні кампанії, оцінка ризику. Інструменти покупця та гайди. Мови: українська, російська, англійська.\n\n## Основне\n- [Головна](${b}/uk/): перевірка за VIN або номером\n- [Інструменти](${b}/uk/tools): розшифровка VIN, калькулятор розмитнення, перевірка пробігу, чек-лист\n- [Перевірка на розшук](${b}/uk/wanted)\n- [Перевірка за держномером](${b}/uk/plate)\n- [Авто зі США](${b}/uk/usa)\n\n## Гайди\n${GUIDES.map((g) => `- [${G.a[g].h}](${b}/uk/guides/${g})`).join('\n')}\n`;
}
function sitemap(req) {
  const base = origin(req); const paths = ['/', '/tools', ...TOOLS.map((t) => '/tools/' + t), '/guides', ...GUIDES.map((g) => '/guides/' + g), '/wanted', '/plate', '/usa', '/pricing', '/terms'];
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

function admin(req, res, url) {
  if (!adminAuth(req, res)) return;
  const ctx = { stats: store.stats(), wanted: wantedState, cov: coverage(), regStatus, paywall: paywallOn(), provider: payProvider() };
  send(req, res, 200, adminPage(url.searchParams.get('tab') || 'overview', Number(url.searchParams.get('d')) || 0, ctx), 'text/html; charset=utf-8', { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', ...NOINDEX });
}
// сброс счётчиков: только POST с того же origin (браузер сам подставляет Basic-доступ, поэтому защищаем от CSRF)
// форма коментаря: той самий origin, urlencoded, приманка для ботів, ліміт частоти, мінімальний час заповнення
const sameOrigin = (req) => { try { return new URL(req.headers.origin || req.headers.referer || '').host === req.headers.host; } catch { return false; } };
const KEY_RE = /^[A-Z0-9]{5,17}$/;
async function readForm(req, res) {
  if (!sameOrigin(req)) { send(req, res, 403, 'Forbidden', 'text/plain'); return null; }
  if (!/^application\/x-www-form-urlencoded/i.test(req.headers['content-type'] || '')) { send(req, res, 415, 'Unsupported', 'text/plain'); return null; }
  return new URLSearchParams(await readBody(req, 8192));
}
async function commentPost(req, res) {
  const f = await readForm(req, res); if (!f) return;
  const lang = LANGS.includes(f.get('lang')) ? f.get('lang') : 'uk';
  const key = String(f.get('key') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const back = (code) => redirect(res, `/${lang}/check?q=${encodeURIComponent(KEY_RE.test(key) ? key : '')}&c=${code}#comments`, 303);
  if (limited('cmt:' + ipOf(req), 3)) return back('fast');
  if (f.get('website')) return back('ok'); // приманка заповнена: робимо вигляд, що прийняли
  const age = Date.now() - Number(f.get('t')); if (!(age >= 3000 && age < 6 * 3600e3)) return back('fast');
  return back(cm.addComment({ key, kind: f.get('kind'), cat: f.get('cat'), text: f.get('text'), lang, ip: ipOf(req) }));
}
async function watchPost(req, res) {
  const f = await readForm(req, res); if (!f) return;
  const lang = LANGS.includes(f.get('lang')) ? f.get('lang') : 'uk';
  const vin = String(f.get('vin') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const back = (code) => redirect(res, `/${lang}/check?q=${encodeURIComponent(KEY_RE.test(vin) ? vin : '')}&w=${code}#watch`, 303);
  if (limited('wt:' + ipOf(req), 3)) return back('fast');
  if (f.get('website')) return back('sent'); // приманка заполнена
  const age = Date.now() - Number(f.get('t')); if (!(age >= 2500 && age < 6 * 3600e3)) return back('fast');
  return back(await wt.addWatch({ email: f.get('email'), vin, lang, base: origin(req) }));
}
function watchLink(req, res, url, confirm) {
  const w = (confirm ? wt.confirmWatch : wt.stopWatch)(url.searchParams.get('t') || '');
  const lang = w?.lang && LANGS.includes(w.lang) ? w.lang : 'uk';
  const k = !w ? 'bad' : confirm ? 'ok' : 'stop';
  return send(req, res, w ? 200 : 404, V.messagePage(req, lang, wt.watchText(lang, k + '_h'), wt.watchText(lang, k + '_p')), 'text/html; charset=utf-8', { 'cache-control': 'no-store', ...NOINDEX });
}
async function commentReport(req, res) {
  const f = await readForm(req, res); if (!f) return;
  const lang = LANGS.includes(f.get('lang')) ? f.get('lang') : 'uk';
  const key = String(f.get('key') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!limited('cmr:' + ipOf(req), 10) && /^\d{1,9}$/.test(f.get('id') || '')) cm.report(f.get('id'));
  return redirect(res, `/${lang}/check?q=${encodeURIComponent(KEY_RE.test(key) ? key : '')}&c=rep#comments`, 303);
}
// модерація з адмінки: тільки власник (Basic) і той самий origin
async function adminComment(req, res) {
  if (!adminAuth(req, res)) return;
  const f = await readForm(req, res); if (!f) return;
  const id = f.get('id'), what = f.get('what');
  if (/^\d{1,9}$/.test(id || '')) { if (what === 'approve') cm.setStatus(id, 'approved'); else if (what === 'hide') cm.setStatus(id, 'hidden'); else if (what === 'delete') cm.remove(id); }
  return redirect(res, '/admin?tab=comments', 303);
}
async function adminReset(req, res) {
  if (!adminAuth(req, res)) return;
  let same = false; try { same = new URL(String(req.headers.origin || '')).host === req.headers.host; } catch { /* нет origin */ }
  if (!same) return send(req, res, 403, 'Forbidden', 'text/plain');
  const f = new URLSearchParams(await readBody(req, 4096));
  if (f.get('confirm') !== 'yes' || !['searches', 'hits'].includes(f.get('what'))) return send(req, res, 400, 'Bad request', 'text/plain');
  resetStats(f.get('what'));
  res.writeHead(303, { location: '/admin?tab=' + (f.get('what') === 'searches' ? 'checks' : 'traffic'), 'cache-control': 'no-store' });
  res.end();
}
// выгрузка листа ожидания (CSV; значения, начинающиеся с = + - @, экранируются от формул Excel)
function adminWaitlist(req, res) {
  if (!adminAuth(req, res)) return;
  const cell = (v) => { let x = String(v ?? ''); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"'; };
  const csv = 'email,lang,created,utm\n' + waitlistAll(100000).map((r) => [r.email, r.lang, fmtTs(r.created_at), r.utm].map(cell).join(',')).join('\n') + '\n';
  send(req, res, 200, csv, 'text/csv; charset=utf-8', { 'cache-control': 'no-store', 'content-disposition': 'attachment; filename="waitlist.csv"', ...NOINDEX });
}

const server = createServer(async (req, res) => {
  const t0 = Date.now(); let failMsg = '';
  res.on('finish', () => track(req, res, t0, ipOf(req), failMsg));
  try {
    const url = new URL(req.url, 'http://x');
    let { pathname } = url;
    if (pathname === '/healthz') return send(req, res, 200, 'ok', 'text/plain');
    // единый адрес сайта: со старого адреса Railway и с www — 301 на основной домен (для поиска и ссылок)
    if (cfg.baseUrl && (req.method === 'GET' || req.method === 'HEAD')) {
      const want = new URL(cfg.baseUrl).host, have = String(req.headers.host || '').toLowerCase();
      if (have && have !== want && (have === 'www.' + want || have.endsWith('.up.railway.app'))) { res.writeHead(301, { location: cfg.baseUrl + req.url }); return res.end(); }
    }
    if (pathname === '/robots.txt') return send(req, res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /*/checkout\nSitemap: ${origin(req)}/sitemap.xml\n`, 'text/plain; charset=utf-8', { 'cache-control': 'public, max-age=3600' });
    if (pathname === '/llms.txt') return send(req, res, 200, llmsTxt(req), 'text/plain; charset=utf-8', { 'cache-control': 'public, max-age=3600' });
    if (pathname === '/sitemap.xml') return send(req, res, 200, sitemap(req), 'application/xml; charset=utf-8', { 'cache-control': 'public, max-age=3600' });
    if (pathname === '/admin') return admin(req, res, url);
    if (pathname === '/admin/waitlist.csv') return adminWaitlist(req, res);
    if (pathname === '/admin/reset' && req.method === 'POST') return adminReset(req, res);
    if (pathname === '/admin/comment' && req.method === 'POST') return adminComment(req, res);
    if (pathname === '/watch' && req.method === 'POST') return watchPost(req, res);
    if (pathname === '/watch/confirm' || pathname === '/watch/stop') return watchLink(req, res, url, pathname === '/watch/confirm');
    if (pathname === '/comment' && req.method === 'POST') return commentPost(req, res);
    if (pathname === '/comment/report' && req.method === 'POST') return commentReport(req, res);
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
    console.error(e); failMsg = String(e?.message || e);
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
  warmRia();
  const purge = () => { store.purgeOld(); purgeHits(); cm.purgeComments(); wt.purgeWatches(); }; purge(); setInterval(purge, 24 * 3600e3).unref();
  setTimeout(() => { wt.runWatches(cfg.baseUrl).catch((e) => console.error('watches', e.message)); setInterval(() => wt.runWatches(cfg.baseUrl).catch((e) => console.error('watches', e.message)), 24 * 3600e3).unref(); }, 10 * 60e3).unref(); // раз в сутки, первый обход через 10 минут после старта
});
