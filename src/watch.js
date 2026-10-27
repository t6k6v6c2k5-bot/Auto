// Слежение за авто: подписка по email на изменения (розыск, отзывные кампании, объявление о продаже и его цена).
// Включается только когда заданы RESEND_API_KEY и MAIL_FROM: без почты обещать оповещения нельзя. Двойное подтверждение, отписка в каждом письме.
import { randomBytes } from 'node:crypto';
import { db } from './db.js';
import { cfg } from './config.js';
import { esc } from './views.js';
import { buildReport } from './report.js';
import { listingsByVin } from './ria.js';

db.exec(`CREATE TABLE IF NOT EXISTS watches(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, vin TEXT NOT NULL, lang TEXT, token TEXT NOT NULL, confirmed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, last_state TEXT, last_mail INTEGER);
CREATE UNIQUE INDEX IF NOT EXISTS watches_uq ON watches(email, vin);
CREATE INDEX IF NOT EXISTS watches_token ON watches(token);`);

export const watchOn = () => Boolean(cfg.mailKey && cfg.mailFrom);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const MAX_ACTIVE = 400, PER_EMAIL = 3;

const T = {
  uk: { h: 'Стежити за цим авто', p: 'Напишемо на пошту, якщо авто потрапить у розшук, з’явиться відкликання виробника або оголошення про продаж чи зміниться його ціна. Лист із підтвердженням — один, далі лише за змінами.', ph: 'Ваш email', btn: 'Стежити', sent: 'Надіслали лист із підтвердженням. Перейдіть за посиланням у листі.', bad: 'Перевірте email.', limit: 'Забагато підписок на цей email.', full: 'Слідкування тимчасово недоступне.', fast: 'Забагато спроб. Спробуйте пізніше.', dup: 'Ви вже стежите за цим авто.', cs: 'Підтвердження стеження', cb: 'Підтвердіть стеження за авто {vin}: {link}\n\nЯкщо це були не ви, просто проігноруйте лист.', ok_h: 'Стеження увімкнено', ok_p: 'Ми напишемо, якщо щось зміниться.', stop_h: 'Стеження вимкнено', stop_p: 'Ми більше не надсилатимемо листів про це авто.', bad_h: 'Посилання недійсне', bad_p: 'Воно застаріло або вже використане.', ms: 'Зміни по авто {vin}', mb: 'Зміни по авто {vin}:\n\n{lines}\n\nЗвіт: {report}\nВідписатися: {stop}', wanted: '— Авто потрапило в розшук.', unwanted: '— Авто більше не в розшуку.', recalls: '— Нові відкликання виробника: було {a}, стало {b}.', listed: '— З’явилося оголошення про продаж (ціна ${p}).', delisted: '— Оголошення про продаж зникло.', price: '— Ціна в оголошенні змінилася: ${a} → ${b}.' },
  ru: { h: 'Следить за этим авто', p: 'Напишем на почту, если авто попадёт в розыск, появится отзывная кампания производителя или объявление о продаже, либо изменится его цена. Письмо с подтверждением одно, дальше только при изменениях.', ph: 'Ваш email', btn: 'Следить', sent: 'Отправили письмо с подтверждением. Перейдите по ссылке из письма.', bad: 'Проверьте email.', limit: 'Слишком много подписок на этот email.', full: 'Слежение временно недоступно.', fast: 'Слишком много попыток. Попробуйте позже.', dup: 'Вы уже следите за этим авто.', cs: 'Подтверждение слежения', cb: 'Подтвердите слежение за авто {vin}: {link}\n\nЕсли это были не вы, просто проигнорируйте письмо.', ok_h: 'Слежение включено', ok_p: 'Мы напишем, если что-то изменится.', stop_h: 'Слежение выключено', stop_p: 'Мы больше не будем присылать письма об этом авто.', bad_h: 'Ссылка недействительна', bad_p: 'Она устарела или уже использована.', ms: 'Изменения по авто {vin}', mb: 'Изменения по авто {vin}:\n\n{lines}\n\nОтчёт: {report}\nОтписаться: {stop}', wanted: '— Авто попало в розыск.', unwanted: '— Авто больше не в розыске.', recalls: '— Новые отзывные кампании: было {a}, стало {b}.', listed: '— Появилось объявление о продаже (цена ${p}).', delisted: '— Объявление о продаже исчезло.', price: '— Цена в объявлении изменилась: ${a} → ${b}.' },
  en: { h: 'Watch this car', p: 'We will email you if the car appears in the wanted list, a manufacturer recall is issued, a sale listing appears or its price changes. One confirmation email, then only when something changes.', ph: 'Your email', btn: 'Watch', sent: 'We sent a confirmation email. Follow the link in it.', bad: 'Check the email address.', limit: 'Too many watches for this email.', full: 'Watching is temporarily unavailable.', fast: 'Too many attempts. Try again later.', dup: 'You are already watching this car.', cs: 'Confirm watching', cb: 'Confirm watching the car {vin}: {link}\n\nIf this was not you, just ignore this email.', ok_h: 'Watching enabled', ok_p: 'We will email you when something changes.', stop_h: 'Watching stopped', stop_p: 'We will not email you about this car any more.', bad_h: 'Link is not valid', bad_p: 'It has expired or has already been used.', ms: 'Changes for the car {vin}', mb: 'Changes for the car {vin}:\n\n{lines}\n\nReport: {report}\nUnsubscribe: {stop}', wanted: '— The car appeared in the wanted list.', unwanted: '— The car is no longer in the wanted list.', recalls: '— New manufacturer recalls: was {a}, now {b}.', listed: '— A sale listing appeared (price ${p}).', delisted: '— The sale listing disappeared.', price: '— The listing price changed: ${a} → ${b}.' },
};
const tx = (lang) => T[lang] || T.uk;
const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');

export function watchBox(lang, vin, status = '') {
  if (!watchOn()) return '';
  const t = tx(lang); const ok = status === 'sent';
  const msg = ok ? t.sent : t[status] || '';
  return `<section class="panel" id="watch" aria-labelledby="h-wt"><h2 id="h-wt">${esc(t.h)}</h2><p class="muted">${esc(t.p)}</p>${msg ? `<p class="${ok ? 'good' : 'err'}" role="status">${esc(msg)}</p>` : ''}<form class="notify" action="/watch" method="post"><input type="hidden" name="vin" value="${esc(vin)}"><input type="hidden" name="lang" value="${esc(lang)}"><input type="hidden" name="t" value="${Date.now()}"><input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px"><label class="sr-only" for="wt-email">${esc(t.ph)}</label><input id="wt-email" type="email" name="email" required maxlength="200" placeholder="${esc(t.ph)}" autocomplete="email" inputmode="email"><button class="btn primary" type="submit">${esc(t.btn)}</button></form></section>`;
}

async function sendMail(to, subject, text) {
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + cfg.mailKey, 'content-type': 'application/json' }, body: JSON.stringify({ from: cfg.mailFrom, to: [to], subject, text }), signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('mail ' + r.status);
}

// -> код для сообщения в блоке: sent | bad | limit | full | dup
export async function addWatch({ email, vin, lang, base }) {
  email = String(email || '').trim().toLowerCase().slice(0, 200);
  if (!EMAIL.test(email) || !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return 'bad';
  if (!watchOn()) return 'full';
  if (db.prepare('SELECT COUNT(*) c FROM watches WHERE confirmed=1').get().c >= MAX_ACTIVE) return 'full';
  if (db.prepare('SELECT COUNT(*) c FROM watches WHERE email=?').get(email).c >= PER_EMAIL) return 'limit';
  const old = db.prepare('SELECT confirmed FROM watches WHERE email=? AND vin=?').get(email, vin);
  if (old?.confirmed) return 'dup';
  const token = randomBytes(18).toString('hex');
  if (old) db.prepare('UPDATE watches SET token=?, lang=? WHERE email=? AND vin=?').run(token, lang, email, vin);
  else db.prepare('INSERT INTO watches(email,vin,lang,token,created_at) VALUES(?,?,?,?,?)').run(email, vin, lang, token, Date.now());
  const t = tx(lang);
  try { await sendMail(email, t.cs, fmt(t.cb, { vin, link: `${base}/watch/confirm?t=${token}` })); } catch (e) { console.error('watch mail', e.message); return 'full'; }
  return 'sent';
}
export function confirmWatch(token) {
  const w = /^[a-f0-9]{36}$/.test(token) && db.prepare('SELECT id, lang, vin FROM watches WHERE token=?').get(token);
  if (!w) return null;
  db.prepare('UPDATE watches SET confirmed=1 WHERE id=?').run(w.id); return w;
}
export function stopWatch(token) {
  const w = /^[a-f0-9]{36}$/.test(token) && db.prepare('SELECT id, lang FROM watches WHERE token=?').get(token);
  if (!w) return null;
  db.prepare('DELETE FROM watches WHERE id=?').run(w.id); return w;
}
export const purgeWatches = () => db.prepare('DELETE FROM watches WHERE confirmed=0 AND created_at<?').run(Date.now() - 2 * 864e5).changes;
export const watchText = (lang, k) => tx(lang)[k];
export const watchCounts = () => db.prepare('SELECT SUM(confirmed=1) active, COUNT(*) total FROM watches').get();

// ежедневный обход: сравниваем с прошлым состоянием, первое состояние — только фиксируем
export async function runWatches(base = cfg.baseUrl || '') {
  if (!watchOn()) return 0;
  const rows = db.prepare('SELECT * FROM watches WHERE confirmed=1').all(); let sent = 0;
  const vins = [...new Set(rows.map((w) => w.vin))];
  const state = new Map();
  for (const vin of vins) {
    try {
      const r = await buildReport(vin, { withProvider: false, market: false });
      const l = await listingsByVin(vin); // null = источник недоступен: не считаем, что объявление пропало
      state.set(vin, { w: r.wanted.length, rc: r.recalls?.unavailable ? null : r.recalls?.items?.length ?? null, l: l ? (l.n ? 1 : 0) : null, p: l?.item?.price ?? null });
    } catch (e) { console.error('watch run', vin, e.message); }
  }
  for (const w of rows) {
    const cur = state.get(w.vin); if (!cur) continue;
    const prev = w.last_state ? JSON.parse(w.last_state) : null;
    const merged = { w: cur.w, rc: cur.rc ?? prev?.rc ?? null, l: cur.l ?? prev?.l ?? null, p: cur.l === null ? prev?.p ?? null : cur.p };
    if (prev) {
      const t = tx(w.lang), lines = [];
      if (!prev.w && merged.w) lines.push(t.wanted); else if (prev.w && !merged.w) lines.push(t.unwanted);
      if (prev.rc != null && merged.rc != null && merged.rc > prev.rc) lines.push(fmt(t.recalls, { a: prev.rc, b: merged.rc }));
      if (prev.l === 0 && merged.l === 1) lines.push(fmt(t.listed, { p: merged.p ?? '—' })); else if (prev.l === 1 && merged.l === 0) lines.push(t.delisted);
      if (prev.l === 1 && merged.l === 1 && prev.p && merged.p && prev.p !== merged.p) lines.push(fmt(t.price, { a: prev.p, b: merged.p }));
      if (lines.length) {
        try { await sendMail(w.email, fmt(t.ms, { vin: w.vin }), fmt(t.mb, { vin: w.vin, lines: lines.join('\n'), report: `${base}/${w.lang}/check?q=${w.vin}`, stop: `${base}/watch/stop?t=${w.token}` })); sent++; db.prepare('UPDATE watches SET last_mail=? WHERE id=?').run(Date.now(), w.id); } catch (e) { console.error('watch mail', e.message); continue; }
      }
    }
    db.prepare('UPDATE watches SET last_state=? WHERE id=?').run(JSON.stringify(merged), w.id);
  }
  return sent;
}
