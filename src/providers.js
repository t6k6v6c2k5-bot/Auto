// Необязательный платный поставщик данных (США: Copart/IAAI, пробег, title). Подключается через
// REPORT_API_URL / REPORT_API_KEY: GET {url}?vin=..&plan=.. -> { found, source, sections:{title,odometer[],auction[],owners,accidents,export} }
// Пока переменные не заданы, раздел «США» в отчёте не показывается (никаких образцов/заглушек с выдуманными данными).
import { cfg } from './config.js';

export const providerEnabled = () => Boolean(cfg.reportApiUrl);

export async function fetchProvider(vin, plan) {
  if (!providerEnabled()) return null;
  const u = new URL(cfg.reportApiUrl);
  u.searchParams.set('vin', vin); u.searchParams.set('plan', plan);
  const r = await fetch(u, { headers: { authorization: `Bearer ${cfg.reportApiKey}`, accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('report provider ' + r.status);
  const j = await r.json();
  return { source: j.source || 'provider', found: j.found !== false && !!j.sections, sections: j.sections || {} };
}
