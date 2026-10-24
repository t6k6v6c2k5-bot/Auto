// Бесплатные открытые данные NHTSA: декодер VIN + отзывные кампании (recalls).
const TTL = 6 * 3600e3;
const cache = new Map();

async function getJson(url, ms = 7000) {
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
    out.found = Boolean(out.make && out.year);
    return out;
  } catch {
    return { found: false, unavailable: true };
  }
}

export async function recalls(d) {
  if (!d?.found) return { items: [], unavailable: !!d?.unavailable };
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
