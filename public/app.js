(() => {
  const lang = document.currentScript.dataset.lang;
  const safe = (f) => { try { return f(); } catch { return null; } };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const track = (name, props) => safe(() => window.plausible && window.plausible(name, { props }));
  document.documentElement.classList.add('js');

  // ---------- Оверлей загрузки: текст подставляется при показе, фон недоступен (inert) ----------
  const loader = $('#loader');
  const setBusy = (on) => {
    if (!loader) return;
    const p = $('p', loader); if (on) p.textContent = loader.dataset.text; else p.textContent = '';
    loader.hidden = !on;
    if (on) loader.focus({ preventScroll: true });
    ['header.top', 'main', 'footer', '.skip', '#sticky'].forEach((sel) => { const el = $(sel); if (el) { on ? el.setAttribute('inert', '') : el.removeAttribute('inert'); } });
    document.body.setAttribute('aria-busy', on ? 'true' : 'false');
  };
  window.addEventListener('pageshow', () => setBusy(false));

  // ---------- VIN / номер: нормализация и валидация (зеркалит src/vin.js и src/plate.js) ----------
  const TR = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9 };
  const W = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
  const CYR = { 'А':'A','В':'B','Е':'E','І':'I','К':'K','М':'M','Н':'H','О':'O','Р':'P','С':'C','Т':'T','Х':'X','У':'Y' };
  // без lookbehind: он не поддерживается в Safari до 16.4 и ломал бы весь скрипт
  const LABEL = /(^|[^\p{L}\d])(?:vin(?:[\s-]*(?:код|code))?|він(?:[\s-]*код)?|вин(?:[\s-]*код)?|номер\s+кузова|номер\s+кузову|кузов|code)(?![\p{L}\d])/giu;
  const strip = (v) => v.replace(LABEL, '$1 ');
  const alnum = (v) => strip(v).toUpperCase().replace(/[^A-Z0-9А-ЯІЇЄҐ]/g, '');
  const latin = (v) => [...strip(v).toUpperCase()].map((c) => CYR[c] || c).join('').replace(/[^A-Z0-9]/g, '');
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

  const recentKey = 'vs_recent';
  const getRecent = () => safe(() => JSON.parse(localStorage.getItem(recentKey) || '[]').filter((x) => /^[A-Z0-9]{5,17}$/.test(x))) || [];
  $$('.vinform').forEach((form) => {
    const input = $('input[name=q]', form), hint = $('.hint', form), cnt = $('.cnt', form), box = $('.searchbox', form);
    const modes = $$('.modes span', form), msg = JSON.parse(input.dataset.msg);
    const setMode = (m) => modes.forEach((el) => el.classList.toggle('on', el.dataset.mode === m));
    const show = (text, kind) => { hint.textContent = text; hint.className = 'hint' + (kind ? ' ' + kind : ''); const bad = kind === 'err'; box.classList.toggle('invalid', bad); input.setAttribute('aria-invalid', bad ? 'true' : 'false'); };
    const update = (final) => {
      const raw = input.value; const v = latin(raw);
      cnt.textContent = alnum(raw).length + '/17';
      if (!v) { show('', ''); setMode(null); return false; }
      if (v.length < 17 && isPlate(v)) { setMode('plate'); show('✓ ' + msg.plate, 'ok'); return true; }
      setMode(/\d/.test(v) && v.length > 8 ? 'vin' : null);
      const e = vinError(v);
      if (!e) { setMode('vin'); show('✓ ' + msg.ok, 'ok'); return true; }
      show((final || v.length >= 17) ? (e === 'bad' ? msg.bad : msg[e]) : '', (final || v.length >= 17) ? 'err' : '');
      return false;
    };
    input.addEventListener('input', () => update(false));
    form.addEventListener('submit', (ev) => {
      if (!update(true)) { ev.preventDefault(); input.focus(); return; }
      const v = latin(input.value); input.value = v;
      safe(() => { const r = getRecent().filter((x) => x !== v); r.unshift(v); localStorage.setItem(recentKey, JSON.stringify(r.slice(0, 4))); });
      track('search', { type: isPlate(v) && v.length < 17 ? 'plate' : 'vin' });
      setBusy(true);
    });
    $$('[data-fill]', form).forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.fill; update(false); input.focus(); }));
    update(false);
    const rec = $('.recent', form);
    const EX = ['1HGCM82633A004352', 'AA1234BB'];
    const LBL = { uk: 'Ви шукали:', ru: 'Вы искали:', en: 'Recent:' };
    const prev = getRecent().filter((x) => !EX.includes(x));
    if (rec && prev.length) { const l = document.createElement('span'); l.className = 'recent-l'; l.textContent = LBL[lang] || LBL.en; rec.appendChild(l); }
    if (rec) prev.forEach((x) => { const a = document.createElement('a'); a.href = `/${lang}/check?q=${encodeURIComponent(x)}`; a.textContent = x; a.addEventListener('click', () => setBusy(true)); rec.appendChild(a); });
  });

  // ---------- Лист ожидания ----------
  $$('form.notify').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msgEl = $('.notify-msg', f.parentElement); const btn = $('button', f); btn.disabled = true;
    const mail = f.email; mail.removeAttribute('aria-invalid');
    try {
      const r = await fetch('/api/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email.value.trim(), lang: f.dataset.lang, utm: location.search.slice(0, 200) }) });
      if (!r.ok) { const j = await r.json(); const e = new Error(j.error || 'error'); e.field = j.field; throw e; }
      msgEl.className = 'good notify-msg'; msgEl.textContent = '✓ ' + f.dataset.ok; f.reset(); track('waitlist');
    } catch (e) { msgEl.className = 'err notify-msg'; msgEl.textContent = e.message; mail.setAttribute('aria-invalid', 'true'); mail.focus(); }
    btn.disabled = false;
  }));

  // ---------- Оформление (платный режим) ----------
  const co = $('#co');
  if (co) co.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = $('#coerr'), btn = $('button[type=submit]', co);
    const body = { lang, plan: co.dataset.plan, vin: latin(co.vin.value), email: co.email.value.trim(), code: co.code ? co.code.value.trim() : '' };
    err.textContent = ''; btn.disabled = true; setBusy(true);
    $$('input', co).forEach((i) => { i.removeAttribute('aria-invalid'); i.setAttribute('aria-describedby', 'coerr'); });
    try {
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { const e = new Error(j.error || 'error'); e.field = j.field; throw e; }
      location.href = j.url;
    } catch (e) {
      err.textContent = e.message; btn.disabled = false; setBusy(false);
      const bad = e.field && co.elements[e.field]; if (bad) { bad.setAttribute('aria-invalid', 'true'); bad.focus(); }
    }
  });

  // ---------- Фото: при ошибке загрузки — силуэт ----------
  $$('.photo img').forEach((img) => {
    const fail = () => img.closest('.photo').classList.add('nophoto');
    img.addEventListener('error', fail);
    if (img.complete && img.naturalWidth === 0) fail();
  });

  // ---------- Печать и «скопировать ссылку» ----------
  $$('[data-print]').forEach((b) => b.addEventListener('click', () => { track('print'); window.print(); }));
  window.addEventListener('beforeprint', () => $$('details').forEach((d) => d.setAttribute('open', '')));
  const sh = $('#share');
  if (sh) sh.addEventListener('click', async () => {
    track('share');
    // на телефоне — системное меню «Поделиться» (мессенджеры), иначе копируем ссылку
    if (navigator.share) { try { await navigator.share({ title: document.title, url: location.href }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    await safe(() => navigator.clipboard.writeText(location.href));
    const o = sh.textContent; sh.textContent = '✓ ' + sh.dataset.ok; setTimeout(() => (sh.textContent = o), 1800);
  });

  // ---------- Ожидание отчёта: опрос с нарастающим интервалом и лимитом ----------
  const poll = $('[data-poll]');
  if (poll) {
    let n = 0;
    const tick = async () => {
      if (++n > 10) { poll.querySelector('p').textContent = poll.dataset.wait; return; }
      await new Promise((r) => setTimeout(r, Math.min(2000 * n, 8000)));
      const html = await safe(async () => (await fetch(location.href, { headers: { accept: 'text/html' } })).text());
      if (html && !html.includes('data-poll')) { const doc = new DOMParser().parseFromString(html, 'text/html'); $('main').innerHTML = doc.querySelector('main').innerHTML;
        const h1 = $('h1'); if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus(); }
        const live = document.createElement('div'); live.className = 'sr-only'; live.setAttribute('role', 'status'); document.body.appendChild(live); setTimeout(() => { live.textContent = poll.dataset.ready; }, 50); return; }
      tick();
    };
    tick();
  }

  // ---------- Липкая кнопка (мобильный): показываем после прокрутки, до этого она скрыта и недоступна ----------
  const sticky = $('#sticky');
  if (sticky) {
    document.body.classList.add('has-sticky');
    const onScroll = () => { const on = window.scrollY > 320; sticky.hidden = !on; sticky.classList.toggle('on', on); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    $('a', sticky).addEventListener('click', () => track('unlock'));
  }

  // ---------- Меню: закрытие, возврат фокуса ----------
  const menu = $('details.menu');
  if (menu) {
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) menu.removeAttribute('open'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.removeAttribute('open'); $('summary', menu).focus(); } });
    $$('.sheet a', menu).forEach((a) => a.addEventListener('click', () => menu.removeAttribute('open')));
  }

  // ---------- Плавное появление секций ----------
  const rev = $$('.reveal');
  if ('IntersectionObserver' in window && rev.length) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    rev.forEach((el) => io.observe(el));
  } else rev.forEach((el) => el.classList.add('in'));
  if (location.hash === '#notify') track('pricing_notify_click');

  // ---------- Пример отчёта: если фото лота недоступно, показываем карточку без галереи ----------
  const gal = $('.pv-gal');
  if (gal) document.addEventListener('error', (e) => { if (e.target && e.target.matches && e.target.matches('.pv-gal img')) { e.target.hidden = true; if (e.target.classList.contains('pv-ph')) gal.hidden = true; } }, true);

  // ---------- Кнопка «Наверх»: появляется после прокрутки на пару экранов ----------
  const up = $('#totop');
  if (up) {
    const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let tick = false;
    const sync = () => { tick = false; const on = window.scrollY > Math.max(600, innerHeight * 0.9); if (up.hidden === on) up.hidden = !on; up.classList.toggle('on', on); };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(sync); } }, { passive: true });
    up.addEventListener('click', () => { scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); const m = $('#main'); if (m) setTimeout(() => m.focus({ preventScroll: true }), calm ? 0 : 450); });
    sync();
  }
})();
