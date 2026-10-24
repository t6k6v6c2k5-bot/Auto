import { LANGS, LOCALE, t, dict } from './i18n.js';
import { cfg, PLANS, price, paywallOn } from './config.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const abs = (req, p) => (cfg.baseUrl || `https://${req.headers.host}`) + p;

const logo = `<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0B1F3A"/><path d="M6 20l4-9h12l4 9v4a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H10v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" fill="none" stroke="#FFB020" stroke-width="1.8" stroke-linejoin="round"/><circle cx="11" cy="18" r="1.4" fill="#FFB020"/><circle cx="21" cy="18" r="1.4" fill="#FFB020"/></svg>`;
const ic = {
  check: '<svg viewBox="0 0 24 24" class="i"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" class="i"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  warn: '<svg viewBox="0 0 24 24" class="i"><path d="M12 3l10 18H2zM12 10v5M12 18v.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const featIcons = ['M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6zM9 12l2 2 4-4', 'M4 19V9m5 10V5m5 14v-8m5 8V7', 'M4 7h16M4 12h16M4 17h10', 'M12 3l9 16H3zM12 10v4M12 17v.5', 'M7 7h10M7 12h10M7 17h6M4 4v16h16', 'M5 19a8 8 0 1 1 14 0M12 13l4-5'];
const fmt = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

export function layout(req, lang, { title, desc, path, body, noindex, jsonld = [], ogImage = '/og.svg' }) {
  const alt = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(abs(req, '/' + l + path))}">`).join('');
  const ld = jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('');
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#0B1F3A">${noindex ? '<meta name="robots" content="noindex,nofollow">' : `<link rel="canonical" href="${esc(abs(req, '/' + lang + path))}">${alt}<link rel="alternate" hreflang="x-default" href="${esc(abs(req, '/uk' + path))}">`}
<meta property="og:type" content="website"><meta property="og:site_name" content="VINScope"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:locale" content="${LOCALE[lang]}"><meta property="og:image" content="${esc(abs(req, ogImage))}"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css?v=2">${ld}
${cfg.plausible ? `<script defer data-domain="${esc(cfg.plausible)}" src="https://plausible.io/js/script.js"></script>` : ''}
</head><body>
<header class="top"><div class="wrap bar">
<a class="brand" href="/${lang}/" aria-label="VINScope">${logo}<span><b>VINScope</b><small>${esc(t(lang, 'brand_tag'))}</small></span></a>
<nav><a href="/${lang}/usa">${esc(t(lang, 'nav_usa'))}</a><a href="/${lang}/sources">${esc(t(lang, 'nav_sources'))}</a><a href="/${lang}/pricing">${esc(t(lang, 'nav_pricing'))}</a></nav>
<div class="langs">${LANGS.map((l) => `<a href="/${l}${path}" class="${l === lang ? 'on' : ''}" hreflang="${l}">${l.toUpperCase()}</a>`).join('')}</div>
</div></header>
<main>${body}</main>
<footer><div class="wrap foot"><div>${logo}<b>VINScope</b><p>${esc(t(lang, 'footer'))}</p></div>
<div><a href="/${lang}/sources">${esc(t(lang, 'nav_sources'))}</a><a href="/${lang}/usa">${esc(t(lang, 'nav_usa'))}</a><a href="/${lang}/terms">${esc(t(lang, 'f_terms'))}</a><a href="mailto:${esc(cfg.supportEmail)}">${esc(cfg.supportEmail)}</a></div></div></footer>
<script src="/app.js?v=2" defer data-lang="${lang}"></script></body></html>`;
}

export function searchForm(lang, value = '', big = true) {
  return `<form class="vinform ${big ? 'big' : ''}" action="/${lang}/check" method="get" novalidate>
<div class="field"><input name="q" id="vin" value="${esc(value)}" placeholder="${esc(t(lang, 'q_ph'))}" maxlength="23" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="vinhint" data-msg='${esc(JSON.stringify({ bad: t(lang, 'vin_len'), chars: t(lang, 'vin_chars'), checksum: t(lang, 'vin_sum'), ok: t(lang, 'vin_ok'), plate: t(lang, 'plate_ok') }))}'>
<span class="cnt" id="vincnt">0/17</span></div>
<button class="btn primary" type="submit">${esc(t(lang, 'btn_check'))}</button>
<p class="hint" id="vinhint" role="status"></p><div class="recent" id="recent"></div></form>`;
}

const faqLd = (lang) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: dict(lang).faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
const orgLd = (req) => ({ '@context': 'https://schema.org', '@type': 'Organization', name: 'VINScope', url: abs(req, '/'), logo: abs(req, '/favicon.svg') });

export function waitlistBox(lang) {
  const d = dict(lang);
  return `<div class="panel soon"><h2>${esc(d.soon_h)}</h2><p class="muted center">${esc(d.soon_p)}</p>
<form class="notify" data-lang="${lang}" data-ok="${esc(d.soon_ok)}"><input type="email" name="email" required placeholder="${esc(d.soon_ph)}" autocomplete="email" aria-label="${esc(d.soon_ph)}"><button class="btn primary" type="submit">${esc(d.soon_btn)}</button></form><p class="err notify-msg" role="status"></p></div>`;
}

export function planCards(lang, vin = '') {
  const d = dict(lang);
  return `<div class="plans three">${Object.entries(PLANS).map(([id, p]) => {
    const [name, desc] = d.plans[id];
    const per = p.count > 1 ? `<small>${price(Math.round(p.usd / p.count))} ${esc(d.per)}</small>` : '';
    return `<article class="plan ${p.popular ? 'pop' : ''}">${p.popular ? `<span class="badge">${esc(d.popular)}</span>` : ''}
<h3>${esc(name)}</h3><div class="amt">${price(p.usd)}</div>${per}<p>${esc(desc)}</p>
<a class="btn ${p.popular ? 'primary' : 'ghost'}" href="/${lang}/checkout?plan=${id}${vin ? '&vin=' + esc(vin) : ''}">${esc(d.choose)}</a></article>`;
  }).join('')}</div>`;
}

const launchBox = (lang) => `<div class="panel launch"><h2>${esc(t(lang, 'launch_h'))}</h2><p class="center">${esc(t(lang, 'launch_p'))}</p></div>`;
const sourcesList = (lang) => `<ul class="srclist">${dict(lang).srcs.map(([n, m, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer"><b>${esc(n)}</b></a><span>${esc(m)}</span></li>`).join('')}</ul>`;

export function home(req, lang, stats) {
  const d = dict(lang);
  const body = `
<section class="hero"><div class="wrap">
<h1>${esc(d.h1)}</h1><p class="lead">${esc(d.sub)}</p>
${searchForm(lang)}
<ul class="trust"><li>${ic.check}${esc(d.trust1)}${stats.wantedCount ? ` (${stats.wantedCount.toLocaleString('uk-UA')})` : ''}</li><li>${ic.check}${esc(d.trust2)}</li><li>${ic.check}${esc(d.trust3)}</li><li>${ic.check}${esc(d.trust4)}</li></ul>
</div></section>
<section class="sec alt"><div class="wrap"><h2>${esc(d.feat_h)}</h2><div class="grid3">${d.feats.map(([h, p], i) => `<article class="card"><svg viewBox="0 0 24 24" class="fi"><path d="${featIcons[i]}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('')}</div></div></section>
<section class="sec"><div class="wrap"><h2>${esc(d.how_h)}</h2><ol class="steps">${d.steps.map(([h, p]) => `<li><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ol></div></section>
<section class="sec dark"><div class="wrap"><h2>${esc(d.know_h)}</h2><div class="grid4">${d.know.map(([h, p]) => `<article class="kcard"><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('')}</div></div></section>
<section class="sec"><div class="wrap narrow">${waitlistBox(lang)}</div></section>
<section class="sec alt"><div class="wrap narrow"><h2>${esc(d.src_h)}</h2><p class="center muted">${esc(d.src_p)}</p>${sourcesList(lang)}</div></section>
<section class="sec"><div class="wrap narrow"><h2>${esc(d.faq_h)}</h2>${d.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
<section class="sec cta"><div class="wrap narrow center"><h2>${esc(d.cta_h)}</h2>${searchForm(lang, '', false)}</div></section>`;
  return layout(req, lang, { title: d.home_title, desc: d.home_desc, path: '/', body, jsonld: [orgLd(req), faqLd(lang)] });
}

export function sourcesPage(req, lang) {
  const d = dict(lang);
  const body = `<section class="hero small"><div class="wrap"><h1>${esc(d.src_h)}</h1><p class="lead">${esc(d.src_p)}</p></div></section><section class="sec"><div class="wrap narrow">${sourcesList(lang)}${waitlistBox(lang)}</div></section>`;
  return layout(req, lang, { title: d.src_h + ' — VINScope', desc: d.src_p, path: '/sources', body });
}

export function usaPage(req, lang) {
  const d = dict(lang);
  const body = `<section class="hero small"><div class="wrap"><h1>${esc(d.usa_page_h)}</h1><p class="lead">${esc(d.usa_p1)}</p>${searchForm(lang)}</div></section>
<section class="sec"><div class="wrap narrow"><h2>${esc(d.usa_h2)}</h2><ul class="check">${d.usa_li.map((x) => `<li>${ic.check}${esc(x)}</li>`).join('')}</ul>${waitlistBox(lang)}</div></section>`;
  return layout(req, lang, { title: d.usa_page_h + ' — VINScope', desc: d.usa_p1.slice(0, 155), path: '/usa', body, jsonld: [orgLd(req)] });
}

export function pricingPage(req, lang) {
  const d = dict(lang);
  const body = `<section class="hero small"><div class="wrap"><h1>${esc(d.price_h)}</h1><p class="lead">${esc(paywallOn() ? d.price_sub : d.launch_p)}</p></div></section>
<section class="sec"><div class="wrap">${paywallOn() ? planCards(lang) : launchBox(lang) + `<p class="center"><a class="btn primary" href="/${lang}/">${esc(d.btn_check)}</a></p>`}<div class="narrow" style="margin-top:48px"><h2>${esc(d.faq_h)}</h2>${d.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div></section>`;
  return layout(req, lang, { title: d.price_h + ' — VINScope', desc: d.launch_p, path: '/pricing', body, jsonld: [orgLd(req), faqLd(lang)] });
}

export function termsPage(req, lang) {
  const d = dict(lang);
  const body = `<section class="sec"><div class="wrap narrow prose"><h1>${esc(d.terms_h)}</h1><ol>${d.terms.map((x, i) => `<li>${esc(x)}${i === 4 ? `<a href="mailto:${esc(cfg.supportEmail)}">${esc(cfg.supportEmail)}</a>` : ''}</li>`).join('')}</ol></div></section>`;
  return layout(req, lang, { title: d.terms_h + ' — VINScope', desc: d.terms[0], path: '/terms', body });
}

export function notFound(req, lang) {
  const d = dict(lang);
  return layout(req, lang, { title: d.err_title, desc: d.err_title, path: '/', noindex: true, body: `<section class="sec"><div class="wrap narrow center"><h1>404</h1><p>${esc(d.err_title)}</p><a class="btn primary" href="/${lang}/">${esc(d.err_back)}</a></div></section>` });
}

// ---------- блоки отчёта ----------
function gauge(score, level) {
  const col = level === 'high' ? 'var(--bad)' : level === 'mid' ? 'var(--warn)' : 'var(--good)';
  const C = 2 * Math.PI * 52;
  return `<svg viewBox="0 0 120 120" class="gauge" role="img" aria-label="Risk ${score}/100"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" stroke-width="11"/><circle cx="60" cy="60" r="52" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(C * score) / 100} ${C}" transform="rotate(-90 60 60)"/><text x="60" y="66" text-anchor="middle" font-size="30" font-weight="800" fill="currentColor">${score}</text></svg>`;
}
const dateRu = (iso) => (iso ? iso.slice(0, 10) : '—');

function riskBlock(lang, r) {
  const d = dict(lang);
  return `<div class="panel"><h2>${esc(d.risk_h)}</h2><div class="riskrow">${gauge(r.risk.score, r.risk.level)}<div><span class="pill ${r.risk.level}">${esc(d['risk_' + r.risk.level])}</span><ul class="factors">${r.risk.factors.map((f) => `<li>${esc(t(lang, f.key, f.vars))}</li>`).join('')}</ul></div></div><p class="muted sm">${esc(d.risk_note)}</p></div>`;
}

function wantedBlock(lang, r) {
  const d = dict(lang);
  if (r.wanted.length) {
    return `<div class="panel alert"><h2>${ic.warn}${esc(d.wanted_hit)}</h2><p>${esc(d.wanted_hit_p)}</p>${r.wanted.slice(0, 3).map((w) => `<dl class="kv"><dt>${esc(d.w_vin)}</dt><dd>${esc(w.vin || w.chassis)}</dd><dt>${esc(d.w_plate)}</dt><dd>${esc(w.plate || '—')}</dd><dt>${esc(d.w_model)}</dt><dd>${esc(w.brand)} ${esc(w.model)}</dd><dt>${esc(d.w_color)}</dt><dd>${esc(w.color)}</dd><dt>${esc(d.w_seized)}</dt><dd>${esc(dateRu(w.seized))}</dd><dt>${esc(d.w_added)}</dt><dd>${esc(dateRu(w.added))}</dd><dt>${esc(d.w_unit)}</dt><dd>${esc(w.unit)}</dd></dl>`).join('')}</div>`;
  }
  const c = r.coverage;
  return `<div class="panel"><h2>${esc(d.wanted_h)}</h2>${c.wantedCount ? `<p class="good">${ic.check}${esc(d.wanted_none)}</p><p class="muted sm">${esc(fmt(d.wanted_asof, { n: c.wantedCount.toLocaleString('uk-UA'), date: dateRu(c.wantedUpdatedAt) }))}</p>` : `<p class="muted">${esc(d.wanted_unavail)}</p>`}</div>`;
}

function uaSummary(lang, ua) {
  const d = dict(lang); const s = ua.summary;
  const item = (k, v) => `<div><span>${esc(k)}</span><b>${v}</b></div>`;
  return `<div class="stats">${item(d.ua_records, s.records)}${item(d.ua_first, esc(s.first))}${item(d.ua_last, esc(s.last))}${item(d.ua_owners, s.owners)}${s.imported ? item(d.ua_imported, esc(s.imported.date)) : ''}${s.plates.length ? item(d.ua_plates, esc(s.plates.slice(-3).join(', '))) : ''}${s.deregistered ? item(d.ua_dereg, esc(s.deregistered.date)) : ''}</div>`;
}

function uaBlock(lang, r, full) {
  const d = dict(lang); const ua = r.ua; const cov = r.coverage.registry;
  const covTxt = cov.from ? fmt(d.ua_cov, { from: cov.from, to: cov.to }) : '';
  if (!ua.rows.length) {
    return `<div class="panel"><h2>${esc(d.ua_h)}</h2>${cov.ready ? `<p>${esc(d.ua_none)}</p><p class="muted sm">${esc(fmt(d.ua_none_p, { from: cov.from, to: cov.to }))}</p>` : `<p class="muted">${esc(d.ua_notready)}</p>`}${cov.indexing && cov.ready ? `<p class="muted sm">${esc(d.ua_indexing)}</p>` : ''}</div>`;
  }
  let tl = '';
  if (full) {
    const keyRows = ua.rows.filter((x) => ['import', 'first', 'owner', 'export', 'scrap', 'dereg'].includes(x.opkind));
    const other = ua.rows.filter((x) => !keyRows.includes(x));
    const row = (x) => `<tr class="k-${x.opkind}"><td>${esc(x.date)}</td><td><span class="kb">${esc(d['k_' + x.opkind] || x.opkind)}</span> ${esc(x.opname || x.oper)}</td><td>${esc((x.dep || '').replace(/^\d+ - /, ''))}</td><td>${esc(x.plate || '')}</td></tr>`;
    const head = `<thead><tr><th>${esc(d.tl_date)}</th><th>${esc(d.tl_op)}</th><th>${esc(d.tl_dep)}</th><th>${esc(d.tl_plate)}</th></tr></thead>`;
    tl = `<div class="tablewrap"><table class="tl">${head}<tbody>${keyRows.map(row).join('')}</tbody></table></div>${other.length ? `<details><summary>${esc(fmt(d.tl_others, { n: other.length }))}</summary><div class="tablewrap"><table class="tl">${head}<tbody>${other.map(row).join('')}</tbody></table></div></details>` : ''}`;
  }
  const v = ua.summary.vehicle;
  return `<div class="panel"><h2>${esc(d.ua_h)}</h2>${[v.brand, v.model, v.year, v.color, v.fuel, v.cap ? v.cap + ' cm³' : ''].filter(Boolean).length ? `<p class="vehline">${esc([v.brand, v.model, v.year, v.color, v.fuel, v.cap ? v.cap + ' cm³' : ''].filter(Boolean).join(' · '))}</p>` : ''}${uaSummary(lang, ua)}${tl}<p class="muted sm">${esc(covTxt)}${cov.indexing ? ' · ' + esc(d.ua_indexing) : ''}</p></div>`;
}

function decodeBlock(lang, r) {
  const d = dict(lang); const x = r.decoded;
  const rows = x.found ? [['Make', x.make], ['Model', x.model], ['Year', x.year], ['Trim', x.trim], ['Body', x.body], ['Drive', x.drive], ['Engine', x.engine], ['Fuel', x.fuel], ['Transmission', x.transmission], ['Plant', x.plant]].filter((q) => q[1]) : [];
  const mm = r.mismatch.length ? `<div class="notice bad">${ic.warn}<div><b>${esc(d.mm_h)}</b>${r.mismatch.map((m) => `<div>${esc(fmt(d['mm_' + m.field], { vin: m.vin, registry: m.registry }))}</div>`).join('')}</div></div>` : '';
  return `<div class="panel"><h2>${esc(d.decode_h)}</h2>${mm}${rows.length ? `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : `<p class="muted">${esc(x.unavailable ? d.decode_unavail : d.decode_none)}</p>`}</div>`;
}

const stars = (v, d) => (/^\d$/.test(String(v)) ? `<b>${'★'.repeat(+v)}${'☆'.repeat(5 - +v)}</b> <span class="muted sm">${v} ${esc(d.stars)}</span>` : `<span class="muted">${esc(d.nr)}</span>`);
function safetyBlock(lang, r, full) {
  const d = dict(lang); const rec = r.recalls, c = r.complaints, rt = r.ratings;
  const recHtml = rec.items.length ? `<p><b>${esc(d.open_recalls)}${rec.items.length}</b></p><ul class="recalls">${rec.items.slice(0, full ? 25 : 4).map((x) => `<li><b>${esc(x.component)}</b><span>${esc((x.summary || '').slice(0, full ? 400 : 200))}…</span></li>`).join('')}</ul>` : `<p class="good">${ic.check}${esc(d.none_recalls)}</p>`;
  const compHtml = c.count ? `<p><b>${esc(fmt(d.comp_n, { n: c.count }))}</b></p><p class="muted sm">${esc(fmt(d.comp_stats, { c: c.crashes, f: c.fires, i: c.injuries, d: c.deaths }))}</p><p class="sm">${esc(d.comp_top)}: ${c.top.map((x) => `${esc(x.component)} (${x.n})`).join(', ')}</p>` : `<p class="muted">${esc(d.none_comp)}</p>`;
  const rateHtml = rt ? `<dl class="kv"><dt>${esc(d.rate_overall)}</dt><dd>${stars(rt.overall, d)}</dd><dt>${esc(d.rate_front)}</dt><dd>${stars(rt.front, d)}</dd><dt>${esc(d.rate_side)}</dt><dd>${stars(rt.side, d)}</dd><dt>${esc(d.rate_roll)}</dt><dd>${stars(rt.rollover, d)}</dd></dl><p class="muted sm">${esc(rt.description)}</p>` : '';
  return `<div class="panel"><h2>${esc(d.safety_h)}</h2><h3>${esc(d.recalls_h)}</h3>${recHtml}<h3>${esc(d.comp_h)}</h3>${compHtml}${rateHtml ? `<h3>${esc(d.rate_h)}</h3>${rateHtml}` : ''}</div>`;
}

function usaBlock(lang, r) {
  const d = dict(lang); const s = r.usa?.found ? r.usa.sections : null;
  if (!s) return `<div class="panel"><h2>${esc(d.usa_h)}</h2><p class="muted">${esc(d.usa_soon)}</p></div>`;
  return `<div class="panel"><h2>${esc(d.usa_h)}</h2><pre class="raw">${esc(JSON.stringify(s, null, 2))}</pre></div>`;
}

export function checkPage(req, lang, r) {
  const d = dict(lang);
  const x = r.decoded; const v = r.ua.summary?.vehicle;
  const title = x.found ? `${x.year} ${x.make} ${x.model}` : v?.brand ? `${v.brand} ${v.model || ''} ${v.year || ''}`.trim() : r.vin;
  const cta = paywallOn() ? `${esc(d.unlock)} — ${price(PLANS.single.usd)}` : esc(d.unlock_free);
  const body = `<section class="hero small"><div class="wrap"><p class="eyebrow">${esc(d.res_h)}</p><h1>${esc(title)}</h1>${title !== r.vin ? `<p class="vinmono">${esc(r.vin)}</p>` : ''}</div></section>
<section class="sec"><div class="wrap two"><div>${wantedBlock(lang, r)}${riskBlock(lang, r)}${uaBlock(lang, r, false)}${decodeBlock(lang, r)}${safetyBlock(lang, r, false)}</div>
<aside><div class="panel paywall"><h2>${paywallOn() ? ic.lock : ''}${esc(d.paid_h)}</h2><ul class="mini"><li>${ic.check}${esc(d.ua_locked)}</li><li>${ic.check}${esc(d.go_pdf)}</li><li>${ic.check}${esc(d.wanted_h)} · NHTSA</li></ul>
<a class="btn primary wide" href="/${lang}/checkout?plan=single&vin=${esc(r.vin)}">${cta}</a>${paywallOn() ? '' : `<p class="muted sm center">${esc(d.co_free_p)}</p>`}</div>${waitlistBox(lang)}</aside></div></section>`;
  return layout(req, lang, { title: `${title} — ${d.res_h} | VINScope`, desc: `${title}: ${d.sub}`, path: '/check?q=' + r.vin, body, noindex: true });
}

export function plateNotFound(req, lang, plate, cov, wanted) {
  const d = dict(lang);
  const w = wanted.length ? `<div class="panel alert"><h2>${ic.warn}${esc(d.wanted_hit)}</h2><p>${esc(d.wanted_hit_p)}</p>${wanted.slice(0, 3).map((q) => `<dl class="kv"><dt>${esc(d.w_plate)}</dt><dd>${esc(q.plate)}</dd><dt>${esc(d.w_vin)}</dt><dd>${esc(q.vin || q.chassis)}</dd><dt>${esc(d.w_model)}</dt><dd>${esc(q.brand)} ${esc(q.model)}</dd><dt>${esc(d.w_seized)}</dt><dd>${esc(dateRu(q.seized))}</dd><dt>${esc(d.w_unit)}</dt><dd>${esc(q.unit)}</dd></dl>`).join('')}</div>` : '';
  const body = `<section class="hero small"><div class="wrap"><p class="eyebrow">${esc(d.res_h)}</p><h1>${esc(plate)}</h1></div></section><section class="sec"><div class="wrap narrow">${w}
<div class="panel"><h2>${esc(d.not_found_plate)}</h2><p>${esc(fmt(d.not_found_plate_p, { from: cov.from || '—', to: cov.to || '—' }))}</p></div>${searchForm(lang, '', false)}</div></section>`;
  return layout(req, lang, { title: `${plate} — ${d.res_h}`, desc: d.not_found_plate, path: '/check', body, noindex: true });
}

export function checkoutPage(req, lang, { plan, vin }) {
  const d = dict(lang);
  const p = PLANS[plan]; const [name, desc] = d.plans[plan];
  const on = paywallOn();
  const body = `<section class="sec"><div class="wrap narrow"><h1>${esc(d.co_h)}</h1>
<div class="panel"><h2>${esc(on ? `${name} — ${price(p.usd)}` : d.free_now)}</h2><p class="muted">${esc(on ? desc : d.co_free_p)}</p>
<form id="co" class="stack" data-lang="${lang}" data-plan="${plan}">
<label>${esc(d.co_vin)}<input name="vin" value="${esc(vin)}" maxlength="23" required autocapitalize="characters" spellcheck="false"></label>
<label>${esc(on ? d.co_email : d.co_email_opt)}<input name="email" type="email" ${on ? 'required' : ''} autocomplete="email" placeholder="you@example.com"></label>
${on ? `<label>${esc(d.code_ph)}<input name="code" placeholder="VS-XXXXXXXX-XXXX" autocomplete="off"></label>` : ''}
<p class="err" id="coerr" role="alert"></p>
<button class="btn primary wide" type="submit">${esc(on ? `${d.co_pay} · ${price(p.usd)}` : d.co_free)}</button>
${on ? `<p class="muted sm">${ic.lock}${esc(d.co_secure)}</p>` : ''}</form></div></div></section>`;
  return layout(req, lang, { title: d.co_h + ' — VINScope', desc: d.co_h, path: '/checkout', body, noindex: true });
}

const PACK = {
  uk: (c, n) => `Ваш код пакета: ${c} — ще ${n} перевірок. Збережіть його: введіть на сторінці оформлення замість оплати.`,
  ru: (c, n) => `Ваш код пакета: ${c} — ещё ${n} проверок. Сохраните его: введите на странице оформления вместо оплаты.`,
  en: (c, n) => `Your pack code: ${c} — ${n} more checks. Save it and enter it at checkout instead of paying.`,
};
const packNote = (lang, order) => (order.credit_code && order.packLeft > 0 ? `<div class="notice">${esc(PACK[lang](order.credit_code, order.packLeft))}</div>` : '');

export function reportPage(req, lang, order, r) {
  const d = dict(lang);
  const x = r?.decoded; const v = r?.ua?.summary?.vehicle;
  const title = x?.found ? `${x.year} ${x.make} ${x.model}` : v?.brand ? `${v.brand} ${v.model || ''} ${v.year || ''}`.trim() : order.vin;
  let inner;
  if (order.status === 'refunded') inner = `<div class="panel center"><h2>${esc(d.refunded_h)}</h2><p>${esc(d.refunded_p)}</p></div>`;
  else if (!r) inner = `<div class="panel center" data-poll="1"><h2>${esc(d.pending_h)}</h2><p>${esc(d.pending_p)}</p></div>`;
  else inner = `${packNote(lang, order)}<div class="actions noprint"><button class="btn ghost" onclick="window.print()">${esc(d.print)}</button><button class="btn ghost" id="share" data-ok="${esc(d.copied)}">${esc(d.share)}</button></div>
<p class="muted sm">${esc(d.asof)} ${esc(r.generatedAt.slice(0, 16).replace('T', ' '))} UTC</p>${wantedBlock(lang, r)}${riskBlock(lang, r)}${uaBlock(lang, r, true)}${decodeBlock(lang, r)}${safetyBlock(lang, r, true)}${usaBlock(lang, r)}<p class="muted sm">${esc(d.sources_note)}</p>`;
  const body = `<section class="hero small"><div class="wrap"><p class="eyebrow">${esc(d.rep_h)}</p><h1>${esc(title)}</h1><p class="vinmono">${esc(order.vin)}</p></div></section><section class="sec"><div class="wrap narrow">${inner}</div></section>`;
  return layout(req, lang, { title: `${title} — ${d.rep_h}`, desc: d.rep_h, path: '/report/' + order.token, body, noindex: true });
}
