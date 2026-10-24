// Нормализация украинских госномеров: кириллица и латиница-двойники приводятся к одной латинице.
const MAP = { А:'A',В:'B',Е:'E',І:'I',К:'K',М:'M',Н:'H',О:'O',Р:'P',С:'C',Т:'T',Х:'X',У:'Y',Ι:'I',Ο:'O' };
export function normalizePlate(s) {
  return [...String(s || '').toUpperCase()].map((c) => MAP[c] || c).join('').replace(/[^A-Z0-9]/g, '');
}
// Форматы: АА1234ВВ, 1234АА (транзит/старые), 12345АА, АА123А, 1234ААА и т.п.
const PLATE_RE = /^(?:[A-Z]{2}\d{4}[A-Z]{2}|\d{5}[A-Z]{2,3}|\d{4}[A-Z]{2,3}|[A-Z]{2}\d{3,5}[A-Z]?|[A-Z]\d{4,6}[A-Z]{0,2})$/;
export const looksLikePlate = (norm) => norm.length >= 5 && norm.length <= 8 && /\d/.test(norm) && /[A-Z]/.test(norm) && PLATE_RE.test(norm);
