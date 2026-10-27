// Раздел «Гайды»: список статей и страница статьи. Тексты — в guides.js.
import { layout, esc, abs, searchForm } from './views.js';
import { GG, GUIDES, GUIDE_DATE, GUIDE_TOOL } from './guides.js';
import { TT } from './tools-i18n.js';

const crumbs = (req, lang, items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(req, path) })) });

const card = (lang, slug) => {
  const G = GG[lang]; const a = G.a[slug];
  return `<li><a class="guide" href="/${lang}/guides/${slug}"><b>${esc(a.h)}</b><span>${esc(a.lead)}</span><small>${a.min} ${esc(G.min)}</small></a></li>`;
};
export const guideCards = (lang, skip = '') => `<ul class="guides" role="list">${GUIDES.filter((s) => s !== skip).map((s) => card(lang, s)).join('')}</ul>`;

export const guidesHomeBlock = (lang) => {
  const G = GG[lang];
  return `<section class="sec"><div class="wrap"><h2 class="reveal">${esc(G.hub_h)}</h2><p class="sec-sub">${esc(G.hub_p)}</p>${guideCards(lang)}</div></section>`;
};

export function guidesHub(req, lang) {
  const G = GG[lang];
  const body = `<section class="hero small"><div class="wrap"><p class="eyebrow">VINScope</p><h1>${esc(G.hub_h)}</h1><p class="lead">${esc(G.hub_p)}</p></div></section><section class="sec" style="padding-top:36px"><div class="wrap">${guideCards(lang)}</div></section>`;
  const ld = [crumbs(req, lang, [['VINScope', `/${lang}/`], [G.hub_h, `/${lang}/guides`]]),
    { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: GUIDES.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: G.a[s].h, url: abs(req, `/${lang}/guides/${s}`) })) }];
  return layout(req, lang, { title: G.hub_t, desc: G.hub_p, path: '/guides', body, jsonld: ld });
}

const clip = (s, n = 158) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

export function guidePage(req, lang, slug) {
  const G = GG[lang]; const a = G.a[slug]; const tool = GUIDE_TOOL[slug]; const [th, tp] = TT[lang].t[tool];
  const path = `/guides/${slug}`;
  const body = `<section class="hero small"><div class="wrap narrow"><a class="crumb" href="/${lang}/guides">${esc(G.back)}</a><h1>${esc(a.h)}</h1><p class="lead">${esc(a.lead)}</p><p class="muted sm">${a.min} ${esc(G.min)}</p></div></section>
<section class="sec" style="padding-top:28px"><div class="wrap narrow prose"><article>${a.s.map(([h, p]) => `<h2 class="left">${esc(h)}</h2><p>${esc(p)}</p>`).join('')}</article>
<div class="panel gcta"><h2>${esc(G.cta_h)}</h2><p class="muted">${esc(G.cta_p)}</p>${searchForm(lang, '', false, 'g')}<p class="sm" style="margin-top:14px"><a href="/${lang}/tools/${tool}"><b>${esc(th)}</b></a> — ${esc(tp)}</p></div></div></section>
<section class="sec alt"><div class="wrap"><h2>${esc(G.related)}</h2>${guideCards(lang, slug)}</div></section>`;
  const url = abs(req, `/${lang}${path}`);
  const ld = [crumbs(req, lang, [['VINScope', `/${lang}/`], [G.hub_h, `/${lang}/guides`], [a.h, `/${lang}${path}`]]),
    { '@context': 'https://schema.org', '@type': 'Article', headline: a.h, description: a.lead, inLanguage: lang, datePublished: GUIDE_DATE.published, dateModified: GUIDE_DATE.modified, mainEntityOfPage: url, image: abs(req, `/og-${lang}.png`), author: { '@type': 'Organization', name: 'VINScope', url: abs(req, `/${lang}/`) }, publisher: { '@type': 'Organization', name: 'VINScope', logo: { '@type': 'ImageObject', url: abs(req, '/logo-512.png') } } }];
  return layout(req, lang, { title: `${a.t} | VINScope`, desc: clip(a.lead), path, body, jsonld: ld });
}
