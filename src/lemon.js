// Lemon Squeezy (Merchant of Record): продаёт от своего имени, поэтому работает без ФОП; выплаты — через PayPal.
// Цена передаётся как custom_price в валюте магазина (по умолчанию USD, пересчёт из гривны по курсу НБУ).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cfg } from './config.js';
import { nbuRate } from './nbu.js';

const BASE = process.env.LEMON_BASE || 'https://api.lemonsqueezy.com/v1';
async function call(method, path, body) {
  const r = await fetch(BASE + path, {
    method, headers: { authorization: `Bearer ${cfg.lemonKey}`, accept: 'application/vnd.api+json', 'content-type': 'application/vnd.api+json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.errors?.[0]?.detail || 'lemonsqueezy ' + r.status);
  return j;
}

// сумма заказа (копейки гривны) -> центы валюты магазина
export async function chargeCents(amountKop) {
  const cur = cfg.lemonCurrency;
  if (cur === 'UAH') return amountKop;
  const rate = (await nbuRate(cur))?.rate;
  if (!rate) throw new Error('no NBU rate for ' + cur);
  return Math.ceil(amountKop / rate);
}

export async function createCheckout({ order, name, redirectUrl }) {
  const cents = await chargeCents(order.amount);
  const j = await call('POST', '/checkouts', { data: { type: 'checkouts', attributes: {
    custom_price: cents,
    product_options: { name, redirect_url: redirectUrl, enabled_variants: [Number(cfg.lemonVariant)] },
    checkout_data: { email: order.email || undefined, custom: { order_id: order.id } },
  }, relationships: { store: { data: { type: 'stores', id: String(cfg.lemonStore) } }, variant: { data: { type: 'variants', id: String(cfg.lemonVariant) } } } } });
  return { url: j.data?.attributes?.url, id: j.data?.id, cents };
}
export const refund = (orderId) => call('POST', `/orders/${encodeURIComponent(orderId)}/refund`, { data: { type: 'orders', id: String(orderId), attributes: {} } });

export function verifyWebhook(raw, sig) {
  if (!cfg.lemonSecret || !sig) return false;
  const exp = Buffer.from(createHmac('sha256', cfg.lemonSecret).update(raw).digest('hex'));
  const got = Buffer.from(String(sig));
  return exp.length === got.length && timingSafeEqual(exp, got);
}
// оплачено: order_created, статус paid, наш номер заказа и сумма без налога не меньше выставленной
export function paidOrder(ev, expectCents) {
  const a = ev?.data?.attributes || {};
  if (ev?.meta?.event_name !== 'order_created' || a.status !== 'paid') return null;
  if (String(a.currency || '').toUpperCase() !== cfg.lemonCurrency || Number(a.subtotal) < expectCents) return null;
  return { orderId: ev.meta?.custom_data?.order_id, lemonId: String(ev.data?.id || '') };
}
