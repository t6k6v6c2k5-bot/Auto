// Сборка отчёта по VIN из реальных открытых источников.
import { searchCount } from './db.js';
import { checkInsurance } from './insurance.js';
import { findMentions } from './mentions.js';
import { fuelEconomy } from './fueleco.js';
import { canadaRecalls } from './canada.js';
import { decodeVin, recalls as getRecalls, complaints as getComplaints, ratings as getRatings } from './nhtsa.js';
import { historyByVin, coverage } from './registry.js';
import { wantedByVin, state as wantedState } from './wanted.js';
import { riskScore } from './risk.js';
import { regionOf } from './vin.js';
import { fetchProvider } from './providers.js';
import { getPhoto } from './photo.js';
import { localDecode } from './wmi.js';

const letters = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
// Сверка NHTSA-расшифровки VIN с записью реестра МВС: ловит подмену VIN / «чужой» кузов.
function consistency(decoded, ua) {
  const v = ua?.summary?.vehicle; const out = [];
  if (!decoded?.trusted || !v) return out;
  if (v.year && decoded.year && Math.abs(v.year - decoded.year) >= 2) out.push({ field: 'year', vin: decoded.year, registry: v.year });
  const a = letters(decoded.make), b = letters(v.brand);
  if (a.length >= 3 && b.length >= 3 && !(a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4)))) out.push({ field: 'make', vin: decoded.make, registry: v.brand });
  return out;
}

// Фото модели берём из Wikipedia: в имени файла обычно есть год. Если он сильно расходится с годом авто, лучше показать силуэт.
// год в имени файла учитывается при подборе фото (photo.js)
const photoYear = (url) => { const m = /(?:^|[/_-])((?:19|20)\d{2})(?=[_\-.\s]|$)/.exec(decodeURIComponent(url || '').split('/').pop() || ''); return m ? +m[1] : null; };
export function photoFits(photo, year) {
  if (!photo) return null;
  const py = photoYear(photo.url);
  if (py && year && Math.abs(py - year) > 5) return null;
  return photo;
}

const withDeadline = (p, ms, fallback) => Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);

export async function buildReport(vin, { withProvider = false, plan = 'single', plate = '' } = {}) {
  const t0 = Date.now();
  const decoded = await withDeadline(decodeVin(vin), 6000, { found: false, unavailable: true });
  const left = () => Math.max(1500, 9000 - (Date.now() - t0));
  const region = regionOf(vin);
  // платные данные США/Канады: только для американского рынка (NHTSA узнал VIN или код региона 1–5), с кэшем и суточным лимитом; идут параллельно с NHTSA
  const usaP = withProvider && (decoded.trusted || ['US', 'CA', 'MX'].includes(region))
    ? withDeadline(fetchProvider(vin, plan, decoded).catch((e) => { console.error('provider failed', e.message); return null; }), 14000, null) : Promise.resolve(null);
  // реестр, розыск и расшифровка по коду изготовителя — локально и сразу; фото, страховка и упоминания идут параллельно с внешними базами
  const ua = historyByVin(vin);
  const wanted = wantedByVin(vin);
  const local = decoded.trusted || ua.rows.length ? null : localDecode(vin); // запасная расшифровка по коду изготовителя
  const veh = decoded.trusted ? { make: decoded.make, model: decoded.model, year: decoded.year } : ua.summary ? { make: ua.summary.vehicle.brand, model: ua.summary.vehicle.model, year: ua.summary.vehicle.year } : local ? { make: local.make, model: local.model, year: local.years.length === 1 ? local.years[0] : null } : { make: decoded.make };
  const regPlate = plate || ua.summary?.plates?.at(-1) || '';
  const photoP = veh.make ? withDeadline(getPhoto(veh.make, veh.model, veh.year).catch(() => null), Math.max(2500, left()), null) : Promise.resolve(null);
  const [rec, comp, rate, fuel, ca, insurance, mentions, photo] = await Promise.all([
    withDeadline(getRecalls(decoded), left(), { items: [], unavailable: true }),
    withDeadline(getComplaints(decoded), left(), { count: 0, unavailable: true }),
    withDeadline(getRatings(decoded), left(), null),
    withDeadline(fuelEconomy(decoded), left(), null),
    withDeadline(canadaRecalls(decoded), left(), null),
    // платные внешние источники (страховка, поиск упоминаний) — только в оплаченном отчёте
    withProvider ? withDeadline(checkInsurance({ vin, plate: regPlate }), 8500, null) : null,
    withProvider ? withDeadline(findMentions({ vin, plate }).catch(() => null), 4500, null) : null,
    photoP,
  ]);
  const mismatch = consistency(decoded, ua);
  const usa = await usaP;
  const risk = riskScore({ decoded, recalls: rec.items, wanted, ua, region, complaints: comp, mismatch, local, usa });
  const found = Boolean(decoded.trusted || decoded.found || ua.rows.length || wanted.length || usa?.found);
  // «Что делать дальше»: ключи i18n, собранные из реальных результатов
  const next = [];
  if (wanted.length) next.push('c_wanted');
  else {
    if (usa?.summary?.rollback) next.push('c_rollback');
    if (mismatch.length) next.push('c_mismatch');
    if (rec.items.length) next.push('c_recalls');
    if (!ua.rows.length) next.push(local ? 'c_localonly' : 'c_nocover');
    next.push('c_default');
  }
  const usMarket = Boolean(decoded.trusted || ['US', 'CA', 'MX'].includes(region));
  return {
    vin, region, usMarket, paidData: withProvider, generatedAt: new Date().toISOString(), found, next,
    vehicle: veh, local, photo, decoded, recalls: rec, complaints: comp, ratings: rate, fuel, canada: ca, checks: searchCount(vin), mentions, insurance, ua, wanted, mismatch, risk, usa,
    coverage: { registry: coverage(), wantedUpdatedAt: wantedState.updatedAt, wantedCount: wantedState.count },
  };
}
