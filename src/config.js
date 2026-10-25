export const cfg = {
  port: Number(process.env.PORT) || 3000,
  baseUrl: (process.env.BASE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : '')).replace(/\/$/, ''),
  dbPath: process.env.DB_PATH || './data/vinscope.db',
  registryDbPath: process.env.REGISTRY_DB_PATH || (process.env.DB_PATH ? process.env.DB_PATH.replace(/[^/]*$/, 'registry.db') : './data/registry.db'),
  registryFromYear: Number(process.env.REGISTRY_FROM_YEAR) || 2013, // с 2021 года архивы содержат VIN; 2013–2020 — только госномер
  registryToYear: Number(process.env.REGISTRY_TO_YEAR) || 0,          // для тестов: ограничить годы и пропустить текущий CSV
  registryMaxGB: Number(process.env.REGISTRY_MAX_GB) || 3.5,
  stripeKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  adminKey: process.env.ADMIN_KEY || '',
  marketcheckKey: process.env.MARKETCHECK_API_KEY || '',
  apibaraKey: process.env.APIBARA_API_KEY || '',                 // аукционы Copart/IAAI (бесплатный тариф: 100 запросов в месяц)
  apibaraBase: process.env.APIBARA_BASE || 'https://apibara.tech/api/v1/vehicle-auction',
  mtsbuReadUrl: process.env.MTSBU_READ_URL || '',                // напр. https://policy-read-test.mtsbu.ua (тест) — read-сервисы Полис Онлайн МТСБУ
  mtsbuToken: process.env.MTSBU_TOKEN || '',                    // Base64(логин:пароль), выдаёт МТСБУ
  insuranceUrl: process.env.INSURANCE_API_URL || '',            // поставщик проверки ОСЦПВ (договор с МТСБУ или партнёр): GET ?vin=&plate=&date=
  insuranceKey: process.env.INSURANCE_API_KEY || '',
  searchKey: process.env.SEARCH_API_KEY || '',                   // Brave Search API: упоминания авто в интернете
  searchBase: process.env.SEARCH_BASE || 'https://api.search.brave.com/res/v1',
  searchDailyLimit: Number(process.env.SEARCH_DAILY_LIMIT) || 300,
  marketcheckBase: (process.env.MARKETCHECK_BASE || 'https://api.marketcheck.com').replace(/\/$/, ''),
  usaDailyLimit: Number(process.env.USA_DAILY_LIMIT) || 500,   // потолок платных запросов в сутки (защита бюджета)
  reportApiUrl: process.env.REPORT_API_URL || '',   // URL вашего поставщика данных (Copart/IAAI/NMVTIS/ЕС)
  reportApiKey: process.env.REPORT_API_KEY || '',
  supportEmail: process.env.SUPPORT_EMAIL || '',            // не показываем вымышленный адрес: задайте реальный
  operatorName: process.env.OPERATOR_NAME || '',            // ФОП/ТОВ, ЄДРПОУ, адреса — для оферты
  operatorDetails: process.env.OPERATOR_DETAILS || '',
  plausible: process.env.PLAUSIBLE_DOMAIN || '',
};
// Без Stripe-ключа сайт работает в режиме запуска: полный отчёт бесплатный (реальные данные), оплата не требуется.
export const paywallOn = () => Boolean(cfg.stripeKey);

// цены в копейках гривны (Stripe: currency uah)
export const CURRENCY = 'uah';
export const PLANS = {
  single: { amount: 9900,  count: 1 },
  pack3:  { amount: 24900, count: 3, popular: true },
  dealer: { amount: 69000, count: 10 },
};
export const price = (kop) => `${(kop / 100).toFixed(kop % 100 ? 2 : 0).replace('.', ',')} ₴`;
