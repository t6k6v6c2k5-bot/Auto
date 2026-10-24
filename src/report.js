// Сборка отчёта по VIN из реальных открытых источников.
import { decodeVin, recalls as getRecalls, complaints as getComplaints, ratings as getRatings } from './nhtsa.js';
import { historyByVin, coverage } from './registry.js';
import { wantedByVin, state as wantedState } from './wanted.js';
import { riskScore } from './risk.js';
import { regionOf } from './vin.js';
import { fetchProvider } from './providers.js';
import { getPhoto } from './photo.js';

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

export async function buildReport(vin, { withProvider = false, plan = 'single' } = {}) {
  const decoded = await decodeVin(vin);
  const [rec, comp, rate] = await Promise.all([getRecalls(decoded), getComplaints(decoded), getRatings(decoded)]);
  const region = regionOf(vin);
  const ua = historyByVin(vin);
  const wanted = wantedByVin(vin);
  const mismatch = consistency(decoded, ua);
  const risk = riskScore({ decoded, recalls: rec.items, wanted, ua, region, complaints: comp, mismatch });
  const veh = decoded.trusted ? { make: decoded.make, model: decoded.model, year: decoded.year } : ua.summary ? { make: ua.summary.vehicle.brand, model: ua.summary.vehicle.model, year: ua.summary.vehicle.year } : { make: decoded.make };
  const photo = veh.make ? await Promise.race([getPhoto(veh.make, veh.model), new Promise((r) => setTimeout(() => r(null), 3500))]) : null;
  let usa = null;
  if (withProvider) { try { usa = await fetchProvider(vin, plan, decoded); } catch (e) { console.error('provider failed', e.message); } }
  const found = Boolean(decoded.trusted || decoded.found || ua.rows.length || wanted.length || usa?.found);
  return {
    vin, region, generatedAt: new Date().toISOString(), found,
    vehicle: veh, photo, decoded, recalls: rec, complaints: comp, ratings: rate, ua, wanted, mismatch, risk, usa,
    coverage: { registry: coverage(), wantedUpdatedAt: wantedState.updatedAt, wantedCount: wantedState.count },
  };
}
