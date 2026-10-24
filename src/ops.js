// Классификация кодов операций реестра ТЗ МВС Украины.
const IMPORT = new Set([70, 71, 72, 76, 77, 100, 105, 180, 221]);
const FIRST = new Set([99, 69, 65]);
const SCRAP = new Set([540, 296, 500]);
const EXPORT = new Set([520]);
const DEREG = new Set([537, 550, 560, 570, 293, 294, 295]);
const PLATE = new Set([410, 412, 420, 421, 431, 435, 434]);
const DOCS = new Set([430, 440, 450, 230, 250, 252, 254, 255, 256, 284]);
export function opKind(code) {
  if (IMPORT.has(code)) return 'import';
  if (FIRST.has(code)) return 'first';
  if (EXPORT.has(code)) return 'export';
  if (SCRAP.has(code)) return 'scrap';
  if (DEREG.has(code)) return 'dereg';
  if ((code >= 300 && code <= 333) || code === 363 || code === 50 || code === 313) return 'owner';
  if (PLATE.has(code)) return 'plate';
  if (DOCS.has(code)) return 'docs';
  if (code >= 340 && code <= 460) return 'change';
  return 'other';
}
export const isKey = (k) => ['import', 'first', 'owner', 'export', 'scrap', 'dereg'].includes(k);
