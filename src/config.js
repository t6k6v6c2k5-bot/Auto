export const cfg = {
  port: Number(process.env.PORT) || 3000,
  baseUrl: (process.env.BASE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : '')).replace(/\/$/, ''),
  dbPath: process.env.DB_PATH || './data/vinscope.db',
  registryDbPath: process.env.REGISTRY_DB_PATH || (process.env.DB_PATH ? process.env.DB_PATH.replace(/[^/]*$/, 'registry.db') : './data/registry.db'),
  registryFromYear: Number(process.env.REGISTRY_FROM_YEAR) || 2021,
  registryMaxGB: Number(process.env.REGISTRY_MAX_GB) || 3.5,
  stripeKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  adminKey: process.env.ADMIN_KEY || '',
  reportApiUrl: process.env.REPORT_API_URL || '',   // URL вашего поставщика данных (Copart/IAAI/NMVTIS/ЕС)
  reportApiKey: process.env.REPORT_API_KEY || '',
  supportEmail: process.env.SUPPORT_EMAIL || '',            // не показываем вымышленный адрес: задайте реальный
  operatorName: process.env.OPERATOR_NAME || '',            // ФОП/ТОВ, ЄДРПОУ, адреса — для оферты
  operatorDetails: process.env.OPERATOR_DETAILS || '',
  plausible: process.env.PLAUSIBLE_DOMAIN || '',
};
// Без Stripe-ключа сайт работает в режиме запуска: полный отчёт бесплатный (реальные данные), оплата не требуется.
export const paywallOn = () => Boolean(cfg.stripeKey);

export const PLANS = {
  single: { usd: 599,  count: 1 },
  pack3:  { usd: 1499, count: 3, popular: true },
  dealer: { usd: 3900, count: 10 },
};
export const price = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
