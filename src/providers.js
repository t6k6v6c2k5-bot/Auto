// Поставщик платных данных. Контракт: report(vin, plan) -> { source, demo, sections, found }
// Реальный поставщик подключается через REPORT_API_URL/REPORT_API_KEY: GET {url}?vin=..&plan=..
// должен вернуть JSON такого же формата (см. README). Пока ключа нет — отдаются ОБРАЗЦЫ (demo:true).
import { createHash } from 'node:crypto';
import { cfg, demoData } from './config.js';

function rng(seed) {
  let s = createHash('sha256').update(seed).digest().readUInt32LE(0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function demoReport(vin, plan, decoded) {
  const r = rng(vin);
  const yr = decoded?.year || 2018;
  const now = new Date();
  const hasAuction = r() > 0.35;
  const dmg = ['Front End', 'Rear End', 'Side', 'Minor Dent/Scratches', 'Water/Flood', 'Hail'];
  let km = 12000 + Math.floor(r() * 20000);
  const odo = [];
  for (let y = yr + 1; y <= now.getFullYear(); y++) {
    odo.push({ date: `${y}-0${1 + Math.floor(r() * 8)}-1${Math.floor(r() * 9)}`, source: ['Dealer service', 'State inspection', 'Insurance', 'Auction'][Math.floor(r() * 4)], km });
    km += 9000 + Math.floor(r() * 16000);
  }
  if (r() > 0.8 && odo.length > 3) odo[odo.length - 2].km = Math.max(1000, odo[odo.length - 3].km - 15000); // демонстрация детектора скрутки
  const sections = {
    title: { brand: hasAuction && r() > 0.5 ? 'Salvage' : 'Clean', state: ['CA', 'TX', 'FL', 'NJ', 'GA', 'IL'][Math.floor(r() * 6)], theftRecord: r() > 0.93, lien: r() > 0.9 },
    odometer: odo,
    auction: hasAuction ? [{
      house: r() > 0.5 ? 'Copart' : 'IAAI', lot: String(30000000 + Math.floor(r() * 9e6)), date: `${now.getFullYear() - 1}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`,
      primaryDamage: dmg[Math.floor(r() * dmg.length)], secondaryDamage: dmg[Math.floor(r() * dmg.length)], estRepairUsd: 1500 + Math.floor(r() * 9000),
      finalBidUsd: 2500 + Math.floor(r() * 9000), keys: r() > 0.3, runsDrives: r() > 0.5, photos: 12 + Math.floor(r() * 20),
    }] : [],
    owners: { count: 1 + Math.floor(r() * 3), lastUse: ['Personal', 'Rental', 'Lease', 'Commercial'][Math.floor(r() * 4)] },
    accidents: hasAuction ? 1 + Math.floor(r() * 2) : Math.floor(r() * 2),
    export: { exported: r() > 0.7, to: 'UA' },
  };
  return { source: 'demo', demo: true, found: true, sections };
}

export async function fetchReport(vin, plan, decoded) {
  if (demoData()) return demoReport(vin, plan, decoded);
  const u = new URL(cfg.reportApiUrl);
  u.searchParams.set('vin', vin); u.searchParams.set('plan', plan);
  const r = await fetch(u, { headers: { authorization: `Bearer ${cfg.reportApiKey}`, accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('report provider ' + r.status);
  const j = await r.json();
  return { source: j.source || 'provider', demo: false, found: j.found !== false && !!j.sections, sections: j.sections || {} };
}

// Ноу-хау №2: что «нашлось» по VIN можно показать БЕСПЛАТНО (количество записей без деталей) —
// пользователь платит, уже зная, что данные есть. Для демо считается детерминированно.
export function prescan(vin, decoded) {
  if (!demoData()) return null; // для реального поставщика подключите его «count»-эндпоинт
  const rep = demoReport(vin, 'full', decoded).sections;
  return {
    auction: rep.auction.length, odometer: rep.odometer.length, accidents: rep.accidents,
    titleBrand: rep.title.brand !== 'Clean', photos: rep.auction[0]?.photos || 0,
  };
}
