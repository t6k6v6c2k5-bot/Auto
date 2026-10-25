// Нидерланды: открытые данные RDW (opendata.rdw.nl), поиск по госномеру (VIN в открытых данных нет).
const BASE = process.env.RDW_BASE || 'https://opendata.rdw.nl/resource';
const TTL = 6 * 3600e3;
const cache = new Map();

// Форматы NL: XX-99-99, 99-XX-99, 99-99-XX, XX-XX-99, 99-XX-XX, XX-99-XX, 99-XXX-9, 9-XXX-99, XX-999-X, X-999-XX (6 знаков)
export const looksLikeNlPlate = (n) => /^[A-Z0-9]{6}$/.test(n) && /\d/.test(n) && /[A-Z]/.test(n)
  && /^(?:[A-Z]{2}\d{4}|\d{2}[A-Z]{2}\d{2}|\d{4}[A-Z]{2}|[A-Z]{4}\d{2}|\d{2}[A-Z]{4}|[A-Z]{2}\d{2}[A-Z]{2}|\d{2}[A-Z]{3}\d|\d[A-Z]{3}\d{2}|[A-Z]{2}\d{3}[A-Z]|[A-Z]\d{3}[A-Z]{2})$/.test(n);

const iso = (s) => (/^\d{8}$/.test(s || '') ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : '');
const num = (s) => (s && !Number.isNaN(+s) ? +s : null);
const yes = (s) => (s === 'Ja' ? true : s === 'Nee' ? false : null);

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('rdw ' + r.status);
  return r.json();
}

export function normalizeRdw(v, fuels = []) {
  return {
    plate: v.kenteken, kind: v.voertuigsoort || '', brand: v.merk || '', model: v.handelsbenaming || '', body: v.inrichting || '',
    color: v.eerste_kleur && v.eerste_kleur !== 'Niet geregistreerd' ? v.eerste_kleur : '',
    firstAdmission: iso(v.datum_eerste_toelating), firstNl: iso(v.datum_eerste_tenaamstelling_in_nederland), registered: iso(v.datum_tenaamstelling),
    apkUntil: iso(v.vervaldatum_apk), cc: num(v.cilinderinhoud), cylinders: num(v.aantal_cilinders), seats: num(v.aantal_zitplaatsen), doors: num(v.aantal_deuren),
    mass: num(v.massa_ledig_voertuig), listPrice: num(v.catalogusprijs),
    insured: yes(v.wam_verzekerd), exported: yes(v.export_indicator), openRecall: yes(v.openstaande_terugroepactie_indicator), taxi: yes(v.taxi_indicator),
    odometerVerdict: v.tellerstandoordeel || '', odometerYear: num(v.jaar_laatste_registratie_tellerstand),
    fuel: fuels.map((f) => f.brandstof_omschrijving).filter(Boolean).join(' / '), kw: fuels.map((f) => num(f.nettomaximumvermogen)).find(Boolean) || null,
  };
}

export async function lookupPlate(plate) {
  if (!looksLikeNlPlate(plate)) return null;
  const hit = cache.get(plate);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  try {
    const q = encodeURIComponent(plate);
    const rows = await getJson(`${BASE}/m9d7-ebf2.json?kenteken=${q}&$limit=1`);
    let v = null;
    if (rows[0]) v = normalizeRdw(rows[0], await getJson(`${BASE}/8ys7-d773.json?kenteken=${q}&$limit=4`).catch(() => []));
    cache.set(plate, { t: Date.now(), v });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return v;
  } catch (e) { console.error('rdw failed:', e.message); return null; }
}
