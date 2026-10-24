(() => {
  const lang = document.currentScript.dataset.lang;
  const safe = (f) => { try { return f(); } catch { return null; } };
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  document.documentElement.classList.add('js');

  // ---------- VIN / номер: нормализация и валидация (зеркалит src/vin.js и src/plate.js) ----------
  const TR = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9 };
  const W = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
  const CYR = { 'А':'A','В':'B','Е':'E','І':'I','К':'K','М':'M','Н':'H','О':'O','Р':'P','С':'C','Т':'T','Х':'X','У':'Y' };
  const alnum = (v) => v.toUpperCase().replace(/[^A-Z0-9А-ЯІЇЄҐ]/g, '');
  const latin = (v) => [...v.toUpperCase()].map((c) => CYR[c] || c).join('').replace(/[^A-Z0-9]/g, '');
  const PLATE = /^(?:[A-Z]{2}\d{4}[A-Z]{2}|\d{5}[A-Z]{2,3}|\d{4}[A-Z]{2,3}|[A-Z]{2}\d{3,5}[A-Z]?|[A-Z]\d{4,6}[A-Z]{0,2})$/;
  const isPlate = (p) => p.length >= 5 && p.length <= 8 && /\d/.test(p) && /[A-Z]/.test(p) && PLATE.test(p);
  function vinError(v) {
    if (v.length !== 17) return 'bad';
    if (/[IOQ]/.test(v)) return 'chars';
    if ('12345'.includes(v[0])) {
      let s = 0; for (let i = 0; i < 17; i++) s += (/\d/.test(v[i]) ? +v[i] : TR[v[i]]) * W[i];
      if ((s % 11 === 10 ? 'X' : String(s % 11)) !== v[8]) return 'checksum';
    }
    return null;
  }
  const loader = document.getElementById('loader');
  window.addEventListener('pageshow', () => loader && loader.classList.remove('on'));

  $$('.vinform').forEach((form) => {
    const input = form.querySelector('input[name=q]'), hint = form.querySelector('.hint'), cnt = form.querySelector('.cnt');
    const modes = $$('.modes span', form), msg = JSON.parse(input.dataset.msg);
    const setMode = (m) => modes.forEach((el) => el.classList.toggle('on', el.dataset.mode === m));
    const update = (final) => {
      const raw = input.value; const v = latin(raw);
      cnt.textContent = alnum(raw).length + '/17';
      hint.className = 'hint';
      if (!v) { hint.textContent = ''; setMode(null); return false; }
      if (v.length < 17 && isPlate(v)) { setMode('plate'); hint.textContent = '✓ ' + msg.plate; hint.className = 'hint ok'; return true; }
      setMode(/\d/.test(v) && v.length > 8 ? 'vin' : null);
      const e = vinError(v);
      if (!e) { setMode('vin'); hint.textContent = '✓ ' + msg.ok; hint.className = 'hint ok'; return true; }
      hint.textContent = (final || v.length >= 17) ? msg[e] : '';
      return false;
    };
    input.addEventListener('input', () => update(false));
    form.addEventListener('submit', (ev) => {
      if (!update(true)) { ev.preventDefault(); input.focus(); return; }
      const v = latin(input.value); input.value = v;
      safe(() => { const r = JSON.parse(localStorage.getItem('vs_recent') || '[]').filter((x) => x !== v); r.unshift(v); localStorage.setItem('vs_recent', JSON.stringify(r.slice(0, 4))); });
      if (loader) loader.classList.add('on');
    });
    $$('[data-fill]', form).forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.fill; update(false); input.focus(); }));
    update(false);
    const box = form.querySelector('.recent');
    const r = safe(() => JSON.parse(localStorage.getItem('vs_recent') || '[]')) || [];
    if (box) box.innerHTML = r.map((x) => `<a href="/${lang}/check?q=${encodeURIComponent(x)}">${x}</a>`).join('');
    $$('a', box || document.createElement('div')).forEach((a) => a.addEventListener('click', () => loader && loader.classList.add('on')));
  });

  // ---------- Лист ожидания ----------
  $$('form.notify').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msgEl = f.parentElement.querySelector('.notify-msg'); const btn = f.querySelector('button'); btn.disabled = true;
    try {
      const r = await fetch('/api/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email.value.trim(), lang: f.dataset.lang }) });
      if (!r.ok) throw new Error((await r.json()).error || 'error');
      msgEl.className = 'good notify-msg'; msgEl.textContent = '✓ ' + f.dataset.ok; f.reset();
    } catch (e) { msgEl.className = 'err notify-msg'; msgEl.textContent = e.message; }
    btn.disabled = false;
  }));

  // ---------- Оформление ----------
  const co = document.getElementById('co');
  if (co) co.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = document.getElementById('coerr'), btn = co.querySelector('button');
    const body = { lang, plan: co.dataset.plan, vin: latin(co.vin.value), email: co.email.value.trim(), code: co.code ? co.code.value.trim() : '' };
    err.textContent = ''; btn.disabled = true; if (loader) loader.classList.add('on');
    try {
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'error');
      location.href = j.url;
    } catch (e) { err.textContent = e.message; btn.disabled = false; if (loader) loader.classList.remove('on'); }
  });

  // ---------- Отчёт: ссылка, автообновление ----------
  const sh = document.getElementById('share');
  if (sh) sh.addEventListener('click', async () => { await safe(() => navigator.clipboard.writeText(location.href)); const o = sh.textContent; sh.textContent = '✓ ' + sh.dataset.ok; setTimeout(() => (sh.textContent = o), 1800); });
  if (document.querySelector('[data-poll]')) setTimeout(() => location.reload(), 3000);

  // ---------- Липкая кнопка (мобильный), меню, появление секций ----------
  const sticky = document.getElementById('sticky');
  if (sticky) {
    document.body.classList.add('has-sticky');
    const onScroll = () => sticky.classList.toggle('on', window.scrollY > 320);
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
  const menu = document.querySelector('details.menu');
  if (menu) {
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) menu.removeAttribute('open'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.removeAttribute('open'); });
  }
  const rev = $$('.reveal');
  if ('IntersectionObserver' in window && rev.length) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    rev.forEach((el) => io.observe(el));
  } else rev.forEach((el) => el.classList.add('in'));
})();
