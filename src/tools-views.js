// Страницы раздела «Инструменты». Расчёты идут в браузере (public/tools.js), сервер отдаёт форму, тексты и курс НБУ.
import { layout, esc, abs } from './views.js';
import { TT, TOOLS } from './tools-i18n.js';

const A = 'aria-hidden="true" focusable="false"';
const ICONS = {
  vin: 'M4 6h16v12H4zM8 10h2M8 14h8M13 10h3',
  customs: 'M4 20h16M6 20V9l6-5 6 5v11M10 20v-6h4v6',
  plate: 'M3 8h18v8H3zM6 12h2M10 12h4M16 12h2',
  mileage: 'M12 21a9 9 0 1 1 9-9M12 12l4-4M12 3v2M3 12h2',
  fuel: 'M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M5 21h10M8 7h4M15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3',
  checklist: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
};
const icon = (id, cls = 'ti') => `<svg viewBox="0 0 24 24" class="${cls}" ${A}><path d="${ICONS[id]}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const toolCards = (lang, skip = '') => `<ul class="tools" role="list">${TOOLS.filter((id) => id !== skip).map((id) => {
  const [h, p] = TT[lang].t[id];
  return `<li><a class="tool" href="/${lang}/tools/${id}"><span class="tico">${icon(id)}</span><span><b>${esc(h)}</b><small>${esc(p)}</small></span></a></li>`;
}).join('')}</ul>`;

// «Как обманывают»: схема → как проверить → кнопка на нужный инструмент
export const diffBlock = (lang) => {
  const T = TT[lang];
  return `<section class="sec"><div class="wrap"><h2 class="reveal">${esc(T.scam_h)}</h2><ul class="scams" role="list">${T.scams.map(([h, how, check, href, label]) => `<li class="reveal"><h3>${esc(h)}</h3><p>${esc(how)}</p><p class="scheck"><b>${esc(T.scam_how)}:</b> ${esc(check)}</p><a class="slink" href="/${lang}${href === '/' ? '/#q-a' : href}">${esc(label)} →</a></li>`).join('')}</ul></div></section>`;
};

export const toolsHomeBlock = (lang) => {
  const T = TT[lang];
  return `<section class="sec alt"><div class="wrap"><h2 class="reveal">${esc(T.home_h)}</h2><p class="sec-sub">${esc(T.home_p)}</p>${toolCards(lang)}</div></section>`;
};

const field = (id, label, input) => `<label class="tf" for="${id}"><span>${esc(label)}</span>${input}</label>`;
const num = (id, attrs = '') => `<input id="${id}" name="${id}" type="number" inputmode="decimal" ${attrs}>`;

function toolBody(lang, id, ctx) {
  const T = TT[lang]; const y = new Date().getFullYear();
  if (id === 'vin') {
    return `<form class="tform" data-tool="vin" novalidate>${field('t-vin', T.vin_ph, `<input id="t-vin" name="vin" class="mono" maxlength="17" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="WVWZZZ1KZ6W000000">`)}<button class="btn primary" type="submit">${esc(T.decode)}</button></form><div class="tout" role="status" aria-live="polite"></div>`;
  }
  if (id === 'customs') {
    const f = T.cu_fuels;
    return `<form class="tform grid" data-tool="customs" novalidate>
${field('t-price', T.cu_price, num('t-price', 'min="0" step="100" value="8000"'))}
${field('t-year', T.cu_year, num('t-year', `min="1980" max="${y}" value="${y - 8}"`))}
${field('t-fuel', T.cu_fuel, `<select id="t-fuel" name="fuel">${Object.entries(f).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>`)}
${field('t-cc', T.cu_cc, num('t-cc', 'min="0" step="100" value="1600"'))}
${field('t-kwh', T.cu_kwh, num('t-kwh', 'min="0" step="1" value="60"'))}
<label class="tcheck"><input type="checkbox" id="t-eu" name="eu"><span>${esc(T.cu_eu)}</span></label>
<button class="btn primary" type="submit">${esc(T.calc)}</button></form><div class="tout" role="status" aria-live="polite"></div>
<p class="muted sm">${esc(ctx.rate ? T.cu_rate.replace('{r}', ctx.rate.rate.toFixed(2)).replace('{d}', ctx.rate.date) : T.cu_rate_na)}</p><p class="muted sm">${esc(T.cu_note)}</p><p class="muted sm">${esc(T.est)}</p>`;
  }
  if (id === 'plate') {
    return `<form class="tform" data-tool="plate" novalidate>${field('t-plate', T.pl_ph, `<input id="t-plate" name="plate" class="mono" maxlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="AA1234BB">`)}<button class="btn primary" type="submit">${esc(T.decode)}</button></form><div class="tout" role="status" aria-live="polite"></div><p class="muted sm">${esc(T.pl_note)}</p>`;
  }
  if (id === 'mileage') {
    return `<form class="tform grid" data-tool="mileage" novalidate>${field('t-myear', T.mi_year, num('t-myear', `min="1980" max="${y}" value="${y - 10}"`))}${field('t-km', T.mi_km, num('t-km', 'min="0" step="1000" value="180000"'))}<button class="btn primary" type="submit">${esc(T.calc)}</button></form><div class="tout" role="status" aria-live="polite"></div><p class="muted sm">${esc(T.mi_norm)}</p>`;
  }
  if (id === 'fuel') {
    return `<form class="tform grid" data-tool="fuel" novalidate>${field('t-cons', T.fu_cons, num('t-cons', 'min="0" step="0.1" value="7.5"'))}${field('t-dist', T.fu_km, num('t-dist', 'min="0" step="100" value="1500"'))}${field('t-fprice', T.fu_price, num('t-fprice', 'min="0" step="0.1" value="58"'))}<button class="btn primary" type="submit">${esc(T.calc)}</button></form><div class="tout" role="status" aria-live="polite"></div>`;
  }
  // checklist
  let n = 0;
  const groups = T.ck.map(([h, items]) => `<fieldset class="ckg"><legend>${esc(h)}</legend>${items.map((x) => `<label class="ck"><input type="checkbox" data-ck="${n++}"><span>${esc(x)}</span></label>`).join('')}</fieldset>`).join('');
  return `<div class="ckbar" role="status" aria-live="polite"><div class="ckprog"><i></i></div><b class="ckn"></b><button class="btn ghost sm-btn" type="button" data-ck-reset>${esc(T.ck_reset)}</button></div><div class="cklist" data-tool="checklist" data-total="${n}">${groups}</div><p class="muted sm">${esc(T.ck_note)}</p>`;
}

export function toolsHub(req, lang) {
  const T = TT[lang];
  const body = `<section class="hero small"><div class="wrap"><p class="eyebrow">VINScope</p><h1>${esc(T.hub_h)}</h1><p class="lead">${esc(T.hub_p)}</p></div></section><section class="sec" style="padding-top:36px"><div class="wrap">${toolCards(lang)}</div></section>${diffBlock(lang)}`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'VINScope', item: abs(req, '/' + lang + '/') }, { '@type': 'ListItem', position: 2, name: T.hub_h, item: abs(req, '/' + lang + '/tools') }] },
    { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: TOOLS.map((id, i) => ({ '@type': 'ListItem', position: i + 1, name: T.t[id][0], url: abs(req, `/${lang}/tools/${id}`) })) }];
  return layout(req, lang, { title: T.hub_t, desc: T.hub_p, path: '/tools', body, jsonld: ld });
}

export function toolPage(req, lang, id, ctx = {}) {
  const T = TT[lang]; const [h, p] = T.t[id];
  // данные для браузерного скрипта: тексты и курс; JSON внутри <script type=application/json> не исполняется
  const data = { lang, id, rate: ctx.rate || null, T: { ...T, diff: undefined, ck: undefined, home_h: undefined, home_p: undefined } };
  const body = `<section class="hero small"><div class="wrap"><a class="crumb" href="/${lang}/tools">${esc(T.back)}</a><div class="toolhead"><span class="tico big">${icon(id)}</span><div><h1>${esc(h)}</h1><p class="lead">${esc(p)}</p></div></div></div></section>
<section class="sec" style="padding-top:32px"><div class="wrap two"><div><div class="panel tool-panel">${id === 'checklist' ? '' : `<noscript><div class="notice">${esc(T.nojs)}</div></noscript>`}${toolBody(lang, id, ctx)}</div></div><aside><div class="panel"><h2>${esc(T.nav)}</h2>${toolCards(lang, id)}</div></aside></div></section>
<script type="application/json" id="tool-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script><script src="/tools.js?v=1" defer></script>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'VINScope', item: abs(req, '/' + lang + '/') }, { '@type': 'ListItem', position: 2, name: T.hub_h, item: abs(req, '/' + lang + '/tools') }, { '@type': 'ListItem', position: 3, name: h, item: abs(req, `/${lang}/tools/${id}`) }] },
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: h, description: p, url: abs(req, `/${lang}/tools/${id}`), applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', inLanguage: lang, isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'UAH' } }];
  return layout(req, lang, { title: `${h} | VINScope`, desc: p, path: `/tools/${id}`, body, jsonld: ld });
}
