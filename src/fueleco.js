// Расход топлива и CO2 из открытых данных EPA (fueleconomy.gov, США, без ключа). Подбор по году/марке/модели и двигателю из NHTSA.
const BASE = process.env.FUELECO_BASE || 'https://www.fueleconomy.gov/ws/rest';
const TTL = 24 * 3600e3;
const cache = new Map();

async function getJson(path) {
  const r = await fetch(BASE + path, { signal: AbortSignal.timeout(5000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('fueleconomy ' + r.status);
  return r.json();
}
const items = (j) => { const m = j?.menuItem; return Array.isArray(m) ? m : m ? [m] : []; };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const num = (v) => (v === '' || v == null || Number.isNaN(+v) ? null : +v);

// «Auto 5-spd, 4 cyl, 2.4 L» -> {auto, cyl, displ}
export function parseOption(text) {
  const t = String(text);
  return { auto: /^auto/i.test(t) ? true : /^man/i.test(t) ? false : null, cyl: num((/(\d+) cyl/i.exec(t) || [])[1]), displ: num((/(\d+(?:\.\d+)?) L/i.exec(t) || [])[1]) };
}

export function pickOptions(options, d) {
  const dm = /(\d+(?:\.\d+)?)L/.exec(d.engine || ''), cm = /(\d+) cyl/.exec(d.engine || '');
  const displ = dm ? +dm[1] : null, cyl = cm ? +cm[1] : null;
  const auto = /auto|cvt|dual/i.test(d.transmission || '') ? true : /manual/i.test(d.transmission || '') ? false : null;
  const parsed = options.map((o) => ({ ...o, p: parseOption(o.text) }));
  let list = parsed.filter((o) => (displ == null || o.p.displ == null || Math.abs(o.p.displ - displ) < 0.11) && (cyl == null || o.p.cyl == null || o.p.cyl === cyl));
  const byTrans = list.filter((o) => auto == null || o.p.auto == null || o.p.auto === auto);
  if (byTrans.length) list = byTrans;
  return list.slice(0, 6);
}

export const l100 = (mpg) => (mpg ? Math.round((235.215 / mpg) * 10) / 10 : null);
export const gpkm = (gpm) => (gpm ? Math.round(gpm * 0.621371) : null);

export async function fuelEconomy(d) {
  if (!d?.trusted || !d.make || !d.model || !d.year) return null;
  const key = `${d.year}|${d.make}|${d.model}|${d.engine}|${d.transmission}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  let v = null;
  try {
    const q = (s) => encodeURIComponent(s);
    const makes = items(await getJson(`/vehicle/menu/make?year=${d.year}`));
    const make = makes.find((m) => norm(m.value) === norm(d.make));
    if (make) {
      const models = items(await getJson(`/vehicle/menu/model?year=${d.year}&make=${q(make.value)}`));
      const model = models.find((m) => norm(m.value) === norm(d.model));
      if (model) {
        const opts = pickOptions(items(await getJson(`/vehicle/menu/options?year=${d.year}&make=${q(make.value)}&model=${q(model.value)}`)), d);
        const cars = (await Promise.all(opts.map((o) => getJson(`/vehicle/${o.value}`).catch(() => null)))).filter(Boolean);
        const rng = (f) => { const a = cars.map((c) => num(c[f])).filter((x) => x); return a.length ? [Math.min(...a), Math.max(...a)] : null; };
        if (cars.length) {
          v = {
            matched: cars.length, comb: rng('comb08'), city: rng('city08'), hwy: rng('highway08'), co2: rng('co2TailpipeGpm'),
            fuel: cars[0].fuelType1 || cars[0].fuelType || '', electric: cars.some((c) => num(c.rangeA) || num(c.range)), range: rng('range'), vclass: cars[0].VClass || '',
          };
          if (!v.comb) v = null;
        }
      }
    }
  } catch (e) { console.error('fueleconomy failed:', e.message); return null; }
  cache.set(key, { t: Date.now(), v });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return v;
}
