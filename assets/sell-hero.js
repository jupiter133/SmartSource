/* Sell hero: live device search (ARIA combobox) + count-up on the payout card. */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const money = (n) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  // Hand off to the quote wizard on this page, or go to the page that has it.
  function startQuote(root, opts) {
    if (window.SellQuote && typeof window.SellQuote.start === 'function') return window.SellQuote.start(opts);
    const params = new URLSearchParams();
    if (opts.device) params.set('sell_device', opts.device);
    if (opts.query) params.set('sell_q', opts.query);
    window.location.href = `${root.dataset.quoteUrl || window.location.pathname}?${params}#sell-quote`;
  }

  function initSearch(root) {
    const form = root.querySelector('[data-sell-search]');
    const input = root.querySelector('[data-search-input]');
    const list = root.querySelector('[data-search-list]');
    const status = root.querySelector('[data-search-status]');
    if (!form || !input || !list) return;

    let devices = [];
    try { devices = JSON.parse(root.querySelector('[data-sell-index]')?.textContent || '[]'); } catch (e) { devices = []; }
    devices.forEach((d) => { d.hay = norm(`${d.n} ${d.b} ${d.c}`); d.nn = norm(d.n); });

    let results = [];
    let active = -1;

    const search = (q) => {
      const terms = norm(q).split(' ').filter(Boolean);
      if (!terms.length) return [];
      return devices
        .filter((d) => terms.every((t) => d.hay.includes(t)))
        .map((d) => ({ d, score: (d.nn.startsWith(terms[0]) ? 3 : 0) + (d.nn.split(' ').some((w) => w.startsWith(terms[0])) ? 1 : 0) - d.n.length / 100 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map((r) => r.d);
    };

    const close = () => {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    };

    const setActive = (i) => {
      const opts = [...list.querySelectorAll('[role="option"]:not([aria-disabled])')];
      if (!opts.length) return;
      active = (i + opts.length) % opts.length;
      opts.forEach((o, k) => o.setAttribute('aria-selected', k === active ? 'true' : 'false'));
      input.setAttribute('aria-activedescendant', opts[active].id);
      opts[active].scrollIntoView({ block: 'nearest' });
    };

    const choose = (d) => {
      input.value = d.n;
      close();
      startQuote(root, { device: d.h });
    };

    const render = () => {
      const q = input.value.trim();
      results = search(q);
      list.replaceChildren();
      active = -1;
      if (!q) return close();
      if (!results.length) {
        const li = document.createElement('li');
        li.className = 'sell-search__empty';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-disabled', 'true');
        li.textContent = devices.length ? 'No match. Try the model name, or pick a category below.' : 'Device list coming soon. Pick a category below.';
        list.append(li);
      }
      results.forEach((d, i) => {
        const li = document.createElement('li');
        li.id = `${list.id}-opt-${i}`;
        li.className = 'sell-search__opt';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        const media = document.createElement('span');
        media.className = 'sell-search__thumb';
        if (d.i) {
          const img = document.createElement('img');
          img.src = d.i; img.alt = ''; img.width = 40; img.height = 40; img.loading = 'lazy';
          media.append(img);
        }
        const text = document.createElement('span');
        const name = document.createElement('strong'); name.textContent = d.n;
        const meta = document.createElement('small'); meta.textContent = [d.b, d.c].filter(Boolean).join(' · ');
        text.append(name, meta);
        li.append(media, text);
        li.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input
        li.addEventListener('click', () => choose(d));
        list.append(li);
      });
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      if (status) status.textContent = results.length ? `${results.length} suggestion${results.length > 1 ? 's' : ''}. Use up and down arrows to choose.` : 'No matching devices.';
    };

    input.addEventListener('input', render);
    input.addEventListener('focus', () => { if (input.value.trim()) render(); });
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) render(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); close(); } }
      else if (e.key === 'Enter' && active >= 0 && results[active]) { e.preventDefault(); choose(results[active]); }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      const top = search(q)[0];
      if (top) return choose(top);
      close();
      startQuote(root, { query: q });
    });
  }

  function initCountUp(root) {
    root.querySelectorAll('[data-countup]').forEach((el) => {
      const target = Number(el.dataset.countup) || 0;
      if (reduceMotion.matches || !('IntersectionObserver' in window) || !target) return;
      el.textContent = money(0); // the card is still fading in, so this isn't seen as a jump
      const run = () => {
        const t0 = performance.now();
        const step = (now) => {
          const p = Math.min(1, (now - t0) / 1400);
          el.textContent = money(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };
      const io = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) { io.disconnect(); setTimeout(run, 450); }
      });
      io.observe(el);
    });
  }

  const init = (scope = document) => scope.querySelectorAll('[data-sell-hero]').forEach((root) => {
    if (root.dataset.ready) return;
    root.dataset.ready = 'true';
    initSearch(root);
    initCountUp(root);
  });
  init();
  document.addEventListener('shopify:section:load', (e) => init(e.target));
})();
