import { LANGS, LOCALE, t, dict, plural } from './i18n.js';
import { cfg, PLANS, price, paywallOn } from './config.js';
import { origin } from './http.js';
import { l100, gpkm } from './fueleco.js';
import { toolsHomeBlock, diffBlock, toolCards } from './tools-views.js';
import { TT } from './tools-i18n.js';

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
const plateEl = (p, sm = false, cc = 'UA') => `<span class="plate${sm ? ' sm' : ''}"><i ${A}>${cc}</i><span>${esc(p)}</span></span>`;

// ---------- каркас страницы ----------
export function layout(req, lang, { title, desc, path, body, noindex, jsonld = [], sticky = '', preconnect = '' }) {
  const alt = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(abs(req, '/' + l + path))}">`).join('');
  const ld = jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('');
  const links = [['/tools', 'nav_tools'], ['/usa', 'nav_usa'], ...(paywallOn() ? [['/pricing', 'nav_pricing']] : [])];
  const cur = (p) => (path === p || (p === '/tools' && path.startsWith('/tools/')) ? ' aria-current="page"' : '');
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
<link rel="stylesheet" href="/styles.css?v=5">${preconnect ? `<link rel="preconnect" href="${esc(preconnect)}">` : ''}${ld}
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

<div><p class="foot-h">VINScope</p><a href="/${lang}/tools">${esc(t(lang, 'nav_tools'))}</a><a href="/${lang}/wanted">${esc(t(lang, 'lp_wanted_link'))}</a><a href="/${lang}/plate">${esc(t(lang, 'lp_plate_link'))}</a><a href="/${lang}/usa">${esc(t(lang, 'nav_usa'))}</a><a href="/${lang}/pricing">${esc(t(lang, 'nav_pricing'))}</a><a href="/${lang}/terms">${esc(t(lang, 'f_terms'))}</a>${cfg.supportEmail ? `<a href="mailto:${esc(cfg.supportEmail)}">${esc(cfg.supportEmail)}</a>` : ''}</div></div>
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
${chip('c3', ['a', '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'], `${d.risk_h} 0–100`, d.trust3)}</div>
</div></section>
<section class="sec" id="what"><div class="wrap"><h2 class="reveal">${esc(d.feat_h)}</h2><ul class="grid3" role="list">${d.feats.map(([h, p], i) => `<li class="card reveal"><svg viewBox="0 0 24 24" class="fi" ${A}><path d="${featIcons[i]}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ul></div></section>
<section class="sec alt"><div class="wrap"><h2 class="reveal">${esc(d.how_h)}</h2><ol class="steps">${d.steps.map(([h, p]) => `<li class="reveal"><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ol></div></section>
${toolsHomeBlock(lang)}${diffBlock(lang)}
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

// «Коротко»: оценка риска и план действий одной карточкой в начале отчёта; разбор баллов — по раскрытию
function verdictBlock(lang, r) {
  const d = dict(lang);
  const items = r.next.flatMap((k) => (Array.isArray(d[k]) ? d[k] : [d[k]]));
  return `<section class="panel verdict ${r.risk.level}" aria-labelledby="h-verdict"><div class="vhead">${gauge(lang, r.risk.score, r.risk.level)}<div><p class="eyebrow">${riskTitle(lang)}</p><h2 id="h-verdict">${esc(d['risk_' + r.risk.level])}</h2><details class="why"><summary>${esc(d.why_score)}</summary><ul class="factors">${r.risk.factors.map((f) => `<li><b>+${f.pts}</b> ${esc(t(lang, f.key, f.vars))}</li>`).join('')}</ul><p class="muted sm">${esc(d.risk_note)} ${esc(d.risk_not_counted)}${r.risk.limited ? ' ' + esc(d.risk_limited) : ''}</p></details></div></div><h3>${esc(d.concl_h)}</h3><ul class="check tight">${items.map((x) => `<li>${ic.check}<span>${tel(x)}</span></li>`).join('')}</ul></section>`;
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

function localBlock(lang, r) {
  const d = dict(lang); const l = r.local;
  return `<section class="panel" aria-labelledby="h-dec"><h2 id="h-dec">${esc(d.local_h)}</h2><div class="notice info">${esc(d.local_note)}</div><dl class="kv"><dt>${esc(d.local_make)}</dt><dd>${esc(l.make)}</dd>${l.model ? `<dt>${esc(d.local_model)}</dt><dd>${esc(l.model)}</dd>` : ''}${l.years.length ? `<dt>${esc(d.local_year)}</dt><dd>${esc(l.years.join(' / '))}</dd>` : ''}</dl></section>`;
}

function decodeBlock(lang, r) {
  if (r.local) return localBlock(lang, r);
  const d = dict(lang); const x = r.decoded;
  const rows = x.found ? (x.trusted ? [['dk_make', x.make], ['dk_model', x.model], ['dk_year', x.year], ['dk_trim', x.trim], ['dk_body', x.body], ['dk_drive', x.drive], ['dk_engine', x.engine], ['dk_fuel', x.fuel], ['dk_trans', x.transmission], ['dk_plant', x.plant]] : [['dk_make', x.make], ['dk_plant', x.plant]]).filter((q) => q[1]) : [];
  const mm = r.mismatch.length ? `<div class="notice bad">${ic.warn}<div><b>${esc(d.mm_h)}</b>${r.mismatch.map((m) => `<div>${esc(fmt(d['mm_' + m.field], { vin: m.vin, registry: m.registry }))}</div>`).join('')}</div></div>` : '';
  const val = (k, v) => (['dk_body', 'dk_fuel', 'dk_drive', 'dk_trans'].includes(k) ? tv(lang, v) : k === 'dk_engine' ? esc(engineText(lang, v)) : ['dk_make', 'dk_model', 'dk_trim', 'dk_plant'].includes(k) ? en(lang, v) : esc(v));
  return `<section class="panel" aria-labelledby="h-dec"><h2 id="h-dec">${esc(d.decode_h)}</h2>${mm}${rows.length ? `${x.trusted ? '' : `<div class="notice info">${esc(d.decode_partial)}</div>`}<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(d[k])}</dt><dd>${val(k, v)}</dd>`).join('')}</dl>` : `<p class="muted">${esc(x.unavailable ? d.decode_unavail : d.decode_none)}</p>`}</section>`;
}

const starsOf = (v, d) => (/^\d$/.test(String(v)) ? `<span aria-hidden="true" class="stars">${'★'.repeat(+v)}${'☆'.repeat(5 - +v)}</span><span class="sr-only">${v} ${esc(d.stars)}</span> <span class="muted sm" aria-hidden="true">${v} ${esc(d.stars)}</span>` : `<span class="muted">${esc(d.nr)}</span>`);
function safetyBlock(lang, r, full) {
  const d = dict(lang); const rec = r.recalls, c = r.complaints, rt = r.ratings;
  const item = (x, long) => `<li><b>${en(lang, x.component)}</b><span lang="en">${esc((x.summary || '').slice(0, long ? 260 : 200))}…</span></li>`;
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
  const ca = r.canada;
  const caHtml = ca ? `<h3>${esc(d.ca_h)}</h3>${ca.count ? `<p><b>${esc(fmt(d.ca_n, { n: ca.count }))}</b></p>${(() => { const li = (x) => `<li><b>${en(lang, x.system || x.number)} <span class="muted">${esc(x.date)}</span></b>${x.issue ? `<span lang="en">${esc(x.issue.slice(0, 220))}${x.issue.length > 220 ? '…' : ''}</span>` : ''}</li>`; return `<ul class="recalls">${ca.items.slice(0, 2).map(li).join('')}</ul>${ca.items.length > 2 ? `<details><summary>${esc(fmt(d.recalls_more, { n: ca.items.length }))}</summary><ul class="recalls">${ca.items.slice(2).map(li).join('')}</ul></details>` : ''}`; })()}<p class="muted sm">${esc(d.ca_note)}</p>` : `<p class="good">${ic.check}<span>${esc(d.ca_none)}</span></p>`}` : '';
  return `<section class="panel" aria-labelledby="h-safe"><h2 id="h-safe">${esc(d.safety_h)}</h2><h3>${esc(d.recalls_h)}</h3>${recHtml}${caHtml}<h3>${esc(d.comp_h)}</h3>${compHtml}${rateHtml ? `<h3>${esc(d.rate_h)}</h3>${rateHtml}` : ''}</section>`;
}

function usaBlock(lang, r) {
  const d = dict(lang); const u = r.usa;
  const head = `<h2 id="h-usa">${esc(d.usa_h)}</h2>`;
  if (!u || (!u.queried && !u.capped && !u.cached)) return `<section class="panel" aria-labelledby="h-usa"><h2 id="h-usa">${esc(d.usa_auc_h)}</h2><p class="muted">${esc(d.usa_soon)}</p></section>`;
  if (u.capped) return `<section class="panel" aria-labelledby="h-usa">${head}<p class="muted">${esc(d.usa_capped)}</p></section>`;
  if (!u.found) return `<section class="panel" aria-labelledby="h-usa">${head}<p>${esc(d.usa_none)}</p></section>`;
  const sm = u.summary; const loc = lang === 'en' ? 'en-US' : 'uk-UA';
  const money = (n) => (n || n === 0 ? '$' + Number(n).toLocaleString(loc) : '—');
  const item = (k, v) => `<div><span>${esc(k)}</span><b>${v}</b></div>`;
  const stats = sm ? `<div class="stats">${item(d.usa_sum_count, sm.count)}${item(d.usa_sum_first, esc(sm.first))}${item(d.usa_sum_last, esc(sm.last))}${item(d.usa_sum_price, sm.minPrice && sm.minPrice !== sm.maxPrice ? `${money(sm.minPrice)} – ${money(sm.maxPrice)}` : money(sm.lastPrice))}${sm.maxMiles ? item(d.usa_sum_miles, Number(sm.maxMiles).toLocaleString(loc)) : ''}${item(d.usa_sum_sellers, sm.sellers)}${sm.states.length ? item(d.usa_sum_states, esc(sm.states.slice(0, 6).join(', '))) : ''}</div>` : '';
  const roll = sm?.rollback ? `<div class="notice bad">${ic.warn}<div>${esc(fmt(d.usa_rollback, { from: Number(sm.rollback.from.m).toLocaleString(loc), to: Number(sm.rollback.to.m).toLocaleString(loc), d1: sm.rollback.from.d, d2: sm.rollback.to.d }))}</div></div>` : '';
  const row = (l) => `<tr><td data-l="${esc(d.usa_col_date)}">${esc(l.firstSeen)}</td><td data-l="${esc(d.usa_col_price)}">${money(l.price)}</td><td data-l="${esc(d.usa_col_miles)}">${l.miles ? Number(l.miles).toLocaleString(loc) : '—'}</td><td data-l="${esc(d.usa_col_seller)}">${esc(l.seller || '—')}</td><td data-l="${esc(d.usa_col_state)}">${esc(l.state)}</td><td data-l="${esc(d.usa_col_src)}">${esc(l.source)}</td></tr>`;
  const th = ['usa_col_date', 'usa_col_price', 'usa_col_miles', 'usa_col_seller', 'usa_col_state', 'usa_col_src'].map((k) => `<th scope="col">${esc(d[k])}</th>`).join('');
  const table = (rows) => `<div class="tablewrap" tabindex="0" role="region" aria-label="${esc(d.usa_tbl)}"><table class="tl"><caption class="sr-only">${esc(d.usa_tbl)}</caption><thead><tr>${th}</tr></thead><tbody>${rows.map(row).join('')}</tbody></table></div>`;
  const L = u.listings || [];
  const listHtml = L.length ? `${table(L.slice(0, 5))}${L.length > 5 ? `<details><summary>${esc(fmt(d.usa_more, { n: L.length }))}</summary>${table(L.slice(5))}</details>` : ''}` : '';
  const A = u.auction || [];
  const aucHtml = A.length ? `<h3>${esc(d.usa_auc_h)}</h3><div class="tablewrap" tabindex="0" role="region" aria-label="${esc(d.usa_auc_h)}"><table class="tl"><thead><tr>${['auc_house', 'usa_col_date', 'auc_lot', 'auc_dmg', 'auc_repair', 'auc_bid', 'auc_keys', 'auc_runs', 'auc_photos'].map((k) => `<th scope="col">${esc(d[k])}</th>`).join('')}</tr></thead><tbody>${A.map((x) => `<tr><td data-l="${esc(d.auc_house)}">${esc(x.house)}</td><td data-l="${esc(d.usa_col_date)}">${esc(String(x.date || '').slice(0, 10))}</td><td data-l="${esc(d.auc_lot)}">${esc(x.lot)}</td><td data-l="${esc(d.auc_dmg)}">${esc([x.primaryDamage, x.secondaryDamage].filter(Boolean).join(' / '))}</td><td data-l="${esc(d.auc_repair)}">${money(x.estRepairUsd)}</td><td data-l="${esc(d.auc_bid)}">${money(x.finalBidUsd)}</td><td data-l="${esc(d.auc_keys)}">${x.keys == null ? '—' : esc(x.keys ? d.auc_yes : d.auc_no)}</td><td data-l="${esc(d.auc_runs)}">${x.runsDrives == null ? '—' : esc(x.runsDrives ? d.auc_yes : d.auc_no)}</td><td data-l="${esc(d.auc_photos)}">${esc(x.photos ?? '—')}</td></tr>`).join('')}</tbody></table></div>` : '';
  return `<section class="panel" aria-labelledby="h-usa">${head}${roll}${stats}${listHtml}${aucHtml}<p class="muted sm">${esc(fmt(d.usa_src, { p: (u.providers || []).join(', ') }))}</p></section>`;
}

function insuranceBlock(lang, r) {
  const d = dict(lang); const x = r.insurance;
  if (!x || (x.status === 'unknown' && !x.history)) return '';
  const loc = lang === 'en' ? 'en-US' : 'uk-UA'; const uah = (n) => (n || n === 0 ? `${Number(n).toLocaleString(loc)} ₴` : '');
  const ok = x.status === 'active', known = x.status !== 'unknown';
  const label = ok ? d.ins_active : x.status === 'pending' ? d.ins_pending : d.ins_none;
  const L = x.limits || {};
  const rows = [[d.ins_insurer, x.insurer], [d.ins_period, x.from && x.to ? `${x.from} — ${x.to}` : ''], [d.ins_kind, x.kind], [d.ins_lim_prop, uah(L.property)], [d.ins_lim_life, uah(L.life)], [d.ins_fr, L.franchise ? uah(L.franchise) : '']].filter(([, v]) => v);
  const h = x.history;
  const hist = h && h.policies.length ? `<h3>${esc(d.ins_hist_h)}</h3><div class="stats">${h.bmClass ? `<div><span>${esc(d.ins_bm)}</span><b>${esc(h.bmClass)}${h.bmCoef ? ` · ×${esc(h.bmCoef)}` : ''}</b></div>` : ''}<div><span>${esc(d.ins_pol_n)}</span><b>${h.policies.length}</b></div><div><span>${esc(d.ins_claims)}</span><b>${h.claims}</b></div></div><div class="tablewrap" tabindex="0" role="region" aria-label="${esc(d.ins_hist_h)}"><table class="tl"><thead><tr><th scope="col">${esc(d.tl_date)}</th><th scope="col">${esc(d.ins_insurer)}</th><th scope="col">${esc(d.ins_claims)}</th><th scope="col">${esc(d.ins_paid)}</th></tr></thead><tbody>${h.policies.slice(0, 10).map((p) => `<tr><td data-l="${esc(d.tl_date)}">${esc(p.year)}</td><td data-l="${esc(d.ins_insurer)}">${esc(p.insurer)}</td><td data-l="${esc(d.ins_claims)}">${p.claims}</td><td data-l="${esc(d.ins_paid)}">${esc(uah(p.paid) || '—')}</td></tr>`).join('')}</tbody></table></div>` : h ? `<h3>${esc(d.ins_hist_h)}</h3><p class="muted">${esc(d.ins_hist_none)}</p>` : '';
  return `<section class="panel${x.status === 'none' ? ' alert' : ''}" aria-labelledby="h-ins"><h2 id="h-ins">${esc(d.ins_h)}</h2>${known ? `<p class="${ok ? 'good' : ''}">${ok ? ic.check : ic.warn}<span>${esc(label)}</span></p>` : ''}${rows.length ? `<dl class="spec-grid">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}${hist}<p class="muted sm">${esc(fmt(d.ins_note, { t: String(x.checkedAt || '').slice(0, 10) }))}</p></section>`;
}

// «Згадки в мережі»: найденные поисковиком публикации об этом авто (домен, заголовок, тип, дата), без ссылок и контактов
function mentionsBlock(lang, r) {
  const d = dict(lang); const m = r.mentions;
  if (!m) return '';
  const kinds = ['sale', 'auction', 'accident', 'wanted', 'other'];
  const by = Object.fromEntries(kinds.map((k) => [k, m.items.filter((x) => x.kind === k)]));
  const row = (x) => `<tr><td data-l="${esc(d.mn_site)}">${esc(x.domain)}</td><td data-l="${esc(d.mn_title)}" lang="auto">${esc(x.title)}</td><td data-l="${esc(d.tl_date)}">${esc(x.published || dateOf(new Date(x.found_at).toISOString()))}</td></tr>`;
  const groups = kinds.filter((k) => by[k].length).map((k) => `<h3>${esc(d['mn_' + k])} · ${by[k].length}</h3><div class="tablewrap" tabindex="0" role="region" aria-label="${esc(d['mn_' + k])}"><table class="tl"><thead><tr><th scope="col">${esc(d.mn_site)}</th><th scope="col">${esc(d.mn_title)}</th><th scope="col">${esc(d.tl_date)}</th></tr></thead><tbody>${by[k].slice(0, 8).map(row).join('')}</tbody></table></div>`).join('');
  return `<section class="panel" aria-labelledby="h-mn"><h2 id="h-mn">${esc(d.mn_h)}</h2>${m.items.length ? groups : `<p>${esc(d.mn_none)}</p>`}<p class="muted sm">${esc(d.mn_note)}</p></section>`;
}

// «Паспорт авто»: все известное о машине из реестра, декодера и локальной расшифровки в одной сетке
function passportBlock(lang, r) {
  const d = dict(lang); const x = r.decoded, us = r.ua.summary, v = us?.vehicle || {}, l = r.local;
  const cells = [];
  const add = (k, val) => { if (val !== undefined && val !== null && val !== '' && val !== false) cells.push([k, val]); };
  if (x?.found && x.trusted) {
    add(d.dk_make, en(lang, x.make)); add(d.dk_model, en(lang, x.model)); add(d.dk_year, esc(x.year)); add(d.dk_trim, x.trim && en(lang, x.trim));
    add(d.dk_body, x.body && tv(lang, x.body)); add(d.dk_drive, x.drive && tv(lang, x.drive)); add(d.dk_engine, x.engine && esc(engineText(lang, x.engine)));
    add(d.dk_fuel, x.fuel && tv(lang, x.fuel)); add(d.dk_trans, x.transmission && tv(lang, x.transmission));
    { const kw = x.kw || (x.hp ? Math.round(x.hp * 0.7457) : 0), hp = x.hp || (x.kw ? Math.round(x.kw * 1.341) : 0); add(d.pass_power, hp && esc(`${hp} ${d.u_hp} · ${kw} ${d.u_kw}`)); }
    { const kg = /\(([\d,\s–-]+)\s*kg\)/i.exec(x.gvwr || ''); add(d.pass_gvwr, kg && esc(`${kg[1].trim().replace(/,/g, ' ').replace(/\s*-\s*/g, ' – ')} ${d.u_kg}`)); }
    add(d.dk_plant, x.plant && en(lang, x.plant));
  } else if (v.brand) {
    add(d.dk_make, esc(nice(v.brand))); add(d.dk_model, v.model && esc(nice(v.model))); add(d.dk_year, esc(v.year));
    add(d.dk_body, v.body && esc(rv(lang, v.body))); add(d.dk_fuel, v.fuel && esc(rv(lang, v.fuel))); add(d.dk_engine, v.cap && esc(`${v.cap} ${d.cm3}`));
  } else if (l) {
    add(d.local_make, esc(l.make)); add(d.local_model, l.model && esc(l.model)); add(d.local_year, l.years.length && esc(l.years.join(' / ')));
  } else if (x?.found) {
    add(d.dk_make, x.make && en(lang, x.make)); add(d.dk_plant, x.plant && en(lang, x.plant));
  }
  if (r.fuel) {
    const f = r.fuel, r2 = (a, fn = (z) => z) => (a ? (a[0] === a[1] ? `${fn(a[0])}` : `${fn(a[1])}–${fn(a[0])}`) : '');
    const l = (a) => r2(a, (z) => String(l100(z)).replace('.', lang === 'en' ? '.' : ','));
    const cons = f.comb && !f.electric ? `${l(f.comb)} ${d.u_l100} (${r2(f.comb)} mpg)` : '';
    add(d.pass_cons, cons && esc(cons));
    add(d.pass_co2, f.co2 && !f.electric && f.co2[0] > 0 && esc(`${r2(f.co2, gpkm)} ${d.u_gkm}`));
  }
  if (v.color) add(d.w_color, esc(rv(lang, v.color)));
  if (us) { add(d.ua_imported, us.imported && esc(us.imported.date)); add(d.ua_first, esc(us.first)); add(d.ua_owners, esc(us.owners)); }
  add(d.pass_checks, r.checks >= 2 && esc(fmt(d.pass_checks_v, { n: r.checks })));
  add(d.w_vin, `<span class="mono">${esc(r.vin)}</span>`);
  const mm = r.mismatch.length ? `<div class="notice bad">${ic.warn}<div><b>${esc(d.mm_h)}</b>${r.mismatch.map((m) => `<div>${esc(fmt(d['mm_' + m.field], { vin: m.vin, registry: m.registry }))}</div>`).join('')}</div></div>` : '';
  const note = l ? `<div class="notice info">${esc(d.local_note)}</div>` : x?.found && !x.trusted && !v.brand ? `<div class="notice info">${esc(d.decode_partial)}</div>` : '';
  const empty = cells.length <= 1 ? `<p class="muted">${esc(x?.unavailable ? d.decode_unavail : d.decode_none)}</p>` : '';
  return `<section class="panel" aria-labelledby="h-pass"><h2 id="h-pass">${esc(d.pass_h)}</h2>${mm}${note}<dl class="spec-grid">${cells.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${val}</dd></div>`).join('')}</dl>${empty}</section>`;
}
const grp = (n, id, title) => `<div class="grp" id="${id}"><span class="n" ${A}>${n}</span><span>${esc(title)}</span></div>`;

// ---------- шапка результата ----------
const vehicleTitle = (r, fallback) => {
  const x = r.decoded; const v = r.ua?.summary?.vehicle;
  if (x?.trusted) return `${nice(x.make)} ${nice(x.model)}, ${x.year}`;
  if (v?.brand) return `${brandModel(v.brand, v.model)}${v.year ? ', ' + v.year : ''}`;
  if (r.local) return `${r.local.make}${r.local.model ? ' ' + r.local.model : ''}${r.local.years.length === 1 ? ', ' + r.local.years[0] : ''}`;
  return x?.make ? nice(x.make) : fallback;
};
function photoFigure(lang, r) {
  const ph = r.photo;
  if (!ph && !r.vehicle?.make) return ''; // марка неизвестна: показывать нечего
  return figureHtml(lang, ph, vehicleTitle(r, ''));
}
// фото модели: подпись «иллюстрация модели» и автор/лицензия (требование свободных лицензий), без ссылок наружу
function figureHtml(lang, ph, alt) {
  const d = dict(lang);
  return `<figure class="photo${ph ? '' : ' nophoto'}"><div class="ph">${ph ? `<img src="${esc(ph.url)}" alt="${esc(alt)}" width="960" height="600" decoding="async" fetchpriority="high" referrerpolicy="no-referrer">` : ''}<div class="fallback">${silhouette}</div></div>${ph ? `<figcaption>${esc(d.photo_cap)}${ph.credit ? ` · ${esc(d.photo_by)}: ${esc(ph.credit)}` : ''}</figcaption>` : ''}</figure>`;
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

function plateAddBlock(lang, vin) {
  const d = dict(lang);
  return `<section class="panel" aria-labelledby="h-padd"><h2 id="h-padd">${esc(d.plate_add_h)}</h2><p class="muted">${esc(d.plate_add_p)}</p>
<form class="plateadd" action="/${lang}/check" method="get"><input type="hidden" name="q" value="${esc(vin)}"><label class="sr-only" for="p-add">${esc(d.mode_plate)}</label>
<input id="p-add" name="p" required maxlength="12" placeholder="${esc(d.plate_add_ph)}" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" class="mono"><button class="btn primary" type="submit">${esc(d.plate_add_btn)}</button></form></section>`;
}

function earlyPlateBlock(lang, plate, early, unverified) {
  if (!early?.length) return '';
  const d = dict(lang);
  return `<section class="panel" aria-labelledby="h-early"><h2 id="h-early">${esc(fmt(d.plate_early_h, { plate }))}</h2>${unverified ? `<div class="notice">${esc(d.plate_unverified)}</div>` : `<p class="muted sm">${esc(d.plate_early_note)}</p>`}${early.map((g) => timeline(lang, g.rows, d.plate_h)).join('')}</section>`;
}

export function checkPage(req, lang, r, { full = false, fromPlate = '', early = [], unverified = false } = {}) {
  const d = dict(lang);
  const title = vehicleTitle(r, r.vin);
  const hit = r.wanted.length > 0;
  const cta = paywallOn() ? `${esc(d.unlock)} — ${price(PLANS.single.usd)}` : esc(d.unlock_free);
  const href = `/${lang}/checkout?plan=single&vin=${encodeURIComponent(r.vin)}`;
  const usa = r.usa && (r.usa.queried || r.usa.capped || r.usa.cached) ? usaBlock(lang, r) : '';
  const secs = [['g-pass', d.g_pass], ['g-legal', d.g_legal], ...(usa ? [['g-usa', d.g_usa]] : []), ...(r.mentions ? [['g-web', d.g_web]] : []), ['g-safe', d.g_safe]];
  const G = (id, i) => grp(i + 1, id, secs.find((x) => x[0] === id)[1]);
  const main = full
    ? `${verdictBlock(lang, r)}${G('g-pass', 0)}${passportBlock(lang, r)}${G('g-legal', 1)}${wantedBlock(lang, r)}${insuranceBlock(lang, r)}${uaBlock(lang, r, true)}${earlyPlateBlock(lang, fromPlate, early, unverified)}${!r.ua.rows.length && !fromPlate ? plateAddBlock(lang, r.vin) : ''}${usa ? G('g-usa', secs.findIndex((x) => x[0] === 'g-usa')) + usa : ''}${r.mentions ? G('g-web', secs.findIndex((x) => x[0] === 'g-web')) + mentionsBlock(lang, r) : ''}${G('g-safe', secs.length - 1)}${safetyBlock(lang, r, true)}<p class="muted sm">${esc(d.sources_note)} ${esc(fmt(d.asof_full, { t: r.generatedAt.slice(0, 16).replace('T', ' ') }))}</p>`
    : `${wantedBlock(lang, r)}${conclusionBlock(lang, r)}${riskBlock(lang, r)}${uaBlock(lang, r, false)}${decodeBlock(lang, r)}${safetyBlock(lang, r, false)}`;
  const toc = `<nav class="panel toc noprint" aria-label="${esc(d.toc_h)}"><h2>${esc(d.toc_h)}</h2><ol>${secs.map(([id, tt]) => `<li><a href="#${id}">${esc(tt)}</a></li>`).join('')}</ol></nav>`;
  const aside = full
    ? `${toc}${actionsBlock(lang)}<div class="panel noprint"><h2>${esc(TT[lang].nav)}</h2>${toolCards(lang)}</div>`
    : `<div class="panel paywall"><h2>${paywallOn() ? ic.lock : ''}${esc(d.paid_h)}</h2><ul class="mini"><li>${ic.check}<span>${esc(d.ua_locked)}</span></li><li>${ic.check}<span>${esc(d.go_pdf)}</span></li></ul><a class="btn primary wide" href="${href}">${cta}</a></div>${waitlistBox(lang)}`;
  const sticky = !full && !hit ? `<div class="stickycta" id="sticky" hidden><a class="btn primary" href="${href}">${cta}</a></div>` : '';
  const secnav = full ? `<nav class="secnav noprint" aria-label="${esc(d.toc_h)}"><div class="wrap">${secs.map(([id, tt]) => `<a href="#${id}">${esc(tt.split(' ').slice(0, 2).join(' '))}</a>`).join('')}</div></nav>` : '';
  const body = `${vehicleHero(lang, r, d.res_h, fromPlate)}${tiles(lang, r)}${secnav}<section class="sec" style="padding-top:36px"><div class="wrap two"><div>${main}</div><aside>${aside}</aside></div></section>`;
  return layout(req, lang, { title: `${title} — ${d.res_h} | VINScope`, desc: `${title}: ${d.sub}`, path: '/check', body, noindex: true, sticky, preconnect: r.photo ? 'https://thumb.wikimedia.org' : '' });
}

export function plateReport(req, lang, plate, hist, pcov, wanted, photo = null) {
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
<div class="vehicle${photo ? '' : ' solo'}">${photo ? figureHtml(lang, photo, sub) : ''}<div><p class="eyebrow">${esc(d.plate_h)}</p><h1 class="platebig">${plateEl(plate)}</h1>${sub ? `<p class="plate-sub">${esc(sub)}</p>` : ''}</div></div></div></section>${tilesHtml}
<section class="sec" style="padding-top:36px"><div class="wrap two"><div>${main}</div><aside>${actionsBlock(lang)}${waitlistBox(lang)}</aside></div></section>`;
  return layout(req, lang, { title: `${plate} — ${d.plate_h} | VINScope`, desc: d.plate_h, path: '/check', body, noindex: true });
}

const RDW_T = {
  uk: { h: 'Нідерланди', eyebrow: 'Реєстр Нідерландів', sub: 'Дані реєстру Нідерландів. VIN у них не вказується.', first: 'Перша реєстрація', firstNl: 'Перша реєстрація в Нідерландах', owner: 'Остання зміна власника', apk: 'Техогляд (APK) дійсний до', insured: 'Страхування (WAM)', yes: 'Так', no: 'Ні', exported: 'Позначка «експорт»', recall: 'Відкликання без ремонту', odo: 'Оцінка пробігу', odoOk: 'Логічний', odoBad: 'Нелогічний (можлива скрутка)', price: 'Каталожна ціна', engine: 'Двигун', color: 'Колір', kind: 'Тип', na: 'немає даних', note: 'Реєстр не публікує пробіг — лише висновок про його логічність.', flagExp: 'Авто позначене як експортоване з Нідерландів — перевірте, чи воно ще на нідерландських номерах.', ukNone: 'У реєстрах України за цим номером записів немає.' },
  ru: { h: 'Нидерланды', eyebrow: 'Реестр Нидерландов', sub: 'Данные реестра Нидерландов. VIN в них не указывается.', first: 'Первая регистрация', firstNl: 'Первая регистрация в Нидерландах', owner: 'Последняя смена владельца', apk: 'Техосмотр (APK) действует до', insured: 'Страхование (WAM)', yes: 'Да', no: 'Нет', exported: 'Отметка «экспорт»', recall: 'Отзыв без ремонта', odo: 'Оценка пробега', odoOk: 'Логичный', odoBad: 'Нелогичный (возможна скрутка)', price: 'Каталожная цена', engine: 'Двигатель', color: 'Цвет', kind: 'Тип', na: 'нет данных', note: 'Реестр не публикует пробег — только вывод о его логичности.', flagExp: 'Авто помечено как экспортированное из Нидерландов — проверьте, остаётся ли оно на нидерландских номерах.', ukNone: 'В реестрах Украины по этому номеру записей нет.' },
  en: { h: 'Netherlands', eyebrow: 'Netherlands register', sub: 'Dutch vehicle register data. It does not include the VIN.', first: 'First registration', firstNl: 'First registered in the Netherlands', owner: 'Last owner change', apk: 'MOT (APK) valid until', insured: 'Insurance (WAM)', yes: 'Yes', no: 'No', exported: 'Export flag', recall: 'Unrepaired recall', odo: 'Odometer verdict', odoOk: 'Logical', odoBad: 'Illogical (possible rollback)', price: 'List price', engine: 'Engine', color: 'Colour', kind: 'Type', na: 'no data', note: 'The register does not publish the odometer reading, only a plausibility verdict.', flagExp: 'The car is flagged as exported from the Netherlands. Check whether it still carries Dutch plates.', ukNone: 'No records for this plate in the Ukrainian registers.' },
};
const NLW = {
  uk: { personenauto: 'Легковий автомобіль', bedrijfsauto: 'Комерційний автомобіль', motorfiets: 'Мотоцикл', bromfiets: 'Moped', aanhangwagen: 'Причіп', bus: 'Автобус', zwart: 'Чорний', wit: 'Білий', grijs: 'Сірий', blauw: 'Синій', rood: 'Червоний', groen: 'Зелений', geel: 'Жовтий', bruin: 'Коричневий', oranje: 'Помаранчевий', beige: 'Бежевий', paars: 'Фіолетовий', zilver: 'Сріблястий', benzine: 'Бензин', diesel: 'Дизель', elektriciteit: 'Електро', lpg: 'Газ (LPG)', cng: 'Газ (CNG)', waterstof: 'Водень', hatchback: 'Хетчбек', sedan: 'Седан', stationwagen: 'Універсал', mpv: 'Мінівен', coupe: 'Купе', cabriolet: 'Кабріолет' },
  ru: { personenauto: 'Легковой автомобиль', bedrijfsauto: 'Коммерческий автомобиль', motorfiets: 'Мотоцикл', bromfiets: 'Мопед', aanhangwagen: 'Прицеп', bus: 'Автобус', zwart: 'Чёрный', wit: 'Белый', grijs: 'Серый', blauw: 'Синий', rood: 'Красный', groen: 'Зелёный', geel: 'Жёлтый', bruin: 'Коричневый', oranje: 'Оранжевый', beige: 'Бежевый', paars: 'Фиолетовый', zilver: 'Серебристый', benzine: 'Бензин', diesel: 'Дизель', elektriciteit: 'Электро', lpg: 'Газ (LPG)', cng: 'Газ (CNG)', waterstof: 'Водород', hatchback: 'Хетчбэк', sedan: 'Седан', stationwagen: 'Универсал', mpv: 'Минивэн', coupe: 'Купе', cabriolet: 'Кабриолет' },
  en: { personenauto: 'Passenger car', bedrijfsauto: 'Commercial vehicle', motorfiets: 'Motorcycle', bromfiets: 'Moped', aanhangwagen: 'Trailer', bus: 'Bus', zwart: 'Black', wit: 'White', grijs: 'Grey', blauw: 'Blue', rood: 'Red', groen: 'Green', geel: 'Yellow', bruin: 'Brown', oranje: 'Orange', beige: 'Beige', paars: 'Purple', zilver: 'Silver', benzine: 'Petrol', elektriciteit: 'Electric', waterstof: 'Hydrogen', stationwagen: 'Estate', cabriolet: 'Convertible' },
};
const nlw = (lang, x) => String(x || '').split(' / ').map((w) => NLW[lang][w.toLowerCase()] || nice(w)).join(' / ');
export function rdwReport(req, lang, plate, v, wanted) {
  const d = dict(lang), t = RDW_T[lang];
  const yn = (b) => (b === null ? t.na : b ? t.yes : t.no);
  const title = [v.brand, v.model].filter(Boolean).join(' ') + (v.firstAdmission ? ', ' + v.firstAdmission.slice(0, 4) : '');
  const bad = v.odometerVerdict && v.odometerVerdict !== 'Logisch';
  const rows = [
    [t.first, v.firstAdmission], [t.firstNl, v.firstNl], [t.owner, v.registered], [t.apk, v.apkUntil],
    [t.insured, yn(v.insured)], [t.exported, yn(v.exported)], [t.recall, yn(v.openRecall)],
    [t.odo, v.odometerVerdict ? (bad ? t.odoBad : t.odoOk) + (v.odometerYear ? ` (${v.odometerYear})` : '') : t.na],
    [t.price, v.listPrice ? `€${v.listPrice.toLocaleString('en')}` : ''], [t.kind, nlw(lang, v.kind)], [t.color, nlw(lang, v.color)],
    [t.engine, [nlw(lang, v.fuel), v.cc && `${v.cc} ${d.cm3}`].filter(Boolean).join(' · ')],
    [d.pass_power, v.kw && `${Math.round(v.kw * 1.341)} ${d.u_hp} · ${v.kw} ${d.u_kw}`], [d.pass_mass, v.mass && `${v.mass} ${d.u_kg}`], [d.pass_maxmass, v.maxMass && `${v.maxMass} ${d.u_kg}`],
  ].filter(([, x]) => x);
  const flags = [v.exported && t.flagExp, bad && t.odoBad].filter(Boolean);
  const hit = wanted.length > 0;
  const wantedHtml = hit ? `<section class="panel alert" role="alert"><h2>${ic.warn}${esc(d.wanted_hit)}</h2><p>${tel(d.wanted_hit_p)}</p></section>` : '';
  const main = `${wantedHtml}${flags.length ? `<div class="notice">${flags.map(esc).join('<br>')}</div>` : ''}<section class="panel"><h2>${esc(t.h)}</h2><dl class="spec-grid">${rows.map(([k, x]) => `<div><dt>${esc(k)}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl><p class="muted sm">${esc(t.note)}</p></section>
<div class="notice info">${esc(t.ukNone)} ${esc(t.sub)}</div>${searchForm(lang, '', false, 'b')}`;
  const body = `<section class="hero small result"><div class="wrap"><a class="crumb" href="/${lang}/">${esc(d.back_new)}</a>
<div class="vehicle${v.photo ? '' : ' solo'}">${v.photo ? figureHtml(lang, v.photo, title) : ''}<div><p class="eyebrow">${esc(t.eyebrow)}</p><h1 class="platebig">${plateEl(plate, false, 'NL')}</h1><p class="plate-sub">${esc(title)}</p></div></div></div></section>
<section class="sec" style="padding-top:36px"><div class="wrap two"><div>${main}</div><aside>${actionsBlock(lang)}</aside></div></section>`;
  return layout(req, lang, { title: `${plate} — ${t.h} | VINScope`, desc: t.sub, path: '/check', body, noindex: true });
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
