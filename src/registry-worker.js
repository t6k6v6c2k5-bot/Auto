// Фоновая загрузка открытого реестра ТЗ МВС Украины (data.gov.ua) в SQLite. Работает в worker_thread.
import { parentPort, workerData } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { statSync } from 'node:fs';
import { parseLine, detectDelimiter } from './csv.js';
import { unzipFirstEntry } from './zipstream.js';
import { normalizeVin } from './vin.js';
import { normalizePlate } from './plate.js';
import { SCHEMA, migrate } from './registry-schema.js';

const { dbPath, fromYear, toYear, maxBytes } = workerData;
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; VINScope/1.0)' };
const PKG_ZIP = '06779371-308f-42d7-895e-5a39833375f0';   // «Відомості про ТЗ та їх власників» (архіви по роках)
const PKG_CUR = '348dbb24-a545-4d8c-95d5-18d35c593ca1';   // «Інформація про зареєстровані ТЗ (VIN)» (поточний рік)
const say = (m) => parentPort.postMessage(m);


const HOST_OK = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)data\.gov\.ua$/.test(x.hostname); } catch { return false; } };
// fetch с проверкой хоста на каждом редиректе и таймаутом заголовков; зависшее тело обрывается по idle-таймеру
async function safeFetch(url, ac) {
  for (let hop = 0; hop < 5; hop++) {
    if (!HOST_OK(url)) throw new Error('blocked host: ' + new URL(url).hostname);
    const res = await fetch(url, { headers: UA, redirect: 'manual', signal: ac.signal });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location'), url).href; continue; }
    return res;
  }
  throw new Error('too many redirects');
}

async function ckan(id) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(`https://data.gov.ua/api/3/action/package_show?id=${id}`, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (r.ok) return (await r.json()).result.resources;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 3000 * (a + 1)));
  }
  throw new Error('CKAN unavailable for ' + id);
}

const parseDate = (s) => {
  let m = /^(\d{2})\.(\d{2})\.(\d{2,4})$/.exec(s);
  if (m) return (m[3].length === 2 ? 2000 + +m[3] : +m[3]) * 10000 + +m[2] * 100 + +m[1];
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? +m[1] * 10000 + +m[2] * 100 + +m[3] : null;
};

async function main() {
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA); migrate(db);
  // хвосты оборванных загрузок (процесс убили посреди импорта): удаляем недогруженные источники и их строки
  db.exec('DELETE FROM reg WHERE src IN (SELECT id FROM sources WHERE done=0); DELETE FROM regp WHERE src IN (SELECT id FROM sources WHERE done=0); DELETE FROM sources WHERE done=0;');
  const dict = new Map(db.prepare('SELECT v,id FROM dict').all().map((r) => [r.v, r.id]));
  const insDict = db.prepare('INSERT OR IGNORE INTO dict(v) VALUES(?)');
  const getDict = db.prepare('SELECT id FROM dict WHERE v=?');
  const D = (s) => {
    if (!s) return null;
    let id = dict.get(s);
    if (id === undefined) { insDict.run(s); id = getDict.get(s).id; dict.set(s, id); }
    return id;
  };
  const insOp = db.prepare('INSERT OR IGNORE INTO ops(code,name) VALUES(?,?)');
  const insPlate = db.prepare('INSERT INTO regp(plate,d,oper,brand,model,year,color,body,fuel,cap,dep,src) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const insReg = db.prepare('INSERT INTO reg(vin,d,oper,brand,model,year,color,kind,body,fuel,cap,dep,plate,person,src) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

  const sources = [];
  const cur = await ckan(PKG_CUR);
  if (!toYear) for (const r of cur.filter((x) => /\.csv/i.test(x.format || '') || /csv$/i.test(x.url))) sources.push({ key: r.id, name: 'registeredVehicles (' + (r.last_modified || '').slice(0, 10) + ')', url: r.url, kind: 'csv', modified: r.last_modified || '', year: 9999 });
  const curYear = new Date().getFullYear();
  for (const r of await ckan(PKG_ZIP)) {
    const y = +(/(\d{4})/.exec(r.name || '')?.[1] || 0);
    if (y < fromYear || (toYear && y > toYear) || !/zip/i.test(r.format || r.url)) continue;
    if (y === curYear && sources.length) continue; // текущий год покрывает CSV (новее)
    sources.push({ key: r.id, name: r.name, url: r.url, kind: 'zip', modified: r.last_modified || '', year: y });
  }
  sources.sort((a, b) => b.year - a.year); // сначала самое свежее
  say({ type: 'plan', sources: sources.length });

  for (const s of sources) {
    const row = db.prepare('SELECT * FROM sources WHERE key=?').get(s.key);
    if (row?.done && row.modified === s.modified) continue;
    if (statSync(dbPath).size > maxBytes) { say({ type: 'log', msg: 'size limit reached, stopping' }); break; }
    // новые строки пишем под временным источником и подменяем старые одной транзакцией после успеха:
    // сбой посреди загрузки не стирает прежнюю историю
    const id = Number(db.prepare('INSERT INTO sources(key,name,modified) VALUES(?,?,?)').run(s.key + '#stage' + Date.now(), s.name, s.modified).lastInsertRowid);
    say({ type: 'start', name: s.name });
    let ac, idle, idleTimer;
    try {
      ac = new AbortController();
      const hdrTimer = setTimeout(() => ac.abort(), 60000);
      const res = await safeFetch(s.url, ac);
      clearTimeout(hdrTimer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      idle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => ac.abort(), 120000); }; idle();
      const stream = s.kind === 'zip' ? unzipFirstEntry(res.body) : (await import('node:stream')).Readable.fromWeb(res.body);
      const dec = new TextDecoder('utf-8'); let tail = '', header = null, delim = ';', idx = {}, n = 0, dmin = 99999999, dmax = 0, plateMode = false;
      db.exec('BEGIN');
      const handle = (line) => {
        if (!line) return;
        if (!header) {
          delim = detectDelimiter(line);
          header = parseLine(line.replace(/^﻿/, ''), delim).map((h) => h.trim().toLowerCase());
          const f = (...names) => { for (const nm of names) { const i = header.indexOf(nm); if (i >= 0) return i; } return -1; };
          idx = { vin: f('vin'), code: f('oper_code', 'opercodeoperas'), name: f('oper_name'), combined: header.findIndex((h) => h.includes('oper_code') && h.includes('||')), d: f('d_reg', 'dreg'), dep: f('dep'), brand: f('brand'), model: f('model'), year: f('make_year', 'makeyear'), color: f('color'), kind: f('kind'), body: f('body'), fuel: f('fuel'), cap: f('capacity'), plate: f('n_reg_new'), person: f('person') };
          if (idx.code < 0 && idx.combined >= 0) idx.code = idx.combined;
          plateMode = idx.vin < 0 && idx.plate >= 0; // архивы до 2021 года: VIN нет, есть номер
          if ((idx.vin < 0 && !plateMode) || idx.d < 0) throw new Error('unexpected header: ' + header.join(','));
          return;
        }
        const c = parseLine(line, delim);
        const vin = plateMode ? '' : normalizeVin(c[idx.vin]); if (!plateMode && vin.length < 5) return;
        const d = parseDate(c[idx.d]); if (!d) return;
        let code = null, oname = idx.name >= 0 ? c[idx.name] : '';
        const raw = idx.code >= 0 ? c[idx.code] : '';
        const m = /^\s*(\d+)\s*(?:-\s*(.*))?$/.exec(raw || '');
        if (m) { code = +m[1]; if (m[2]) oname = m[2]; }
        oname = String(oname || '').replace(/^\s*\d+\s*-\s*/, '');
        if (code !== null && oname) insOp.run(code, oname.trim());
        const plate = idx.plate >= 0 && c[idx.plate] ? normalizePlate(c[idx.plate]) : null;
        const num = (i) => (i >= 0 && c[i] && !Number.isNaN(+c[i]) ? +c[i] : null);
        if (plateMode) {
          if (!plate || plate.length < 4) return;
          insPlate.run(plate, d, code, D(clean(c[idx.brand])), D(clean(c[idx.model])), num(idx.year), D(clean(c[idx.color])), D(clean(c[idx.body])), D(clean(c[idx.fuel])), num(idx.cap), D(clean(c[idx.dep])), id);
        } else insReg.run(vin, d, code, D(clean(c[idx.brand])), D(clean(c[idx.model])), num(idx.year), D(clean(c[idx.color])), D(clean(c[idx.kind])), D(clean(c[idx.body])), D(clean(c[idx.fuel])), num(idx.cap), D(clean(c[idx.dep])), plate, null, id); // person (физлицо/юрлицо) намеренно не сохраняем
        if (d < dmin) dmin = d; if (d > dmax) dmax = d;
        if (++n % 50000 === 0) {
          db.exec('COMMIT'); db.exec('BEGIN'); say({ type: 'progress', name: s.name, rows: n });
          if (statSync(dbPath).size > maxBytes) throw new Error('size limit reached');
        }
      };
      let bytes = 0;
      for await (const chunk of stream) {
        bytes += chunk.length; idle();
        if (bytes > 2.5e9) throw new Error('source too large');           // защита от распаковки-бомбы
        const text = tail + dec.decode(chunk, { stream: true });
        const lines = text.split('\n'); tail = lines.pop();
        if (tail.length > 1e6) throw new Error('line too long');
        for (const l of lines) handle(l.replace(/\r$/, ''));
      }
      if (tail) handle(tail.replace(/\r$/, ''));
      db.exec('COMMIT');
      clearTimeout(idleTimer);
      db.exec('BEGIN');
      if (row) { db.prepare('DELETE FROM reg WHERE src=?').run(row.id); db.prepare('DELETE FROM regp WHERE src=?').run(row.id); db.prepare('DELETE FROM sources WHERE id=?').run(row.id); }
      db.prepare('UPDATE sources SET key=?, done=1, rows=?, dmin=?, dmax=?, updated_at=?, kind=? WHERE id=?').run(s.key, n, dmin, dmax, new Date().toISOString(), plateMode ? 'plate' : 'vin', id);
      db.exec('COMMIT');
      say({ type: 'done', name: s.name, rows: n });
    } catch (e) {
      clearTimeout(idleTimer);
      try { db.exec('ROLLBACK'); } catch { /* not in tx */ }
      try { db.prepare('DELETE FROM reg WHERE src=?').run(id); db.prepare('DELETE FROM regp WHERE src=?').run(id); db.prepare('DELETE FROM sources WHERE id=?').run(id); } catch { /* чистка временных строк */ }
      say({ type: 'error', name: s.name, msg: e.message });
    }
  }
  db.exec('PRAGMA optimize; PRAGMA wal_checkpoint(TRUNCATE);');
  db.close();
  say({ type: 'finished' });
}
main().catch((e) => { say({ type: 'fatal', msg: e.message }); });
