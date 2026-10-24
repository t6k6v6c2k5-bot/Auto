import { LANGS, LOCALE, t, dict } from './i18n.js';
import { cfg, PLANS, price, demoPayments, demoData } from './config.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const abs = (req, p) => (cfg.baseUrl || `https://${req.headers.host}`) + p;

const logo = `<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0B1F3A"/><path d="M6 20l4-9h12l4 9v4a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H10v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" fill="none" stroke="#FFB020" stroke-width="1.8" stroke-linejoin="round"/><circle cx="11" cy="18" r="1.4" fill="#FFB020"/><circle cx="21" cy="18" r="1.4" fill="#FFB020"/></svg>`;
const ic = {
  check: '<svg viewBox="0 0 24 24" class="i"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" class="i"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};
const featIcons = ['M4 18l3-9h10l3 9M7 18v2M17 18v2', 'M4 19V9m5 10V5m5 14v-8m5 8V7', 'M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6z', 'M12 3l9 16H3zM12 10v4M12 17v.5', 'M4 7h16M4 12h16M4 17h10', 'M5 19a8 8 0 1 1 14 0M12 13l4-5'];

export function layout(req, lang, { title, desc, path, body, noindex, jsonld = [], ogImage = '/og.svg' }) {
  const alt = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(abs(req, '/' + l + path))}">`).join('');
  const ld = jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('');
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#0B1F3A">${noindex ? '<meta name="robots" content="noindex,nofollow">' : `<link rel="canonical" href="${esc(abs(req, '/' + lang + path))}">${alt}<link rel="alternate" hreflang="x-default" href="${esc(abs(req, '/uk' + path))}">`}
<meta property="og:type" content="website"><meta property="og:site_name" content="VINScope"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:locale" content="${LOCALE[lang]}"><meta property="og:image" content="${esc(abs(req, ogImage))}"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css?v=1">${ld}
${cfg.plausible ? `<script defer data-domain="${esc(cfg.plausible)}" src="https://plausible.io/js/script.js"></script>` : ''}
</head><body>
${(demoPayments() || demoData()) ? `<div class="demo">${esc(t(lang, 'demo_banner'))}</div>` : ''}
<header class="top"><div class="wrap bar">
<a class="brand" href="/${lang}/" aria-label="VINScope">${logo}<span><b>VINScope</b><small>${esc(t(lang, 'brand_tag'))}</small></span></a>
<nav><a href="/${lang}/usa">${esc(t(lang, 'nav_usa'))}</a><a href="/${lang}/pricing">${esc(t(lang, 'nav_pricing'))}</a><a href="/${lang}/sample">${esc(t(lang, 'nav_sample'))}</a></nav>
<div class="langs">${LANGS.map((l) => `<a href="/${l}${path}" class="${l === lang ? 'on' : ''}" hreflang="${l}">${l.toUpperCase()}</a>`).join('')}</div>
</div></header>
<main>${body}</main>
<footer><div class="wrap foot"><div>${logo}<b>VINScope</b><p>${esc(t(lang, 'footer'))}</p></div>
<div><a href="/${lang}/pricing">${esc(t(lang, 'nav_pricing'))}</a><a href="/${lang}/usa">${esc(t(lang, 'nav_usa'))}</a><a href="/${lang}/terms">${esc(t(lang, 'f_terms'))}</a><a href="mailto:${esc(cfg.supportEmail)}">${esc(cfg.supportEmail)}</a></div></div></footer>
<script src="/app.js?v=1" defer data-lang="${lang}"></script></body></html>`;
}

export function vinForm(lang, value = '', big = true) {
  return `<form class="vinform ${big ? 'big' : ''}" action="/${lang}/check" method="get" novalidate>
<div class="field"><input name="vin" id="vin" value="${esc(value)}" placeholder="${esc(t(lang, 'vin_ph'))}" maxlength="23" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" aria-describedby="vinhint" data-msg='${esc(JSON.stringify({ length: t(lang, 'vin_len'), chars: t(lang, 'vin_chars'), checksum: t(lang, 'vin_sum'), ok: t(lang, 'vin_ok') }))}'>
<span class="cnt" id="vincnt">0/17</span></div>
<button class="btn primary" type="submit">${esc(t(lang, 'btn_check'))}</button>
<p class="hint" id="vinhint" role="status"></p><div class="recent" id="recent"></div></form>`;
}

const faqLd = (lang) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: dict(lang).faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
const orgLd = (req) => ({ '@context': 'https://schema.org', '@type': 'Organization', name: 'VINScope', url: abs(req, '/'), logo: abs(req, '/favicon.svg') });

export function planCards(lang, vin = '') {
  const d = dict(lang);
  return `<div class="plans">${Object.entries(PLANS).map(([id, p]) => {
    const [name, qty, desc] = d.plans[id];
    const per = p.count > 1 ? `<small>${price(Math.round(p.usd / p.count))} ${esc(d.per)}</small>` : '';
    return `<article class="plan ${p.popular ? 'pop' : ''}">${p.popular ? `<span class="badge">${esc(d.popular)}</span>` : ''}
<h3>${esc(name)}</h3><div class="amt">${price(p.usd)}</div>${per}<p class="qty">${esc(qty)}</p><p>${esc(desc)}</p>
<a class="btn ${p.popular ? 'primary' : 'ghost'}" href="/${lang}/checkout?plan=${id}${vin ? '&vin=' + esc(vin) : ''}">${esc(d.choose)}</a></article>`;
  }).join('')}</div>`;
}

export function home(req, lang) {
  const d = dict(lang);
  const body = `
<section class="hero"><div class="wrap">
<h1>${esc(d.h1)}</h1><p class="lead">${esc(d.sub)}</p>
${vinForm(lang)}
<ul class="trust"><li>${ic.check}${esc(d.trust1)}</li><li>${ic.check}${esc(d.trust2)}</li><li>${ic.check}${esc(d.trust3)}</li><li>${ic.check}${esc(d.trust4)}</li></ul>
</div></section>
<section class="sec"><div class="wrap narrow"><h2>${esc(d.why_h)}</h2><p class="big-p">${esc(d.why_p)}</p></div></section>
<section class="sec alt"><div class="wrap"><h2>${esc(d.feat_h)}</h2><div class="grid3">${d.feats.map(([h, p], i) => `<article class="card"><svg viewBox="0 0 24 24" class="fi"><path d="${featIcons[i]}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('')}</div></div></section>
<section class="sec"><div class="wrap"><h2>${esc(d.how_h)}</h2><ol class="steps">${d.steps.map(([h, p]) => `<li><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ol></div></section>
<section class="sec dark"><div class="wrap"><h2>${esc(d.know_h)}</h2><div class="grid4">${d.know.map(([h, p]) => `<article class="kcard"><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('')}</div></div></section>
<section class="sec"><div class="wrap"><h2>${esc(d.price_h)}</h2><p class="center muted">${esc(d.price_sub)}</p>${planCards(lang)}</div></section>
<section class="sec alt"><div class="wrap"><h2>${esc(d.rev_h)}</h2><div class="grid3">${d.revs.map(([n, p]) => `<blockquote class="card"><p>«${esc(p)}»</p><footer>${esc(n)}</footer></blockquote>`).join('')}</div></div></section>
<section class="sec"><div class="wrap narrow"><h2>${esc(d.faq_h)}</h2>${d.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
<section class="sec cta"><div class="wrap narrow center"><h2>${esc(d.cta_h)}</h2>${vinForm(lang, '', false)}</div></section>`;
  return layout(req, lang, { title: d.home_title, desc: d.home_desc, path: '/', body, jsonld: [orgLd(req), faqLd(lang)] });
}

export function usaPage(req, lang) {
  const d = dict(lang);
  const body = `<section class="hero small"><div class="wrap"><h1>${esc(d.usa_h)}</h1><p class="lead">${esc(d.usa_p1)}</p>${vinForm(lang)}</div></section>
<section class="sec"><div class="wrap narrow"><h2>${esc(d.usa_h2)}</h2><ul class="check">${d.usa_li.map((x) => `<li>${ic.check}${esc(x)}</li>`).join('')}</ul>
<p class="center"><a class="btn primary" href="/${lang}/pricing">${esc(d.usa_cta)}</a></p></div></section>`;
  return layout(req, lang, { title: d.usa_h + ' — VINScope', desc: d.usa_p1.slice(0, 155), path: '/usa', body, jsonld: [orgLd(req)] });
}

export function pricingPage(req, lang) {
  const d = dict(lang);
  const body = `<section class="hero small"><div class="wrap"><h1>${esc(d.price_h)}</h1><p class="lead">${esc(d.price_sub)}</p></div></section>
<section class="sec"><div class="wrap">${planCards(lang)}<div class="narrow" style="margin-top:48px"><h2>${esc(d.faq_h)}</h2>${d.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div></section>`;
  return layout(req, lang, { title: d.price_h + ' — VINScope', desc: d.price_sub, path: '/pricing', body, jsonld: [orgLd(req), faqLd(lang)] });
}

export function termsPage(req, lang) {
  const d = dict(lang);
  const body = `<section class="sec"><div class="wrap narrow prose"><h1>${esc(d.terms_h)}</h1><ol>${d.terms.map((x, i) => `<li>${esc(x)}${i === 3 ? `<a href="mailto:${esc(cfg.supportEmail)}">${esc(cfg.supportEmail)}</a>` : ''}</li>`).join('')}</ol></div></section>`;
  return layout(req, lang, { title: d.terms_h + ' — VINScope', desc: d.terms[0], path: '/terms', body });
}

export function notFound(req, lang) {
  const d = dict(lang);
  return layout(req, lang, { title: d.err_title, desc: d.err_title, path: '/', noindex: true, body: `<section class="sec"><div class="wrap narrow center"><h1>404</h1><p>${esc(d.err_title)}</p><a class="btn primary" href="/${lang}/">${esc(d.err_back)}</a></div></section>` });
}

function gauge(score, level) {
  const col = level === 'high' ? 'var(--bad)' : level === 'mid' ? 'var(--warn)' : 'var(--good)';
  const C = 2 * Math.PI * 52;
  return `<svg viewBox="0 0 120 120" class="gauge" role="img" aria-label="Risk ${score}/100"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" stroke-width="11"/><circle cx="60" cy="60" r="52" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(C * score) / 100} ${C}" transform="rotate(-90 60 60)"/><text x="60" y="66" text-anchor="middle" font-size="30" font-weight="800" fill="currentColor">${score}</text></svg>`;
}

export function checkPage(req, lang, { vin, decoded, rec, risk, pre }) {
  const d = dict(lang);
  const fx = (f) => esc(t(lang, f.key, f.vars));
  const rows = decoded.found ? [
    ['Make', decoded.make], ['Model', decoded.model], ['Year', decoded.year], ['Trim', decoded.trim], ['Body', decoded.body], ['Drive', decoded.drive], ['Engine', decoded.engine],
    ['Fuel', decoded.fuel], ['Transmission', decoded.transmission], ['Plant', decoded.plant],
  ].filter((r) => r[1]) : [];
  const title = decoded.found ? `${decoded.year} ${decoded.make} ${decoded.model}` : vin;
  const body = `<section class="hero small"><div class="wrap"><p class="eyebrow">${esc(d.res_h)}</p><h1>${esc(title)}</h1><p class="vinmono">${esc(vin)}</p></div></section>
<section class="sec"><div class="wrap two">
<div>
<div class="panel"><h2>${esc(d.risk_h)}</h2><div class="riskrow">${gauge(risk.score, risk.level)}<div><span class="pill ${risk.level}">${esc(d['risk_' + risk.level])}</span><ul class="factors">${risk.factors.map((f) => `<li>${fx(f)}</li>`).join('')}</ul></div></div><p class="muted sm">${esc(d.risk_note)}</p></div>
<div class="panel"><h2>${esc(d.decode_h)}</h2>${rows.length ? `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : `<p class="muted">${esc(decoded.unavailable ? d.pdecoded_unavail : d.f_nodecode)}</p>`}</div>
<div class="panel"><h2>${esc(d.recalls_h)}</h2>${rec.items.length ? `<p><b>${esc(d.open_recalls)}${rec.items.length}</b></p><ul class="recalls">${rec.items.slice(0, 6).map((r) => `<li><b>${esc(r.component)}</b><span>${esc((r.summary || '').slice(0, 220))}…</span></li>`).join('')}</ul>` : `<p class="good">${ic.check}${esc(d.none_recalls)}</p>`}</div>
</div>
<aside><div class="panel paywall"><h2>${ic.lock}${esc(d.res_paid)}</h2>
${pre ? `<h3>${esc(d.found_h)}</h3><ul class="found"><li><b>${pre.auction}</b> ${esc(d.found_auction)}</li><li><b>${pre.odometer}</b> ${esc(d.found_odo)}</li><li><b>${pre.accidents}</b> ${esc(d.found_acc)}</li><li><b>${pre.titleBrand ? '⚠' : '✓'}</b> ${esc(d.found_brand)}</li>${pre.photos ? `<li><b>${pre.photos}</b> ${esc(d.found_photos)}</li>` : ''}</ul>` : ''}
<div class="blur" aria-hidden="true"><div></div><div></div><div></div></div>
<p class="muted sm">${esc(d.locked)}</p>
<a class="btn primary wide" href="/${lang}/checkout?plan=full&vin=${esc(vin)}">${esc(d.unlock)} — ${price(PLANS.full.usd)}</a>
<a class="btn ghost wide" href="/${lang}/checkout?plan=basic&vin=${esc(vin)}">${esc(d.plans.basic[0])} — ${price(PLANS.basic.usd)}</a>
<ul class="mini"><li>${ic.check}${esc(d.trust3)}</li><li>${ic.check}${esc(d.trust4)}</li></ul></div></aside>
</div></section>`;
  return layout(req, lang, { title: `${title} — ${d.res_h} | VINScope`, desc: `${title}: ${d.sub}`, path: '/check?vin=' + vin, body, noindex: true });
}

export function checkoutPage(req, lang, { plan, vin, error }) {
  const d = dict(lang);
  const p = PLANS[plan]; const [name, qty, desc] = d.plans[plan];
  const body = `<section class="sec"><div class="wrap narrow"><h1>${esc(d.co_h)}</h1>
<div class="panel"><h2>${esc(name)} — ${price(p.usd)}</h2><p class="muted">${esc(qty)} · ${esc(desc)}</p>
<form id="co" class="stack" data-lang="${lang}" data-plan="${plan}">
<label>${esc(d.co_vin)}<input name="vin" value="${esc(vin)}" maxlength="23" required autocapitalize="characters" spellcheck="false"></label>
<label>${esc(d.co_email)}<input name="email" type="email" required autocomplete="email" placeholder="you@example.com"></label>
<label>${esc(d.code_ph)}<input name="code" placeholder="VS-XXXXXXXX-XXXX" autocomplete="off"></label>
<p class="err" id="coerr" role="alert">${esc(error || '')}</p>
<button class="btn primary wide" type="submit">${esc(demoPayments() ? d.demo_pay : d.co_pay)} · ${price(p.usd)}</button>
<p class="muted sm">${ic.lock}${esc(d.co_secure)}</p></form></div></div></section>`;
  return layout(req, lang, { title: d.co_h + ' — VINScope', desc: d.co_h, path: '/checkout', body, noindex: true });
}

function reportBody(lang, o, r) {
  const d = dict(lang); const s = r.sections || {};
  const odo = s.odometer || [];
  const rollback = odo.some((x, i) => i && x.km < odo[i - 1].km);
  const yn = (b) => esc(b ? d.yes : d.no);
  return `
<div class="panel"><h2>${esc(d.rep_title)}</h2><dl class="kv"><dt>${esc(d.brand)}</dt><dd><span class="pill ${s.title?.brand === 'Clean' ? 'low' : 'high'}">${esc(s.title?.brand || '—')}</span></dd><dt>${esc(d.state)}</dt><dd>${esc(s.title?.state || '—')}</dd><dt>${esc(d.theft)}</dt><dd>${yn(s.title?.theftRecord)}</dd><dt>${esc(d.lien)}</dt><dd>${yn(s.title?.lien)}</dd></dl></div>
<div class="panel"><h2>${esc(d.rep_odo)}</h2><p class="${rollback ? 'bad' : 'good'}">${rollback ? '⚠ ' + esc(d.odo_warn) : ic.check + esc(d.odo_ok)}</p>
<table><thead><tr><th>${esc(d.date)}</th><th>${esc(d.src)}</th><th>${esc(d.km)}</th></tr></thead><tbody>${odo.map((x, i) => `<tr class="${i && x.km < odo[i - 1].km ? 'rb' : ''}"><td>${esc(x.date)}</td><td>${esc(x.source)}</td><td>${Number(x.km).toLocaleString('en-US')}</td></tr>`).join('')}</tbody></table></div>
<div class="panel"><h2>${esc(d.rep_auction)}</h2>${(s.auction || []).length ? s.auction.map((a) => `<dl class="kv"><dt>${esc(d.house)}</dt><dd>${esc(a.house)}</dd><dt>${esc(d.lot)}</dt><dd>#${esc(a.lot)}</dd><dt>${esc(d.date)}</dt><dd>${esc(a.date)}</dd><dt>${esc(d.dmg1)}</dt><dd>${esc(a.primaryDamage)}</dd><dt>${esc(d.dmg2)}</dt><dd>${esc(a.secondaryDamage)}</dd><dt>${esc(d.repair)}</dt><dd>$${Number(a.estRepairUsd).toLocaleString('en-US')}</dd><dt>${esc(d.bid)}</dt><dd>$${Number(a.finalBidUsd).toLocaleString('en-US')}</dd><dt>${esc(d.keys)}</dt><dd>${yn(a.keys)}</dd><dt>${esc(d.rd)}</dt><dd>${yn(a.runsDrives)}</dd><dt>${esc(d.photos_n)}</dt><dd>${esc(a.photos)}</dd></dl>`).join('') : `<p class="muted">${esc(d.none_auction)}</p>`}</div>
<div class="panel"><h2>${esc(d.rep_owners)}</h2><dl class="kv"><dt>${esc(d.owners_n)}</dt><dd>${esc(s.owners?.count ?? '—')}</dd><dt>${esc(d.usage)}</dt><dd>${esc(s.owners?.lastUse || '—')}</dd><dt>${esc(d.rep_acc)}</dt><dd>${esc(s.accidents ?? '—')}</dd><dt>${esc(d.rep_export)}</dt><dd>${s.export?.exported ? esc(d.exported + ': ' + s.export.to) : esc(d.no)}</dd></dl></div>`;
}

const PACK = {
  uk: (c, n) => `Ваш код пакета: ${c} — ще ${n} перевірок. Збережіть його: введіть на сторінці оформлення замість оплати.`,
  ru: (c, n) => `Ваш код пакета: ${c} — ещё ${n} проверок. Сохраните его: введите на странице оформления вместо оплаты.`,
  en: (c, n) => `Your pack code: ${c} — ${n} more checks. Save it and enter it at checkout instead of paying.`,
};
const packNote = (lang, order) => (order.credit_code && order.packLeft > 0 ? `<div class="notice">${esc(PACK[lang](order.credit_code, order.packLeft))}</div>` : '');

export function reportPage(req, lang, order, report, decoded) {
  const d = dict(lang);
  const title = decoded?.found ? `${decoded.year} ${decoded.make} ${decoded.model}` : order.vin;
  let inner;
  if (order.status === 'refunded') inner = `<div class="panel center"><h2>${esc(d.refunded_h)}</h2><p>${esc(d.refunded_p)}</p></div>`;
  else if (!report) inner = `<div class="panel center" data-poll="1"><h2>${esc(d.pending_h)}</h2><p>${esc(d.pending_p)}</p></div>`;
  else inner = `${packNote(lang, order)}${report.demo ? `<div class="notice">${esc(d.demo_banner)}</div>` : ''}<div class="actions noprint"><button class="btn ghost" onclick="window.print()">${esc(d.print)}</button><button class="btn ghost" id="share" data-ok="${esc(d.copied)}">${esc(d.share)}</button></div>${reportBody(lang, order, report)}`;
  const body = `<section class="hero small"><div class="wrap"><p class="eyebrow">${esc(d.rep_h)}</p><h1>${esc(title)}</h1><p class="vinmono">${esc(order.vin)}</p></div></section><section class="sec"><div class="wrap narrow">${inner}</div></section>`;
  return layout(req, lang, { title: `${title} — ${d.rep_h}`, desc: d.rep_h, path: '/report/' + order.token, body, noindex: true });
}
