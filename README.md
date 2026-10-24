# VINScope — платная проверка авто по VIN (США · Канада · ЕС)

Сайт на Node 22 без внешних зависимостей (встроенный SQLite). Языки: uk / ru / en. Деплой — Railway.

## Что внутри
- **Бесплатно:** офлайн-проверка VIN (контрольная цифра), расшифровка и отзывные кампании NHTSA (реальные данные), **Risk Score 0–100** с объяснением.
- **Платно:** тарифы Basic $7.99 / Full $14.99 / Pack 3 $34.99 / Dealer 10 $79 (Stripe Checkout, `src/config.js`).
- **Ноу-хау:** антиопечатка VIN до оплаты · бесплатный «пре-скан» количества записей · автовозврат, если данных нет · отчёт по защищённой ссылке · пакеты по коду (B2B/автоподбор).
- **SEO:** hreflang, canonical, sitemap.xml, robots.txt, JSON-LD (Organization, FAQPage), OG-теги, посадочная «Авто из США».
- `/admin?key=ADMIN_KEY` — выручка, заказы, топ-VIN.

## Режимы
Без `STRIPE_SECRET_KEY` оплата **имитируется**; без `REPORT_API_URL` отчёты — **образцы** (виден жёлтый баннер). Это нужно, чтобы показывать сайт до подключения источников.

## Переменные окружения (Railway → Variables)
| Переменная | Назначение |
|---|---|
| `STRIPE_SECRET_KEY` | боевая оплата; вебхук: `POST /webhook/stripe`, событие `checkout.session.completed` |
| `STRIPE_WEBHOOK_SECRET` | подпись вебхука |
| `REPORT_API_URL`, `REPORT_API_KEY` | ваш поставщик данных (Copart/IAAI/NMVTIS/ЕС). `GET ?vin=&plan=` → `{found, source, sections:{title,odometer[],auction[],owners,accidents,export}}` |
| `BASE_URL` | `https://ваш-домен` (для sitemap/canonical) |
| `ADMIN_KEY` | доступ к /admin |
| `SUPPORT_EMAIL`, `PLAUSIBLE_DOMAIN` | контакты, аналитика |
| `DB_PATH` | путь к SQLite; **подключите Volume** и укажите `/data/vinscope.db`, иначе заказы пропадут при редеплое |

## Запуск
`npm start` → http://localhost:3000
