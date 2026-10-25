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
  assert.equal(clean.factors.reduce((a, f) => a + f.pts, 0), clean.score, 'сумма весов равна баллу');
  assert.equal(wanted.factors.reduce((a, f) => a + f.pts, 0), wanted.score);
  const swap = riskScore({ decoded: { found: true, year: 2020 }, recalls: [], wanted: [], ua: null, region: 'EU', complaints: {}, mismatch: [{ field: 'year' }] });
  assert.ok(swap.score > clean.score);
});

test('i18n: во всех языках одинаковый набор ключей', () => {
  const base = Object.keys(dict('uk')).sort();
  for (const l of LANGS) assert.deepEqual(Object.keys(dict(l)).sort(), base, l);
  assert.equal(t('en', 'f_owners', { n: 4 }), 'Owner changes: 4');
});

test('RDW: форматы нидерландских номеров', async () => {
  const { looksLikeNlPlate, normalizeRdw } = await import('../src/rdw.js');
  for (const p of ['GJ123B', '12ABC3', '1ABC23', 'AB1234', '12AB34', 'AB12CD']) assert.ok(looksLikeNlPlate(p), p);
  for (const p of ['ABCDEF', '123456', 'AB123', 'AB12345']) assert.ok(!looksLikeNlPlate(p), p);
  const n = normalizeRdw({ kenteken: 'GJ123B', merk: 'PEUGEOT', datum_eerste_toelating: '20150529', wam_verzekerd: 'Ja', export_indicator: 'Nee' }, [{ brandstof_omschrijving: 'Benzine', nettomaximumvermogen: '60' }]);
  assert.equal(n.firstAdmission, '2015-05-29'); assert.equal(n.insured, true); assert.equal(n.exported, false); assert.equal(n.kw, 60);
});

test('fueleconomy: подбор комплектации и перевод единиц', async () => {
  const { pickOptions, parseOption, l100, gpkm } = await import('../src/fueleco.js');
  assert.deepEqual(parseOption('Auto 5-spd, 6 cyl, 3.0 L'), { auto: true, cyl: 6, displ: 3 });
  const opts = [{ text: 'Auto 5-spd, 4 cyl, 2.4 L', value: '1' }, { text: 'Auto 5-spd, 6 cyl, 3.0 L', value: '2' }, { text: 'Man 6-spd, 6 cyl, 3.0 L', value: '3' }];
  assert.deepEqual(pickOptions(opts, { engine: '3.0L · 6 cyl', transmission: 'Automatic' }).map((o) => o.value), ['2']);
  assert.equal(pickOptions(opts, { engine: '', transmission: '' }).length, 3);
  assert.equal(l100(25), 9.4); assert.equal(gpkm(355.48), 221);
});

test('Transport Canada: разбор описания отзыва', async () => {
  const { parseSummary } = await import('../src/canada.js');
  const row = [{ Name: 'RECALL_NUMBER_NUM', Value: { Literal: '2018523' } }, { Name: 'SYSTEM_TYPE_ETXT', Value: { Literal: 'Airbag' } }, { Name: 'COMMENT_ETXT', Value: { Literal: 'Issue: \r\nAirbag may over-deploy.\r\n\r\nSafety Risk: \r\nInjury.\r\n\r\nCorrective Actions: \r\nDealers replace it.' } }];
  const s = parseSummary(row);
  assert.equal(s.issue, 'Airbag may over-deploy.'); assert.equal(s.risk, 'Injury.'); assert.equal(s.system, 'Airbag');
  assert.match(parseSummary([{ Name: 'COMMENT_ETXT', Value: { Literal: 'Plain text. Correction: fix.' } }]).issue, /^Plain text\./);
});

test('mentions: фильтр точного совпадения, очистка контактов, классификация', async () => {
  const { normalizeResults, scrub, classify, plateCyr } = await import('../src/mentions.js');
  assert.equal(scrub('Honda Accord, тел. +380 67 123 45 67, a@b.com'), 'Honda Accord, тел. ,');
  assert.equal(plateCyr('AE5340IM'), 'АЕ5340ІМ');
  assert.equal(classify('olx.ua', 'продаж'), 'sale'); assert.equal(classify('copart.com', ''), 'auction');
  assert.equal(classify('news.ua', 'Страшне ДТП'), 'accident'); assert.equal(classify('x.ua', 'авто в розшуку'), 'wanted');
  const json = { web: { results: [
    { url: 'https://www.olx.ua/d/1', title: 'Продам Honda 1HGCM82633A004352', description: '', page_age: '2025-03-01T00:00:00' },
    { url: 'https://example.com/2', title: 'Unrelated', description: 'VIN 1HGCM82633A004999' },
    { url: 'https://example.com/3', title: 'Other', description: 'no id here' },
  ] } };
  const r = normalizeResults(json, ['1HGCM82633A004352']);
  assert.equal(r.length, 1); assert.equal(r[0].domain, 'olx.ua'); assert.equal(r[0].kind, 'sale'); assert.equal(r[0].published, '2025-03-01');
});

test('insurance: нормализация ответа поставщика ОСЦПВ', async () => {
  const { normalizeInsurance } = await import('../src/insurance.js');
  assert.deepEqual(normalizeInsurance({ status: 'ACTIVE', insurer: 'Х', from: '2026-01-01T00:00', to: '2026-12-31' }), { status: 'active', insurer: 'Х', from: '2026-01-01', to: '2026-12-31', kind: '' });
  assert.equal(normalizeInsurance({ active: false }).status, 'none');
  assert.equal(normalizeInsurance({}).status, 'unknown');
});

test('МТСБУ: разбор GetStatus и GetHistory', async () => {
  const { normalizeStatus, normalizeHistory } = await import('../src/mtsbu.js');
  const st = normalizeStatus({ SearchResult: [{ 'FContract.DViewStatus.Code': 'Canceled ', 'FContract.DInsurer.Name': 'А' }, { 'FContract.DViewStatus.Code': 'Active ', 'FContract.DInsurer.Name': 'УНІКА', 'FContract.DVehicleType.Name': 'легковий;', 'FContract.PropertyLimit': '50000,0000', 'FContract.LifeLimit': '100000,0000', 'FContract.Franchise': '500,0000' }] });
  assert.equal(st.status, 'active'); assert.equal(st.insurer, 'УНІКА'); assert.equal(st.kind, 'легковий'); assert.deepEqual(st.limits, { property: 50000, life: 100000, franchise: 500 });
  assert.equal(normalizeStatus({ SearchResult: [{ 'FContract.DViewStatus.Code': 'Canceled' }] }).status, 'none');
  assert.equal(normalizeStatus({ SearchResult: [{ 'FContract.DViewStatus.Code': 'Reserve' }] }).status, 'pending');
  const h = normalizeHistory({ BMClass: '12', BMCoef: '0,91', SearchResult: [{ 'FContract.StartYear': '2014', 'FContract.CaseCount': '' }, { 'FContract.StartYear': '2015', 'FContract.DInsurer.Name': 'СКАЙД', 'FContract.CaseCount': '2', 'FContract.TotalClaimspaid': '1500,5' }] });
  assert.equal(h.bmClass, '12'); assert.equal(h.claims, 2); assert.equal(h.policies[0].year, '2015'); assert.equal(h.policies[0].paid, 1500.5);
});
