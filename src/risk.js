// Ноу-хау №1: «Risk Score» — объяснимая оценка риска 0–100 из реальных данных (розыск, реестр МВС, NHTSA).
// Каждый фактор — {pts, key, vars}; сумма баллов ровно равна показанному числу (в т.ч. базовый уровень).
// Чего мы НЕ знаем (аукционы США, пробег, аварии), в баллы не превращается: это отдельная пометка в интерфейсе.
const BASE = 12;
export function riskScore({ decoded, recalls, wanted, ua, region, complaints, mismatch }) {
  const factors = [{ pts: BASE, key: 'f_base', vars: {} }];
  const add = (pts, key, vars = {}) => factors.push({ pts, key, vars });
  const year = ua?.summary?.vehicle?.year || (decoded?.trusted ? decoded.year : null);
  const age = year ? new Date().getFullYear() - year : 0;

  if (wanted.length) add(70, 'f_wanted');
  if (mismatch?.length) add(25, 'f_mismatch');
  const s = ua?.summary;
  if (s) {
    if (s.deregistered?.kind === 'scrap') add(30, 'f_scrap', { date: s.deregistered.date });
    else if (s.deregistered?.kind === 'export') add(10, 'f_export', { date: s.deregistered.date });
    else if (s.deregistered) add(8, 'f_dereg', { date: s.deregistered.date });
    if (s.owners >= 5) add(12, 'f_owners_many', { n: s.owners }); else if (s.owners >= 3) add(6, 'f_owners', { n: s.owners });
  }
  if (recalls.length) add(Math.min(20, recalls.length * 4), 'f_recalls', { n: recalls.length });
  if (complaints?.fires > 0) add(5, 'f_fires', { n: complaints.fires });
  if (age >= 15) add(10, 'f_old', { n: age }); else if (age >= 8) add(5, 'f_mid', { n: age });
  if (!decoded?.found && !s && !wanted.length) add(15, 'f_nodata');

  let total = factors.reduce((a, f) => a + f.pts, 0);
  // розыск: итог не ниже 92 — добавляем недостающие баллы в сам фактор, чтобы сумма сходилась
  if (wanted.length && total < 92) { factors.find((f) => f.key === 'f_wanted').pts += 92 - total; total = 92; }
  const score = Math.max(5, Math.min(98, total));
  const level = score >= 60 ? 'high' : score >= 35 ? 'mid' : 'low';
  return { score, level, factors, limited: !decoded?.trusted, region };
}
