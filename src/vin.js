// Офлайн-валидация VIN (ISO 3779 / 49 CFR 565). Ловит опечатки ДО оплаты.
const TRANSLIT = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9 };
const WEIGHTS = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];

// ярлыки при копировании («VIN: …», «ВІН-код …», «номер кузова …») не считаем частью номера
const LABEL = /(?<![\p{L}\d])(?:vin(?:[\s-]*(?:код|code))?|він(?:[\s-]*код)?|вин(?:[\s-]*код)?|номер\s+кузова|номер\s+кузову|кузов|code)(?![\p{L}\d])/giu;
export const stripLabels = (v) => String(v || '').replace(LABEL, ' ');
export function normalizeVin(v) {
  return stripLabels(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function checkDigit(vin) {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i];
    const val = /\d/.test(c) ? Number(c) : TRANSLIT[c];
    sum += val * WEIGHTS[i];
  }
  const r = sum % 11;
  return r === 10 ? 'X' : String(r);
}

// -> { ok, vin, error: 'length'|'chars'|'checksum'|null, region }
export function validateVin(input) {
  const vin = normalizeVin(input);
  if (vin.length !== 17) return { ok: false, vin, error: 'length' };
  if (/[IOQ]/.test(vin)) return { ok: false, vin, error: 'chars' };
  const na = '12345'.includes(vin[0]); // Северная Америка: контрольная цифра обязательна
  if (na && checkDigit(vin) !== vin[8]) return { ok: false, vin, error: 'checksum' };
  return { ok: true, vin, error: null, region: regionOf(vin) };
}

export function regionOf(vin) {
  const c = vin[0];
  if ('12345'.includes(c)) return c === '2' ? 'CA' : c === '3' ? 'MX' : 'US';
  if ('JKLMNPR'.includes(c)) return 'AS';
  if ('STUVWXYZ'.includes(c)) return 'EU';
  if ('89'.includes(c)) return 'SA';
  return 'OTHER';
}

const YEARS = 'ABCDEFGHJKLMNPRSTVWXY123456789';
export function modelYearHint(vin) {
  const i = YEARS.indexOf(vin[9]);
  if (i < 0) return null;
  const y = 1980 + i;
  // для NA 7-й символ буква => 2010+, цифра => до 2009 (цикл 30 лет)
  const base = /[A-Z]/.test(vin[6]) || !'12345'.includes(vin[0]) ? y + 30 : y;
  return base > new Date().getFullYear() + 1 ? base - 30 : base;
}
