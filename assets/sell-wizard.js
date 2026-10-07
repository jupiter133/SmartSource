/* Sell quote wizard: client-side, data from the section's JSON blobs. Exposes window.SellQuote.start(). */
(() => {
  const root = document.querySelector('[data-sell-wizard]');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';

  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const parse = (sel) => { try { return JSON.parse($(sel)?.textContent || '{}'); } catch (e) { return {}; } };

  const catalog = parse('[data-sell-catalog]');
  const config = parse('[data-sell-config]');
  const COND_INDEX = { like_new: 0, good: 1, fair: 2, cracked: 3, defective: 4 };
  const STORE_KEY = 'sellQuote:v1';
  const LAST_KEY = 'sellQuote:last';
  const TZ = 'America/Toronto';

  const categories = (catalog.categories || []).slice().sort((a, b) => a.s - b.s || a.n.localeCompare(b.n));
  const brands = (catalog.brands || []).slice().sort((a, b) => a.s - b.s || a.n.localeCompare(b.n));
  // Prices come nested under each device (d.pr); a flat catalog.prices list also works.
  const prices = (catalog.prices || []).concat((catalog.devices || []).flatMap((d) => (d.pr || []).map((x) => ({ d: d.h, st: x.st, p: x.p }))));
  const pricedDevices = new Set(prices.map((p) => p.d));
  const devices = (catalog.devices || []).filter((d) => pricedDevices.has(d.h));
  const conditions = (config.conditions || []).filter((c) => c.key in COND_INDEX);
  const byHandle = (list, h) => list.find((x) => x.h === h);
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const money = (n) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n || 0);
  const storageGB = (s) => { const m = /([\d.]+)\s*(tb|gb)/i.exec(s || ''); return m ? parseFloat(m[1]) * (m[2].toLowerCase() === 'tb' ? 1024 : 1) : Infinity; };
  const priceFor = (device, storage, condKey) => {
    const row = prices.find((p) => p.d === device && p.st === storage);
    const v = row ? row.p[COND_INDEX[condKey]] : null;
    return typeof v === 'number' && v > 0 ? v : null;
  };
  const storagesFor = (device) => [...new Set(prices.filter((p) => p.d === device).map((p) => p.st))].sort((a, b) => storageGB(a) - storageGB(b));
  const topPrice = (device, storage) => Math.max(0, ...Object.keys(COND_INDEX).map((k) => priceFor(device, storage, k) || 0));
  const imageFor = (d) => (d && (d.i || byHandle(categories, d.c)?.i)) || null;

  // ---------- state ----------
  const fresh = () => ({ step: 1, cur: { cat: null, brand: null, device: null, storage: null, cond: null }, items: [], details: { name: '', email: '', phone: '', method: '', store: '' } });
  const store = {
    get(key) { try { return JSON.parse(window.sessionStorage.getItem(key)); } catch (e) { return null; } },
    set(key, v) { try { window.sessionStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* private mode: progress just isn't saved */ } },
    del(key) { try { window.sessionStorage.removeItem(key); } catch (e) { /* ignore */ } },
  };
  let state = Object.assign(fresh(), store.get(STORE_KEY) || {});
  // drop saved selections that no longer exist (prices changed, device removed)
  if (state.cur.device && !byHandle(devices, state.cur.device)) state.cur = fresh().cur;
  state.items = (state.items || []).filter((it) => byHandle(devices, it.device) && priceFor(it.device, it.storage, it.cond));
  const save = () => store.set(STORE_KEY, state);

  const curPrice = () => (state.cur.device && state.cur.storage && state.cur.cond ? priceFor(state.cur.device, state.cur.storage, state.cur.cond) : null);
  const total = () => state.items.reduce((sum, it) => sum + it.price, 0) + (curPrice() || 0);

  const detailsValid = () => {
    const d = state.details;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '');
    return Boolean(d.name && d.name.trim() && emailOk && d.method && (d.method !== 'dropoff' || d.store || !$('[data-detail="store"] option[value]:not([value=""])')));
  };
  const complete = (n) => ({
    1: () => Boolean(state.cur.cat),
    2: () => Boolean(state.cur.brand),
    3: () => Boolean(state.cur.device),
    4: () => Boolean(state.cur.storage),
    5: () => Boolean(curPrice()),
    6: () => state.items.length > 0 && detailsValid(),
  }[n] || (() => false))();
  // First step the current device still needs; 6 once it is fully described.
  const firstOpen = () => {
    let n = 1;
    while (n < 5 && complete(n)) n += 1;
    return n === 5 && complete(5) ? 6 : n;
  };
  const allowed = (n) => n === 7 || n <= firstOpen() || (n === 6 && state.items.length > 0);

  // ---------- rendering helpers ----------
  const el = (tag, attrs = {}, ...kids) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().filter(Boolean).forEach((k) => node.append(k));
    return node;
  };
  const thumb = (src, alt = '') => {
    if (src) return el('img', { src, alt, loading: 'lazy', width: 160, height: 160 });
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 40 64');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<rect x="4" y="2" width="32" height="60" rx="7" fill="none" stroke="currentColor" stroke-width="2.5"/><rect x="15" y="6" width="10" height="3" rx="1.5" fill="currentColor"/>';
    return svg;
  };
  const check = () => el('span', { class: 'wiz-card__check', 'aria-hidden': 'true' });
  const card = ({ name, value, checked, disabled, cls = '', media, title, meta, badge }) => {
    const input = el('input', { type: 'radio', name, value, checked, disabled });
    return el('label', { class: `wiz-card ${cls}`.trim() },
      input, check(),
      media ? el('span', { class: 'wiz-card__media' }, media) : null,
      badge ? el('span', { class: 'wiz-card__badge', text: badge }) : null,
      el('span', { class: 'wiz-card__name', text: title }),
      meta ? el('span', { class: 'wiz-card__meta', text: meta }) : null);
  };
  const empty = (msg) => el('p', { class: 'wiz-empty', text: msg });

  function renderOptions(n) {
    const box = $(`[data-options="${n}"]`);
    if (!box) return;
    const c = state.cur;
    let nodes = [];
    if (n === 1) {
      const used = new Set(devices.map((d) => d.c));
      nodes = categories.filter((cat) => used.has(cat.h)).map((cat) => card({ name: 'wiz-cat', value: cat.h, checked: c.cat === cat.h, title: cat.n, media: thumb(cat.i), cls: 'wiz-card--cat' }));
      if (!nodes.length) nodes = [empty("We're updating our prices. Check back soon, or visit one of our stores.")];
    } else if (n === 2) {
      const used = new Set(devices.filter((d) => d.c === c.cat).map((d) => d.b));
      nodes = brands.filter((b) => used.has(b.h)).map((b) => card({ name: 'wiz-brand', value: b.h, checked: c.brand === b.h, title: b.n, media: b.i ? thumb(b.i) : el('span', { class: 'wiz-card__mono', text: b.n.slice(0, 1) }), cls: 'wiz-card--brand' }));
    } else if (n === 3) {
      nodes = devices.filter((d) => d.c === c.cat && d.b === c.brand)
        .sort((a, b) => (b.y || 0) - (a.y || 0) || a.s - b.s || a.n.localeCompare(b.n))
        .map((d) => card({ name: 'wiz-device', value: d.h, checked: c.device === d.h, title: d.n, meta: d.y ? String(d.y) : null, media: thumb(imageFor(d)), badge: d.p ? 'Popular' : null, cls: 'wiz-card--model' }));
    } else if (n === 4) {
      const d = byHandle(devices, c.device);
      $('[data-step-sub="4"]').textContent = d ? d.n : '';
      nodes = d ? storagesFor(d.h).map((st) => card({ name: 'wiz-storage', value: st, checked: c.storage === st, title: st, meta: `Up to ${money(topPrice(d.h, st))}`, cls: 'wiz-card--storage' })) : [];
      if (!nodes.length) nodes = [empty('Pick a model first.')];
    } else if (n === 5) {
      nodes = conditions.map((cond) => {
        const price = priceFor(c.device, c.storage, cond.key);
        const id = `WizCond-${cond.key}`;
        const input = el('input', { type: 'radio', name: 'wiz-cond', value: cond.key, checked: c.cond === cond.key, disabled: !price, 'aria-describedby': `${id}-sum` });
        const label = el('label', { class: 'wiz-cond__head' },
          input, check(),
          el('span', { class: 'wiz-cond__text' }, el('span', { class: 'wiz-card__name', text: cond.title }), el('span', { class: 'wiz-card__meta', id: `${id}-sum`, text: cond.summary })),
          el('span', { class: `wiz-cond__price${price ? '' : ' is-na'}`, text: price ? money(price) : 'Not accepted' }));
        const list = el('ul', { class: 'wiz-cond__list', role: 'list' }, cond.checklist.map((item) => el('li', { text: item })));
        const more = el('div', { class: 'wiz-cond__more', hidden: c.cond !== cond.key }, list);
        return el('div', { class: `wiz-cond${c.cond === cond.key ? ' is-selected' : ''}${price ? '' : ' is-disabled'}` }, label, more);
      });
    }
    box.replaceChildren(...nodes);
  }

  // ---------- summary + navigation ----------
  const totalEl = $('[data-sum-total]');
  const barTotalEl = $('[data-bar-total]');
  let shownTotal = 0;
  function animateTotal(to) {
    const from = shownTotal;
    shownTotal = to;
    if (reduceMotion.matches || from === to) { totalEl.textContent = money(to); barTotalEl.textContent = money(to); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 500);
      const v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      barTotalEl.textContent = money(p < 1 ? v : to);
      if (p < 1) requestAnimationFrame(tick); else totalEl.textContent = money(to); // announce the final value once
    };
    requestAnimationFrame(tick);
  }

  function renderSummary() {
    const c = state.cur;
    const d = byHandle(devices, c.device);
    const cond = conditions.find((x) => x.key === c.cond);
    $('[data-sum-img]').replaceChildren(thumb(imageFor(d)));
    $('[data-sum-name]').textContent = d ? d.n : (state.items.length ? 'Add another device, or get paid' : 'Pick your device');
    $('[data-sum-meta]').textContent = d ? [c.storage, cond && cond.title].filter(Boolean).join(' · ') || 'Choose storage and condition' : 'Your offer updates as you go.';
    animateTotal(total());

    const list = $('[data-sum-items]');
    list.replaceChildren(...state.items.map((it, i) => {
      const btn = el('button', { type: 'button', class: 'wiz-sum__remove', 'aria-label': `Remove ${it.name} from your quote`, text: 'Remove' });
      btn.addEventListener('click', () => removeItem(i));
      return el('li', {}, el('span', { class: 'wiz-sum__item-name', text: `${it.name} · ${it.storage} · ${it.condTitle}` }), el('strong', { text: money(it.price) }), btn);
    }));
    $('[data-sum-list]').hidden = state.items.length === 0;
  }

  function renderNav() {
    const step = state.step;
    $$('[data-goto]').forEach((b) => {
      const n = Number(b.dataset.goto);
      b.disabled = !allowed(n) || step === 7;
      b.classList.toggle('is-done', n !== step && allowed(n) && (n < step || complete(n)));
      if (n === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    $('[data-progress-fill]').style.width = `${(Math.min(step, 6) - 1) / 5 * 100}%`;

    const next = $('[data-wiz-next]');
    const prev = $('[data-wiz-prev]');
    const onCond = step === 5;
    prev.disabled = step === 1 && !state.items.length;
    prev.hidden = step === 7;
    next.hidden = onCond || step === 7;
    next.textContent = step === 6 ? 'Submit my quote' : 'Next';
    next.disabled = step === 6 ? !complete(6) : !complete(step);
    $('[data-getpaid]').hidden = !onCond;
    $('[data-addanother]').hidden = !onCond;
    $('[data-getpaid]').disabled = !complete(5);
    $('[data-addanother]').disabled = !complete(5);
    root.classList.toggle('is-done', step === 7);
  }

  function goTo(n, { push = true, focus = true } = {}) {
    if (n === 6 && curPrice()) addCurrent(); // reaching details with a finished device adds it to the quote
    if (!allowed(n)) n = Math.min(firstOpen(), 5);
    if (n === 6 && !state.items.length) n = Math.min(firstOpen(), 5);
    const dir = n >= state.step ? 1 : -1;
    const changed = n !== state.step;
    state.step = n;
    $$('[data-step]').forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
    const panel = $(`[data-step="${n}"]`);
    if (panel && changed && !reduceMotion.matches) {
      panel.classList.remove('is-entering');
      panel.style.setProperty('--dir', dir);
      void panel.offsetWidth;
      panel.classList.add('is-entering');
    }
    renderOptions(n);
    if (n === 6) syncDetailsToForm();
    renderSummary();
    renderNav();
    if (push && n !== 7) {
      const hash = `#sell-step-${n}`;
      if (window.location.hash !== hash) window.history.pushState({ sellStep: n }, '', hash);
    }
    if (n !== 7) save();
    if (focus) {
      const top = root.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.5) root.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      panel?.querySelector('.wiz-step__title')?.focus({ preventScroll: true });
    }
  }

  // ---------- selections ----------
  function selectDevice(handle) {
    const d = byHandle(devices, handle);
    if (!d) return false;
    state.cur = { cat: d.c, brand: d.b, device: d.h, storage: null, cond: null };
    const sts = storagesFor(d.h);
    if (sts.length === 1) state.cur.storage = sts[0];
    return true;
  }
  function addCurrent() {
    const c = state.cur;
    const d = byHandle(devices, c.device);
    const cond = conditions.find((x) => x.key === c.cond);
    const price = curPrice();
    if (!d || !cond || !price) return false;
    state.items.push({ device: d.h, name: d.n, img: imageFor(d), storage: c.storage, cond: c.cond, condTitle: cond.title, price });
    state.cur = fresh().cur;
    return true;
  }
  function removeItem(i) {
    state.items.splice(i, 1);
    save();
    if (state.step === 6 && !state.items.length) goTo(state.cur.cat ? Math.min(firstOpen(), 5) : 1);
    else { renderSummary(); renderNav(); }
  }

  let autoTimer;
  root.addEventListener('change', (e) => {
    const t = e.target;
    const c = state.cur;
    if (t.name === 'wiz-cat') state.cur = { ...fresh().cur, cat: t.value };
    else if (t.name === 'wiz-brand') state.cur = { ...fresh().cur, cat: c.cat, brand: t.value };
    else if (t.name === 'wiz-device') { selectDevice(t.value); }
    else if (t.name === 'wiz-storage') state.cur = { ...c, storage: t.value, cond: null };
    else if (t.name === 'wiz-cond') { c.cond = t.value; renderOptions(5); $(`input[name="wiz-cond"][value="${t.value}"]`)?.focus(); }
    else if (t.dataset && t.dataset.detail) { readDetails(); renderNav(); save(); return; }
    else return;
    renderSummary();
    renderNav();
    save();
  });
  // Pointer clicks on steps 1-4 move on automatically; keyboard users stay put and press Next.
  root.addEventListener('click', (e) => {
    const input = e.target.closest('.wiz-card')?.querySelector('input[type="radio"]');
    if (!input || e.detail === 0 || !['wiz-cat', 'wiz-brand', 'wiz-device', 'wiz-storage'].includes(input.name)) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => { if (complete(state.step) && state.step < 5) goTo(Math.min(firstOpen(), 5)); }, 260); // skips storage when there's only one
  });

  $('[data-wiz-next]').addEventListener('click', () => {
    if (state.step === 6) return form?.requestSubmit();
    if (complete(state.step)) goTo(state.step + 1);
  });
  $('[data-wiz-prev]').addEventListener('click', () => {
    if (state.step === 6 && !state.cur.cat && state.items.length) {
      const last = state.items.pop(); // bring the last device back so its condition can be changed
      state.cur = { cat: byHandle(devices, last.device)?.c, brand: byHandle(devices, last.device)?.b, device: last.device, storage: last.storage, cond: last.cond };
      return goTo(5);
    }
    if (state.step === 1 && state.items.length) return goTo(6);
    goTo(state.step - 1);
  });
  $('[data-getpaid]').addEventListener('click', () => { if (addCurrent()) goTo(6); });
  $('[data-addanother]').addEventListener('click', () => {
    if (!addCurrent()) return;
    goTo(1);
    $('[data-sum-total]').textContent = money(total()); // announce the running total
  });
  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => goTo(Number(b.dataset.goto))));

  // ---------- step 1 search (ARIA combobox) ----------
  (function initSearch() {
    const input = $('[data-wiz-search]');
    const list = $('[data-wiz-search-list]');
    if (!input || !list) return;
    const index = devices.map((d) => ({ d, hay: norm(`${d.n} ${byHandle(brands, d.b)?.n || ''} ${byHandle(categories, d.c)?.n || ''}`), nn: norm(d.n) }));
    let results = [];
    let active = -1;
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    const choose = (d) => { close(); input.value = ''; if (selectDevice(d.h)) goTo(Math.min(firstOpen(), 5)); };
    const setActive = (i) => {
      const opts = $$('[role="option"]:not([aria-disabled])', list);
      if (!opts.length) return;
      active = (i + opts.length) % opts.length;
      opts.forEach((o, k) => o.setAttribute('aria-selected', String(k === active)));
      input.setAttribute('aria-activedescendant', opts[active].id);
    };
    const render = () => {
      const terms = norm(input.value).split(' ').filter(Boolean);
      if (!terms.length) return close();
      results = index.filter((x) => terms.every((t) => x.hay.includes(t)))
        .sort((a, b) => Number(b.nn.startsWith(terms[0])) - Number(a.nn.startsWith(terms[0])) || a.d.n.length - b.d.n.length)
        .slice(0, 6).map((x) => x.d);
      list.replaceChildren(...(results.length ? results.map((d, i) => {
        const li = el('li', { id: `${list.id}-opt-${i}`, class: 'sell-search__opt', role: 'option', 'aria-selected': 'false' },
          el('span', { class: 'sell-search__thumb' }, thumb(imageFor(d))),
          el('span', {}, el('strong', { text: d.n }), el('small', { text: [byHandle(brands, d.b)?.n, byHandle(categories, d.c)?.n].filter(Boolean).join(' · ') })));
        li.addEventListener('mousedown', (e) => e.preventDefault());
        li.addEventListener('click', () => choose(d));
        return li;
      }) : [el('li', { class: 'sell-search__empty', role: 'option', 'aria-disabled': 'true', text: 'No match. Pick a category below.' })]));
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = -1;
    };
    input.addEventListener('input', render);
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) render(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Escape') close();
      else if (e.key === 'Enter') { e.preventDefault(); const pick = results[active] || results[0]; if (pick) choose(pick); }
    });
    root.sellSearch = (q) => { input.value = q || ''; render(); input.focus({ preventScroll: true }); };
  })();

  // ---------- details + submission ----------
  const form = $('[data-wiz-form]');
  function readDetails() {
    $$('[data-detail]').forEach((f) => {
      if (f.type === 'radio') { if (f.checked) state.details[f.dataset.detail] = f.value; }
      else state.details[f.dataset.detail] = f.value;
    });
    const storeField = $('[data-store-field]');
    if (storeField) storeField.hidden = state.details.method !== 'dropoff';
  }
  function syncDetailsToForm() {
    $$('[data-detail]').forEach((f) => {
      const v = state.details[f.dataset.detail] || '';
      if (f.type === 'radio') f.checked = f.value === v;
      else if (!f.value) f.value = v;
    });
    readDetails();
  }

  const torontoDate = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); // YYYY-MM-DD
  const longDate = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  function quoteRef(now) {
    const ymd = torontoDate(now).replace(/-/g, '').slice(2);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(4);
    (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(bytes) : bytes.forEach((_, i) => { bytes[i] = Math.random() * 256; });
    return `Q-${ymd}-${[...bytes].map((b) => chars[b % chars.length]).join('')}`;
  }

  // Buyback Live switch (Theme settings > Sell program). While off, offers are previews and can't be submitted.
  if (!config.live) {
    const note = document.createElement('p');
    note.className = 'wiz-preview';
    note.setAttribute('role', 'status');
    note.textContent = 'Preview offers, not final. Online quotes open soon. For a firm offer today, visit one of our stores.';
    (root.querySelector('.wiz-panel') || root).prepend(note);
  }

  form?.addEventListener('submit', (e) => {
    if (!$('[data-step="6"]')) return; // confirmation view: nothing to submit
    if (!config.live) { e.preventDefault(); alert('Online quotes aren\'t open yet. These are preview offers. Visit one of our stores for a firm offer.'); return; }
    readDetails();
    const missing = $$('[data-step="6"] [required]').find((f) => !f.checkValidity());
    if (missing) { e.preventDefault(); missing.reportValidity(); return; }
    if (!complete(6)) {
      e.preventDefault();
      const method = $('[data-detail="method"]');
      if (!state.details.method) { method.setCustomValidity('Choose how you will send it.'); method.reportValidity(); method.setCustomValidity(''); }
      else $('[data-detail="store"]')?.focus();
      return;
    }
    const now = new Date();
    const expires = new Date(now.getTime() + (config.quoteDays || 21) * 86400000);
    state.ref = quoteRef(now);
    state.expires = expires.toISOString();
    const methodLabel = state.details.method === 'dropoff' ? 'Drop off in store' : 'Ship it (free label)';
    const fields = {
      'Quote reference': state.ref,
      ...Object.fromEntries(state.items.map((it, i) => [`Device ${i + 1}`, `${it.name} | ${it.storage} | ${it.condTitle} | ${money(it.price)}`])),
      Total: money(state.items.reduce((s, it) => s + it.price, 0)),
      'Send method': methodLabel,
      Store: state.details.method === 'dropoff' ? (state.details.store || 'Not chosen') : 'n/a',
      'Submitted at': `${now.toLocaleString('en-CA', { timeZone: TZ })} (Toronto)`,
      'Quote expires': `${torontoDate(expires)} (${config.quoteDays} days)`,
    };
    const box = $('[data-hidden-fields]');
    box.replaceChildren(...Object.entries(fields).map(([k, v]) => el('input', { type: 'hidden', name: `contact[${k}]`, value: v })));
    store.set(LAST_KEY, { ref: state.ref, expires: state.expires, items: state.items, details: { method: state.details.method, store: state.details.store } });
    save();
  });

  function showConfirmation() {
    const last = store.get(LAST_KEY);
    state = fresh();
    store.del(STORE_KEY);
    if (last) {
      const refEl = $('[data-done-ref]');
      refEl.querySelector('strong').textContent = last.ref;
      refEl.hidden = false;
      $('[data-done-items]').replaceChildren(...last.items.map((it) => el('li', {},
        el('span', { class: 'wiz-done__thumb' }, thumb(it.img)),
        el('span', { class: 'wiz-done__name' }, el('strong', { text: it.name }), el('small', { text: `${it.storage} · ${it.condTitle}` })),
        el('strong', { text: money(it.price) }))));
      const totalP = $('[data-done-total]');
      totalP.querySelector('strong').textContent = money(last.items.reduce((s, it) => s + it.price, 0));
      totalP.hidden = false;
      const exp = $('[data-done-expiry]');
      exp.querySelector('strong').textContent = longDate(new Date(last.expires));
      exp.hidden = false;
    }
    goTo(7, { push: false, focus: true });
    $('[data-restart]')?.addEventListener('click', () => {
      store.del(LAST_KEY);
      const url = new URL(window.location.href);
      url.searchParams.delete('contact_posted');
      url.hash = 'sell-quote';
      window.location.href = url.toString();
    });
  }

  // ---------- public entry point (hero, price list, banners) ----------
  function start(opts = {}) {
    if (state.step === 7) return root.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    if (opts.device && selectDevice(opts.device)) return goTo(Math.min(firstOpen(), 5));
    if (opts.category) {
      const cat = categories.find((c) => norm(c.n) === norm(opts.category) || c.h === opts.category);
      if (cat) {
        const brand = opts.brand ? brands.find((b) => norm(b.n) === norm(opts.brand) || b.h === opts.brand) : null;
        const hasBrand = brand && devices.some((d) => d.c === cat.h && d.b === brand.h);
        state.cur = { ...fresh().cur, cat: cat.h, brand: hasBrand ? brand.h : null };
        return goTo(hasBrand ? 3 : 2);
      }
    }
    goTo(opts.query !== undefined || !state.cur.cat ? 1 : state.step);
    if (opts.query) root.sellSearch(opts.query);
  }
  window.SellQuote = { start };
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-sell-start]');
    if (!link) return;
    e.preventDefault();
    start({ device: link.dataset.device, category: link.dataset.category, brand: link.dataset.brand });
  });

  window.addEventListener('popstate', () => {
    if (state.step === 7) return;
    const m = /^#sell-step-(\d)$/.exec(window.location.hash);
    if (m) goTo(Number(m[1]), { push: false });
    else if (window.location.hash === '' && state.step !== 1 && state.step !== 7) goTo(1, { push: false, focus: false });
  });

  // ---------- mobile sticky bar ----------
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => root.classList.toggle('is-inview', en.isIntersecting), { rootMargin: '-35% 0px -35% 0px' }).observe(root);
  }

  // ---------- boot ----------
  if ($('[data-posted]')) {
    showConfirmation();
  } else {
    const params = new URLSearchParams(window.location.search);
    const hashStep = /^#sell-step-(\d)$/.exec(window.location.hash);
    const deep = { device: params.get('sell_device'), category: params.get('sell_category'), brand: params.get('sell_brand'), query: params.get('sell_q') };
    if (deep.device || deep.category || deep.query !== null) {
      ['sell_device', 'sell_category', 'sell_brand', 'sell_q'].forEach((k) => params.delete(k));
      const qs = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}#sell-quote`);
      start({ device: deep.device, category: deep.category, brand: deep.brand, query: deep.query === null ? undefined : deep.query });
    } else if ($('[data-form-errors]')) {
      goTo(6, { push: false });
    } else if (hashStep) {
      goTo(Number(hashStep[1]), { push: false });
    } else {
      goTo(state.step || 1, { push: false, focus: false });
    }
  }
  // Theme editor: scripts in re-rendered sections don't run again, so reload when the wizard is edited.
  document.addEventListener('shopify:section:load', (e) => { if (e.target.querySelector('[data-sell-wizard]')) window.location.reload(); });
})();
