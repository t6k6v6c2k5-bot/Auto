// Monobank Acquiring (api.monobank.ua/docs/acquiring.html): счёт, статус, отмена (возврат), вебхук с подписью ECDSA (X-Sign).
// Тестовый токен с api.monobank.ua даёт песочницу: оплата любой картой, валидной по алгоритму Луна.
import { createVerify } from 'node:crypto';
import { cfg } from './config.js';

const BASE = process.env.MONO_BASE || 'https://api.monobank.ua';
export const UAH = 980;

async function call(method, path, body) {
  const r = await fetch(BASE + path, {
    method, headers: { 'x-token': cfg.monoToken, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  let j = {}; try { j = text ? JSON.parse(text) : {}; } catch { /* пустой ответ */ }
  if (!r.ok) throw new Error(j.errText || j.errorDescription || 'monobank ' + r.status);
  return j;
}

export const createInvoice = ({ order, destination, redirectUrl, webHookUrl }) => call('POST', '/api/merchant/invoice/create', {
  amount: order.amount, ccy: UAH, validity: 3600,
  merchantPaymInfo: { reference: order.id, destination: destination.slice(0, 280), basketOrder: [{ name: destination.slice(0, 128), qty: 1, sum: order.amount, total: order.amount, unit: 'шт.', code: order.plan }] },
  redirectUrl, webHookUrl,
});
export const invoiceStatus = (id) => call('GET', `/api/merchant/invoice/status?invoiceId=${encodeURIComponent(id)}`);
export const cancel = (invoiceId) => call('POST', '/api/merchant/invoice/cancel', { invoiceId });

// оплачено ли: статус success, сумма и валюта совпадают с заказом
export const isPaid = (s, order) => s?.status === 'success' && Number(s.amount) === order.amount && Number(s.ccy || UAH) === UAH && (!s.reference || s.reference === order.id);

// публичный ключ для проверки подписи вебхука; при смене ключа банком обновляем один раз
let pub = { pem: '', t: 0 };
async function pubKey(force = false) {
  if (!force && pub.pem && Date.now() - pub.t < 24 * 3600e3) return pub.pem;
  const j = await call('GET', '/api/merchant/pubkey');
  pub = { pem: Buffer.from(j.key, 'base64').toString('utf8'), t: Date.now() };
  return pub.pem;
}
export const verifyWith = (pem, raw, xSign) => {
  try { const v = createVerify('SHA256'); v.update(raw); v.end(); return v.verify(pem, Buffer.from(String(xSign), 'base64')); } catch { return false; }
};
export async function verifyWebhook(raw, xSign) {
  if (!xSign) return false;
  if (verifyWith(await pubKey(), raw, xSign)) return true;
  if (Date.now() - pub.t < 600e3) return false; // ключ свежий — подпись просто неверна (защита от перезапросов ключа)
  return verifyWith(await pubKey(true), raw, xSign);
}
