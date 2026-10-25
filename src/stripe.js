import { createHmac, timingSafeEqual } from 'node:crypto';
import { CURRENCY, cfg } from './config.js';

async function call(method, path, params) {
  const r = await fetch('https://api.stripe.com/v1' + path, {
    method,
    headers: { authorization: `Bearer ${cfg.stripeKey}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: params ? new URLSearchParams(params) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'Stripe error ' + r.status);
  return j;
}

export const createCheckout = ({ order, name, description, successUrl, cancelUrl }) =>
  call('POST', '/checkout/sessions', {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': CURRENCY,
    'line_items[0][price_data][unit_amount]': String(order.amount),
    'line_items[0][price_data][product_data][name]': name,
    'line_items[0][price_data][product_data][description]': description,
    client_reference_id: order.id,
    'metadata[order_id]': order.id,
    ...(order.email ? { customer_email: order.email } : {}),
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

export const getSession = (id) => call('GET', '/checkout/sessions/' + encodeURIComponent(id));
export const refund = (paymentIntent) => call('POST', '/refunds', { payment_intent: paymentIntent });

// Проверка подписи вебхука Stripe (без SDK): допускает несколько v1 (ротация секрета), окно 5 минут
export function verifyWebhook(raw, header) {
  if (!cfg.stripeWebhookSecret || !header) return false;
  const parts = header.split(',').map((p) => p.trim().split('='));
  const ts = Number(parts.find((p) => p[0] === 't')?.[1]);
  const sigs = parts.filter((p) => p[0] === 'v1').map((p) => p[1]).filter(Boolean);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300 || !sigs.length) return false;
  const exp = Buffer.from(createHmac('sha256', cfg.stripeWebhookSecret).update(`${ts}.${raw}`).digest('hex'));
  return sigs.some((x) => { const b = Buffer.from(x); return b.length === exp.length && timingSafeEqual(exp, b); });
}
