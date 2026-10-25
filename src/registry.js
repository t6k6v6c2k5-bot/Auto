// Чтение реестра ТЗ МВС (SQLite) + управление фоновым загрузчиком.
import { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import { mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { cfg } from './config.js';
import { opKind, isKey } from './ops.js';
import { SCHEMA, migrate } from './registry-schema.js';

mkdirSync(dirname(cfg.registryDbPath), { recursive: true });
const db = new DatabaseSync(cfg.registryDbPath);
db.exec(SCHEMA); migrate(db);

export const status = { running: false, current: null, rows: 0, lastError: null, lastFinished: null, startedAt: null };

const Q = {
  byVin: db.prepare(`SELECT r.d, r.oper, o.name opname, b.v brand, m.v model, r.year, c.v color, k.v kind, bd.v body, f.v fuel, r.cap, dp.v dep, r.plate
    FROM reg r LEFT JOIN ops o ON o.code=r.oper LEFT JOIN dict b ON b.id=r.brand LEFT JOIN dict m ON m.id=r.model LEFT JOIN dict c ON c.id=r.color
    LEFT JOIN dict k ON k.id=r.kind LEFT JOIN dict bd ON bd.id=r.body LEFT JOIN dict f ON f.id=r.fuel LEFT JOIN dict dp ON dp.id=r.dep
    WHERE r.vin=? ORDER BY r.d, r.rowid`),
  byPlate: db.prepare('SELECT vin, MAX(d) d FROM reg WHERE plate=? GROUP BY vin ORDER BY d DESC LIMIT 5'),
  plateRows: db.prepare(`SELECT r.d, r.oper, o.name opname, b.v brand, m.v model, r.year, c.v color, bd.v body, f.v fuel, r.cap, dp.v dep
    FROM regp r LEFT JOIN ops o ON o.code=r.oper LEFT JOIN dict b ON b.id=r.brand LEFT JOIN dict m ON m.id=r.model LEFT JOIN dict c ON c.id=r.color
    LEFT JOIN dict bd ON bd.id=r.body LEFT JOIN dict f ON f.id=r.fuel LEFT JOIN dict dp ON dp.id=r.dep
    WHERE r.plate=? ORDER BY r.d, r.rowid LIMIT 500`),
  sources: db.prepare("SELECT name, rows, dmin, dmax, done, updated_at, COALESCE(kind,'vin') kind FROM sources ORDER BY dmax DESC"),
};
const fmt = (d) => (d ? `${String(d).slice(0, 4)}-${String(d).slice(4, 6)}-${String(d).slice(6, 8)}` : null);

function cov(kind) {
  const rows = Q.sources.all();
  const done = rows.filter((r) => r.done && r.dmin && (!kind || r.kind === kind));
  return {
    from: done.length ? fmt(Math.min(...done.map((r) => r.dmin))) : null,
    to: done.length ? fmt(Math.max(...done.map((r) => r.dmax))) : null,
    records: done.reduce((a, r) => a + r.rows, 0), sources: rows.length, indexing: status.running, ready: done.length > 0,
    sizeMB: existsSync(cfg.registryDbPath) ? Math.round(statSync(cfg.registryDbPath).size / 1e6) : 0,
  };
}
// Покрытие реестра с VIN (2021+) — для проверки по VIN; архив только по номеру (2013–2020) — отдельно
export const coverage = () => cov('vin');
export const plateCoverage = () => cov('plate');
export const totalCoverage = () => cov(null);

export function historyByVin(vin) {
  const rows = Q.byVin.all(vin).map((r) => ({ ...r, date: fmt(r.d), opkind: opKind(r.oper) }));
  if (!rows.length) return { rows: [], summary: null };
  const last = rows[rows.length - 1];
  const veh = [...rows].reverse().find((r) => r.brand) || last;
  const owners = rows.filter((r) => r.opkind === 'owner').length;
  const imp = rows.find((r) => r.opkind === 'import');
  const plates = [...new Set(rows.map((r) => r.plate).filter(Boolean))];
  const lastKey = [...rows].reverse().find((r) => isKey(r.opkind));
  return {
    rows,
    summary: {
      records: rows.length, first: rows[0].date, last: last.date, owners, plates,
      imported: imp ? { date: imp.date, op: imp.opname } : null,
      deregistered: lastKey && ['export', 'scrap', 'dereg'].includes(lastKey.opkind) ? { kind: lastKey.opkind, date: lastKey.date, op: lastKey.opname } : null,
      vehicle: { brand: veh.brand, model: veh.model, year: veh.year, color: veh.color, kind: veh.kind, body: veh.body, fuel: veh.fuel, cap: veh.cap },
    },
  };
}
export const vinsByPlate = (plate) => Q.byPlate.all(plate).map((r) => ({ vin: r.vin, date: fmt(r.d) }));

// История по номеру из архивов без VIN. Номер мог переходить к другим авто, поэтому группируем по марке/модели/году.
export function historyByPlate(plate) {
  const rows = Q.plateRows.all(plate).map((r) => ({ ...r, date: fmt(r.d), opkind: opKind(r.oper), plate }));
  const groups = new Map();
  for (const r of rows) {
    const key = [r.brand, r.model, r.year].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const list = [...groups.values()].map((g) => {
    const last = g[g.length - 1];
    const lastKey = [...g].reverse().find((r) => isKey(r.opkind));
    return {
      rows: g,
      summary: {
        records: g.length, first: g[0].date, last: last.date, owners: g.filter((r) => r.opkind === 'owner').length, plates: [plate],
        imported: (() => { const i = g.find((r) => r.opkind === 'import'); return i ? { date: i.date, op: i.opname } : null; })(),
        deregistered: lastKey && ['export', 'scrap', 'dereg'].includes(lastKey.opkind) ? { kind: lastKey.opkind, date: lastKey.date, op: lastKey.opname } : null,
        vehicle: { brand: last.brand, model: last.model, year: last.year, color: last.color, body: last.body, fuel: last.fuel, cap: last.cap },
      },
    };
  }).sort((a, b) => (b.summary.last > a.summary.last ? 1 : -1));
  return { rows, groups: list };
}

// ---- управление воркером ----
let worker = null;
export function startRegistry() {
  if (process.env.REGISTRY_DISABLED === '1') return;
  const run = () => {
    if (worker) return;
    status.running = true; status.startedAt = new Date().toISOString();
    worker = new Worker(new URL('./registry-worker.js', import.meta.url), { workerData: { dbPath: cfg.registryDbPath, fromYear: cfg.registryFromYear, toYear: cfg.registryToYear, maxBytes: cfg.registryMaxGB * 1e9 } });
    worker.on('message', (m) => {
      if (m.type === 'start') { status.current = m.name; status.rows = 0; console.log('registry: loading', m.name); }
      else if (m.type === 'progress') status.rows = m.rows;
      else if (m.type === 'done') console.log(`registry: ${m.name} done, ${m.rows} rows`);
      else if (m.type === 'error' || m.type === 'fatal') { status.lastError = `${m.name || ''} ${m.msg}`; console.error('registry error:', status.lastError); }
      else if (m.type === 'finished') { status.lastFinished = new Date().toISOString(); status.current = null; }
    });
    const end = () => { worker = null; status.running = false; status.current = null; };
    worker.on('error', (e) => { status.lastError = e.message; console.error('registry worker crashed:', e.message); end(); setTimeout(run, 10 * 60e3).unref(); });
    worker.on('exit', end);
  };
  setTimeout(run, 3000).unref();
  setInterval(run, 24 * 3600e3).unref(); // раз в сутки проверяем обновления источников
}
