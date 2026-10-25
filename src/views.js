import { LANGS, LOCALE, t, dict, plural } from './i18n.js';
import { cfg, PLANS, price, paywallOn } from './config.js';
import { origin } from './http.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const abs = (req, p) => origin(req) + p;
const fmt = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const LANG_NAMES = { uk: 'Українська', ru: 'Русский', en: 'English' };
const en = (lang, txt) => (lang === 'en' ? esc(txt) : `<span lang="en">${esc(txt)}</span>`); // англоязычный фрагмент внутри uk/ru-страницы
const cut = (str, n = 160) => { const x = String(str); if (x.length <= n) return x; const y = x.slice(0, n - 1); return y.slice(0, y.lastIndexOf(' ')).replace(/[,;:—-]+$/, '') + '…'; };
const nice = (str) => String(str || '').toLowerCase().split(/(\s+|-)/).map((w) => (/^\s+$|^-$/.test(w) || !w ? w : /\d/.test(w) || (w.length <= 3 && /^\p{L}+$/u.test(w)) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join('');
const tel = (txt) => esc(txt).replace(/\b102\b/g, '<a href="tel:102">102</a>');
// значения реестра МВС приходят украинскими заглавными: показываем на языке страницы
const REG = {
  ru: { 'БІЛИЙ': 'Белый', 'ЧОРНИЙ': 'Чёрный', 'СІРИЙ': 'Серый', 'СРІБЛЯСТИЙ': 'Серебристый', 'СИНІЙ': 'Синий', 'ЧЕРВОНИЙ': 'Красный', 'ЗЕЛЕНИЙ': 'Зелёный', 'ЖОВТИЙ': 'Жёлтый', 'КОРИЧНЕВИЙ': 'Коричневый', 'ЗОЛОТИСТИЙ': 'Золотистый', 'БЕЖЕВИЙ': 'Бежевый', 'ПОМАРАНЧЕВИЙ': 'Оранжевый', 'ФІОЛЕТОВИЙ': 'Фиолетовый', 'РОЖЕВИЙ': 'Розовый', 'ВИШНЕВИЙ': 'Вишнёвый', 'БОРДОВИЙ': 'Бордовый', 'ГОЛУБИЙ': 'Голубой', 'БІРЮЗОВИЙ': 'Бирюзовый', 'НЕВИЗНАЧЕНИЙ': 'Не определён',
    'БЕНЗИН': 'Бензин', 'ДИЗЕЛЬНЕ ПАЛИВО': 'Дизель', 'ЕЛЕКТРО': 'Электро', 'ЕЛЕКТРО АБО БЕНЗИН': 'Гибрид (электро/бензин)', 'ЕЛЕКТРО АБО ДИЗЕЛЬНЕ ПАЛИВО': 'Гибрид (электро/дизель)', 'БЕНЗИН АБО ГАЗ': 'Бензин/газ', 'ГАЗ': 'Газ', 'ГАЗ АБО БЕНЗИН': 'Газ/бензин',
    'СЕДАН': 'Седан', 'ХЕТЧБЕК': 'Хетчбэк', 'УНІВЕРСАЛ': 'Универсал', 'ПОЗАШЛЯХОВИК': 'Внедорожник', 'КУПЕ': 'Купе', 'КАБРІОЛЕТ': 'Кабриолет', 'МІНІВЕН': 'Минивэн', 'ПІКАП': 'Пикап', 'ЛІФТБЕК': 'Лифтбэк', 'ФУРГОН': 'Фургон' },
  en: { 'БІЛИЙ': 'White', 'ЧОРНИЙ': 'Black', 'СІРИЙ': 'Grey', 'СРІБЛЯСТИЙ': 'Silver', 'СИНІЙ': 'Blue', 'ЧЕРВОНИЙ': 'Red', 'ЗЕЛЕНИЙ': 'Green', 'ЖОВТИЙ': 'Yellow', 'КОРИЧНЕВИЙ': 'Brown', 'ЗОЛОТИСТИЙ': 'Gold', 'БЕЖЕВИЙ': 'Beige', 'ПОМАРАНЧЕВИЙ': 'Orange', 'ФІОЛЕТОВИЙ': 'Purple', 'РОЖЕВИЙ': 'Pink', 'ВИШНЕВИЙ': 'Cherry', 'БОРДОВИЙ': 'Burgundy', 'ГОЛУБИЙ': 'Light blue', 'БІРЮЗОВИЙ': 'Turquoise', 'НЕВИЗНАЧЕНИЙ': 'Undetermined',
    'БЕНЗИН': 'Petrol', 'ДИЗЕЛЬНЕ ПАЛИВО': 'Diesel', 'ЕЛЕКТРО': 'Electric', 'ЕЛЕКТРО АБО БЕНЗИН': 'Hybrid (electric/petrol)', 'ЕЛЕКТРО АБО ДИЗЕЛЬНЕ ПАЛИВО': 'Hybrid (electric/diesel)', 'БЕНЗИН АБО ГАЗ': 'Petrol/LPG', 'ГАЗ': 'LPG', 'ГАЗ АБО БЕНЗИН': 'LPG/petrol',
    'СЕДАН': 'Sedan', 'ХЕТЧБЕК': 'Hatchback', 'УНІВЕРСАЛ': 'Estate', 'ПОЗАШЛЯХОВИК': 'SUV', 'КУПЕ': 'Coupe', 'КАБРІОЛЕТ': 'Convertible', 'МІНІВЕН': 'Minivan', 'ПІКАП': 'Pickup', 'ЛІФТБЕК': 'Liftback', 'ФУРГОН': 'Van' },
};
const rv = (lang, v) => { const k = String(v || '').trim().toUpperCase(); return REG[lang]?.[k] || REG[lang]?.[k.split('-')[0]] || (nice(k).charAt(0) + nice(k).slice(1)); };
const engineText = (lang, e) => String(e || '').replace(/(\d+(?:\.\d+)?)L\b/, lang === 'en' ? '$1 L' : '$1 л').replace(/ cyl\b/, lang === 'en' ? ' cyl' : ' цил.').replace(/ hp\b/, lang === 'en' ? ' hp' : ' к.с.');
const dateOf = (iso) => (iso ? String(iso).slice(0, 10) : '—');

// ---------- иконки (декоративные: aria-hidden) ----------
const A = 'aria-hidden="true" focusable="false"';
const logo = `<svg width="30" height="30" viewBox="0 0 32 32" ${A}><rect width="32" height="32" rx="8" fill="#0B1F3A"/><path d="M6 20l4-9h12l4 9v4a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H10v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" fill="none" stroke="#FFB020" stroke-width="1.8" stroke-linejoin="round"/><circle cx="11" cy="18" r="1.4" fill="#FFB020"/><circle cx="21" cy="18" r="1.4" fill="#FFB020"/></svg>`;
const ic = {
  check: `<svg viewBox="0 0 24 24" class="i" ${A}><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" class="i" ${A}><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" class="i" ${A}><path d="M12 3l10 18H2zM12 10v5M12 18v.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
const carSvg = (cls = 'carsvg') => `<svg class="${cls}" viewBox="0 0 560 250" ${A}><defs><linearGradient id="cb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b8cff"/><stop offset="1" stop-color="#1c3f9e"/></linearGradient><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe0ff" stop-opacity=".95"/><stop offset="1" stop-color="#7fa3ee" stop-opacity=".85"/></linearGradient></defs><ellipse cx="280" cy="226" rx="230" ry="14" fill="#000" opacity=".28"/><path d="M36 170c0-20 18-30 52-36l62-8c22-30 52-48 98-50h98c42 2 70 24 92 52l46 8c22 4 36 18 36 40v18c0 8-6 14-14 14H48c-8 0-12-6-12-14z" fill="url(#cb)"/><path d="M166 128c22-26 46-38 90-40h54v40zm164-40h20c32 2 56 18 74 40H330z" fill="url(#cg)"/><path d="M36 176h488v14H36z" fill="#0f2a6b" opacity=".35"/><rect x="482" y="150" width="34" height="10" rx="5" fill="#ffe9a8"/><rect x="40" y="152" width="22" height="9" rx="4.5" fill="#ff5d4d"/><g><circle cx="140" cy="198" r="36" fill="#0b1220"/><circle cx="140" cy="198" r="20" fill="#d9e3f7"/><circle cx="140" cy="198" r="7" fill="#0b1220"/><circle cx="432" cy="198" r="36" fill="#0b1220"/><circle cx="432" cy="198" r="20" fill="#d9e3f7"/><circle cx="432" cy="198" r="7" fill="#0b1220"/></g></svg>`;
// нейтральный силуэт для случаев, когда фото модели нет или оно не подходит по году
const silhouette = `<svg viewBox="0 0 560 250" class="sil" ${A}><path d="M36 170c0-20 18-30 52-36l62-8c22-30 52-48 98-50h98c42 2 70 24 92 52l46 8c22 4 36 18 36 40v18c0 8-6 14-14 14H48c-8 0-12-6-12-14z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M166 128c22-26 46-38 90-40h54v40zm164-40h20c32 2 56 18 74 40H330z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><circle cx="140" cy="198" r="34" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="432" cy="198" r="34" fill="none" stroke="currentColor" stroke-width="5"/></svg>`;
const featIcons = ['M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6zM9 12l2 2 4-4', 'M4 19V9m5 10V5m5 14v-8m5 8V7', 'M4 7h16M4 12h16M4 17h10', 'M12 3l9 16H3zM12 10v4M12 17v.5', 'M7 7h10M7 12h10M7 17h6M4 4v16h16', 'M5 19a8 8 0 1 1 14 0M12 13l4-5'];
const plateEl = (p, sm = false) => `<span class="plate${sm ? ' sm' : ''}"><i ${A}>UA</i><span>${esc(p)}</span></span>`;

// ---------- каркас страницы ----------
export function layout(req, lang, { title, desc, path, body, noindex, jsonld = [], sticky = '', preconnect = '' }) {
  const alt = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(abs(req, '/' + l + path))}">`).join('');
  const ld = jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('');
  const links = [['/usa', 'nav_usa'], ['/sources', 'nav_sources'], ['/pricing', 'nav_pricing']];
  const cur = (p) => (path === p ? ' aria-current="page"' : '');
  const og = abs(req, `/og-${lang}.png`);
  const url = abs(req, '/' + lang + path);
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#0a1628">${noindex ? '<meta name="robots" content="noindex,nofollow">' : `<link rel="canonical" href="${esc(url)}">${alt}<link rel="alternate" hreflang="x-default" href="${esc(abs(req, '/uk' + path))}">`}
<meta property="og:type" content="website"><meta property="og:site_name" content="VINScope"><meta property="og:url" content="${esc(url)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:locale" content="${LOCALE[lang]}">${LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${LOCALE[l]}">`).join('')}
<meta property="og:image" content="${esc(og)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="VINScope — ${esc(t(lang, 'brand_tag'))}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(og)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/logo-512.png">
<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/inter-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css?v=4">${preconnect ? `<link rel="preconnect" href="${esc(preconnect)}">` : ''}${ld}
${cfg.plausible && !noindex ? `<script defer data-domain="${esc(cfg.plausible)}" src="https://plausible.io/js/script.js"></script>` : ''}
</head><body>
<a class="skip" href="#main">${esc(t(lang, 'skip'))}</a>
<header class="top"><div class="wrap bar">
<a class="brand" href="/${lang}/" aria-label="VINScope — ${esc(t(lang, 'brand_tag'))}">${logo}<span><b>VINScope</b><small>${esc(t(lang, 'brand_tag'))}</small></span></a>
<nav class="nav" aria-label="${esc(t(lang, 'nav_label'))}">${links.map(([h, k]) => `<a href="/${lang}${h}"${cur(h)}>${esc(t(lang, k))}</a>`).join('')}</nav>
<div class="langs" role="group" aria-label="${esc(t(lang, 'lang_label'))}">${LANGS.map((l) => `<a href="/${l}${path === '/check' || path.startsWith('/report') ? '/' : path}" class="${l === lang ? 'on' : ''}" hreflang="${l}" lang="${l}" aria-label="${LANG_NAMES[l]}"${l === lang ? ' aria-current="true"' : ''}>${l.toUpperCase()}</a>`).join('')}</div>
<details class="menu"><summary aria-label="${esc(t(lang, 'menu'))}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ${A}><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary><nav class="sheet" aria-label="${esc(t(lang, 'nav_label'))}">${links.map(([h, k]) => `<a href="/${lang}${h}"${cur(h)}>${esc(t(lang, k))}</a>`).join('')}<a href="/${lang}/terms">${esc(t(lang, 'f_terms'))}</a></nav></details>
</div></header>
<main id="main" tabindex="-1">${body}</main>
<footer><div class="wrap foot"><div>${logo}<b>VINScope</b><p>${esc(t(lang, 'footer'))}</p></div>
<div><p class="foot-h">${esc(t(lang, 'nav_sources'))}</p>${t(lang, 'srcs').map(([n, , u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(n.split(' — ')[0])}<span class="sr-only"> ${esc(t(lang, 'ext_new_tab'))}</span></a>`).join('')}</div>
<div><p class="foot-h">VINScope</p><a href="/${lang}/wanted">${esc(t(lang, 'lp_wanted_link'))}</a><a href="/${lang}/plate">${esc(t(lang, 'lp_plate_link'))}</a><a href="/${lang}/usa">${esc(t(lang, 'nav_usa'))}</a><a href="/${lang}/pricing">${esc(t(lang, 'nav_pricing'))}</a><a href="/${lang}/terms">${esc(t(lang, 'f_terms'))}</a>${cfg.supportEmail ? `<a href="mailto:${esc(cfg.supportEmail)}">${esc(cfg.supportEmail)}</a>` : ''}</div></div>
<div class="wrap legal">© ${new Date().getFullYear()} VINScope${cfg.operatorName ? ` · ${esc(cfg.operatorName)}` : ''} · ${esc(t(lang, 'sources_note'))}</div></footer>
${sticky}
<div class="loader" id="loader" hidden role="status" aria-live="polite" tabindex="-1" data-text="${esc(t(lang, 'loader_text'))}"><div><div class="spin" ${A}></div><p></p></div></div>
<script src="/app.js?v=4" defer data-lang="${lang}"></script></body></html>`;
}

// ---------- поиск ----------
export function searchForm(lang, value = '', big = true, id = 'a', errKind = '') {
  const errText = errKind ? ({ checksum: t(lang, 'vin_sum'), chars: t(lang, 'vin_chars') }[errKind] || t(lang, 'vin_len')) : '';
  const msg = JSON.stringify({ bad: t(lang, 'vin_len'), chars: t(lang, 'vin_chars'), checksum: t(lang, 'vin_sum'), ok: t(lang, 'vin_ok'), plate: t(lang, 'plate_ok') });
  return `<form class="vinform ${big ? 'big' : ''}" action="/${lang}/check" method="get" novalidate role="search">
<label class="sr-only" for="q-${id}">${esc(t(lang, 'q_ph'))}</label>
<div class="searchbox${errKind ? ' invalid' : ''}"><div class="field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ${A}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
<input name="q" id="q-${id}" value="${esc(value)}" placeholder="${esc(t(lang, 'q_ph'))}" maxlength="23" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="search" aria-describedby="hint-${id}"${errKind ? ' aria-invalid="true"' : ''} data-msg='${esc(msg)}'>
<span class="cnt" aria-hidden="true">0/17</span></div><button class="btn primary" type="submit">${esc(t(lang, 'btn_check'))}</button></div>
<div class="modes" aria-hidden="true"><span data-mode="vin">${esc(t(lang, 'mode_vin'))}</span><span data-mode="plate">${esc(t(lang, 'mode_plate'))}</span></div>
<p class="hint${errKind ? ' err' : ''}" id="hint-${id}" role="status" aria-live="polite">${esc(errText)}</p>
<div class="examples"><span>${esc(t(lang, 'ex_label'))}</span><button type="button" data-fill="1HGCM82633A004352">1HGCM82633A004352</button><button type="button" data-fill="AA1234BB">АА1234ВВ</button></div>
<div class="recent"></div></form>`;
}

const orgLd = (req, lang = 'uk') => ({ '@context': 'https://schema.org', '@type': 'Organization', name: 'VINScope', url: abs(req, '/' + lang + '/'), logo: abs(req, '/logo-512.png') });
const siteLd = (req, lang) => ({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'VINScope', alternateName: ['VIN Scope'], url: abs(req, '/' + lang + '/'), inLanguage: lang });
const crumbLd = (req, lang, name, path) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'VINScope', item: abs(req, '/' + lang + '/') }, { '@type': 'ListItem', position: 2, name, item: abs(req, '/' + lang + path) }] });
const faqLd = (lang) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: dict(lang).faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });

export function waitlistBox(lang, id = 'notify') {
  const d = dict(lang);
  return `<div class="panel soon" id="${id}"><h2>${esc(d.soon_h)}</h2><p class="muted">${esc(d.soon_p)}</p>
<form class="notify" data-lang="${lang}" data-ok="${esc(d.soon_ok)}"><label class="sr-only" for="${id}-email">${esc(d.soon_ph)}</label><input id="${id}-email" type="email" name="email" required placeholder="${esc(d.soon_ph)}" autocomplete="email" inputmode="email" aria-describedby="${id}-msg"><button class="btn primary" type="submit">${esc(d.soon_btn)}</button></form>
<p class="muted sm" style="margin:10px 0 0">${esc(d.soon_promise)}</p><p class="notify-msg" id="${id}-msg" role="status"></p></div>`;
}

export function planCards(lang, vin = '', soon = false) {
  const d = dict(lang);
  return `<ul class="plans" role="list">${Object.entries(PLANS).map(([id, p]) => {
    const [name, desc] = d.plans[id];
    const per = p.count > 1 ? `<small>${price(Math.round(p.usd / p.count))} ${esc(d.per)}</small>` : '';
    return `<li class="plan ${p.popular ? 'pop' : ''}">${p.popular && !soon ? `<span class="badge">${esc(d.popular)}</span>` : ''}
<h3>${esc(name)}</h3><div class="amt">${price(p.usd)}</div>${per}<p>${esc(desc)}</p>
<a class="btn ${p.popular ? 'primary' : 'ghost'}" href="${soon ? '#notify' : `/${lang}/checkout?plan=${id}${vin ? '&vin=' + encodeURIComponent(vin) : ''}`}">${esc(soon ? d.plan_notify : d.choose)}</a></li>`;
  }).join('')}</ul>`;
}

const sourcesList = (lang) => `<ul class="srclist">${dict(lang).srcs.map(([n, m, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer"><b>${esc(n)}</b><span class="sr-only"> ${esc(t(lang, 'ext_new_tab'))}</span></a><span>${esc(m)}</span></li>`).join('')}</ul>`;
const h1Html = (txt) => esc(txt).replace(/\*(.+?)\*/g, '<span class="grad">$1</span>');

// ---------- публичные страницы ----------
export function home(req, lang, stats, opts = {}) {
  const d = dict(lang);
  const nf = (n) => Number(n || 0).toLocaleString(lang === 'en' ? 'en-US' : lang === 'ru' ? 'ru-RU' : 'uk-UA');
  const chip = (cls, ico, a, b) => `<div class="chip ${cls}"><span class="dot ${ico[0]}" ${A}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${A}>${ico[1]}</svg></span><div>${esc(a)}<small>${esc(b)}</small></div></div>`;
  const body = `
<section class="hero"><div class="wrap hero-grid"><div>
<span class="badge-pill"><i ${A}></i>${esc(d.hero_badge)}</span>
<h1>${h1Html(d.h1)}</h1><p class="lead">${esc(d.sub)}</p>
${searchForm(lang, opts.q || '', true, 'a', opts.err || '')}
<div class="herostats">${stats.wantedCount ? `<div><b>${nf(stats.wantedCount)}</b><span>${esc(d.stat_wanted)}</span></div>` : ''}${stats.registryRecords ? `<div><b>${nf(stats.registryRecords)}</b><span>${esc(d.stat_reg)}</span></div>` : ''}${stats.wantedUpdatedAt ? `<div><b>${esc(dateOf(stats.wantedUpdatedAt))}</b><span>${esc(d.stat_upd)}</span></div>` : ''}</div>
</div>
<div class="visual" aria-hidden="true">${carSvg()}
${chip('c1', ['g', '<path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'], d.t_wanted_ok, d.wanted_h)}
${chip('c2', ['b', '<path d="M5 7h14M5 12h14M5 17h9"/>'], d.t_reg, `${d.ua_owners} · ${d.ua_imported}`)}
${chip('c3', ['a', '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'], `${d.risk_h} 0–100`, 'NHTSA')}</div>
</div></section>
<section class="sec alt"><div class="wrap"><h2 class="reveal">${esc(d.feat_h)}</h2><ul class="grid3" role="list">${d.feats.map(([h, p], i) => `<li class="card reveal"><svg viewBox="0 0 24 24" class="fi" ${A}><path d="${featIcons[i]}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ul></div></section>
<section class="sec"><div class="wrap"><h2 class="reveal">${esc(d.how_h)}</h2><ol class="steps">${d.steps.map(([h, p]) => `<li class="reveal"><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ol></div></section>
<section class="sec dark"><div class="wrap"><h2 class="reveal">${esc(d.know_h)}</h2><ul class="grid4" role="list">${d.know.map(([h, p]) => `<li class="kcard reveal"><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ul></div></section>
<section class="sec alt"><div class="wrap narrow"><h2 class="reveal">${esc(d.src_h)}</h2><p class="sec-sub">${esc(d.src_p)}</p>${sourcesList(lang)}</div></section>
<section class="sec"><div class="wrap narrow"><h2 class="reveal">${esc(d.faq_h)}</h2>${d.faq.map(([q, a]) => `<details class="reveal"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
<section class="sec cta"><div class="wrap narrow center"><h2 class="reveal">${esc(d.cta_h)}</h2>${searchForm(lang, '', false, 'b')}<div style="margin-top:48px;text-align:left">${waitlistBox(lang)}</div></div></section>`;
  return layout(req, lang, { title: d.home_title, desc: d.home_desc, path: '/', noindex: !!opts.q, body, jsonld: [orgLd(req, lang), siteLd(req, lang), faqLd(lang)] });
}

export function sourcesPage(req, lang) {
  const d = dict(lang);
  const body = `<section class="hero small"><div class="wrap"><h1>${esc(d.src_h)}</h1><p class="lead">${esc(d.src_p)}</p></div></section><section class="sec"><div class="wrap narrow">${sourcesList(lang)}${waitlistBox(lang)}</div></section>`;
  return layout(req, lang, { title: d.t_sources, desc: d.src_p, path: '/sources', body, jsonld: [crumbLd(req, lang, d.src_h, '/sources')] });
}

export function usaPage(req, lang) {
  const d = dict(lang);
  const body = `<section class="hero small"><div class="wrap"><h1>${esc(d.usa_page_h)}</h1><p class="lead">${esc(d.usa_p1)}</p>${searchForm(lang, '', true, 'a')}</div></section>
<section class="sec"><div class="wrap narrow"><h2>${esc(d.usa_h2)}</h2><ul class="check">${d.usa_li.map((x) => `<li>${ic.check}<span>${esc(x)}</span></li>`).join('')}</ul>${waitlistBox(lang)}</div></section>`;
  return layout(req, lang, { title: d.t_usa, desc: cut(d.usa_p1), path: '/usa', body, jsonld: [orgLd(req, lang), crumbLd(req, lang, d.nav_usa, '/usa')] });
}

export function pricingPage(req, lang) {
  const d = dict(lang);
  const on = paywallOn();
  const body = `<section class="hero small"><div class="wrap"><h1>${esc(d.price_h)}</h1><p class="lead">${esc(on ? d.price_sub : d.pricing_lead)}</p></div></section>
<section class="sec"><div class="wrap">${on ? '' : `<div class="panel launch"><h2>${esc(d.launch_h)}</h2><p>${esc(d.launch_p)}</p><a class="btn primary" href="/${lang}/">${esc(d.btn_check)}</a></div><h2 style="margin-top:40px">${esc(d.plans_soon_h)}</h2><p class="sec-sub">${esc(d.price_sub)}</p>`}${planCards(lang, '', !on)}${on ? '' : `<div class="narrow" style="margin-top:40px">${waitlistBox(lang)}</div>`}
<div class="narrow" style="margin-top:48px"><h2>${esc(d.faq_h)}</h2>${d.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div></section>`;
  return layout(req, lang, { title: d.t_pricing, desc: on ? d.price_sub : d.launch_p, path: '/pricing', body, jsonld: [orgLd(req, lang), crumbLd(req, lang, d.price_h, '/pricing')] });
}

export function termsPage(req, lang) {
  const d = dict(lang);
  const contact = cfg.supportEmail ? `<a href="mailto:${esc(cfg.supportEmail)}">${esc(cfg.supportEmail)}</a>` : '';
  const items = d.terms.map((x, i) => {
    if (i === 3) return `<li>${esc(x)}${contact ? ' ' + esc(d.terms_del) + contact : ''}</li>`;
    if (i === 4) return contact || cfg.operatorName ? `<li>${esc(x)}${esc(cfg.operatorName)} ${esc(cfg.operatorDetails)} ${contact}</li>` : '';
    return `<li>${esc(x)}</li>`;
  }).join('');
  const body = `<section class="sec"><div class="wrap narrow prose"><h1>${esc(d.terms_h)}</h1><ol>${items}</ol></div></section>`;
  return layout(req, lang, { title: d.t_terms, desc: cut(d.terms[0]), path: '/terms', body, jsonld: [crumbLd(req, lang, d.terms_h, '/terms')] });
}

export function landingPage(req, lang, key) {
  const d = dict(lang); const lp = d['lp_' + key]; const path = '/' + key;
  const body = `<section class="hero small"><div class="wrap"><h1>${esc(lp.h1)}</h1><p class="lead">${esc(lp.lead)}</p>${searchForm(lang, '', true, 'a')}</div></section>
<section class="sec"><div class="wrap narrow prose">${lp.s.map(([h, p]) => `<h2 class="left">${esc(h)}</h2><p>${esc(p)}</p>`).join('')}<p class="center" style="margin-top:32px"><a class="btn primary" href="/${lang}/">${esc(d.btn_check)}</a></p></div></section>`;
  return layout(req, lang, { title: lp.t, desc: cut(lp.lead), path, body, jsonld: [orgLd(req, lang), crumbLd(req, lang, lp.h1, path)] });
}

export function messagePage(req, lang, title, text) {
  const d = dict(lang);
  return layout(req, lang, { title, desc: text, path: '/', noindex: true, body: `<section class="sec"><div class="wrap narrow center"><h1>${esc(title)}</h1><p>${esc(text)}</p><a class="btn primary" href="/${lang}/">${esc(d.err_back)}</a></div></section>` });
}
export function notFound(req, lang) {
  const d = dict(lang);
  const links = [['/', 'err_back'], ['/usa', 'nav_usa'], ['/sources', 'nav_sources'], ['/pricing', 'nav_pricing']];
  return layout(req, lang, { title: d.err_title, desc: d.err_title + ' — VINScope', path: '/', noindex: true, body: `<section class="sec"><div class="wrap narrow center"><h1>${esc(d.err_title)}</h1><p class="muted">404</p>${searchForm(lang, '', false, 'a')}<nav class="nf-links" aria-label="${esc(d.nav_label)}">${links.map(([h, k]) => `<a href="/${lang}${h}">${esc(d[k])}</a>`).join('')}</nav></div></section>` });
}

// ---------- блоки результата ----------
function gauge(lang, score, level) {
  const col = level === 'high' ? 'var(--bad)' : level === 'mid' ? 'var(--warn)' : 'var(--good)';
  const C = 2 * Math.PI * 52;
  return `<svg viewBox="0 0 120 120" class="gauge" role="img" aria-label="${esc(fmt(t(lang, 'risk_aria'), { n: score }))}"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" stroke-width="11"/><circle cx="60" cy="60" r="52" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(C * score) / 100} ${C}" transform="rotate(-90 60 60)"/><text x="60" y="66" text-anchor="middle" font-size="30" font-weight="800" fill="currentColor">${score}</text></svg>`;
}
const riskTitle = (lang) => (lang === 'en' ? 'Risk Score' : `${en(lang, 'Risk Score')}`);

function riskBlock(lang, r) {
  const d = dict(lang);
  return `<section class="panel" aria-labelledby="h-risk"><h2 id="h-risk">${riskTitle(lang)}</h2><div class="riskrow">${gauge(lang, r.risk.score, r.risk.level)}<div><span class="pill ${r.risk.level}">${esc(d['risk_' + r.risk.level])}</span><ul class="factors">${r.risk.factors.map((f) => `<li><b>+${f.pts}</b> ${esc(t(lang, f.key, f.vars))}</li>`).join('')}</ul></div></div><p class="muted sm">${esc(d.risk_note)} ${esc(d.risk_not_counted)}${r.risk.limited ? ' ' + esc(d.risk_limited) : ''}</p></section>`;
}

function wantedBlock(lang, r) {
  const d = dict(lang);
  if (r.wanted.length) {
    return `<section class="panel alert" aria-labelledby="h-wanted" role="alert"><h2 id="h-wanted">${ic.warn}${esc(d.wanted_hit)}</h2><p>${tel(d.wanted_hit_p)}</p>${r.wanted.slice(0, 3).map((w) => `<dl class="kv"><dt>${esc(d.w_vin)}</dt><dd>${esc(w.vin || w.chassis)}</dd><dt>${esc(d.w_plate)}</dt><dd>${w.plate ? plateEl(w.plate) : '—'}</dd><dt>${esc(d.w_model)}</dt><dd>${esc(w.brand)} ${esc(w.model)}</dd><dt>${esc(d.w_color)}</dt><dd>${esc(w.color)}</dd><dt>${esc(d.w_seized)}</dt><dd>${esc(dateOf(w.seized))}</dd><dt>${esc(d.w_added)}</dt><dd>${esc(dateOf(w.added))}</dd><dt>${esc(d.w_unit)}</dt><dd lang="uk">${esc(w.unit)}</dd></dl>`).join('')}</section>`;
  }
  const c = r.coverage;
  return `<section class="panel" aria-labelledby="h-wanted"><h2 id="h-wanted">${esc(d.wanted_h)}</h2>${c.wantedCount ? `<p class="good">${ic.check}<span>${esc(d.wanted_none)}</span></p><p class="muted sm">${esc(fmt(d.wanted_asof, { n: c.wantedCount.toLocaleString(lang === 'en' ? 'en-US' : 'uk-UA'), date: dateOf(c.wantedUpdatedAt) }))}</p>` : `<p class="muted">${esc(d.wanted_unavail)}</p>`}</section>`;
}

function conclusionBlock(lang, r) {
  const d = dict(lang);
  const items = r.next.flatMap((k) => (Array.isArray(d[k]) ? d[k] : [d[k]]));
  return `<section class="panel" aria-labelledby="h-next"><h2 id="h-next">${esc(d.concl_h)}</h2><ul class="check tight">${items.map((x) => `<li>${ic.check}<span>${tel(x)}</span></li>`).join('')}</ul></section>`;
}

function uaSummary(lang, ua) {
  const d = dict(lang); const s = ua.summary;
  const item = (k, v) => `<div><span>${esc(k)}</span><b>${v}</b></div>`;
  return `<div class="stats">${item(d.ua_records, s.records)}${item(d.ua_first, esc(s.first))}${item(d.ua_last, esc(s.last))}${item(d.ua_owners, s.owners)}${s.imported ? item(d.ua_imported, esc(s.imported.date)) : ''}${s.plates.length ? item(d.ua_plates, s.plates.slice(-2).map((x) => plateEl(x, true)).join(' ')) : ''}${s.deregistered ? item(d.ua_dereg, esc(s.deregistered.date)) : ''}</div>`;
}

function timeline(lang, rows, label) {
  const d = dict(lang);
  const isKey = (x) => ['import', 'first', 'owner', 'export', 'scrap', 'dereg'].includes(x.opkind);
  const keyRows = rows.filter(isKey), other = rows.filter((x) => !isKey(x));
  const row = (x) => `<tr class="k-${x.opkind}"><td data-l="${esc(d.tl_date)}">${esc(x.date)}</td><td data-l="${esc(d.tl_op)}"><span class="kb">${esc(d['k_' + x.opkind] || x.opkind)}</span> ${esc(x.opname || x.oper)}</td><td data-l="${esc(d.tl_dep)}" lang="uk">${esc((x.dep || '').replace(/^\d+ - /, ''))}</td><td data-l="${esc(d.tl_plate)}">${x.plate ? plateEl(x.plate, true) : ''}</td></tr>`;
  const head = `<thead><tr><th scope="col">${esc(d.tl_date)}</th><th scope="col">${esc(d.tl_op)}</th><th scope="col">${esc(d.tl_dep)}</th><th scope="col">${esc(d.tl_plate)}</th></tr></thead>`;
  const table = (list, cap) => `<div class="tablewrap" tabindex="0" role="region" aria-label="${esc(cap)}"><table class="tl"><caption class="sr-only">${esc(cap)}</caption>${head}<tbody>${list.map(row).join('')}</tbody></table></div>`;
  const main = keyRows.length ? keyRows : other;
  const rest = keyRows.length ? other : [];
  return `${table(main, label)}${rest.length ? `<details><summary>${esc(fmt(d.tl_others, { n: rest.length }))}</summary>${table(rest, d.more_ops)}</details>` : ''}`;
}
// «ВАЗ 21063» + «21063» -> не повторяем модель
const brandModel = (b, m) => { const B = String(b || '').trim(), M = String(m || '').trim(); return !M || B.toUpperCase().includes(M.toUpperCase()) ? nice(B) : `${nice(B)} ${nice(M)}`; };

function uaBlock(lang, r, full) {
  const d = dict(lang); const ua = r.ua; const cov = r.coverage.registry;
  const covTxt = cov.from ? fmt(d.ua_cov, { from: cov.from, to: cov.to }) : '';
  if (!ua.rows.length) {
    return `<section class="panel" aria-labelledby="h-ua"><h2 id="h-ua">${esc(d.ua_h)}</h2>${cov.ready ? `<div class="notice">${esc(fmt(d.ua_notchecked, { from: cov.from, to: cov.to }))}</div><p>${esc(d.ua_none)}</p><p class="muted sm">${esc(fmt(d.ua_none_p, { from: cov.from, to: cov.to }))}</p>` : `<p class="muted">${esc(d.ua_notready)}</p>`}${cov.indexing && cov.ready ? `<p class="muted sm">${esc(d.ua_indexing)}</p>` : ''}</section>`;
  }
  const tl = full ? timeline(lang, ua.rows, d.ua_h) : '';
  const v = ua.summary.vehicle;
  const line = [brandModel(v.brand, v.model), v.year, v.color && rv(lang, v.color), v.fuel && rv(lang, v.fuel), v.cap ? `${v.cap} ${d.cm3}` : ''].filter(Boolean).join(' · ');
  return `<section class="panel" aria-labelledby="h-ua"><h2 id="h-ua">${esc(d.ua_h)}</h2>${line ? `<p class="vehline">${esc(line)}</p>` : ''}${uaSummary(lang, ua)}${tl}<p class="muted sm">${esc(covTxt)}${cov.indexing ? ' · ' + esc(d.ua_indexing) : ''}</p></section>`;
}

// Перевод частых значений NHTSA (топливо, кузов, привод, КПП)
const TR = {
  uk: { gasoline: 'Бензин', diesel: 'Дизель', 'electric': 'Електро', 'flexible fuel vehicle (ffv)': 'Flex-fuel', hybrid: 'Гібрид', coupe: 'Купе', sedan: 'Седан', hatchback: 'Хетчбек', 'sedan/saloon': 'Седан', 'sport utility vehicle (suv)/multi-purpose vehicle (mpv)': 'Позашляховик (SUV)', 'pickup': 'Пікап', 'wagon': 'Універсал', 'minivan': 'Мінівен', convertible: 'Кабріолет', 'automatic': 'Автомат', manual: 'Механіка', 'fwd/front-wheel drive': 'Передній', 'rwd/rear-wheel drive': 'Задній', 'awd/all-wheel drive': 'Повний (AWD)', '4wd/4-wheel drive/4x4': 'Повний (4WD)' },
  ru: { gasoline: 'Бензин', diesel: 'Дизель', electric: 'Электро', 'flexible fuel vehicle (ffv)': 'Flex-fuel', hybrid: 'Гибрид', coupe: 'Купе', sedan: 'Седан', hatchback: 'Хетчбэк', 'sedan/saloon': 'Седан', 'sport utility vehicle (suv)/multi-purpose vehicle (mpv)': 'Внедорожник (SUV)', pickup: 'Пикап', wagon: 'Универсал', minivan: 'Минивэн', convertible: 'Кабриолет', automatic: 'Автомат', manual: 'Механика', 'fwd/front-wheel drive': 'Передний', 'rwd/rear-wheel drive': 'Задний', 'awd/all-wheel drive': 'Полный (AWD)', '4wd/4-wheel drive/4x4': 'Полный (4WD)' },
};
function tv(lang, value) {
  const k = String(value).toLowerCase();
  const hit = TR[lang]?.[k] || TR[lang]?.[Object.keys(TR[lang] || {}).find((x) => k.startsWith(x)) || ''];
  return hit ? esc(hit) : (lang === 'en' ? esc(value) : en(lang, value));
}

function decodeBlock(lang, r) {
  const d = dict(lang); const x = r.decoded;
  const rows = x.found ? (x.trusted ? [['dk_make', x.make], ['dk_model', x.model], ['dk_year', x.year], ['dk_trim', x.trim], ['dk_body', x.body], ['dk_drive', x.drive], ['dk_engine', x.engine], ['dk_fuel', x.fuel], ['dk_trans', x.transmission], ['dk_plant', x.plant]] : [['dk_make', x.make], ['dk_plant', x.plant]]).filter((q) => q[1]) : [];
  const mm = r.mismatch.length ? `<div class="notice bad">${ic.warn}<div><b>${esc(d.mm_h)}</b>${r.mismatch.map((m) => `<div>${esc(fmt(d['mm_' + m.field], { vin: m.vin, registry: m.registry }))}</div>`).join('')}</div></div>` : '';
  const val = (k, v) => (['dk_body', 'dk_fuel', 'dk_drive', 'dk_trans'].includes(k) ? tv(lang, v) : k === 'dk_engine' ? esc(engineText(lang, v)) : ['dk_make', 'dk_model', 'dk_trim', 'dk_plant'].includes(k) ? en(lang, v) : esc(v));
  return `<section class="panel" aria-labelledby="h-dec"><h2 id="h-dec">${esc(d.decode_h)}</h2>${mm}${rows.length ? `${x.trusted ? '' : `<div class="notice info">${esc(d.decode_partial)}</div>`}<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(d[k])}</dt><dd>${val(k, v)}</dd>`).join('')}</dl>` : `<p class="muted">${esc(x.unavailable ? d.decode_unavail : d.decode_none)}</p>`}</section>`;
}

const starsOf = (v, d) => (/^\d$/.test(String(v)) ? `<span aria-hidden="true" class="stars">${'★'.repeat(+v)}${'☆'.repeat(5 - +v)}</span><span class="sr-only">${v} ${esc(d.stars)}</span> <span class="muted sm" aria-hidden="true">${v} ${esc(d.stars)}</span>` : `<span class="muted">${esc(d.nr)}</span>`);
function safetyBlock(lang, r, full) {
  const d = dict(lang); const rec = r.recalls, c = r.complaints, rt = r.ratings;
  const item = (x, long) => `<li><b>${en(lang, x.component)}</b><span lang="en">${esc((x.summary || '').slice(0, long ? 420 : 220))}…</span></li>`;
  const head = rec.items.slice(0, full ? 3 : 3), tail = full ? rec.items.slice(3) : [];
  const recHtml = rec.items.length
    ? `<p><b>${esc(d.open_recalls)}${rec.items.length}</b></p><ul class="recalls">${head.map((x) => item(x, full)).join('')}</ul>${tail.length ? `<details><summary>${esc(fmt(d.recalls_more, { n: rec.items.length }))}</summary><ul class="recalls">${tail.map((x) => item(x, true)).join('')}</ul></details>` : ''}<p class="muted sm">${esc(d.nhtsa_en)} ${esc(d.recalls_check)}</p>`
    : r.decoded.trusted ? `<p class="good">${ic.check}<span>${esc(d.none_recalls)}</span></p>` : `<p class="muted">${esc(d.sr_dev)}</p>`;
  const compHtml = c.count ? `<p><b>${esc(fmt(d.comp_n, { n: c.count }))}</b></p><p class="muted sm">${esc(fmt(d.comp_stats, { c: c.crashes, f: c.fires, i: c.injuries, d: c.deaths }))}</p><p class="sm">${esc(d.comp_top)}: ${c.top.map((x) => `${en(lang, x.component)} (${x.n})`).join(', ')}</p><p class="muted sm">${esc(d.comp_note)}</p>` : `<p class="muted">${r.decoded.trusted ? esc(d.none_comp) : esc(d.sr_dev)}</p>`;
  let rateHtml = '';
  if (rt) {
    const all = [rt.overall, rt.front, rt.side, rt.rollover];
    rateHtml = all.every((x) => !/^\d$/.test(String(x))) ? `<p class="muted">${esc(d.rate_none)}</p>` : `<dl class="kv"><dt>${esc(d.rate_overall)}</dt><dd>${starsOf(rt.overall, d)}</dd><dt>${esc(d.rate_front)}</dt><dd>${starsOf(rt.front, d)}</dd><dt>${esc(d.rate_side)}</dt><dd>${starsOf(rt.side, d)}</dd><dt>${esc(d.rate_roll)}</dt><dd>${starsOf(rt.rollover, d)}</dd></dl><p class="muted sm" lang="en">${esc(rt.description)}</p>`;
  }
  return `<section class="panel" aria-labelledby="h-safe"><h2 id="h-safe">${esc(d.safety_h)}</h2><h3>${esc(d.recalls_h)}</h3>${recHtml}<h3>${esc(d.comp_h)}</h3>${compHtml}${rateHtml ? `<h3>${esc(d.rate_h)}</h3>${rateHtml}` : ''}</section>`;
}

function usaBlock(lang, r) {
  const d = dict(lang); const s = r.usa?.found ? r.usa.sections : null;
  if (!s) return `<section class="panel" aria-labelledby="h-usa"><h2 id="h-usa">${esc(d.usa_h)}</h2><p class="muted">${esc(d.usa_soon)}</p></section>`;
  return `<section class="panel" aria-labelledby="h-usa"><h2 id="h-usa">${esc(d.usa_h)}</h2><pre class="raw">${esc(JSON.stringify(s, null, 2))}</pre></section>`;
}

// ---------- шапка результата ----------
const vehicleTitle = (r, fallback) => {
  const x = r.decoded; const v = r.ua?.summary?.vehicle;
  if (x?.trusted) return `${nice(x.make)} ${nice(x.model)}, ${x.year}`;
  if (v?.brand) return `${brandModel(v.brand, v.model)}${v.year ? ', ' + v.year : ''}`;
  return x?.make ? nice(x.make) : fallback;
};
function photoFigure(lang, r) {
  const d = dict(lang); const ph = r.photo;
  if (!ph && !r.vehicle?.make) return ''; // марка неизвестна: показывать нечего
  return `<figure class="photo${ph ? '' : ' nophoto'}"><div class="ph">${ph ? `<img src="${esc(ph.url)}" alt="${esc(vehicleTitle(r, ''))}" width="960" height="600" decoding="async" fetchpriority="high">` : ''}<div class="fallback">${silhouette}</div></div>${ph ? `<figcaption>${esc(d.photo_cap)} · <a href="${esc(ph.page)}" target="_blank" rel="noopener noreferrer">${esc(d.photo_src)}<span class="sr-only"> ${esc(d.ext_new_tab)}</span></a></figcaption>` : ''}</figure>`;
}
function specChips(lang, r) {
  const x = r.decoded; const v = r.ua?.summary?.vehicle || {}; const d = dict(lang);
  const items = x?.trusted
    ? [x.body && tv(lang, x.body), x.fuel && tv(lang, x.fuel), x.engine && esc(engineText(lang, x.engine))]
    : [v.body && esc(rv(lang, v.body)), v.fuel && esc(rv(lang, v.fuel)), v.cap && `${v.cap} ${esc(d.cm3)}`, v.color && esc(rv(lang, v.color))];
  const list = items.filter(Boolean);
  return list.length ? `<ul class="specs" role="list">${list.map((i) => `<li>${i}</li>`).join('')}</ul>` : '';
}
function vehicleHero(lang, r, eyebrow, fromPlate) {
  const d = dict(lang); const title = vehicleTitle(r, r.vin);
  return `<section class="hero small result"><div class="wrap"><a class="crumb" href="/${lang}/"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" ${A}><path d="M15 6l-6 6 6 6"/></svg>${esc(d.back_new)}</a>
<div class="vehicle${photoFigure(lang, r) ? '' : ' solo'}">${photoFigure(lang, r)}<div><p class="eyebrow">${esc(eyebrow)}</p><h1 class="${title === r.vin ? 'vin' : ''}">${esc(title)}</h1>${title !== r.vin ? `<p class="vinmono">${esc(r.vin)}</p>` : ''}${fromPlate ? `<p class="byplate">${esc(fmt(d.found_by_plate, { plate: '' }))}${plateEl(fromPlate, true)}</p>` : ''}${specChips(lang, r)}</div></div></div></section>`;
}
const miniGauge = (score, level) => {
  const col = level === 'high' ? 'var(--bad)' : level === 'mid' ? 'var(--warn)' : 'var(--good)'; const C = 2 * Math.PI * 20;
  return `<svg class="mini-g" viewBox="0 0 52 52" ${A}><circle cx="26" cy="26" r="20" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="26" cy="26" r="20" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(C * score) / 100} ${C}" transform="rotate(-90 26 26)"/></svg>`;
};
const tileIc = {
  ok: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" ${A}><path d="M5 12l5 5 9-10"/></svg>`,
  bad: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" ${A}><path d="M12 5v9M12 18v.5"/></svg>`,
  doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${A}><path d="M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6"/></svg>`,
  na: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" ${A}><path d="M6 12h12"/></svg>`,
};
function tiles(lang, r) {
  const d = dict(lang); const c = r.coverage; const cov = c.registry;
  const t1 = r.wanted.length ? ['bad', tileIc.bad, d.t_wanted_hit] : c.wantedCount > 0 ? ['ok', tileIc.ok, d.t_wanted_ok] : ['na', tileIc.na, d.t_na];
  const n = r.ua.rows.length;
  const t2 = n ? ['ok', tileIc.doc, plural(lang, n, d.t_reg_n)] : cov.ready ? ['na', tileIc.doc, d.t_reg_none] : ['na', tileIc.na, d.t_reg_unk];
  const regLabel = cov.ready ? fmt(d.tile_reg_years, { from: String(cov.from).slice(0, 4), to: String(cov.to).slice(0, 4) }) : d.t_reg;
  const rc = r.recalls.items.length;
  const t3 = !r.decoded.trusted ? ['na', tileIc.na, d.t_na] : rc ? ['warn', tileIc.bad, plural(lang, rc, d.t_recalls_n)] : ['ok', tileIc.ok, d.t_recalls_none];
  const tile = ([cls, icon, txt], label) => `<li class="tile ${cls}"><span class="ic">${icon}</span><div><small>${esc(label)}</small><b>${esc(txt)}</b></div></li>`;
  return `<div class="wrap"><ul class="tiles" role="list">${tile(t1, d.wanted_h)}${tile(t2, regLabel)}${tile(t3, d.t_recalls)}<li class="tile risk"><span class="ic">${miniGauge(r.risk.score, r.risk.level)}</span><div><small>${esc(d.t_risk)}</small><b>${r.risk.score} · ${esc(d['risk_' + r.risk.level])}</b></div></li></ul></div>`;
}

const actionsBlock = (lang) => `<div class="panel actions-panel noprint"><h2>${esc(t(lang, 'print_h'))}</h2><div class="actions"><button class="btn ghost" type="button" data-print>${esc(t(lang, 'print'))}</button><button class="btn ghost" type="button" id="share" data-ok="${esc(t(lang, 'copied_ok'))}">${esc(t(lang, 'share'))}</button></div><p class="muted sm" style="margin:12px 0 0">${esc(t(lang, 'share_note'))}</p></div>`;

function earlyPlateBlock(lang, plate, early) {
  if (!early?.length) return '';
  const d = dict(lang);
  return `<section class="panel" aria-labelledby="h-early"><h2 id="h-early">${esc(fmt(d.plate_early_h, { plate }))}</h2><p class="muted sm">${esc(d.plate_early_note)}</p>${early.map((g) => timeline(lang, g.rows, d.plate_h)).join('')}</section>`;
}

export function checkPage(req, lang, r, { full = false, fromPlate = '', early = [] } = {}) {
  const d = dict(lang);
  const title = vehicleTitle(r, r.vin);
  const hit = r.wanted.length > 0;
  const cta = paywallOn() ? `${esc(d.unlock)} — ${price(PLANS.single.usd)}` : esc(d.unlock_free);
  const href = `/${lang}/checkout?plan=single&vin=${encodeURIComponent(r.vin)}`;
  const main = full
    ? `${wantedBlock(lang, r)}${conclusionBlock(lang, r)}${riskBlock(lang, r)}${uaBlock(lang, r, true)}${earlyPlateBlock(lang, fromPlate, early)}${decodeBlock(lang, r)}${safetyBlock(lang, r, true)}${usaBlock(lang, r)}<p class="muted sm">${esc(d.sources_note)} ${esc(fmt(d.asof_full, { t: r.generatedAt.slice(0, 16).replace('T', ' ') }))}</p>`
    : `${wantedBlock(lang, r)}${conclusionBlock(lang, r)}${riskBlock(lang, r)}${uaBlock(lang, r, false)}${decodeBlock(lang, r)}${safetyBlock(lang, r, false)}`;
  const aside = full
    ? `${actionsBlock(lang)}${waitlistBox(lang)}`
    : `<div class="panel paywall"><h2>${paywallOn() ? ic.lock : ''}${esc(d.paid_h)}</h2><ul class="mini"><li>${ic.check}<span>${esc(d.ua_locked)}</span></li><li>${ic.check}<span>${esc(d.go_pdf)}</span></li></ul><a class="btn primary wide" href="${href}">${cta}</a></div>${waitlistBox(lang)}`;
  const sticky = !full && !hit ? `<div class="stickycta" id="sticky" hidden><a class="btn primary" href="${href}">${cta}</a></div>` : '';
  const body = `${vehicleHero(lang, r, d.res_h, fromPlate)}${tiles(lang, r)}<section class="sec" style="padding-top:36px"><div class="wrap two"><div>${main}</div><aside>${aside}</aside></div></section>`;
  return layout(req, lang, { title: `${title} — ${d.res_h} | VINScope`, desc: `${title}: ${d.sub}`, path: '/check', body, noindex: true, sticky, preconnect: r.photo ? 'https://thumb.wikimedia.org' : '' });
}

export function plateReport(req, lang, plate, hist, pcov, wanted) {
  const d = dict(lang);
  const g0 = hist.groups[0];
  const v = g0?.summary.vehicle;
  const sub = v ? `${brandModel(v.brand, v.model)}${v.year ? ', ' + v.year : ''}` : '';
  const yr = (x) => String(x || '').slice(0, 4);
  const hit = wanted.length > 0;
  const tile = ([cls, icon, txt], label) => `<li class="tile ${cls}"><span class="ic">${icon}</span><div><small>${esc(label)}</small><b>${esc(txt)}</b></div></li>`;
  const tilesHtml = `<div class="wrap"><ul class="tiles three" role="list">${tile(hit ? ['bad', tileIc.bad, d.t_wanted_hit] : ['ok', tileIc.ok, d.t_wanted_ok], d.wanted_h)}${tile(['ok', tileIc.doc, plural(lang, hist.rows.length, d.t_reg_n)], fmt(d.t_plate_reg, { from: yr(pcov.from), to: yr(pcov.to) }))}${tile(['na', tileIc.na, d.t_vin_none], d.t_vin)}</ul></div>`;
  const wantedHtml = hit
    ? `<section class="panel alert" role="alert"><h2>${ic.warn}${esc(d.wanted_hit)}</h2><p>${tel(d.wanted_hit_p)}</p>${wanted.slice(0, 3).map((q) => `<dl class="kv"><dt>${esc(d.w_plate)}</dt><dd>${plateEl(q.plate)}</dd><dt>${esc(d.w_vin)}</dt><dd>${esc(q.vin || q.chassis)}</dd><dt>${esc(d.w_model)}</dt><dd>${esc(q.brand)} ${esc(q.model)}</dd><dt>${esc(d.w_seized)}</dt><dd>${esc(dateOf(q.seized))}</dd><dt>${esc(d.w_unit)}</dt><dd lang="uk">${esc(q.unit)}</dd></dl>`).join('')}</section>`
    : `<section class="panel"><h2>${esc(d.wanted_h)}</h2><p class="good">${ic.check}<span>${esc(d.wanted_none)}</span></p></section>`;
  const groupsHtml = hist.groups.map((g, i) => {
    const gv = g.summary.vehicle;
    const title = `${brandModel(gv.brand, gv.model)}${gv.year ? ', ' + gv.year : ''}`;
    const line = [gv.color && rv(lang, gv.color), gv.fuel && rv(lang, gv.fuel), gv.body && rv(lang, gv.body), gv.cap ? `${gv.cap} ${d.cm3}` : ''].filter(Boolean).join(' · ');
    return `<section class="panel" aria-labelledby="h-g${i}"><h2 id="h-g${i}">${esc(title)}</h2>${line ? `<p class="vehline">${esc(line)}</p>` : ''}${uaSummary(lang, g)}${timeline(lang, g.rows, title)}</section>`;
  }).join('');
  const next = hit ? d.c_wanted : [d.plate_vin_hint, ...d.c_default];
  const main = `${wantedHtml}<section class="panel" aria-labelledby="h-next"><h2 id="h-next">${esc(d.concl_h)}</h2><ul class="check tight">${next.map((x) => `<li>${ic.check}<span>${tel(x)}</span></li>`).join('')}</ul></section>
<div class="notice info">${esc(fmt(d.plate_note, { from: pcov.from || '—', to: pcov.to || '—' }))}${hist.groups.length > 1 ? ` <b>${esc(plural(lang, hist.groups.length, d.plate_groups))}.</b>` : ''}</div>${groupsHtml}
${searchForm(lang, '', false, 'b')}<p class="muted sm">${esc(d.sources_note)}</p>`;
  const body = `<section class="hero small result"><div class="wrap"><a class="crumb" href="/${lang}/"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" ${A}><path d="M15 6l-6 6 6 6"/></svg>${esc(d.back_new)}</a>
<div class="vehicle solo"><div><p class="eyebrow">${esc(d.plate_h)}</p><h1 class="platebig">${plateEl(plate)}</h1>${sub ? `<p class="plate-sub">${esc(sub)}</p>` : ''}</div></div></div></section>${tilesHtml}
<section class="sec" style="padding-top:36px"><div class="wrap two"><div>${main}</div><aside>${actionsBlock(lang)}${waitlistBox(lang)}</aside></div></section>`;
  return layout(req, lang, { title: `${plate} — ${d.plate_h} | VINScope`, desc: d.plate_h, path: '/check', body, noindex: true });
}

export function plateNotFound(req, lang, plate, cov, wanted) {
  const d = dict(lang);
  const w = wanted.length ? `<section class="panel alert" role="alert"><h2>${ic.warn}${esc(d.wanted_hit)}</h2><p>${tel(d.wanted_hit_p)}</p>${wanted.slice(0, 3).map((q) => `<dl class="kv"><dt>${esc(d.w_plate)}</dt><dd>${plateEl(q.plate)}</dd><dt>${esc(d.w_vin)}</dt><dd>${esc(q.vin || q.chassis)}</dd><dt>${esc(d.w_model)}</dt><dd>${esc(q.brand)} ${esc(q.model)}</dd><dt>${esc(d.w_seized)}</dt><dd>${esc(dateOf(q.seized))}</dd><dt>${esc(d.w_unit)}</dt><dd lang="uk">${esc(q.unit)}</dd></dl>`).join('')}</section>` : '';
  const body = `<section class="hero small"><div class="wrap"><a class="crumb" href="/${lang}/">${esc(d.back_new)}</a><p class="eyebrow">${esc(d.res_h)}</p><h1>${plateEl(plate)}</h1></div></section><section class="sec"><div class="wrap narrow">${w}
<div class="panel"><h2>${esc(d.not_found_plate)}</h2><p>${esc(fmt(d.not_found_plate_p, { from: cov.from || '—', to: cov.to || '—' }))}</p></div>${searchForm(lang, '', false, 'a')}</div></section>`;
  return layout(req, lang, { title: `${plate} — ${d.res_h} | VINScope`, desc: d.not_found_plate, path: '/check', body, noindex: true });
}

export function checkoutPage(req, lang, { plan, vin }) {
  const d = dict(lang);
  const p = PLANS[plan]; const [name, desc] = d.plans[plan];
  const body = `<section class="sec"><div class="wrap narrow"><h1>${esc(d.co_h)}</h1>
<div class="panel"><h2>${esc(`${name} — ${price(p.usd)}`)}</h2><p class="muted">${esc(desc)}</p>
<form id="co" class="stack" data-lang="${lang}" data-plan="${plan}">
<label>${esc(d.co_vin)}<input name="vin" value="${esc(vin)}" maxlength="23" required autocapitalize="characters" autocorrect="off" spellcheck="false" class="mono"></label>
<label>${esc(d.co_email)}<input name="email" type="email" required autocomplete="email" inputmode="email" placeholder="you@example.com"></label>
<label>${esc(d.code_ph)}<input name="code" placeholder="VS-XXXXXXXXXX-XXXXXX" autocomplete="off" autocapitalize="characters" class="mono"></label>
<p class="err" id="coerr" role="alert"></p>
<button class="btn primary wide" type="submit">${esc(`${d.co_pay} · ${price(p.usd)}`)}</button>
<p class="muted sm">${ic.lock}${esc(d.co_secure)}</p></form></div></div></section>`;
  return layout(req, lang, { title: d.co_h + ' — VINScope', desc: d.co_h, path: '/checkout', body, noindex: true });
}

const PACK = {
  uk: (c, n) => `Ваш код пакета: ${c}. Залишилося ${n} ${plural('uk', n, ['перевірка', 'перевірки', 'перевірок'])}. Збережіть код: введіть його на сторінці оформлення замість оплати.`,
  ru: (c, n) => `Ваш код пакета: ${c}. Осталось ${n} ${plural('ru', n, ['проверка', 'проверки', 'проверок'])}. Сохраните код: введите его на странице оформления вместо оплаты.`,
  en: (c, n) => `Your pack code: ${c}. ${n} ${n === 1 ? 'check' : 'checks'} left. Save it and enter it at checkout instead of paying.`,
};
const packNote = (lang, order) => (order.credit_code && order.packLeft > 0 ? `<div class="notice">${esc(PACK[lang](order.credit_code, order.packLeft))}</div>` : '');

// Отчёт по токену (платный режим): те же блоки, что и в полной проверке
export function reportPage(req, lang, order, r) {
  const d = dict(lang);
  const title = r ? vehicleTitle(r, order.vin) : order.vin;
  let inner;
  if (['refunded', 'refund_failed'].includes(order.status)) inner = `<div class="panel center"><h2>${esc(d.refunded_h)}</h2><p>${esc(d.refunded_p)}</p></div>`;
  else if (!r) inner = `<div class="panel center" data-poll="1" role="status" data-ready="${esc(d.report_ready)}" data-wait="${esc(d.report_wait)}"><h2>${esc(d.pending_h)}</h2><p>${esc(d.pending_p)}</p><a class="btn ghost" href="">${esc(d.refresh || 'Refresh')}</a></div>`;
  else inner = `${packNote(lang, order)}${actionsBlock(lang)}<p class="muted sm">${esc(fmt(d.asof_full, { t: r.generatedAt.slice(0, 16).replace('T', ' ') }))}</p>${wantedBlock(lang, r)}${conclusionBlock(lang, r)}${riskBlock(lang, r)}${uaBlock(lang, r, true)}${decodeBlock(lang, r)}${safetyBlock(lang, r, true)}${usaBlock(lang, r)}<p class="muted sm">${esc(d.sources_note)}</p>`;
  const hero = r ? vehicleHero(lang, r, d.rep_h) + tiles(lang, r) : `<section class="hero small"><div class="wrap"><p class="eyebrow">${esc(d.rep_h)}</p><h1>${esc(title)}</h1><p class="vinmono">${esc(order.vin)}</p></div></section>`;
  const body = `${hero}<section class="sec" style="padding-top:36px"><div class="wrap narrow">${inner}</div></section>`;
  return layout(req, lang, { title: `${title} — ${d.rep_h} | VINScope`, desc: d.rep_h, path: '/report/' + order.token, body, noindex: true });
}
