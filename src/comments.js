// Коментарі про авто: досвід покупців и продавців по конкретному VIN или номеру (ДТП, пробіг, документи, стан).
// Правила: тільки про автомобіль, без персональних даних, контактів, образ и оцінок водія/власника.
// Усі коментарі проходять попередню модерацію; є скарги, ліміти и автоматичні фільтри.
import { createHash } from 'node:crypto';
import { db } from './db.js';
import { esc, layout, abs } from './views.js';
import { dict } from './i18n.js';

db.exec(`
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, kind TEXT NOT NULL, cat TEXT NOT NULL, text TEXT NOT NULL, lang TEXT, status TEXT NOT NULL DEFAULT 'pending', reports INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, ip TEXT);
CREATE INDEX IF NOT EXISTS comments_key ON comments(key, status);
CREATE INDEX IF NOT EXISTS comments_status ON comments(status, created_at);
`);

export const CAR_CATS = ['accident', 'mileage', 'docs', 'condition', 'sale', 'other'];
export const ROAD_CATS = ['road_parking', 'road_cutoff', 'road_speed', 'road_other']; // поведение на дороге: только для комментариев по госномеру
export const CATS = [...CAR_CATS, ...ROAD_CATS];
const MIN = 20, MAX = 400;
const ipHash = (ip) => createHash('sha256').update('cmt|' + ip).digest('hex').slice(0, 12);
// в дорожных комментариях описываем ситуацию, а не личность: без ссылок на владельца/водителя как человека, имён, обвинений в преступлениях
const PERSON = /(владел|власник|хозяин|господар|знаю\s+(его|её|ее|її|цього|этого)|живёт|живе\b|проживає|адрес|по\s+вулиц\w*\s+живе|водитель\s+[А-ЯІЇЄҐ]|водій\s+[А-ЯІЇЄҐ]|зовут|звати|п[’']яни[йц]|пьян|наркот|краде|вор\b|злодій|бандит|псих)/i;
const RUDE = /(хуй|хує|хуї|хуя|пізд|пизд|бляд|блят|єбан|ебан|ёбан|сука|сучар|мудак|гандон|підор|пидор|підар|пидар|чмо\b|залуп|шлюх|даун)/i;

// -> { ok: true, text } | { ok: false, error }
export function validateComment({ key, kind, cat, text }) {
  if (!['vin', 'plate'].includes(kind) || !/^[A-Z0-9]{5,17}$/.test(String(key || ''))) return { ok: false, error: 'bad' };
  if (!CATS.includes(cat) || (ROAD_CATS.includes(cat) && kind !== 'plate')) return { ok: false, error: 'cat' };
  const t = String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (t.length < MIN) return { ok: false, error: 'short' };
  if (t.length > MAX) return { ok: false, error: 'long' };
  if (/https?:|www\.|\b[\w-]+\.(com|ua|net|org|info|ru|biz|me|io|cc|xyz)\b|t\.me|@\w|[\w.+-]+@[\w-]+/i.test(t)) return { ok: false, error: 'contact' };
  if (/(?:\+?\d[\s().-]*){8,}/.test(t.replace(new RegExp(key, 'i'), ''))) return { ok: false, error: 'contact' }; // телефони; VIN/номер цього авто дозволені
  if (RUDE.test(t)) return { ok: false, error: 'rude' };
  if (ROAD_CATS.includes(cat) && PERSON.test(t)) return { ok: false, error: 'person' };
  const letters = (t.match(/\p{L}/gu) || []).length;
  if (letters < t.length * 0.5 || /(.)\1{6,}/u.test(t)) return { ok: false, error: 'spam' };
  const upper = (t.match(/\p{Lu}/gu) || []).length;
  if (letters > 30 && upper > letters * 0.7) return { ok: false, error: 'caps' };
  return { ok: true, text: t };
}

const q = (sql, ...a) => db.prepare(sql).all(...a);
export const listApproved = (keys, limit = 20) => { const ks = [].concat(keys).filter(Boolean); return q(`SELECT id, cat, text, created_at FROM comments WHERE key IN (${ks.map(() => '?').join(',')}) AND status='approved' ORDER BY created_at DESC LIMIT ?`, ...ks, limit); };
export const latestApproved = (limit = 50) => q("SELECT id, key, kind, cat, text, created_at FROM comments WHERE status='approved' ORDER BY created_at DESC LIMIT ?", limit);
export const pendingList = (limit = 100) => q("SELECT id, key, kind, cat, text, lang, reports, status, created_at FROM comments WHERE status='pending' ORDER BY created_at ASC LIMIT ?", limit);
export const recentList = (limit = 30) => q("SELECT id, key, kind, cat, text, status, reports, created_at FROM comments WHERE status<>'pending' ORDER BY created_at DESC LIMIT ?", limit);
export const counts = () => Object.fromEntries(q('SELECT status, COUNT(*) c FROM comments GROUP BY status').map((r) => [r.status, r.c]));
export const setStatus = (id, status) => db.prepare('UPDATE comments SET status=? WHERE id=?').run(status, Number(id)).changes;
export const remove = (id) => db.prepare('DELETE FROM comments WHERE id=?').run(Number(id)).changes;

// додати: захист від повторів и надлишку; повертає 'ok' або код помилки
export function addComment({ key, kind, cat, text, lang, ip }) {
  const v = validateComment({ key, kind, cat, text }); if (!v.ok) return v.error;
  const h = ipHash(ip), now = Date.now();
  if (db.prepare('SELECT COUNT(*) c FROM comments WHERE ip=? AND created_at>?').get(h, now - 864e5).c >= 8) return 'limit';
  if (db.prepare('SELECT COUNT(*) c FROM comments WHERE key=? AND status=\'pending\'').get(key).c >= 6) return 'busy';
  if (db.prepare('SELECT 1 FROM comments WHERE key=? AND text=?').get(key, v.text)) return 'dup';
  db.prepare('INSERT INTO comments(key,kind,cat,text,lang,created_at,ip) VALUES(?,?,?,?,?,?,?)').run(key, kind, cat, v.text, lang || 'uk', now, h);
  return 'ok';
}
// скарга: після трьох коментар повертається на модерацію
export const report = (id) => {
  db.prepare("UPDATE comments SET reports=reports+1 WHERE id=?").run(Number(id));
  db.prepare("UPDATE comments SET status='pending' WHERE id=? AND status='approved' AND reports>=3").run(Number(id));
};
export const purgeComments = () => db.prepare("DELETE FROM comments WHERE status='hidden' AND created_at<?").run(Date.now() - 90 * 864e5).changes;

// ---------- тексти ----------
const CM = {
  uk: { h: 'Коментарі про це авто', sub: 'Досвід покупців і продавців: ДТП, пробіг, документи, технічний стан. Лише про автомобіль.', none: 'Коментарів поки немає. Будьте першим.', add: 'Додати коментар', cat: 'Про що', ph: 'Опишіть подію чи факт: що, де, коли. Без імен, контактів і особистих даних.', send: 'Надіслати на перевірку', note: 'Коментар з’явиться після перевірки модератором. Не пишіть імен, телефонів, посилань і оцінок особи водія чи власника — такі коментарі не публікуються.', report: 'Поскаржитись', reported: 'Дякуємо, перевіримо', feed: 'Усі коментарі', title: 'Коментарі про авто', ok: 'Дякуємо! Коментар з’явиться після перевірки модератором (зазвичай до доби).',
    cats: { road_parking: 'Паркування', road_cutoff: 'Підрізав / небезпечний маневр', road_speed: 'Швидкість і обгін', road_other: 'Інше на дорозі', accident: 'ДТП і пошкодження', mileage: 'Пробіг', docs: 'Документи і реєстрація', condition: 'Технічний стан', sale: 'Продаж і ціна', other: 'Інше' },
    err: { bad: 'Не вдалося прийняти коментар.', cat: 'Оберіть, про що коментар.', short: 'Напишіть хоча б 20 символів — конкретніше про авто.', long: 'Коротше, будь ласка: до 400 символів.', contact: 'Не вказуйте контакти, посилання та телефони.', rude: 'Без образ і лайки, лише факти про авто.', spam: 'Схоже на спам: напишіть звичайним текстом.', caps: 'Не пишіть усе великими літерами.', limit: 'Забагато коментарів за добу. Спробуйте пізніше.', busy: 'Для цього авто вже чекають перевірки кілька коментарів. Спробуйте пізніше.', dup: 'Такий коментар уже є.', person: 'Опишіть ситуацію на дорозі, а не особу водія чи власника: без імен, адрес і звинувачень.', fast: 'Забагато запитів. Спробуйте за хвилину.' },
    carGroup: 'Про автомобіль', roadGroup: 'Поведінка на дорозі', hPlate: 'Коментарі про цей номер', subPlate: 'Досвід водіїв і покупців: ситуації на дорозі, ДТП, документи, технічний стан. Описуйте подію, а не особу.', disclaimer: 'Коментарі — суб’єктивна думка авторів, сервіс їх не підтверджує. Якщо коментар про ваш номер неправдивий, натисніть «Поскаржитись».', feedLead: 'Останні опубліковані коментарі про автомобілі. Тут лише факти про авто: ДТП, пробіг, документи, технічний стан.', feedNone: 'Опублікованих коментарів поки немає.', open: 'Відкрити перевірку' },
  ru: { h: 'Комментарии об этом авто', sub: 'Опыт покупателей и продавцов: ДТП, пробег, документы, техническое состояние. Только об автомобиле.', none: 'Комментариев пока нет. Будьте первым.', add: 'Добавить комментарий', cat: 'О чём', ph: 'Опишите событие или факт: что, где, когда. Без имён, контактов и личных данных.', send: 'Отправить на проверку', note: 'Комментарий появится после проверки модератором. Не пишите имена, телефоны, ссылки и оценки личности водителя или владельца — такие комментарии не публикуются.', report: 'Пожаловаться', reported: 'Спасибо, проверим', feed: 'Все комментарии', title: 'Комментарии об авто', ok: 'Спасибо! Комментарий появится после проверки модератором (обычно в течение суток).',
    cats: { road_parking: 'Парковка', road_cutoff: 'Подрезал / опасный манёвр', road_speed: 'Скорость и обгон', road_other: 'Другое на дороге', accident: 'ДТП и повреждения', mileage: 'Пробег', docs: 'Документы и регистрация', condition: 'Техническое состояние', sale: 'Продажа и цена', other: 'Другое' },
    err: { bad: 'Не удалось принять комментарий.', cat: 'Выберите, о чём комментарий.', short: 'Напишите хотя бы 20 символов — конкретнее об авто.', long: 'Короче, пожалуйста: до 400 символов.', contact: 'Не указывайте контакты, ссылки и телефоны.', rude: 'Без оскорблений и брани, только факты об авто.', spam: 'Похоже на спам: напишите обычным текстом.', caps: 'Не пишите всё заглавными буквами.', limit: 'Слишком много комментариев за сутки. Попробуйте позже.', busy: 'Для этого авто уже ждут проверки несколько комментариев. Попробуйте позже.', dup: 'Такой комментарий уже есть.', person: 'Опишите ситуацию на дороге, а не личность водителя или владельца: без имён, адресов и обвинений.', fast: 'Слишком много запросов. Попробуйте через минуту.' },
    carGroup: 'Об автомобиле', roadGroup: 'Поведение на дороге', hPlate: 'Комментарии об этом номере', subPlate: 'Опыт водителей и покупателей: ситуации на дороге, ДТП, документы, техническое состояние. Описывайте событие, а не личность.', disclaimer: 'Комментарии — субъективное мнение авторов, сервис их не подтверждает. Если комментарий о вашем номере неверен, нажмите «Пожаловаться».', feedLead: 'Последние опубликованные комментарии об автомобилях. Здесь только факты об авто: ДТП, пробег, документы, техническое состояние.', feedNone: 'Опубликованных комментариев пока нет.', open: 'Открыть проверку' },
  en: { h: 'Comments about this car', sub: 'Buyers’ and sellers’ experience: accidents, mileage, documents, technical condition. About the car only.', none: 'No comments yet. Be the first.', add: 'Add a comment', cat: 'About', ph: 'Describe the event or fact: what, where, when. No names, contacts or personal data.', send: 'Submit for review', note: 'Your comment will appear after a moderator reviews it. Do not post names, phone numbers, links or remarks about a driver or owner as a person — such comments are not published.', report: 'Report', reported: 'Thanks, we will review it', feed: 'All comments', title: 'Comments about cars', ok: 'Thank you! Your comment will appear after moderator review (usually within a day).',
    cats: { road_parking: 'Parking', road_cutoff: 'Cut me off / dangerous manoeuvre', road_speed: 'Speed and overtaking', road_other: 'Other on the road', accident: 'Accidents and damage', mileage: 'Mileage', docs: 'Documents and registration', condition: 'Technical condition', sale: 'Sale and price', other: 'Other' },
    err: { bad: 'We could not accept the comment.', cat: 'Choose what the comment is about.', short: 'Please write at least 20 characters — be specific about the car.', long: 'Please keep it under 400 characters.', contact: 'Do not include contacts, links or phone numbers.', rude: 'No insults or profanity, just facts about the car.', spam: 'Looks like spam: please write in plain text.', caps: 'Please do not write in all capitals.', limit: 'Too many comments today. Try again later.', busy: 'Several comments for this car are already waiting for review. Try again later.', dup: 'This comment already exists.', person: 'Describe the situation on the road, not the driver or owner as a person: no names, addresses or accusations.', fast: 'Too many requests. Try again in a minute.' },
    carGroup: 'About the car', roadGroup: 'Behaviour on the road', hPlate: 'Comments about this plate', subPlate: 'Drivers’ and buyers’ experience: road situations, accidents, documents, technical condition. Describe the event, not the person.', disclaimer: 'Comments are the authors’ subjective opinions and are not verified by the service. If a comment about your plate is untrue, press “Report”.', feedLead: 'The latest published comments about cars. Facts about the car only: accidents, mileage, documents, technical condition.', feedNone: 'No published comments yet.', open: 'Open the check' },
};
export const cmText = (lang) => CM[lang] || CM.uk;
const dayOf = (ts) => new Date(ts).toISOString().slice(0, 10);
const body = (t) => esc(t).replace(/\n/g, '<br>');

// блок на сторінці перевірки: список + форма. keys — чиї коментарі показуємо (VIN і номери авто), postKey/postKind — до чого прикріпляється новий
export function commentsSection(req, lang, { postKey, postKind, keys = [] }) {
  const T = cmText(lang); const items = listApproved([postKey, ...keys]);
  const flag = new URL(req.url, 'http://x').searchParams.get('c') || '';
  const msg = flag === 'ok' ? `<p class="cm-msg ok" role="status">${esc(T.ok)}</p>` : flag === 'rep' ? `<p class="cm-msg ok" role="status">${esc(T.reported)}</p>` : T.err[flag] ? `<p class="cm-msg err" role="alert">${esc(T.err[flag])}</p>` : '';
  const list = items.length ? `<ul class="cm-list" role="list">${items.map((c) => `<li><div class="cm-top"><span class="cm-cat">${esc(T.cats[c.cat] || c.cat)}</span><time datetime="${dayOf(c.created_at)}">${dayOf(c.created_at)}</time></div><p>${body(c.text)}</p><form method="post" action="/comment/report"><input type="hidden" name="id" value="${c.id}"><input type="hidden" name="lang" value="${esc(lang)}"><input type="hidden" name="key" value="${esc(postKey)}"><button class="cm-rep" type="submit">${esc(T.report)}</button></form></li>`).join('')}</ul>` : `<p class="muted">${esc(T.none)}</p>`;
  const group = (label, cats, first) => `<fieldset><legend>${esc(label)}</legend><div class="cm-cats">${cats.map((c, i) => `<label><input type="radio" name="cat" value="${c}"${first && i === 0 ? ' required' : ''}><span>${esc(T.cats[c])}</span></label>`).join('')}</div></fieldset>`;
  const form = `<details class="cm-add"${flag && flag !== 'ok' && flag !== 'rep' ? ' open' : ''}><summary>${esc(T.add)}</summary><form method="post" action="/comment" class="cm-form"><input type="hidden" name="key" value="${esc(postKey)}"><input type="hidden" name="kind" value="${esc(postKind)}"><input type="hidden" name="lang" value="${esc(lang)}"><input type="hidden" name="t" value="${Date.now()}">
<div class="cm-honey" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
${postKind === 'plate' ? group(T.carGroup, CAR_CATS, true) + group(T.roadGroup, ROAD_CATS, false) : group(T.cat, CAR_CATS, true)}
<label class="sr-only" for="cm-text">${esc(T.add)}</label><textarea id="cm-text" name="text" rows="4" minlength="${MIN}" maxlength="${MAX}" required placeholder="${esc(T.ph)}"></textarea>
<p class="muted sm">${esc(T.note)}</p><button class="btn primary" type="submit">${esc(T.send)}</button></form></details>`;
  return `<section class="panel comments" id="comments" aria-labelledby="h-cm"><h2 id="h-cm">${esc(postKind === 'plate' ? T.hPlate : T.h)}</h2><p class="muted sm">${esc(postKind === 'plate' ? T.subPlate : T.sub)}</p>${msg}${list}${form}<p class="muted sm">${esc(T.disclaimer)}</p><p class="sm"><a href="/${lang}/comments">${esc(T.feed)} →</a></p></section>`;
}

// сторінка «Усі коментарі»
export function commentsPage(req, lang) {
  const T = cmText(lang); const items = latestApproved(50);
  const cards = items.length ? `<ul class="cm-feed" role="list">${items.map((c) => `<li><a class="cm-key" href="/${lang}/check?q=${encodeURIComponent(c.key)}">${esc(c.key)}</a><div class="cm-top"><span class="cm-cat">${esc(T.cats[c.cat] || c.cat)}</span><time datetime="${dayOf(c.created_at)}">${dayOf(c.created_at)}</time></div><p>${body(c.text)}</p></li>`).join('')}</ul>` : `<p class="muted">${esc(T.feedNone)}</p>`;
  const page = `<section class="hero small"><div class="wrap"><p class="eyebrow">VINScope</p><h1>${esc(T.title)}</h1><p class="lead">${esc(T.feedLead)}</p></div></section><section class="sec" style="padding-top:28px"><div class="wrap narrow">${cards}</div></section>`;
  return layout(req, lang, { title: `${T.title} | VINScope`, desc: T.feedLead, path: '/comments', body: page, noindex: true });
}
