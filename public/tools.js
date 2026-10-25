// Инструменты покупателя: все расчёты в браузере, на сервер ничего не отправляется.
(() => {
  const el = document.getElementById('tool-data');
  if (!el) return;
  const { lang, id, rate, T } = JSON.parse(el.textContent);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const safe = (f) => { try { return f(); } catch { return null; } };
  const loc = lang === 'en' ? 'en-US' : 'uk-UA';
  const fmtN = (n, d = 0) => Number(n).toLocaleString(loc, { maximumFractionDigits: d, minimumFractionDigits: d });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const out = $('.tout');
  const val = (s) => { const x = $(s); return x ? Number(String(x.value).replace(',', '.')) : NaN; };
  const show = (html) => { out.innerHTML = html; out.classList.add('on'); };
  const err = (msg) => show(`<p class="terr">${esc(msg)}</p>`);
  const row = (k, v, cls = '') => `<div class="trow ${cls}"><span>${esc(k)}</span><b>${v}</b></div>`;
  const year = new Date().getFullYear();
  const CYR = { 'А': 'A', 'В': 'B', 'Е': 'E', 'І': 'I', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'У': 'Y' };
  const latin = (v) => [...String(v).toUpperCase()].map((c) => CYR[c] || c).join('').replace(/[^A-Z0-9]/g, '');

  const tools = {
    vin(form) {
      const v = latin($('#t-vin').value);
      if (v.length !== 17 || /[IOQ]/.test(v)) return err(T.vin_err);
      const TR = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
      const W = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
      let s = 0; for (let i = 0; i < 17; i++) s += (/\d/.test(v[i]) ? +v[i] : TR[v[i]]) * W[i];
      const cd = s % 11 === 10 ? 'X' : String(s % 11);
      const na = '12345'.includes(v[0]);
      const chk = na ? (cd === v[8] ? T.vin_ok : T.vin_bad) : (cd === v[8] ? T.vin_ok : T.vin_na);
      const YC = 'ABCDEFGHJKLMNPRSTVWXY123456789';
      const yi = YC.indexOf(v[9]);
      const years = yi < 0 ? [] : [1980 + yi, 2010 + yi].filter((y) => y <= year + 1);
      const regionKey = /\d/.test(v[0]) ? v[0] : v[0];
      const region = T.vin_regions[regionKey] || T.vin_regions[v[0]] || '—';
      const seg = (a, b, cls) => `<span class="vseg ${cls}">${v.slice(a, b)}</span>`;
      show(`<div class="vinbar mono">${seg(0, 3, 's1')}${seg(3, 8, 's2')}${seg(8, 9, 's3')}${seg(9, 10, 's4')}${seg(10, 11, 's5')}${seg(11, 17, 's6')}</div>
${row(T.vin_region, esc(region), 's1')}${row(T.vin_wmi, esc(v.slice(0, 3)), 's1')}${row(T.vin_vds, esc(v.slice(3, 8)), 's2')}${row(T.vin_check, `${esc(v[8])} · ${esc(chk)}`, 's3')}${row(T.vin_year, esc(years.join(' / ') || '—'), 's4')}${row(T.vin_plant, esc(v[10]), 's5')}${row(T.vin_serial, esc(v.slice(11)), 's6')}
<a class="btn primary wide" href="/${lang}/check?q=${v}">${esc(T.vin_full)}</a>`);
    },
    customs() {
      const price = val('#t-price'), y = val('#t-year'), fuel = $('#t-fuel').value, cc = val('#t-cc'), kwh = val('#t-kwh'), eu = $('#t-eu').checked;
      if (!(price > 0) || !(y > 1900)) return err(T.fu_err);
      const age = Math.min(15, Math.max(1, year - y - 1));
      let excise = 0;
      if (fuel === 'electric') excise = (kwh || 0) * 1;
      else if (fuel === 'hybrid') excise = 100;
      else {
        const base = fuel === 'diesel' ? (cc > 3500 ? 150 : 75) : (cc > 3000 ? 100 : 50);
        excise = base * ((cc || 0) / 1000) * age;
      }
      const duty = eu ? 0 : price * 0.10;
      const vat = (price + duty + excise) * 0.20;
      const total = duty + excise + vat;
      const r = rate?.rate;
      const money = (eur) => `${fmtN(eur)} €${r ? ` <small>≈ ${fmtN(eur * r)} ₴</small>` : ''}`;
      show(`${row(T.cu_duty, money(duty))}${row(T.cu_excise, money(excise))}${fuel !== 'electric' && fuel !== 'hybrid' ? row(T.cu_age, String(age)) : ''}${row(T.cu_vat, money(vat))}${row(T.cu_total, money(total), 'total')}${row(T.cu_full, money(price + total), 'total')}`);
    },
    plate() {
      const p = latin($('#t-plate').value);
      if (p.length < 4 || !/\d/.test(p) || !/^[A-Z]{2}/.test(p)) return err(T.pl_err);
      const code = p.slice(0, 2); const reg = T.regions[code];
      const std = /^[A-Z]{2}\d{4}[A-Z]{2}$/.test(p);
      show(`<div class="platebig-t"><span class="plate"><i aria-hidden="true">UA</i><span>${esc(p)}</span></span></div>${row(T.pl_region, reg ? esc(reg) : '—', reg ? 'total' : '')}${reg ? '' : `<p class="muted">${esc(T.pl_unknown.replace('{c}', code))}</p>`}${row(T.pl_fmt, esc(std ? T.pl_std : T.pl_other))}<a class="btn primary wide" href="/${lang}/check?q=${p}">${esc(T.pl_check)}</a>`);
    },
    mileage() {
      const y = val('#t-myear'), km = val('#t-km');
      if (!(y > 1900) || !(km >= 0)) return err(T.mi_err);
      const age = Math.max(1, year - y + 0.5);
      const avg = km / age;
      const [cls, msg] = avg < 8000 && age >= 3 ? ['warn', T.mi_low] : avg > 25000 ? ['warn', T.mi_high] : ['ok', T.mi_ok];
      const pct = Math.min(100, Math.round((avg / 30000) * 100));
      show(`${row(T.mi_avg, `${fmtN(avg)} km`, 'total')}<div class="meter"><i style="width:${pct}%"></i><span class="band" aria-hidden="true"></span></div><p class="tverdict ${cls}">${esc(msg)}</p>`);
    },
    fuel() {
      const c = val('#t-cons'), d = val('#t-dist'), p = val('#t-fprice');
      if (!(c > 0) || !(d > 0) || !(p > 0)) return err(T.fu_err);
      const m = (c / 100) * d * p;
      show(`${row(T.fu_month, `${fmtN(m)} ₴`, 'total')}${row(T.fu_year, `${fmtN(m * 12)} ₴`, 'total')}`);
    },
  };

  const form = $('form.tform');
  if (form) {
    form.addEventListener('submit', (e) => { e.preventDefault(); tools[form.dataset.tool](form); });
    const fuelSel = $('#t-fuel');
    const syncFuel = () => { if (!fuelSel) return; const ev = fuelSel.value === 'electric'; $('#t-cc').closest('label').hidden = ev || fuelSel.value === 'hybrid'; $('#t-kwh').closest('label').hidden = !ev; };
    if (fuelSel) { fuelSel.addEventListener('change', syncFuel); syncFuel(); }
    const q = new URLSearchParams(location.search).get('v');
    if (q && $('#t-vin')) { $('#t-vin').value = q; tools.vin(form); }
    else if (form.dataset.tool !== 'vin' && form.dataset.tool !== 'plate') tools[form.dataset.tool](form); // сразу показываем пример расчёта
  }

  // ---------- чек-лист: состояние в localStorage ----------
  const list = $('.cklist');
  if (list) {
    const key = 'vs_ck_' + lang; const total = Number(list.dataset.total);
    const boxes = $$('input[data-ck]', list);
    const saved = new Set(safe(() => JSON.parse(localStorage.getItem(key) || '[]')) || []);
    boxes.forEach((b) => { b.checked = saved.has(b.dataset.ck); });
    const upd = () => {
      const on = boxes.filter((b) => b.checked).map((b) => b.dataset.ck);
      safe(() => localStorage.setItem(key, JSON.stringify(on)));
      $('.ckn').textContent = T.ck_done.replace('{n}', on.length).replace('{t}', total);
      $('.ckprog i').style.width = `${Math.round((on.length / total) * 100)}%`;
    };
    list.addEventListener('change', upd);
    $('[data-ck-reset]').addEventListener('click', () => { boxes.forEach((b) => { b.checked = false; }); upd(); });
    upd();
  }
})();
