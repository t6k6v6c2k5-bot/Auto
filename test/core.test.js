import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { validateVin, checkDigit, regionOf } from '../src/vin.js';
import { normalizePlate, looksLikePlate } from '../src/plate.js';
import { opKind } from '../src/ops.js';
import { parseLine, detectDelimiter } from '../src/csv.js';
import { unzipFirstEntry } from '../src/zipstream.js';
import { riskScore } from '../src/risk.js';
import { t, dict, LANGS } from '../src/i18n.js';

test('VIN: корректный, опечатка, запрещённые символы', () => {
  assert.equal(validateVin('1HGCM82633A004352').ok, true);
  assert.equal(validateVin('1HGCM82633A004353').error, 'checksum');
  assert.equal(validateVin('1HGCM82633A00435').error, 'length');
  assert.equal(validateVin('1HGCM82633A00435O').error, 'chars');
  assert.equal(checkDigit('1HGCM82633A004352'), '3');
  assert.equal(validateVin('WBAKV210300R24692').ok, true); // неамериканский VIN: контрольная цифра не обязательна
  assert.equal(regionOf('WBAKV210300R24692'), 'EU');
});

test('Номера: кириллица и латиница сводятся к одному виду', () => {
  assert.equal(normalizePlate('ка 3682 нк'), 'KA3682HK');
  assert.equal(normalizePlate('KA3682HK'), 'KA3682HK');
  assert.ok(looksLikePlate('KA3682HK'));
  assert.ok(!looksLikePlate('1HGCM82'));
  assert.ok(!looksLikePlate('ABCDEF'));
});

test('Классификация операций реестра', () => {
  assert.equal(opKind(100), 'import');
  assert.equal(opKind(315), 'owner');
  assert.equal(opKind(540), 'scrap');
  assert.equal(opKind(520), 'export');
  assert.equal(opKind(410), 'plate');
  assert.equal(opKind(340), 'change');
});

test('CSV: кавычки, пустые поля, разделители', () => {
  assert.deepEqual(parseLine('"P";"a;b";"x""y";01.01.25;;""', ';'), ['P', 'a;b', 'x"y', '01.01.25', '', '']);
  assert.deepEqual(parseLine('a,b,,', ','), ['a', 'b', '', '']);
  assert.equal(detectDelimiter('"A";"B";"C"'), ';');
  assert.equal(detectDelimiter('"a","b","c"'), ',');
});

test('ZIP-поток: распаковка deflate по частям', async () => {
  const payload = Buffer.from('VIN;OPER\n' + 'X1;315\n'.repeat(5000));
  const comp = deflateRawSync(payload);
  const name = Buffer.from('r.csv');
  const hdr = Buffer.alloc(30); hdr.writeUInt32LE(0x04034b50, 0); hdr.writeUInt16LE(8, 8); hdr.writeUInt16LE(name.length, 26);
  const zip = Buffer.concat([hdr, name, comp, Buffer.alloc(40)]);
  const chunks = []; for (let i = 0; i < zip.length; i += 7) chunks.push(zip.subarray(i, i + 7)); // крошечные куски
  const web = Readable.toWeb(Readable.from(chunks));
  let out = ''; for await (const c of unzipFirstEntry(web)) out += c;
  assert.equal(out, payload.toString());
});

test('Risk Score: розыск даёт максимальный риск, чистое авто — низкий', () => {
  const clean = riskScore({ decoded: { found: true, year: 2020 }, recalls: [], wanted: [], ua: { summary: { owners: 1, vehicle: { year: 2020 } } }, region: 'EU', complaints: { fires: 0 }, mismatch: [] });
  assert.equal(clean.level, 'low');
  const wanted = riskScore({ decoded: { found: true, year: 2020 }, recalls: [], wanted: [{}], ua: { rows: [] }, region: 'EU', complaints: {}, mismatch: [] });
  assert.ok(wanted.score >= 92 && wanted.level === 'high');
  const swap = riskScore({ decoded: { found: true, year: 2020 }, recalls: [], wanted: [], ua: null, region: 'EU', complaints: {}, mismatch: [{ field: 'year' }] });
  assert.ok(swap.score > clean.score);
});

test('i18n: во всех языках одинаковый набор ключей', () => {
  const base = Object.keys(dict('uk')).sort();
  for (const l of LANGS) assert.deepEqual(Object.keys(dict(l)).sort(), base, l);
  assert.equal(t('en', 'f_owners', { n: 4 }), 'Owner changes: 4');
});
