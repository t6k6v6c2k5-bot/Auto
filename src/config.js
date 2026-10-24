export const cfg = {
  port: Number(process.env.PORT) || 3000,
  baseUrl: (process.env.BASE_URL || '').replace(/\/$/, ''),
  dbPath: process.env.DB_PATH || './data/vinscope.db',
  stripeKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  adminKey: process.env.ADMIN_KEY || '',
  reportApiUrl: process.env.REPORT_API_URL || '',   // URL вашего поставщика данных (Copart/IAAI/NMVTIS/ЕС)
  reportApiKey: process.env.REPORT_API_KEY || '',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@vinscope.example',
  plausible: process.env.PLAUSIBLE_DOMAIN || '',
};
// Без Stripe-ключа сайт работает в ДЕМО-режиме: оплата имитируется, отчёты — образцы.
export const demoPayments = () => !cfg.stripeKey;
export const demoData = () => !cfg.reportApiUrl;

export const PLANS = {
  basic: { usd: 799,  count: 1,  icon: 'basic' },
  full:  { usd: 1499, count: 1,  icon: 'full', popular: true },
  pack3: { usd: 3499, count: 3,  icon: 'pack' },
  dealer:{ usd: 7900, count: 10, icon: 'dealer' },
};
export const price = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
