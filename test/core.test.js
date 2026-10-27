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

test('фото: выбор снимка нужной модели и года, без интерьеров и деталей', async () => {
  const { pickFile, brandNames, modelNames } = await import('../src/photo.js');
  assert.deepEqual(brandNames('LADA (ВАЗ)'), ['lada', 'vaz']);
  assert.deepEqual(modelNames('21063'), ['21063', '2106']);
  const pg = (title, index, w = 960) => ({ title: 'File:' + title, index, imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/x/' + encodeURIComponent(title), thumbwidth: w, extmetadata: { Artist: { value: '<a href="#">John</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] });
  const pages = [pg('2003 Honda Accord interior.jpg', 1), pg('2019 Honda Accord LX.jpg', 2), pg('Honda Civic 2003.jpg', 3), pg('2003 Honda Accord EX sedan.jpg', 4), pg('2004 Honda Accord coupe.jpg', 5)];
  const r = pickFile(pages, { make: 'HONDA', model: 'Accord', year: 2003 });
  assert.equal(r.title, '2003 Honda Accord EX sedan.jpg'); assert.equal(r.credit, 'John, CC BY-SA 4.0');
  assert.equal(pickFile([pg('2019 Honda Accord LX.jpg', 1)], { make: 'HONDA', model: 'Accord', year: 2003 }), null); // другое поколение
  assert.equal(pickFile([pg('VAZ-2106 in Kyiv.jpg', 1)], { make: 'LADA (ВАЗ)', model: '21063', year: 1986 }).title, 'VAZ-2106 in Kyiv.jpg');
});

test('фото: без точной модели берём любое фото марки', async () => {
  const { pickFile } = await import('../src/photo.js');
  const pg = (title, index) => ({ title: 'File:' + title, index, imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/x/a.jpg', thumbwidth: 960 }] });
  assert.equal(pickFile([pg('2019 Honda Accord LX.jpg', 1)], { make: 'HONDA', model: 'Accord', year: null }).title, '2019 Honda Accord LX.jpg');
  assert.equal(pickFile([pg('Honda Civic 2007 in Kyiv.jpg', 1)], { make: 'HONDA', model: '', year: null }).title, 'Honda Civic 2007 in Kyiv.jpg');
});

test('фото: марки и модели через дефис (Mercedes-Benz S-Class)', async () => {
  const { pickFile } = await import('../src/photo.js');
  const pg = (title) => ({ title: 'File:' + title, index: 1, imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/x/a.jpg', thumbwidth: 960 }] });
  assert.ok(pickFile([pg('2007 Mercedes-Benz S-Class (W221) S 350.jpg')], { make: 'MERCEDES-BENZ', model: 'S-Class', year: 2007 }));
});

test('фото: тёзка марки (ГАЗ — сладость gaz) не подходит, модель ГАЗ 31105-801 разбирается', async () => {
  const { pickFile, modelNames } = await import('../src/photo.js');
  assert.ok(modelNames('31105-801').includes('31105'));
  const pg = (title) => ({ title: 'File:' + title, index: 1, imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/x/a.jpg', thumbwidth: 960 }] });
  assert.equal(pickFile([pg('Gaz (Persian nougat).jpg')], { make: 'ГАЗ', model: '', year: null }), null);
  assert.ok(pickFile([pg('GAZ-31105 Volga in Kyiv.jpg')], { make: 'ГАЗ', model: '31105-801', year: 2008 }));
  assert.ok(pickFile([pg('GAZ Volga car in Lviv.jpg')], { make: 'ГАЗ', model: '', year: null }));
});

test('VIN: ярлыки при копировании не мешают («VIN: …», «ВІН-код …»)', async () => {
  const { validateVin } = await import('../src/vin.js');
  for (const x of ['VIN: 1HGCM82633A004352', 'vin 1HGCM82633A004352', 'ВІН-код: 1HGCM82633A004352', 'номер кузова 1HGCM82633A004352', 'VIN-код 1hgcm 8263 3a00 4352']) assert.ok(validateVin(x).ok, x);
  assert.equal(validateVin('1HGCM82633A004352').vin, '1HGCM82633A004352');
});

test('клиентский JS не использует lookbehind (ломает Safari < 16.4)', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['public/app.js', 'public/tools.js']) assert.ok(!/\(\?<[!=]/.test(readFileSync(new URL('../' + f, import.meta.url), 'utf8')), f);
});


test('рыночная цена: подбор марки и модели, статистика по ценам', async () => {
  const { findMark, findModel, stats, norm } = await import('../src/ria.js');
  const marks = [{ name: 'Toyota', value: 79 }, { name: 'Mercedes-Benz', value: 48 }, { name: 'LADA (ВАЗ)', value: 88 }, { name: 'Land Rover', value: 57 }];
  assert.equal(findMark(marks, 'TOYOTA'), 79);
  assert.equal(findMark(marks, 'MERCEDES-BENZ'), 48);
  assert.equal(findMark(marks, 'Land Rover'), 57);
  assert.equal(findMark(marks, 'Unknownbrand'), null);
  const models = [{ name: 'Camry', value: 698 }, { name: 'RAV4', value: 715 }, { name: '3 Series', value: 1 }, { name: 'Corolla', value: 702 }];
  assert.equal(findModel(models, 'Camry'), 698);
  assert.equal(findModel(models, 'Camry Hybrid'), 698);
  assert.equal(findModel(models, 'RAV4'), 715);
  assert.equal(findModel(models, '3-Series'), 1);
  assert.equal(findModel(models, 'Zzz'), null);
  assert.equal(norm('LADA (ВАЗ)'), 'lada');
  const s = stats([10000, 11000, 12000, 13000, 14000, 100, 99999999]);
  assert.equal(s.total, 5);
  assert.equal(s.median, 12000);
  assert.ok(s.p25 < s.median && s.median < s.p75);
  assert.equal(stats([1000, 2000]), null);
});


test('данные из объявлений по VIN: разбор ответа и пустые ответы', async () => {
  const { parseChips } = await import('../src/riavin.js');
  const j = { chipsData: { chips: [{ entity: 'brandId', name: 'Toyota', value: 79 }, { entity: 'modelId', name: 'Camry', value: 698 }, { entity: 'year', name: '2012 - 2012 рр.', value: { gte: 2012, lte: 2012 } }, { entity: 'mileage', name: 'Пробіг від 188 до 188 тис.км', value: { gte: 188, lte: 188 } }, { entity: 'stateId', name: 'Вінницька', value: 1 }, { entity: 'engineVolume', name: 'x', value: { gte: 2.5, lte: 2.5 } }] } };
  const p = parseChips(j);
  assert.equal(p.brand, 'Toyota'); assert.equal(p.year, 2012); assert.equal(p.mileageK, 188); assert.equal(p.region, 'Вінницька'); assert.equal(p.engine, 2.5);
  assert.equal(parseChips({}), null);
  assert.equal(parseChips({ chipsData: { chips: [] } }), null);
});


test('комментарии: допускаются факты об авто, отклоняются контакты, ссылки, брань и спам', async () => {
  const { validateComment } = await import('../src/comments.js');
  const base = { key: '1HGCM82633A004352', kind: 'vin', cat: 'mileage' };
  const ok = (text, extra = {}) => validateComment({ ...base, text, ...extra });
  assert.equal(ok('На одометре 120 тысяч, а по сервисной книжке было 210 тысяч в 2021 году.').ok, true);
  assert.equal(ok('Номер кузова этого авто 1HGCM82633A004352 совпал с документами, перебивки нет.').ok, true);
  assert.equal(ok('Коротко').error, 'short');
  assert.equal(ok('x'.repeat(401)).error, 'long');
  assert.equal(ok('Звоните по номеру +380 67 123 45 67 всё расскажу про авто').error, 'contact');
  assert.equal(ok('Подробности на сайте www.example.com обязательно посмотрите').error, 'contact');
  assert.equal(ok('Пишите в телеграм @seller_name расскажу про это авто всё').error, 'contact');
  assert.equal(ok('Этот владелец полный мудак и водит как хочет, никому не советую').error, 'rude');
  assert.equal(ok('аааааааааааааааааааааааааа бббббббббббббб').error, 'spam');
  assert.equal(ok('ЭТО АВТО БИТОЕ И С СКРУЧЕННЫМ ПРОБЕГОМ НЕ ПОКУПАЙТЕ ЕГО НИ ЗА КАКИЕ ДЕНЬГИ').error, 'caps');
  assert.equal(ok('Нормальный текст про авто и его пробег, достаточно длинный', { cat: 'zzz' }).error, 'cat');
  assert.equal(ok('Нормальный текст про авто и его пробег, достаточно длинный', { key: 'bad key' }).error, 'bad');
});
