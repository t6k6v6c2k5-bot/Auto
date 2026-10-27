// Собственная аналитика для админки: посещения страниц, проверки, источники трафика, ошибки, скорость.
// Личные данные не храним: IP не записывается, «посетитель» — ежедневно меняющийся хеш (IP + браузер + дата + соль),
// по нему нельзя отследить человека между днями. Записи старше 60 дней удаляются.
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db.js';

db.exec(`
CREATE TABLE IF NOT EXISTS hits(ts INTEGER NOT NULL, day TEXT NOT NULL, hour INTEGER NOT NULL, kind TEXT NOT NULL, path TEXT, lang TEXT, ref TEXT, dev TEXT, vid TEXT, status INTEGER, ms INTEGER, note TEXT);
CREATE INDEX IF NOT EXISTS hits_day ON hits(day, kind);
CREATE INDEX IF NOT EXISTS hits_ts ON hits(ts);
`);
try { db.exec('ALTER TABLE hits ADD COLUMN agent TEXT'); } catch { /* колонка уже есть */ }
const SALT = randomBytes(8).toString('hex');
const TZ = 'Europe/Kyiv';
const dayFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });
const stampFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
export const dayOf = (ts) => dayFmt.format(ts);
export const fmtTs = (ts) => (ts ? stampFmt.format(ts) : '—');
const hourOf = (ts) => Number(hourFmt.format(ts)) % 24;
// последние n календарных дней по Киеву; арифметика по датам, а не по 24-часовым сдвигам (переход на летнее время не дублирует и не теряет день)
export const daysBack = (n) => { const [y, m, d] = dayOf(Date.now()).split('-').map(Number); return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1, d - (n - 1 - i))).toISOString().slice(0, 10)); };

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|monitor|uptime|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch|headless|lighthouse|pingdom|statuscake|zabbix|scanner|bytespider|barkrowler|dataprovider|seokicks|ahrefs|semrush|mj12|dotbot|blexbot|serpstat|netestate|zoominfo|scrapy|httpclient|libwww|requests|http-client|nmap|masscan|nikto|sqlmap|zgrab|censys|shodan|expanse|phantom|selenium|puppeteer|playwright|check_http|^$/i;
// настоящий браузер всегда шлёт Accept-Language; его отсутствие у «браузерного» UA — признак скрипта
const isBot = (ua, h) => BOT.test(ua) || !h['accept-language'];
export const isBotReq = (req) => isBot(String(req.headers['user-agent'] || ''), req.headers);
const devOf = (ua, h = { 'accept-language': 'x' }) => (isBot(ua, h) ? 'bot' : /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop');
// короткое имя клиента для диагностики: имя бота либо семейство браузера
const agentOf = (ua) => {
  if (!ua) return '(пусто)';
  const b = /([A-Za-z0-9_.-]*(?:bot|crawl|spider|slurp|preview)[A-Za-z0-9_.-]*)/i.exec(ua) || /\b(curl|wget|python-requests|python|go-http-client|okhttp|axios|node-fetch|scrapy|headlesschrome|playwright|puppeteer|bytespider|barkrowler)\b/i.exec(ua);
  if (b) return b[1].slice(0, 30);
  return /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'другой';
};
const SKIP = /^\/(healthz|admin|webhook|api\/lotimg)|\.[a-z0-9]{2,5}$/i;

const ins = db.prepare('INSERT INTO hits(ts,day,hour,kind,path,lang,ref,dev,vid,status,ms,note,agent) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');

// вызывается после отправки ответа; ошибки аналитики никогда не ломают сайт
export function track(req, res, t0, ip, errMsg = '') {
  try {
    if (req.method !== 'GET') return;
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;
    if (SKIP.test(p)) return;
    const m = /^\/(uk|ru|en)(\/.*)?$/.exec(p);
    const isApi = p.startsWith('/api/');
    if (!m && !isApi && res.statusCode !== 404) return; // корень и служебные редиректы не считаем
    const rest = m ? (m[2] || '/').replace(/\/$/, '') || '/' : p;
    const status = res.statusCode;
    if (status >= 300 && status < 400 && !(rest === '/check' && req.evNote === 'invalid')) return;
    const ua = String(req.headers['user-agent'] || '');
    const dev = devOf(ua, req.headers);
    const ts = Date.now(), day = dayOf(ts);
    let ref = '';
    const rh = String(req.headers.referer || '');
    if (rh) { try { const h = new URL(rh).host.replace(/^www\./, ''); if (h !== String(req.headers.host || '').replace(/^www\./, '')) ref = h.slice(0, 60); } catch { /* мусор */ } }
    const utm = u.searchParams.get('utm_source'); if (utm) ref = ('utm:' + utm).slice(0, 40);
    const vid = createHash('sha256').update(`${ip}|${ua}|${day}|${SALT}`).digest('hex').slice(0, 12);
    const kind = dev === 'bot' ? 'bot' : status >= 500 ? 'error' : isApi ? 'api' : rest === '/check' ? 'check' : 'page';
    ins.run(ts, day, hourOf(ts), kind, rest.slice(0, 80), m ? m[1] : '', ref, dev, vid, status, Date.now() - t0, kind === 'error' ? errMsg.slice(0, 160) : (req.evNote || ''), agentOf(ua));
  } catch { /* статистика не критична */ }
}

export const purgeHits = () => {
  let n = db.prepare('DELETE FROM hits WHERE ts<?').run(Date.now() - 60 * 864e5).changes;
  // страховка от разрастания (наплыв ботов): держим не больше 400 тыс. записей, самые старые удаляем
  const total = db.prepare('SELECT COUNT(*) c FROM hits').get().c;
  if (total > 400000) n += db.prepare('DELETE FROM hits WHERE rowid IN (SELECT rowid FROM hits ORDER BY ts LIMIT ?)').run(total - 300000).changes;
  return n;
};

const all = (sql, ...a) => db.prepare(sql).all(...a);
const one = (sql, ...a) => db.prepare(sql).get(...a);

// посуточная сводка с заполнением пропущенных дней нулями
export function daily(n) {
  const days = daysBack(n);
  const rows = all(`SELECT day,
      COUNT(DISTINCT CASE WHEN kind IN ('page','check') AND status<400 THEN vid END) visitors, COUNT(DISTINCT CASE WHEN kind='check' THEN vid END) checkers,
      SUM(kind IN ('page','check') AND status<400) views, SUM(kind='check') checks, SUM(kind='bot') bots, SUM(kind='error') errors
    FROM hits WHERE day>=? GROUP BY day`, days[0]);
  const by = new Map(rows.map((r) => [r.day, r]));
  return days.map((d) => { const r = by.get(d) || {}; return { day: d, visitors: r.visitors || 0, views: r.views || 0, checks: r.checks || 0, checkers: r.checkers || 0, bots: r.bots || 0, errors: r.errors || 0 }; });
}

export function breakdown(n) {
  const from = daysBack(n)[0];
  const human = "kind IN ('page','check')";
  return {
    pages: all(`SELECT path, COUNT(*) c, COUNT(DISTINCT vid) u, CAST(AVG(ms) AS INTEGER) avg FROM hits WHERE day>=? AND ${human} AND status<400 GROUP BY path ORDER BY c DESC LIMIT 15`, from),
    refs: all(`SELECT CASE WHEN ref='' THEN '(прямой заход)' ELSE ref END ref, COUNT(*) c, COUNT(DISTINCT vid) u FROM hits WHERE day>=? AND ${human} GROUP BY ref ORDER BY c DESC LIMIT 12`, from),
    langs: all(`SELECT lang, COUNT(*) c FROM hits WHERE day>=? AND ${human} AND lang<>'' GROUP BY lang ORDER BY c DESC`, from),
    devs: all(`SELECT dev, COUNT(*) c FROM hits WHERE day>=? AND kind<>'error' GROUP BY dev ORDER BY c DESC`, from),
    notfound: all("SELECT path, COUNT(*) c FROM hits WHERE day>=? AND status=404 AND kind<>'bot' GROUP BY path ORDER BY c DESC LIMIT 12", from),
    botfound: all("SELECT path, COUNT(*) c FROM hits WHERE day>=? AND status=404 AND kind='bot' GROUP BY path ORDER BY c DESC LIMIT 6", from),
    hours: all(`SELECT hour, COUNT(*) c FROM hits WHERE day>=? AND ${human} GROUP BY hour`, from),
    errors: all("SELECT ts, path, status, note FROM hits WHERE day>=? AND kind='error' ORDER BY ts DESC LIMIT 15", from),
    slow: slowPages(from),
    agents: all("SELECT COALESCE(agent,'—') agent, dev, COUNT(*) c FROM hits WHERE day>=? AND kind<>'error' GROUP BY agent, dev ORDER BY c DESC LIMIT 14", from),
    heavy: all("SELECT substr(vid,1,6) id, day, COUNT(*) c, MIN(dev) dev, COALESCE(MIN(agent),'—') agent FROM hits WHERE day>=? AND kind IN ('page','check') GROUP BY vid, day ORDER BY c DESC LIMIT 6", from),
  };
}

// p95 по страницам: считаем в JS по выборке, чтобы не зависеть от оконных функций
function slowPages(from) {
  const rows = all("SELECT path, ms FROM hits WHERE day>=? AND kind IN ('page','check') AND status<400 ORDER BY ts DESC LIMIT 20000", from);
  const g = new Map();
  for (const r of rows) { if (!g.has(r.path)) g.set(r.path, []); g.get(r.path).push(r.ms); }
  return [...g].filter(([, a]) => a.length >= 5).map(([path, a]) => { a.sort((x, y) => x - y); return { path, n: a.length, p50: a[Math.floor(a.length * 0.5)], p95: a[Math.min(a.length - 1, Math.floor(a.length * 0.95))] }; }).sort((x, y) => y.p95 - x.p95).slice(0, 8);
}

// итоги проверок: что искали и чем закончилось
export function checkOutcomes(n) {
  return all("SELECT COALESCE(NULLIF(note,''),'—') note, COUNT(*) c FROM hits WHERE day>=? AND kind='check' GROUP BY note ORDER BY c DESC", daysBack(n)[0]);
}
export const recentSearches = (limit = 60) => all('SELECT vin, lang, created_at FROM searches ORDER BY created_at DESC LIMIT ?', limit);
export const topSearches = (n, limit = 10) => all('SELECT vin, COUNT(*) c FROM searches WHERE created_at>? GROUP BY vin HAVING c>1 ORDER BY c DESC LIMIT ?', Date.now() - n * 864e5, limit);
export const searchesByLang = (n) => all('SELECT lang, COUNT(*) c FROM searches WHERE created_at>? GROUP BY lang ORDER BY c DESC', Date.now() - n * 864e5);

export const ordersAll = (limit = 100) => all('SELECT id,vin,plan,status,amount,email,created_at,paid_at FROM orders ORDER BY created_at DESC LIMIT ?', limit);
export const creditsSummary = () => one('SELECT COUNT(*) n, COALESCE(SUM(remaining),0) rem FROM credits');
export const waitlistAll = (limit = 500) => all('SELECT email, lang, created_at, utm FROM waitlist ORDER BY created_at DESC LIMIT ?', limit);
export const waitlistByDay = (n) => all('SELECT strftime("%Y-%m-%d", created_at/1000, "unixepoch") d, COUNT(*) c FROM waitlist WHERE created_at>? GROUP BY d', Date.now() - n * 864e5);

export function dbInfo() {
  const t = (name) => one(`SELECT COUNT(*) c FROM ${name}`).c;
  return { hits: t('hits'), searches: t('searches'), orders: t('orders'), waitlist: t('waitlist'), photos: one('SELECT SUM(url IS NOT NULL) f, SUM(url IS NULL) m FROM photos'), usa: t('usa_cache'), usaMonth: one('SELECT COUNT(*) c FROM usa_cache WHERE ts>?', Date.now() - 30 * 864e5).c, riaVin: (() => { const r = one("SELECT json FROM ria_cache WHERE k=?", 'usage-vin:' + new Date().toISOString().slice(0, 7)); return r ? Number(JSON.parse(r.json)) || 0 : 0; })(), riaMonth: (() => { const r = one("SELECT json FROM ria_cache WHERE k=?", 'usage:' + new Date().toISOString().slice(0, 7)); return r ? Number(JSON.parse(r.json)) || 0 : 0; })(), mentions: t('mentions') };
}

// ручной сброс статистики из админки
export const resetStats = (what) => (what === 'hits' ? db.prepare('DELETE FROM hits').run().changes : what === 'searches' ? db.prepare('DELETE FROM searches').run().changes : 0);
