(() => {
  const lang = document.currentScript.dataset.lang;
  const safe = (f) => { try { return f(); } catch { return null; } };
  // --- VIN: живая валидация (зеркалит src/vin.js) ---
  const TR = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9 };
  const W = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
  const norm = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  function validate(v) {
    if (v.length !== 17) return 'length';
    if (/[IOQ]/.test(v)) return 'chars';
    if ('12345'.includes(v[0])) {
      let s = 0; for (let i = 0; i < 17; i++) s += (/\d/.test(v[i]) ? +v[i] : TR[v[i]]) * W[i];
      const c = s % 11 === 10 ? 'X' : String(s % 11);
      if (c !== v[8]) return 'checksum';
    }
    return null;
  }
  document.querySelectorAll('.vinform').forEach((form) => {
    const input = form.querySelector('input'), hint = form.querySelector('.hint'), cnt = form.querySelector('.cnt');
    const msg = JSON.parse(input.dataset.msg);
    const update = (final) => {
      const v = norm(input.value); cnt.textContent = v.length + '/17';
      if (!v) { hint.textContent = ''; hint.className = 'hint'; return false; }
      const e = validate(v);
      if (!e) { hint.textContent = '✓ ' + msg.ok; hint.className = 'hint ok'; return true; }
      hint.className = 'hint';
      hint.textContent = (final || v.length === 17) ? msg[e] : '';
      return false;
    };
    input.addEventListener('input', () => update(false));
    form.addEventListener('submit', (ev) => {
      if (!update(true)) { ev.preventDefault(); input.focus(); return; }
      input.value = norm(input.value);
      safe(() => { const r = JSON.parse(localStorage.getItem('vs_recent') || '[]').filter((x) => x !== input.value); r.unshift(input.value); localStorage.setItem('vs_recent', JSON.stringify(r.slice(0, 4))); });
    });
    update(false);
    const box = form.querySelector('.recent');
    const r = safe(() => JSON.parse(localStorage.getItem('vs_recent') || '[]')) || [];
    if (box) box.innerHTML = r.map((x) => `<a href="/${lang}/check?vin=${encodeURIComponent(x)}">${x}</a>`).join('');
  });

  // --- Checkout ---
  const co = document.getElementById('co');
  if (co) co.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = document.getElementById('coerr'), btn = co.querySelector('button');
    const body = { lang, plan: co.dataset.plan, vin: norm(co.vin.value), email: co.email.value.trim(), code: co.code.value.trim() };
    err.textContent = ''; btn.disabled = true;
    try {
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'error');
      location.href = j.url;
    } catch (e) { err.textContent = e.message; btn.disabled = false; }
  });

  // --- Report: share + polling ---
  const sh = document.getElementById('share');
  if (sh) sh.addEventListener('click', async () => { await safe(() => navigator.clipboard.writeText(location.href)); const o = sh.textContent; sh.textContent = '✓ ' + sh.dataset.ok; setTimeout(() => (sh.textContent = o), 1800); });
  if (document.querySelector('[data-poll]')) setTimeout(() => location.reload(), 3000);
})();
