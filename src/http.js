// HTTP-утилиты: IP за прокси, лимитер, заголовки безопасности, сжатие, статика с ETag.
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { gzipSync, brotliCompressSync, constants as Z } from 'node:zlib';
import { createHash } from 'node:crypto';
import { sep } from 'node:path';
import { cfg } from './config.js';

// Railway ставит свой прокси перед приложением и дописывает реальный IP клиента в КОНЕЦ X-Forwarded-For;
// левые элементы подконтрольны клиенту, поэтому берём последний.
// IP_HEADER (например x-real-ip или cf-connecting-ip) переопределяет источник, если перед приложением стоит CDN.
// IPv6 группируем по /64: у одного клиента их миллиарды, иначе лимит обходится сменой адреса.
export const ipOf = (req) => {
  let ip;
  if (process.env.IP_HEADER) ip = String(req.headers[process.env.IP_HEADER.toLowerCase()] || '').split(',')[0].trim();
  if (!ip) { const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean); ip = xff.at(-1) || req.socket.remoteAddress || 'unknown'; }
  ip = ip.replace(/^::ffff:/i, '');
  return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
};

const hits = new Map();
export const limited = (key, max = 60) => {
  const slot = Math.floor(Date.now() / 60000);
  const k = key + ':' + slot;
  const n = (hits.get(k) || 0) + 1; hits.set(k, n);
  if (hits.size > 50000) { let i = 0; for (const key of hits.keys()) { hits.delete(key); if (++i >= 10000) break; } } // верхняя граница памяти: выбрасываем самые старые ключи
  return n > max;
};
setInterval(() => { const slot = Math.floor(Date.now() / 60000); for (const k of hits.keys()) if (!k.endsWith(':' + slot)) hits.delete(k); }, 60000).unref();

// Источник сайта для абсолютных ссылок. Без BASE_URL берём Host только если он выглядит как имя хоста.
export function origin(req) {
  if (cfg.baseUrl) return cfg.baseUrl;
  const host = String(req.headers.host || '').toLowerCase();
  const ok = /^[a-z0-9.-]{1,253}(:\d{1,5})?$/.test(host) ? host : 'localhost';
  return `${/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(ok) ? 'http' : 'https'}://${ok}`;
}

const CSP = [
  "default-src 'self'", "script-src 'self' https://plausible.io", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://upload.wikimedia.org https://thumb.wikimedia.org", "font-src 'self'",
  "connect-src 'self' https://plausible.io", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'", "object-src 'none'",
].join('; ');
const SEC = {
  'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000; includeSubDomains', 'content-security-policy': CSP,
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(self)', 'cross-origin-opener-policy': 'same-origin',
};
if (cfg.baseUrl.startsWith('https://')) SEC['content-security-policy'] += '; upgrade-insecure-requests';
// слабые ETag (W/"…") приходят от прокси при сжатии: сравниваем без префикса
export const etagMatch = (header, etag) => !!header && header.split(',').some((v) => v.trim().replace(/^W\//, '') === etag);
const COMPRESSIBLE = /^(text\/|application\/(json|xml|javascript)|image\/svg)/;

function encode(buf, accept) {
  if (/\bbr\b/.test(accept)) return ['br', brotliCompressSync(buf, { params: { [Z.BROTLI_PARAM_QUALITY]: accept === 'br' ? 11 : 4 } })];
  if (/\bgzip\b/.test(accept)) return ['gzip', gzipSync(buf, { level: accept === 'gzip' ? 9 : 6 })];
  return [null, buf];
}

export function send(req, res, code, body, type = 'text/html; charset=utf-8', extra = {}) {
  const headers = { 'content-type': type, ...SEC, ...extra };
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  if (code === 200 && req.method === 'GET' && /public/.test(headers['cache-control'] || '') && !headers.etag) {
    headers.etag = '"' + createHash('sha1').update(buf).digest('base64url').slice(0, 20) + '"';
  }
  if (headers.etag && etagMatch(req.headers['if-none-match'], headers.etag)) { delete headers['content-type']; res.writeHead(304, headers); return res.end(); }
  if (buf.length > 1024 && COMPRESSIBLE.test(type)) {
    const [enc, out] = encode(buf, req.headers['accept-encoding'] || '');
    if (enc) { headers['content-encoding'] = enc; headers.vary = [headers.vary, 'Accept-Encoding'].filter(Boolean).join(', '); res.writeHead(code, headers); return res.end(out); }
  }
  res.writeHead(code, headers); res.end(buf);
}
export const json = (req, res, code, obj) => send(req, res, code, JSON.stringify(obj), 'application/json; charset=utf-8', { 'cache-control': 'no-store' });
export const redirect = (res, to, code = 302, extra = {}) => { res.writeHead(code, { location: to, ...SEC, ...extra }); res.end(); };

export const readBody = (req, max = 1e5) => new Promise((res, rej) => {
  const chunks = []; let n = 0;
  let over = false;
  req.on('data', (c) => { if (over) return; n += c.length; if (n > max) { over = true; const e = new Error('too large'); e.status = 413; rej(e); req.resume(); } else chunks.push(c); });
  req.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
  req.on('error', rej);
});

// ---------- статика ----------
const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const cache = new Map();
export async function serveStatic(req, res, root, pathname) {
  let rel; try { rel = decodeURIComponent(pathname); } catch { return false; }
  const p = normalize(join(root, rel));
  if (!p.startsWith(root + sep)) return false;
  try {
    const st = await stat(p); if (!st.isFile()) return false;
    let c = cache.get(p);
    if (!c || c.mtime !== st.mtimeMs) {
      const buf = await readFile(p);
      c = { mtime: st.mtimeMs, buf, etag: '"' + createHash('sha1').update(buf).digest('base64url').slice(0, 20) + '"' };
      cache.set(p, c);
    }
    const ext = extname(p), type = MIME[ext] || 'application/octet-stream';
    const immutable = ext === '.woff2';
    const headers = { 'content-type': type, ...SEC, etag: c.etag, 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600, must-revalidate' };
    if (etagMatch(req.headers['if-none-match'], c.etag)) { delete headers['content-type']; res.writeHead(304, headers); res.end(); return true; }
    const accept = req.headers['accept-encoding'] || '';
    let out = c.buf;
    if (c.buf.length > 1024 && COMPRESSIBLE.test(type)) {
      const enc = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
      if (enc) { c[enc] ||= encode(c.buf, enc)[1]; out = c[enc]; headers['content-encoding'] = enc; headers.vary = 'Accept-Encoding'; }
    }
    res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : out);
    return true;
  } catch { return false; }
}
