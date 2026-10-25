export const SCHEMA = `
PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=10000;
CREATE TABLE IF NOT EXISTS dict(id INTEGER PRIMARY KEY, v TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS ops(code INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE IF NOT EXISTS sources(id INTEGER PRIMARY KEY, key TEXT UNIQUE, name TEXT, modified TEXT, done INTEGER DEFAULT 0, rows INTEGER DEFAULT 0, dmin INTEGER, dmax INTEGER, updated_at TEXT);
CREATE TABLE IF NOT EXISTS reg(vin TEXT NOT NULL, d INTEGER, oper INTEGER, brand INTEGER, model INTEGER, year INTEGER, color INTEGER, kind INTEGER, body INTEGER, fuel INTEGER, cap INTEGER, dep INTEGER, plate TEXT, person TEXT, src INTEGER);
CREATE INDEX IF NOT EXISTS reg_vin ON reg(vin);
CREATE INDEX IF NOT EXISTS reg_plate ON reg(plate) WHERE plate IS NOT NULL;
-- архивы 2013–2020: МВС публиковало их без VIN, поэтому храним историю по госномеру отдельно
CREATE TABLE IF NOT EXISTS regp(plate TEXT NOT NULL, d INTEGER, oper INTEGER, brand INTEGER, model INTEGER, year INTEGER, color INTEGER, body INTEGER, fuel INTEGER, cap INTEGER, dep INTEGER, src INTEGER);
CREATE INDEX IF NOT EXISTS regp_plate ON regp(plate);
`;
// Миграция существующей базы: тип источника (vin — с VIN, plate — только номер)
export function migrate(db) {
  try { db.exec("ALTER TABLE sources ADD COLUMN kind TEXT DEFAULT 'vin'"); } catch { /* колонка уже есть */ }
}
