// Ноу-хау №1: «Risk Score» — объяснимая предварительная оценка риска 0–100.
// Бесплатно показывается сразу; платный отчёт уточняет её данными аукционов/пробега/титула.
export function riskScore(decoded, recallList, year) {
  const factors = [];
  let score = 18;
  const add = (pts, key, vars = {}) => { score += pts; factors.push({ pts, key, vars }); };
  const age = new Date().getFullYear() - (year || decoded?.year || new Date().getFullYear());

  if (!decoded?.found) add(20, 'f_nodecode');
  if (recallList.length) add(Math.min(30, recallList.length * 5), 'f_recalls', { n: recallList.length });
  if (age >= 15) add(12, 'f_old', { n: age }); else if (age >= 8) add(6, 'f_mid', { n: age });
  if (/diesel|hybrid|electric/i.test(decoded?.fuel || '')) add(4, 'f_powertrain');
  add(14, 'f_unknown_history'); // без платного отчёта история всегда «чёрный ящик»
  score = Math.max(5, Math.min(95, score));
  const level = score >= 60 ? 'high' : score >= 35 ? 'mid' : 'low';
  return { score, level, factors };
}
