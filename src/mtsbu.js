// Read-сервисы «Поліс Онлайн» МТСБУ (policy-doc.mtsbu.ua/DpApiDoc): REST, HTTP Basic (токен выдаёт МТСБУ), без VPN.
//   GET {MTSBU_READ_URL}/v5/GetStatus.svc/ByPlateNum/{номер}   — действующий полис по госномеру
//   GET {MTSBU_READ_URL}/v6/GetHistory.svc/ByVIN/{VIN}         — история полисов и страховых случаев (бонус-малус)
import { cfg } from './config.js';

export const mtsbuEnabled = () => Boolean(cfg.mtsbuReadUrl && cfg.mtsbuToken);
const get = (row, key) => String(row?.[`FContract.${key}`] ?? row?.[`FContract_${key.replace(/\./g, '_')}`] ?? '').trim();
const money = (v) => { const n = Number(String(v || '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) && v !== '' ? n : null; };

export function normalizeStatus(j) {
  const rows = Array.isArray(j?.SearchResult) ? j.SearchResult : [];
  const act = rows.find((r) => get(r, 'DViewStatus.Code') === 'Active');
  const res = rows.find((r) => get(r, 'DViewStatus.Code') === 'Reserve');
  const row = act || res;
  if (!row) return { status: 'none' };
  return {
    status: act ? 'active' : 'pending', insurer: get(row, 'DInsurer.Name'), kind: get(row, 'DVehicleType.Name').replace(/;$/, ''),
    form: get(row, 'DForm.Code'), limits: { property: money(get(row, 'PropertyLimit')), life: money(get(row, 'LifeLimit')), franchise: money(get(row, 'Franchise')) },
  };
}

export function normalizeHistory(j) {
  const rows = Array.isArray(j?.SearchResult) ? j.SearchResult : [];
  const policies = rows.map((r) => ({ year: get(r, 'StartYear'), insurer: get(r, 'DInsurer.Name'), period: get(r, 'DPeriod.Name'), claims: Number(get(r, 'CaseCount')) || 0, claimed: money(get(r, 'TotalClaimedAvount')), paid: money(get(r, 'TotalClaimspaid')) }))
    .sort((a, b) => (a.year < b.year ? 1 : -1));
  return { bmClass: String(j?.BMClass || ''), bmCoef: String(j?.BMCoef || ''), policies, claims: policies.reduce((n, p) => n + p.claims, 0) };
}

async function call(path, fetchFn) {
  const r = await fetchFn(cfg.mtsbuReadUrl.replace(/\/$/, '') + path, {
    headers: { authorization: `Basic ${cfg.mtsbuToken}`, authentication: cfg.mtsbuToken, accept: 'application/json' }, signal: AbortSignal.timeout(8000),
  });
  if (r.status === 404) return null; // сервис отвечает 404, когда записей нет
  if (!r.ok) throw new Error('mtsbu ' + r.status);
  return r.json();
}
const seg = (s) => encodeURIComponent(String(s).replace(/[^A-Za-z0-9А-ЯІЇЄҐа-яіїєґ]/g, ''));

export async function mtsbuInsurance({ vin, plate = '' }, { fetchFn = fetch } = {}) {
  const [st, hi] = await Promise.allSettled([plate ? call(`/v5/GetStatus.svc/ByPlateNum/${seg(plate)}`, fetchFn) : null, vin ? call(`/v6/GetHistory.svc/ByVIN/${seg(vin)}`, fetchFn) : null]);
  if (st.status === 'rejected' && hi.status === 'rejected') throw st.reason;
  const out = st.status === 'fulfilled' && st.value !== null ? normalizeStatus(st.value) : plate && st.status === 'fulfilled' ? { status: 'none' } : { status: 'unknown' };
  if (hi.status === 'fulfilled' && hi.value) out.history = normalizeHistory(hi.value);
  return out;
}
