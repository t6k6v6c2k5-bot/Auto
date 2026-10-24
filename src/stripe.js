import { createHmac, timingSafeEqual } from 'node:crypto';
import { cfg } from './config.js';

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
    'line_items[0][price_data][currency]': 'usd',
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

// Проверка подписи вебхука Stripe (без SDK)
export function verifyWebhook(raw, header) {
  if (!cfg.stripeWebhookSecret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) return false;
  const exp = createHmac('sha256', cfg.stripeWebhookSecret).update(`${parts.t}.${raw}`).digest('hex');
  const a = Buffer.from(exp), b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
