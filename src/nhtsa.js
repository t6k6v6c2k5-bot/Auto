// Бесплатные открытые данные NHTSA: декодер VIN + отзывные кампании (recalls).
const TTL = 6 * 3600e3;
const cache = new Map();

async function getJson(url, ms = 5000) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const v = await r.json();
  cache.set(url, { t: Date.now(), v });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return v;
}

export async function decodeVin(vin) {
  try {
    const j = await getJson(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`);
    const r = j.Results?.[0] || {};
    const pick = (k) => (r[k] && r[k] !== 'Not Applicable' ? r[k] : '');
    const out = {
      make: pick('Make'), model: pick('Model'), year: Number(r.ModelYear) || null,
      trim: pick('Trim'), body: pick('BodyClass'), drive: pick('DriveType'),
      fuel: pick('FuelTypePrimary'), engine: [pick('DisplacementL') && Number(pick('DisplacementL')).toFixed(1) + 'L', pick('EngineCylinders') && pick('EngineCylinders') + ' cyl', pick('EngineHP') && pick('EngineHP') + ' hp'].filter(Boolean).join(' · '),
      transmission: pick('TransmissionStyle'), country: pick('PlantCountry'), plant: [pick('PlantCity'), pick('PlantCountry')].filter(Boolean).join(', '),
      manufacturer: pick('Manufacturer'), errorCode: r.ErrorCode || '',
    };
    // trusted: «чистый» разбор NHTSA (ErrorCode 0) — только он годится для выводов; у европейских VIN разбор частичный и год может быть неверным
    out.trusted = /^0(,|$)/.test(String(out.errorCode)) && Boolean(out.make && out.model && out.year);
    out.found = Boolean(out.make);
    return out;
  } catch {
    return { found: false, unavailable: true };
  }
}

export async function recalls(d) {
  if (!d?.trusted) return { items: [], unavailable: !!d?.unavailable };
  try {
    const q = new URLSearchParams({ make: d.make, model: d.model, modelYear: String(d.year) });
    const j = await getJson(`https://api.nhtsa.gov/recalls/recallsByVehicle?${q}`);
    const items = (j.results || []).slice(0, 25).map((x) => ({
      id: x.NHTSACampaignNumber, component: x.Component, summary: x.Summary, remedy: x.Remedy, date: x.ReportReceivedDate,
    }));
    return { items, unavailable: false };
  } catch {
    return { items: [], unavailable: true };
  }
}

// Жалобы владельцев (NHTSA ODI): статистика по марке/модели/году.
export async function complaints(d) {
  if (!d?.trusted) return { count: 0, unavailable: !!d?.unavailable };
  try {
    const q = new URLSearchParams({ make: d.make, model: d.model, modelYear: String(d.year) });
    const j = await getJson(`https://api.nhtsa.gov/complaints/complaintsByVehicle?${q}`, 6000);
    const res = j.results || [];
    const comp = new Map();
    for (const x of res) for (const c of String(x.components || '').split(',')) { const k = c.trim(); if (k) comp.set(k, (comp.get(k) || 0) + 1); }
    return {
      count: j.count ?? res.length,
      crashes: res.filter((x) => x.crash).length, fires: res.filter((x) => x.fire).length,
      injuries: res.reduce((a, x) => a + (x.numberOfInjuries || 0), 0), deaths: res.reduce((a, x) => a + (x.numberOfDeaths || 0), 0),
      top: [...comp].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([component, n]) => ({ component, n })),
      unavailable: false,
    };
  } catch { return { count: 0, unavailable: true }; }
}

// Краш-тесты NHTSA (5-star): берём первую комплектацию модели.
export async function ratings(d) {
  if (!d?.trusted) return null;
  try {
    const base = `https://api.nhtsa.gov/SafetyRatings/modelyear/${d.year}/make/${encodeURIComponent(d.make)}/model/${encodeURIComponent(d.model)}`;
    const list = (await getJson(base)).Results || [];
    if (!list.length) return null;
    const r = (await getJson(`https://api.nhtsa.gov/SafetyRatings/VehicleId/${list[0].VehicleId}`)).Results?.[0];
    if (!r) return null;
    return { description: list[0].VehicleDescription, overall: r.OverallRating, front: r.OverallFrontCrashRating, side: r.OverallSideCrashRating, rollover: r.RolloverRating };
  } catch { return null; }
}
