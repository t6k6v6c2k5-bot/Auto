import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { cfg } from './config.js';

mkdirSync(dirname(cfg.dbPath), { recursive: true });
export const db = new DatabaseSync(cfg.dbPath);
db.exec(`
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS orders(
  id TEXT PRIMARY KEY, token TEXT NOT NULL, vin TEXT NOT NULL, plan TEXT NOT NULL, email TEXT,
  status TEXT NOT NULL, amount INTEGER NOT NULL, lang TEXT, stripe_session TEXT, payment_intent TEXT,
  credit_code TEXT, report TEXT, created_at INTEGER NOT NULL, paid_at INTEGER
);
CREATE TABLE IF NOT EXISTS credits(code TEXT PRIMARY KEY, plan TEXT, remaining INTEGER NOT NULL, email TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS waitlist(email TEXT PRIMARY KEY, lang TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS searches(id INTEGER PRIMARY KEY AUTOINCREMENT, vin TEXT, lang TEXT, created_at INTEGER NOT NULL);
`);

const rid = (n) => randomBytes(n).toString('hex');
export const newOrder = (o) => {
  const row = { id: rid(6), token: rid(16), status: 'pending', created_at: Date.now(), ...o };
  db.prepare(`INSERT INTO orders(id,token,vin,plan,email,status,amount,lang,credit_code,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(row.id, row.token, row.vin, row.plan, row.email || null, row.status, row.amount, row.lang || 'uk', row.credit_code || null, row.created_at);
  return row;
};
export const getOrder = (id) => db.prepare('SELECT * FROM orders WHERE id=?').get(id);
export const getOrderByToken = (t) => db.prepare('SELECT * FROM orders WHERE token=?').get(t);
export const updateOrder = (id, f) => {
  const keys = Object.keys(f);
  db.prepare(`UPDATE orders SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`).run(...keys.map((k) => f[k]), id);
};
export const newCredit = (plan, n, email) => {
  const code = ('VS-' + rid(4) + '-' + rid(2)).toUpperCase();
  db.prepare('INSERT INTO credits(code,plan,remaining,email,created_at) VALUES(?,?,?,?,?)').run(code, plan, n, email || null, Date.now());
  return code;
};
export const getCredit = (code) => db.prepare('SELECT * FROM credits WHERE code=?').get(String(code || '').trim().toUpperCase());
export const useCredit = (code) => db.prepare('UPDATE credits SET remaining=remaining-1 WHERE code=? AND remaining>0').run(code).changes === 1;
export const addWaitlist = (email, lang) => db.prepare('INSERT OR IGNORE INTO waitlist(email,lang,created_at) VALUES(?,?,?)').run(email, lang, Date.now());
export const logSearch = (vin, lang) => db.prepare('INSERT INTO searches(vin,lang,created_at) VALUES(?,?,?)').run(vin, lang, Date.now());
export const stats = () => ({
  paid: db.prepare(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM orders WHERE status IN ('paid','credit') AND stripe_session IS NOT NULL`).get(),
  byStatus: db.prepare('SELECT status, COUNT(*) c FROM orders GROUP BY status').all(),
  waitlist: db.prepare('SELECT COUNT(*) c FROM waitlist').get().c,
  searches: db.prepare('SELECT COUNT(*) c FROM searches').get().c,
  searches7: db.prepare('SELECT COUNT(*) c FROM searches WHERE created_at>?').get(Date.now() - 7 * 864e5).c,
  recent: db.prepare('SELECT id,vin,plan,status,amount,created_at FROM orders ORDER BY created_at DESC LIMIT 20').all(),
  topVins: db.prepare('SELECT vin, COUNT(*) c FROM searches GROUP BY vin ORDER BY c DESC LIMIT 5').all(),
});
