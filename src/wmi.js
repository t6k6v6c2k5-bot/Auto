// Локальная расшифровка по структуре VIN (ISO 3779) — запасной вариант, когда NHTSA VIN не знает
// (советские/российские/украинские авто, многие европейские). Это НЕ официальная база: марка надёжна по коду
// изготовителя (WMI), модель и год — ориентировочные.
const WMI = {
  XTA: 'LADA (ВАЗ)', XTH: 'ГАЗ', XTT: 'УАЗ', Y6D: 'ЗАЗ',
  WBA: 'BMW', WBS: 'BMW M', WBY: 'BMW (i)', WMW: 'MINI', WDB: 'Mercedes-Benz', WDC: 'Mercedes-Benz', WDD: 'Mercedes-Benz', WDF: 'Mercedes-Benz (фургон)',
  WVW: 'Volkswagen', WV1: 'Volkswagen (комерційні)', WV2: 'Volkswagen (бус)', WAU: 'Audi', WUA: 'Audi Sport', TRU: 'Audi', W0L: 'Opel', W0V: 'Opel', WF0: 'Ford (Німеччина)',
  TMB: 'Škoda', VSS: 'SEAT', VF1: 'Renault', VF3: 'Peugeot', VF7: 'Citroën', ZFA: 'Fiat', ZAR: 'Alfa Romeo', SAL: 'Land Rover', SAJ: 'Jaguar', YV1: 'Volvo', TMA: 'Hyundai (Чехія)', U5Y: 'Kia (Словаччина)',
};
// Классические модели ВАЗ: годы выпуска, чтобы снять неоднозначность года по 10-му символу (1986 или 2016)
const VAZ = { '2101': [1970, 1988], '2102': [1971, 1985], '2103': [1972, 1984], '2104': [1984, 2012], '2105': [1979, 2010], '2106': [1976, 2006], '21063': [1976, 2006], '2107': [1982, 2012], '2108': [1984, 2003], '2109': [1987, 2004], '21099': [1990, 2004], '2121': [1977, 2019] };
const YEARS = 'ABCDEFGHJKLMNPRSTVWXY123456789';

export function localDecode(vin) {
  const make = WMI[vin.slice(0, 3)];
  if (!make) return null;
  const i = YEARS.indexOf(vin[9]);
  const now = new Date().getFullYear() + 1;
  let model = null, years = i >= 0 ? [1980 + i, 2010 + i].filter((y) => y <= now) : [];
  if (vin.startsWith('XTA')) {
    const code = vin.slice(3, 8).replace(/0+$/, '').replace(/^(\d{4})0$/, '$1'); // XTA 21063 -> 21063, XTA 21060 -> 2106
    const key = VAZ[vin.slice(3, 8)] ? vin.slice(3, 8) : VAZ[code] ? code : null;
    if (/^\d{4,5}$/.test(vin.slice(3, 8))) model = vin.slice(3, 8);
    if (key && years.length) { const [a, b] = VAZ[key]; const f = years.filter((y) => y >= a && y <= b); if (f.length) years = f; }
  }
  return { make, model, years, source: 'vin-structure' };
}
