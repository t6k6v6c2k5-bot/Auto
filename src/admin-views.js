// Админка: обзор, трафик, проверки, заказы, система. Только чтение + форма платного отчёта.
// Страницы рендерятся на сервере, графики — inline SVG (скрипты не нужны, CSP их не пропустил бы).
import { statSync } from 'node:fs';
import { cfg, price } from './config.js';
import { esc } from './views.js';
import * as A from './analytics.js';

const nf = (n) => Number(n || 0).toLocaleString('uk-UA');
const TABS = [['overview', 'Обзор'], ['traffic', 'Трафик'], ['checks', 'Проверки'], ['orders', 'Заказы и лиды'], ['system', 'Система']];
const DEV = { mobile: 'Телефон', desktop: 'Компьютер', tablet: 'Планшет', bot: 'Боты' };
const LANG = { uk: 'Українська', ru: 'Русский', en: 'English' };
const NOTE = { vin: 'Проверка по VIN', plate: 'По номеру (найден)', 'plate-nl': 'По номеру (Нидерланды)', 'plate-nf': 'Номер не найден', invalid: 'Неверный ввод', limited: 'Лимит запросов' };

const css = `
:root{--bg:#f4f6fa;--card:#fff;--ink:#0e1a2b;--mut:#64748b;--line:#e3e8ef;--blue:#2563eb;--org:#f59e0b;--good:#16a34a;--bad:#dc2626;--side:#0a1628}
@media(prefers-color-scheme:dark){:root{--bg:#0b1220;--card:#121c2e;--ink:#e6edf7;--mut:#8da0ba;--line:#22304a;--blue:#60a5fa;--org:#fbbf24;--good:#4ade80;--bad:#f87171;--side:#060d1a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}
.shell{display:grid;grid-template-columns:220px 1fr;min-height:100vh}
aside{background:var(--side);color:#cbd5e1;padding:20px 14px;position:sticky;top:0;height:100vh}
aside b{display:block;color:#fff;font-size:18px;margin:0 8px 18px}aside small{display:block;margin:18px 8px 0;color:#7b8aa3;font-size:12px}
aside a{display:block;padding:9px 12px;border-radius:9px;color:#cbd5e1;margin-bottom:2px}aside a:hover{background:#ffffff14;text-decoration:none}aside a.on{background:#2563eb;color:#fff}
main{padding:24px;max-width:1180px;width:100%}
h1{margin:0 0 4px;font-size:24px}h2{font-size:16px;margin:0 0 12px}.sub{color:var(--mut);margin:0 0 20px}
.grid{display:grid;gap:14px}.k4{grid-template-columns:repeat(4,minmax(0,1fr))}.k3{grid-template-columns:repeat(3,minmax(0,1fr))}.k2{grid-template-columns:repeat(2,minmax(0,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;min-width:0}
.kpi .l{color:var(--mut);font-size:13px}.kpi .v{font-size:28px;font-weight:700;line-height:1.2;margin:2px 0}.kpi .s{font-size:13px;color:var(--mut)}.up{color:var(--good)}.dn{color:var(--bad)}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--mut);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.03em}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px}.scroll{overflow-x:auto}
.pill{display:inline-block;padding:1px 9px;border-radius:99px;font-size:12px;font-weight:600;background:var(--line)}.pill.ok{background:#16a34a22;color:var(--good)}.pill.bad{background:#dc262622;color:var(--bad)}.pill.warn{background:#f59e0b26;color:var(--org)}
.alert{padding:10px 14px;border-radius:10px;margin-bottom:8px;border:1px solid var(--line);background:var(--card)}.alert.bad{border-color:var(--bad)}.alert.warn{border-color:var(--org)}.alert.ok{border-color:var(--good)}
.bar{height:8px;border-radius:5px;background:var(--line);overflow:hidden}.bar i{display:block;height:100%;background:var(--blue)}
.seg{display:flex;gap:6px;margin:0 0 16px}.seg a{padding:5px 12px;border:1px solid var(--line);border-radius:99px;color:var(--ink);background:var(--card)}.seg a.on{background:var(--blue);border-color:var(--blue);color:#fff}
form.inline{display:flex;gap:8px;flex-wrap:wrap}input{font:16px ui-monospace,monospace;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--ink)}button,.btn{font:inherit;padding:8px 14px;border:0;border-radius:9px;background:var(--blue);color:#fff;cursor:pointer}
.legend{display:flex;gap:14px;font-size:13px;color:var(--mut);margin-bottom:6px}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}
svg.chart{width:100%;height:auto;display:block}.chart text{fill:var(--mut);font-size:10px}
@media(max-width:900px){.shell{grid-template-columns:1fr}aside{position:static;height:auto;display:flex;gap:6px;overflow-x:auto;padding:10px}aside b,aside small{display:none}aside a{white-space:nowrap;margin:0}.k4{grid-template-columns:repeat(2,minmax(0,1fr))}.k3,.k2{grid-template-columns:1fr}main{padding:14px}}
`;

const kpi = (l, v, s = '') => `<div class="card kpi"><div class="l">${esc(l)}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
const delta = (cur, prev) => (prev ? `<span class="${cur >= prev ? 'up' : 'dn'}">${cur >= prev ? '▲' : '▼'} ${Math.abs(Math.round(((cur - prev) / prev) * 100))}%</span> к прошлому периоду` : 'нет данных для сравнения');
const sum = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0);
const table = (head, rows, empty = 'Пока нет данных') => `<div class="scroll"><table><tr>${head.map((h) => `<th${h.startsWith('#') ? ' class="n"' : ''}>${esc(h.replace(/^#/, ''))}</th>`).join('')}</tr>${rows.length ? rows.join('') : `<tr><td colspan="${head.length}" style="color:var(--mut)">${esc(empty)}</td></tr>`}</table></div>`;

// столбики по дням (до двух рядов)
function bars(days, series) {
  const W = 640, H = 170, padL = 30, padB = 22, n = days.length;
  const max = Math.max(1, ...series.flatMap((s) => days.map((d) => d[s.key] || 0)));
  const bw = (W - padL) / n, g = Math.min(14, bw * 0.8) / series.length;
  const y = (v) => H - padB - (v / max) * (H - padB - 8);
  const rects = days.map((d, i) => series.map((s, j) => { const v = d[s.key] || 0; const x = padL + i * bw + (bw - g * series.length) / 2 + j * g; return `<rect x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${Math.max(1, g - 1).toFixed(1)}" height="${Math.max(0, H - padB - y(v)).toFixed(1)}" rx="2" fill="${s.color}"><title>${esc(d.day)}: ${esc(s.name)} ${v}</title></rect>`; }).join('')).join('');
  const step = Math.ceil(n / 8);
  const labels = days.map((d, i) => (i % step === 0 ? `<text x="${(padL + i * bw + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(d.day.slice(5))}</text>` : '')).join('');
  const grid = [0, 0.5, 1].map((f) => `<line x1="${padL}" x2="${W}" y1="${y(max * f).toFixed(1)}" y2="${y(max * f).toFixed(1)}" stroke="var(--line)"/><text x="${padL - 4}" y="${(y(max * f) + 3).toFixed(1)}" text-anchor="end">${Math.round(max * f)}</text>`).join('');
  return `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="График по дням">${grid}${rects}${labels}</svg>`;
}
function hoursChart(rows) {
  const by = new Map(rows.map((r) => [r.hour, r.c]));
  const data = Array.from({ length: 24 }, (_, h) => ({ day: String(h).padStart(2, '0') + ':00', v: by.get(h) || 0 }));
  return bars(data.map((d) => ({ day: d.day, v: d.v })), [{ key: 'v', name: 'Просмотры по часам (Киев)', color: 'var(--blue)' }]);
}
const share = (rows, total, label) => rows.map((r) => `<tr><td>${esc(label(r))}</td><td class="n">${nf(r.c)}</td><td style="width:38%"><div class="bar"><i style="width:${total ? Math.round((r.c / total) * 100) : 0}%"></i></div></td></tr>`);

function alerts(ctx, d7) {
  const out = []; const push = (lvl, t) => out.push(`<div class="alert ${lvl}">${t}</div>`);
  if (!ctx.cov.ready) push('warn', 'Реестр МВС ещё загружается или не готов — проверки по VIN работают с неполными данными.');
  if (ctx.regStatus.lastError) push('bad', `Ошибка загрузчика реестра: ${esc(String(ctx.regStatus.lastError).slice(0, 160))}`);
  if (ctx.wanted.error) push('bad', `Ошибка обновления базы розыска: ${esc(String(ctx.wanted.error).slice(0, 160))}`);
  else if (ctx.wanted.updatedAt && Date.now() - Date.parse(ctx.wanted.updatedAt) > 14 * 3600e3) push('warn', `База розыска не обновлялась больше 14 часов (последний раз ${esc(A.fmtTs(Date.parse(ctx.wanted.updatedAt)))}).`);
  const err = sum(d7.slice(-1), 'errors'); if (err) push('bad', `Ошибки сервера сегодня: ${err}. Подробности во вкладке «Трафик».`);
  const miss = [['SUPPORT_EMAIL', cfg.supportEmail], ['OPERATOR_NAME', cfg.operatorName], ['OPERATOR_DETAILS', cfg.operatorDetails]].filter(([, v]) => !v).map(([k]) => k);
  if (miss.length) push('warn', `Не заданы контакты оператора для оферты: ${miss.join(', ')}.`);
  const dbi = A.dbInfo(); if (cfg.apibaraKey && dbi.usaMonth >= 80) push('warn', `Лимит аукционных запросов за 30 дней: использовано ${dbi.usaMonth} из 100 бесплатных.`);
  if (!ctx.paywall) push('ok', 'Платная оплата выключена: полный отчёт открыт бесплатно (платные поставщики не вызываются).');
  if (!out.length) push('ok', 'Критичных проблем не найдено.');
  return out.join('');
}

function overview(ctx) {
  const d30 = A.daily(30), d7 = d30.slice(-7), p7 = d30.slice(-14, -7);
  const today = d30[29], yest = d30[28];
  const k7 = sum(d7, 'checkers'), v7 = sum(d7, 'visitors'), pv7 = sum(p7, 'visitors'), c7 = sum(d7, 'checks'), pc7 = sum(p7, 'checks');
  const o = ctx.stats;
  const top = A.breakdown(7);
  return `<h1>Обзор</h1><p class="sub">Время — Киев. «Посетители» считаются по дням без хранения личных данных.</p>
${alerts(ctx, d30)}
<div class="grid k4" style="margin:14px 0">${kpi('Посетители сегодня', nf(today.visitors), `вчера: ${nf(yest.visitors)}`)}${kpi('Посетители, 7 дней', nf(v7), delta(v7, pv7))}${kpi('Проверки, 7 дней', nf(c7), delta(c7, pc7))}${kpi('Конверсия в проверку', v7 ? Math.min(100, Math.round((k7 / v7) * 100)) + '%' : '—', 'посетители, сделавшие проверку, 7 дней')}</div>
<div class="grid k4" style="margin-bottom:14px">${kpi('Просмотры, 7 дней', nf(sum(d7, 'views')), `за 30 дней: ${nf(sum(d30, 'views'))}`)}${kpi('Заказы оплачено', nf(o.paid.c), `выручка: ${price(o.paid.s)}`)}${kpi('Лист ожидания', nf(o.waitlist), 'email-подписчики')}${kpi('База', `${nf(ctx.wanted.count)}`, `в розыске · реестр: ${nf(ctx.cov.records)} записей`)}</div>
<div class="card" style="margin-bottom:14px"><h2>Посетители и проверки, 30 дней</h2>${bars(d30, [{ key: 'visitors', name: 'Посетители', color: 'var(--blue)' }, { key: 'checks', name: 'Проверки', color: 'var(--org)' }])}</div>
<div class="grid k2"><div class="card"><h2>Популярные страницы (7 дней)</h2>${table(['Страница', '#Просмотры', '#Посетители'], top.pages.slice(0, 8).map((r) => `<tr><td class="mono">${esc(r.path)}</td><td class="n">${nf(r.c)}</td><td class="n">${nf(r.u)}</td></tr>`))}</div>
<div class="card"><h2>Откуда приходят (7 дней)</h2>${table(['Источник', '#Просмотры', '#Посетители'], top.refs.slice(0, 8).map((r) => `<tr><td>${esc(r.ref)}</td><td class="n">${nf(r.c)}</td><td class="n">${nf(r.u)}</td></tr>`))}</div></div>`;
}

function traffic(ctx, n) {
  const d = A.daily(n), b = A.breakdown(n);
  const human = sum(d, 'views');
  const seg = [1, 7, 30].map((x) => `<a href="?tab=traffic&d=${x}" class="${x === n ? 'on' : ''}">${x === 1 ? 'Сегодня' : x + ' дней'}</a>`).join('');
  const devTotal = b.devs.reduce((s, r) => s + r.c, 0), langTotal = b.langs.reduce((s, r) => s + r.c, 0);
  return `<h1>Трафик</h1><p class="sub">Боты (поисковые роботы, мониторинги, превью ссылок) считаются отдельно и не входят в посетителей.</p><div class="seg">${seg}</div>
<div class="grid k4" style="margin-bottom:14px">${kpi('Посетители', nf(sum(d, 'visitors')), 'сумма уникальных по дням')}${kpi('Просмотры', nf(human), '')}${kpi('Проверки', nf(sum(d, 'checks')), '')}${kpi('Запросы ботов', nf(sum(d, 'bots')), `ошибок сервера: ${nf(sum(d, 'errors'))}`)}</div>
<div class="card" style="margin-bottom:14px"><h2>По дням</h2>${bars(d, [{ key: 'visitors', name: 'Посетители', color: 'var(--blue)' }, { key: 'checks', name: 'Проверки', color: 'var(--org)' }, { key: 'bots', name: 'Боты', color: '#94a3b8' }])}</div>
<div class="grid k2"><div class="card"><h2>Страницы</h2>${table(['Страница', '#Просм.', '#Посет.', '#Среднее, мс'], b.pages.map((r) => `<tr><td class="mono">${esc(r.path)}</td><td class="n">${nf(r.c)}</td><td class="n">${nf(r.u)}</td><td class="n">${nf(r.avg)}</td></tr>`))}</div>
<div class="card"><h2>Источники</h2>${table(['Источник', '#Просм.', '#Посет.'], b.refs.map((r) => `<tr><td>${esc(r.ref)}</td><td class="n">${nf(r.c)}</td><td class="n">${nf(r.u)}</td></tr>`))}</div></div>
<div class="grid k3" style="margin-top:14px"><div class="card"><h2>Устройства</h2>${table(['Тип', '#Запросы', ''], share(b.devs, devTotal, (r) => DEV[r.dev] || r.dev))}</div>
<div class="card"><h2>Языки</h2>${table(['Язык', '#Просм.', ''], share(b.langs, langTotal, (r) => LANG[r.lang] || r.lang))}</div>
<div class="card"><h2>Медленные страницы</h2>${table(['Страница', '#p50', '#p95, мс'], b.slow.map((r) => `<tr><td class="mono">${esc(r.path)}</td><td class="n">${nf(r.p50)}</td><td class="n">${nf(r.p95)}</td></tr>`), 'Недостаточно данных (нужно ≥5 просмотров)')}</div></div>
<div class="grid k2" style="margin-top:14px"><div class="card"><h2>Кто заходит (по клиентам)</h2>${table(['Клиент', 'Тип', '#Запросы'], b.agents.map((r) => `<tr><td>${esc(r.agent)}</td><td>${esc(DEV[r.dev] || r.dev)}</td><td class="n">${nf(r.c)}</td></tr>`))}<p class="sub" style="margin:10px 0 0">Если большую часть дают «Боты» или один клиент — реальных людей меньше, чем кажется.</p></div>
<div class="card"><h2>Самые активные посетители за день</h2>${table(['Хеш', 'Дата', 'Клиент', '#Просмотров'], b.heavy.map((r) => `<tr><td class="mono">${esc(r.id)}</td><td>${esc(r.day)}</td><td>${esc(r.agent)}</td><td class="n">${nf(r.c)}</td></tr>`))}<p class="sub" style="margin:10px 0 0">Один «посетитель» с десятками просмотров — это обычно скрипт, а не человек.</p></div></div>
<div class="card" style="margin-top:14px"><h2>Активность по часам</h2>${hoursChart(b.hours)}</div>
<div class="grid k2" style="margin-top:14px"><div class="card"><h2>Битые ссылки (404) — люди</h2>${table(['Адрес', '#Раз'], b.notfound.map((r) => `<tr><td class="mono">${esc(r.path)}</td><td class="n">${nf(r.c)}</td></tr>`), 'Битых ссылок нет')}${b.botfound.length ? `<p class="sub" style="margin:10px 0 4px">Боты и сканеры: ${b.botfound.map((r) => `<span class="mono">${esc(r.path)}</span> (${r.c})`).join(', ')}</p>` : ''}</div>
<div class="card"><h2>Ошибки сервера (5xx)</h2>${table(['Когда', 'Адрес', 'Сообщение'], b.errors.map((r) => `<tr><td>${esc(A.fmtTs(r.ts))}</td><td class="mono">${esc(r.path)}</td><td>${esc(r.note || '')}</td></tr>`), 'Ошибок нет')}</div></div>`;
}

function checks(ctx, n) {
  const seg = [7, 30, 60].map((x) => `<a href="?tab=checks&d=${x}" class="${x === n ? 'on' : ''}">${x} дней</a>`).join('');
  const d = A.daily(n), out = A.checkOutcomes(n), tot = out.reduce((s, r) => s + r.c, 0);
  const rec = A.recentSearches(60), top = A.topSearches(n);
  const langs = A.searchesByLang(n), lt = langs.reduce((s, r) => s + r.c, 0);
  const ok = out.filter((r) => ['vin', 'plate', 'plate-nl'].includes(r.note)).reduce((s, r) => s + r.c, 0);
  return `<h1>Проверки</h1><p class="sub">Что ищут пользователи. Повторы одного VIN в течение 10 минут считаются одной проверкой. Записи старше 90 дней удаляются автоматически.</p><div class="seg">${seg}</div>
<div class="grid k4" style="margin-bottom:14px">${kpi('Проверок', nf(sum(d, 'checks')), `за ${n} дней`)}${kpi('Успешных', tot ? Math.round((ok / tot) * 100) + '%' : '—', 'найдено по VIN или номеру')}${kpi('Номер не найден', nf((out.find((r) => r.note === 'plate-nf') || {}).c || 0), 'кандидаты на расширение базы')}${kpi('Неверный ввод', nf((out.find((r) => r.note === 'invalid') || {}).c || 0), 'ошибки в VIN/номере')}</div>
<div class="card" style="margin-bottom:14px"><h2>Проверки по дням</h2>${bars(d, [{ key: 'checks', name: 'Проверки', color: 'var(--org)' }])}</div>
<div class="grid k3"><div class="card"><h2>Результаты</h2>${table(['Итог', '#Раз', ''], share(out, tot, (r) => NOTE[r.note] || r.note))}</div>
<div class="card"><h2>Языки запросов</h2>${table(['Язык', '#Раз', ''], share(langs, lt, (r) => LANG[r.lang] || r.lang))}</div>
<div class="card"><h2>Повторные запросы</h2>${table(['VIN / номер', '#Раз'], top.map((r) => `<tr><td class="mono"><a href="/uk/check?q=${encodeURIComponent(r.vin)}" rel="noreferrer">${esc(r.vin)}</a></td><td class="n">${r.c}</td></tr>`), 'Повторов нет')}</div></div>
<div class="card" style="margin-top:14px"><h2>Последние запросы</h2>${table(['Время (Киев)', 'VIN / номер', 'Язык'], rec.map((r) => `<tr><td>${esc(A.fmtTs(r.created_at))}</td><td class="mono"><a href="/${esc(r.lang)}/check?q=${encodeURIComponent(r.vin)}" rel="noreferrer">${esc(r.vin)}</a></td><td>${esc((r.lang || '').toUpperCase())}</td></tr>`))}</div>`;
}

function orders(ctx) {
  const o = ctx.stats, rows = A.ordersAll(100), cr = A.creditsSummary(), wl = A.waitlistAll(200);
  const stat = { paid: 'ok', credit: 'ok', pending: 'warn', refunded: 'bad', failed: 'bad' };
  return `<h1>Заказы и лиды</h1><p class="sub">Платная оплата: ${ctx.paywall ? `<b>включена</b> (${esc(ctx.provider)})` : '<b>выключена</b>'}. Цена полного отчёта: ${price(9900)}.</p>
<div class="grid k4" style="margin-bottom:14px">${kpi('Оплачено заказов', nf(o.paid.c), '')}${kpi('Выручка', price(o.paid.s), '')}${kpi('Кредиты', nf(cr.n), `осталось проверок: ${nf(cr.rem)}`)}${kpi('Лист ожидания', nf(o.waitlist), `последние ${wl.length} ниже`)}</div>
<div class="card" style="margin-bottom:14px"><h2>Статусы заказов</h2><p>${o.byStatus.length ? o.byStatus.map((x) => `<span class="pill ${stat[x.status] || ''}">${esc(x.status)}: ${x.c}</span>`).join(' ') : '<span style="color:var(--mut)">Заказов пока нет</span>'}</p></div>
<div class="card" style="margin-bottom:14px"><h2>Последние заказы</h2>${table(['Создан', 'ID', 'VIN', 'Тариф', 'Статус', '#Сумма', 'Email'], rows.map((r) => `<tr><td>${esc(A.fmtTs(r.created_at))}</td><td class="mono">${esc(r.id)}</td><td class="mono">${esc(r.vin)}</td><td>${esc(r.plan)}</td><td><span class="pill ${stat[r.status] || ''}">${esc(r.status)}</span></td><td class="n">${price(r.amount)}</td><td>${esc(r.email || '')}</td></tr>`), 'Заказов пока нет')}</div>
<div class="card"><h2>Лист ожидания <a class="btn" style="float:right;font-size:13px;padding:4px 10px" href="/admin/waitlist.csv">Скачать CSV</a></h2>${table(['Дата', 'Email', 'Язык', 'Метка'], wl.slice(0, 100).map((r) => `<tr><td>${esc(A.fmtTs(r.created_at))}</td><td>${esc(r.email)}</td><td>${esc(r.lang || '')}</td><td>${esc(r.utm || '')}</td></tr>`), 'Подписчиков пока нет')}</div>`;
}

function system(ctx) {
  const dbi = A.dbInfo(), m = process.memoryUsage();
  const size = (p) => { try { return (statSync(p).size / 1048576).toFixed(1) + ' МБ'; } catch { return '—'; } };
  const up = process.uptime(), upS = up > 86400 ? `${Math.floor(up / 86400)} д ${Math.floor((up % 86400) / 3600)} ч` : up > 3600 ? `${Math.floor(up / 3600)} ч ${Math.floor((up % 3600) / 60)} мин` : `${Math.floor(up / 60)} мин`;
  const flag = (set, onText = 'задан', offText = 'не задан', offCls = 'warn') => `<span class="pill ${set ? 'ok' : offCls}">${set ? onText : offText}</span>`;
  const conf = [
    ['BASE_URL', flag(cfg.baseUrl, esc(cfg.baseUrl)), 'Адрес сайта для ссылок и sitemap'],
    ['ADMIN_KEY', flag(cfg.adminKey.length >= 16, 'надёжный', 'короткий', 'bad'), 'Пароль админки (≥16 символов)'],
    ['APIBARA_API_KEY', flag(cfg.apibaraKey), 'Аукционы США (платные запросы только в оплаченном отчёте)'],
    ['MARKETCHECK_API_KEY', flag(cfg.marketcheckKey), 'Рыночные цены США'],
    ['SEARCH_API_KEY', flag(cfg.searchKey), 'Поиск упоминаний авто'],
    ['MTSBU_TOKEN / INSURANCE_API_KEY', flag(cfg.mtsbuToken || cfg.insuranceKey), 'Проверка страховки'],
    ['MONO_TOKEN', flag(cfg.monoToken, 'задан (оплата включена)', 'пусто — оплата выключена', ''), 'Monobank Acquiring'],
    ['LEMON_* / STRIPE_*', flag(cfg.lemonKey || cfg.stripeKey), 'Запасные платёжные системы'],
    ['SUPPORT_EMAIL', flag(cfg.supportEmail), 'Контакт для оферты'],
    ['OPERATOR_NAME / OPERATOR_DETAILS', flag(cfg.operatorName && cfg.operatorDetails), 'Реквизиты оператора для оферты'],
    ['PLAUSIBLE_DOMAIN', flag(cfg.plausible, 'задан', 'не задан', ''), 'Внешняя аналитика (необязательно)'],
  ];
  return `<h1>Система</h1><p class="sub">Состояние сервера, данных и настроек. Значения ключей не показываются.</p>
<div class="grid k4" style="margin-bottom:14px">${kpi('Аптайм', esc(upS), 'с последнего деплоя')}${kpi('Память', Math.round(m.rss / 1048576) + ' МБ', `heap: ${Math.round(m.heapUsed / 1048576)} МБ`)}${kpi('Node.js', esc(process.version), '')}${kpi('База данных', size(cfg.dbPath), `реестр: ${size(cfg.registryDbPath)}`)}</div>
<div class="grid k2" style="margin-bottom:14px"><div class="card"><h2>Данные</h2>${table(['Источник', 'Состояние'], [
    `<tr><td>База розыска</td><td>${nf(ctx.wanted.count)} записей · обновлено ${esc(ctx.wanted.updatedAt ? A.fmtTs(Date.parse(ctx.wanted.updatedAt)) : '—')} ${ctx.wanted.error ? '<span class="pill bad">ошибка</span>' : '<span class="pill ok">ок</span>'}</td></tr>`,
    `<tr><td>Реестр ТЗ (с VIN)</td><td>${nf(ctx.cov.records)} записей${ctx.cov.from ? ` · ${esc(ctx.cov.from)}–${esc(ctx.cov.to)}` : ''} ${ctx.cov.ready ? '<span class="pill ok">готов</span>' : '<span class="pill warn">грузится</span>'}</td></tr>`,
    `<tr><td>Загрузчик реестра</td><td>${ctx.regStatus.running ? 'работает: ' + esc(ctx.regStatus.current || '') : 'простаивает'}${ctx.regStatus.lastFinished ? ' · завершён ' + esc(A.fmtTs(Date.parse(ctx.regStatus.lastFinished) || ctx.regStatus.lastFinished)) : ''}</td></tr>`,
    `<tr><td>Кэш аукционов США</td><td>${nf(dbi.usa)} записей · запросов за 30 дней: ${nf(dbi.usaMonth)}${cfg.apibaraKey ? ' из 100' : ''}</td></tr>`,
    `<tr><td>Кэш фото</td><td>найдено ${nf(dbi.photos.f || 0)} · не найдено ${nf(dbi.photos.m || 0)}</td></tr>`,
    `<tr><td>Упоминания</td><td>${nf(dbi.mentions)}</td></tr>`])}</div>
<div class="card"><h2>Объём хранилища</h2>${table(['Таблица', '#Строк'], [['Посещения (60 дней)', dbi.hits], ['Запросы проверок (90 дней)', dbi.searches], ['Заказы', dbi.orders], ['Лист ожидания', dbi.waitlist]].map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${nf(v)}</td></tr>`))}<p class="sub" style="margin-top:10px">IP-адреса не сохраняются.</p></div></div>
<div class="card" style="margin-bottom:14px"><h2>Настройки</h2>${table(['Переменная', 'Статус', 'Назначение'], conf.map(([k, s, d]) => `<tr><td class="mono">${esc(k)}</td><td>${s}</td><td>${esc(d)}</td></tr>`))}</div>
<div class="card" style="margin-bottom:14px"><h2>Сброс статистики</h2><p class="sub">Удаляет только счётчики. Заказы, лист ожидания и кэши не затрагиваются. Действие необратимо.</p><div class="grid k2">${[['searches', 'Обнулить запросы проверок', dbi.searches], ['hits', 'Обнулить посещения и трафик', dbi.hits]].map(([w, l, n]) => `<form class="inline" action="/admin/reset" method="post"><input type="hidden" name="what" value="${w}"><label><input type="checkbox" name="confirm" value="yes" required style="width:auto"> Подтверждаю (${nf(n)} записей)</label><button>${esc(l)}</button></form>`).join('')}</div></div>
<div class="card"><h2>Полный (платный) отчёт</h2><p class="sub">Открывает отчёт с аукционами, страховкой и упоминаниями. <b>Тратит запросы платных поставщиков</b> — используйте для проверки.</p><form class="inline" action="/admin/report" method="get"><input name="vin" placeholder="VIN" maxlength="17" autocomplete="off" style="min-width:240px"><button>Открыть отчёт</button></form></div>`;
}

export function adminPage(tab, d, ctx) {
  const t = TABS.some(([k]) => k === tab) ? tab : 'overview';
  const nav = TABS.map(([k, l]) => `<a href="?tab=${k}" class="${k === t ? 'on' : ''}">${esc(l)}</a>`).join('');
  const body = t === 'traffic' ? traffic(ctx, [1, 7, 30].includes(d) ? d : 7) : t === 'checks' ? checks(ctx, [7, 30, 60].includes(d) ? d : 30) : t === 'orders' ? orders(ctx) : t === 'system' ? system(ctx) : overview(ctx);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>VINScope — админка</title><style>${css}</style></head><body><div class="shell"><aside><b>VINScope</b>${nav}<a href="/uk/" target="_blank" rel="noopener" style="margin-top:14px">Открыть сайт ↗</a><small>Админка · только для владельца</small></aside><main>${body}</main></div></body></html>`;
}
