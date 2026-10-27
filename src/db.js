import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { cfg } from './config.js';

mkdirSync(dirname(cfg.dbPath), { recursive: true });
export const db = new DatabaseSync(cfg.dbPath);
db.exec(`
PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS orders(
  id TEXT PRIMARY KEY, token TEXT NOT NULL, vin TEXT NOT NULL, plan TEXT NOT NULL, email TEXT,
  status TEXT NOT NULL, amount INTEGER NOT NULL, lang TEXT, stripe_session TEXT, payment_intent TEXT,
  credit_code TEXT, report TEXT, created_at INTEGER NOT NULL, paid_at INTEGER
);
CREATE TABLE IF NOT EXISTS credits(code TEXT PRIMARY KEY, plan TEXT, remaining INTEGER NOT NULL, email TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS usa_cache(vin TEXT PRIMARY KEY, ts INTEGER NOT NULL, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS photos(key TEXT PRIMARY KEY, url TEXT, page TEXT, title TEXT, ts INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS waitlist(email TEXT PRIMARY KEY, lang TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS mentions(key TEXT NOT NULL, url TEXT NOT NULL, domain TEXT, title TEXT, kind TEXT, published TEXT, found_at INTEGER NOT NULL, PRIMARY KEY(key,url));
CREATE TABLE IF NOT EXISTS mention_checks(key TEXT PRIMARY KEY, ts INTEGER NOT NULL, n INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS searches(id INTEGER PRIMARY KEY AUTOINCREMENT, vin TEXT, lang TEXT, created_at INTEGER NOT NULL);
`);

const rid = (n) => randomBytes(n).toString('hex');
export const newOrder = (o) => {
  const row = { id: rid(6), token: rid(16), secret: rid(16), status: 'pending', created_at: Date.now(), ...o };
  db.prepare(`INSERT INTO orders(id,token,vin,plan,email,status,amount,lang,credit_code,created_at,success_secret) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .run(row.id, row.token, row.vin, row.plan, row.email || null, row.status, row.amount, row.lang || 'uk', row.credit_code || null, row.created_at, row.secret);
  return row;
};
export const getOrder = (id) => db.prepare('SELECT * FROM orders WHERE id=?').get(id);
export const getOrderByToken = (t) => db.prepare('SELECT * FROM orders WHERE token=?').get(t);
export const updateOrder = (id, f) => {
  const keys = Object.keys(f);
  db.prepare(`UPDATE orders SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`).run(...keys.map((k) => f[k]), id);
};
export const newCredit = (plan, n, email) => {
  const code = ('VS-' + rid(5) + '-' + rid(3)).toUpperCase(); // 64 бита энтропии
  db.prepare('INSERT INTO credits(code,plan,remaining,email,created_at) VALUES(?,?,?,?,?)').run(code, plan, n, email || null, Date.now());
  return code;
};
export const getCredit = (code) => db.prepare('SELECT * FROM credits WHERE code=?').get(String(code || '').trim().toUpperCase());
export const useCredit = (code) => db.prepare('UPDATE credits SET remaining=remaining-1 WHERE code=? AND remaining>0').run(code).changes === 1;
try { db.exec('ALTER TABLE waitlist ADD COLUMN utm TEXT'); } catch { /* колонка уже есть */ }
try { db.exec('ALTER TABLE orders ADD COLUMN success_secret TEXT'); } catch { /* колонка уже есть */ }
export const addWaitlist = (email, lang, utm) => db.prepare('INSERT OR IGNORE INTO waitlist(email,lang,created_at,utm) VALUES(?,?,?,?)').run(email, lang, Date.now(), utm || null);
// Атомарный переход pending -> paid: true только для первого вызывающего (защита от гонки /success и webhook)
export const claimPaid = (id, paymentIntent) => db.prepare("UPDATE orders SET status='paid', payment_intent=COALESCE(?,payment_intent), paid_at=? WHERE id=? AND status='pending'").run(paymentIntent || null, Date.now(), id).changes === 1;
export const setCreditOnce = (id, code) => db.prepare('UPDATE orders SET credit_code=? WHERE id=? AND credit_code IS NULL').run(code, id).changes === 1;
// Срок хранения: поисковые запросы (VIN/номер) не держим дольше 90 дней
export const purgeOld = () => {
  db.prepare("DELETE FROM orders WHERE status='pending' AND created_at<?").run(Date.now() - 7 * 864e5); // неоплаченные заказы с email
  db.prepare('DELETE FROM mentions WHERE found_at<?').run(Date.now() - 180 * 864e5);
  return db.prepare('DELETE FROM searches WHERE created_at<?').run(Date.now() - 90 * 864e5).changes;
};
// повторный запрос того же VIN в течение 10 минут (обновление страницы) не считаем отдельной проверкой
export const logSearch = (vin, lang) => {
  const last = db.prepare('SELECT MAX(created_at) t FROM searches WHERE vin=?').get(vin)?.t || 0;
  if (Date.now() - last < 600e3) return;
  db.prepare('INSERT INTO searches(vin,lang,created_at) VALUES(?,?,?)').run(vin, lang, Date.now());
};
export const searchCount = (vin, days = 30) => db.prepare('SELECT COUNT(*) c FROM searches WHERE vin=? AND created_at>?').get(vin, Date.now() - days * 864e5).c;
export const stats = () => ({
  paid: db.prepare(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM orders WHERE status IN ('paid','credit') AND stripe_session IS NOT NULL AND COALESCE(email,'') NOT LIKE '%@example.com'`).get(), // тестовые заказы выручкой не считаем
  byStatus: db.prepare('SELECT status, COUNT(*) c FROM orders GROUP BY status').all(),
  waitlist: db.prepare('SELECT COUNT(*) c FROM waitlist').get().c,
  searches: db.prepare('SELECT COUNT(*) c FROM searches').get().c,
  searches7: db.prepare('SELECT COUNT(*) c FROM searches WHERE created_at>?').get(Date.now() - 7 * 864e5).c,
  recent: db.prepare('SELECT id,vin,plan,status,amount,created_at FROM orders ORDER BY created_at DESC LIMIT 20').all(),
  topVins: db.prepare('SELECT vin, COUNT(*) c FROM searches GROUP BY vin ORDER BY c DESC LIMIT 5').all(),
});

db.exec('CREATE TABLE IF NOT EXISTS ria_cache(k TEXT PRIMARY KEY, ts INTEGER NOT NULL, json TEXT NOT NULL)');
export const getRia = (k) => db.prepare('SELECT ts, json FROM ria_cache WHERE k=?').get(k) || null;
export const setRia = (k, json) => db.prepare('INSERT OR REPLACE INTO ria_cache(k,ts,json) VALUES(?,?,?)').run(k, Date.now(), json);
export const getPhotoRow = (key) => db.prepare('SELECT url,page,title,ts FROM photos WHERE key=?').get(key);
export const setPhotoRow = (key, url, page, title) => db.prepare('INSERT OR REPLACE INTO photos(key,url,page,title,ts) VALUES(?,?,?,?,?)').run(key, url, page, title, Date.now());
export const returnCredit = (code) => db.prepare('UPDATE credits SET remaining=remaining+1 WHERE code=?').run(code);

export const getUsaCache = (vin) => { const r = db.prepare('SELECT ts, json FROM usa_cache WHERE vin=?').get(vin); return r ? { ts: r.ts, json: JSON.parse(r.json) } : null; };
export const setUsaCache = (vin, obj) => db.prepare('INSERT OR REPLACE INTO usa_cache(vin,ts,json) VALUES(?,?,?)').run(vin, Date.now(), JSON.stringify(obj));

// Упоминания авто в интернете (только данные об авто: домен, заголовок без контактов, тип, дата)
export const getMentions = (key) => db.prepare('SELECT domain, title, kind, published, found_at FROM mentions WHERE key=? ORDER BY found_at DESC LIMIT 60').all(key);
export const mentionCheck = (key) => db.prepare('SELECT ts, n FROM mention_checks WHERE key=?').get(key) || null;
export const saveMentions = (key, items) => {
  const ins = db.prepare('INSERT OR IGNORE INTO mentions(key,url,domain,title,kind,published,found_at) VALUES(?,?,?,?,?,?,?)');
  for (const x of items) ins.run(key, x.url, x.domain, x.title, x.kind, x.published || '', Date.now());
  db.prepare('INSERT OR REPLACE INTO mention_checks(key,ts,n) VALUES(?,?,?)').run(key, Date.now(), items.length);
};
export const mentionsTotal = () => db.prepare('SELECT COUNT(*) c FROM mentions').get().c;
