(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Announcement close
  $$('[data-announcement] [data-close]').forEach(b => b.addEventListener('click', () => b.parentElement.remove()));

  // Mobile menu
  const menuBtn = $('[data-menu-toggle]'), menu = $('[data-menu]');
  const setMenu = open => { menu?.classList.toggle('is-open', open); menuBtn?.setAttribute('aria-expanded', open); };
  menuBtn?.addEventListener('click', () => setMenu(!menu?.classList.contains('is-open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu?.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); } });
  matchMedia('(min-width: 750px)').addEventListener('change', e => e.matches && setMenu(false));

  // Mega menu: hover intent on desktop, tap to expand on mobile
  const overlay = document.createElement('div'); overlay.className = 'mega-overlay'; document.body.append(overlay);
  const desktop = () => matchMedia('(min-width: 750px)').matches;
  const closeAll = () => { $$('[data-nav-item].is-open').forEach(i => { i.classList.remove('is-open'); $('.nav-link', i)?.setAttribute('aria-expanded', 'false'); }); document.body.classList.remove('mega-open'); };
  const openItem = item => { closeAll(); item.classList.add('is-open'); $('.nav-link', item)?.setAttribute('aria-expanded', 'true'); if (desktop()) document.body.classList.add('mega-open'); };
  $$('[data-nav-item].has-mega').forEach(item => {
    let t;
    item.addEventListener('mouseenter', () => { if (!desktop()) return; clearTimeout(t); t = setTimeout(() => openItem(item), 120); });
    item.addEventListener('mouseleave', () => { if (!desktop()) return; clearTimeout(t); t = setTimeout(closeAll, 150); });
    $('.nav-link', item).addEventListener('click', e => { if (desktop()) return; e.preventDefault(); item.classList.contains('is-open') ? closeAll() : openItem(item); });
    $('.nav-link', item).addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); openItem(item); $('.mega a', item)?.focus(); } });
    item.addEventListener('focusout', e => { if (!item.contains(e.relatedTarget)) closeAll(); });
  });
  document.addEventListener('keydown', e => e.key === 'Escape' && closeAll());

  // Carousels
  $$('[data-carousel]').forEach(root => {
    const track = $('[data-track]', root);
    if (!track) return;
    const step = () => track.clientWidth * 0.8;
    $$('[data-prev]', root).forEach(b => b.addEventListener('click', () => track.scrollBy({ left: -step() })));
    $$('[data-next]', root).forEach(b => b.addEventListener('click', () => track.scrollBy({ left: step() })));
  });

  // Slideshows: scroll-snap track + dots, arrows, autoplay (paused on hover, focus, hidden tab, reduced motion)
  $$('[data-slideshow]').forEach(root => {
    const track = $('[data-slides]', root);
    const slides = track ? [...track.children] : [];
    if (slides.length < 2) return;
    const dots = $$('[data-slide-dot]', root);
    let i = 0, timer;
    const go = n => { i = (n + slides.length) % slides.length; track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft }); };
    const mark = () => dots.forEach((d, k) => { d.classList.toggle('is-active', k === i); k === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current'); });
    let raf;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { i = Math.round(track.scrollLeft / track.clientWidth); mark(); }); }, { passive: true });
    $('[data-slide-prev]', root)?.addEventListener('click', () => { go(i - 1); stop(); });
    $('[data-slide-next]', root)?.addEventListener('click', () => { go(i + 1); stop(); });
    dots.forEach((d, k) => d.addEventListener('click', () => { go(k); stop(); }));
    const secs = +root.dataset.autoplay;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let paused = false, stopped = false;
    const start = () => { clearInterval(timer); if (!secs || reduce || stopped) return; timer = setInterval(() => { if (!paused && !document.hidden) go(i + 1); }, secs * 1000); };
    const stop = () => { stopped = true; clearInterval(timer); };
    root.addEventListener('mouseenter', () => (paused = true));
    root.addEventListener('mouseleave', () => (paused = false));
    root.addEventListener('focusin', () => (paused = true));
    root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) paused = false; });
    track.addEventListener('touchstart', stop, { passive: true });
    start();
  });

  // Collection filters: apply on change, drop empty fields, slide-out drawer on mobile
  $$('[data-filter-form]').forEach(form => {
    const clean = () => $$('input, select', form).forEach(el => { if (!el.value || (el.type === 'checkbox' && !el.checked)) el.disabled = true; });
    form.addEventListener('submit', clean);
    const send = () => { clean(); form.submit(); };
    form.addEventListener('change', e => { if (e.target.matches('input[type=checkbox], [data-autosubmit]')) send(); });
    const drawer = $('[data-filter-drawer]', form), opener = $('[data-filter-open]', form);
    const setOpen = open => { form.classList.toggle('filters-open', open); opener?.setAttribute('aria-expanded', open); document.body.style.overflow = open ? 'hidden' : ''; if (open) $('summary', drawer)?.focus(); };
    opener?.addEventListener('click', () => setOpen(true));
    $$('[data-filter-close]', form).forEach(b => b.addEventListener('click', () => { setOpen(false); opener?.focus(); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && form.classList.contains('filters-open')) { setOpen(false); opener?.focus(); } });
  });

  // Help center: live search across questions + open whichever chat app is installed
  $$('[data-help]').forEach(root => {
    const input = $('[data-help-search]', root), none = $('[data-help-none]', root);
    const qs = $$('[data-help-q]', root), groups = $$('[data-help-group]', root), topics = $('[data-help-topics]', root);
    input?.addEventListener('input', () => {
      const term = input.value.trim().toLowerCase();
      let hits = 0;
      qs.forEach(q => { const on = !term || q.textContent.toLowerCase().includes(term); q.hidden = !on; if (on) hits++; if (term && on) q.open = false; });
      groups.forEach(g => (g.hidden = term && !$$('[data-help-q]', g).some(q => !q.hidden)));
      if (topics) topics.hidden = !!term;
      if (none) none.hidden = !term || hits > 0;
    });
    const chatBtn = $('[data-help-chat]', root), note = $('[data-help-chat-note]', root);
    chatBtn?.addEventListener('click', () => {
      const inbox = document.querySelector('inbox-online-store-chat');
      const inboxBtn = inbox?.shadowRoot?.querySelector('button');
      if (inboxBtn) return inboxBtn.click();
      if (window.tidioChatApi) return window.tidioChatApi.open();
      if (window.GorgiasChat?.open) return window.GorgiasChat.open();
      if (typeof window.zE === 'function') return window.zE('messenger', 'open');
      if (chatBtn.dataset.fallback) return window.open(chatBtn.dataset.fallback, '_blank', 'noopener');
      if (note) note.hidden = false;
      $('#HelpContactForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  // Tabs
  $$('[data-tabs]').forEach(root => {
    $$('[data-tab]', root).forEach(tab => tab.addEventListener('click', () => {
      $$('[data-tab]', root).forEach(t => t.classList.toggle('is-active', t === tab));
      $$('[data-panel]', root).forEach(p => (p.hidden = p.dataset.panel !== tab.dataset.tab));
    }));
  });

  // Video reels: click to play/pause
  $$('[data-reel]').forEach(reel => {
    const v = $('video', reel);
    if (!v) return;
    reel.addEventListener('click', () => {
      if (v.paused) { v.muted = false; v.play(); reel.classList.add('is-playing'); }
      else { v.pause(); reel.classList.remove('is-playing'); }
    });
  });

  // Product page
  const fmt = cents => (cents / 100).toLocaleString(undefined, { style: 'currency', currency: window.Shopify?.currency?.active || 'USD' });
  const SWATCH = { black:'#1b1b1f', midnight:'#1f2430', 'space black':'#2b2b2e', 'space gray':'#6e6e73', graphite:'#54524f', white:'#f5f5f2', starlight:'#f2ece0', silver:'#e3e4e5', gold:'#f2d9b3', red:'#d1001f', '(product)red':'#d1001f', blue:'#8fb3d9', 'pacific blue':'#2f4f6b', 'sierra blue':'#9bb5ce', 'deep blue':'#24344d', 'mist blue':'#a9bfd4', 'sky blue':'#bcd7ec', ultramarine:'#5a6ff0', teal:'#9fd4cf', green:'#c8dcc4', 'alpine green':'#566453', 'midnight green':'#4e5851', yellow:'#f9e479', purple:'#d9cbe8', 'deep purple':'#594f63', pink:'#f7c9cf', coral:'#ee7762', lavender:'#d8c8ef', sage:'#b7c4a6', 'cosmic orange':'#e8743b', 'desert titanium':'#bfa48f', 'natural titanium':'#bab4aa', 'white titanium':'#f2f1ed', 'black titanium':'#3a3a3c', 'blue titanium':'#3f4a5a', 'cloud white':'#f2f2f0', 'light gold':'#ead8b9',
    // Samsung
    'phantom black':'#2a2a2c', 'phantom gray':'#77797d', 'phantom white':'#f1f0ec', 'phantom silver':'#c9cbce', 'phantom violet':'#b7a6d1', 'phantom pink':'#f3cfd0', 'pink gold':'#eac9b5', burgundy:'#6b2737', cream:'#eee5d3', olive:'#8f9a6a', mint:'#c6ead9', onyx:'#2a2a2c', 'onyx black':'#2a2a2c', 'marble gray':'#c7c6c3', 'cobalt violet':'#6c5fa8', 'amber yellow':'#f2d98a', 'titanium black':'#3c3c3e', 'titanium gray':'#8e8d8a', 'titanium violet':'#8a7fa0', 'titanium yellow':'#e9dcae', navy:'#283147', icyblue:'#cfe0ee', 'icy blue':'#cfe0ee', 'silver shadow':'#b8bcc2', 'titanium silverblue':'#a9b8c9', 'titanium whitesilver':'#e7e7e5', 'titanium silver':'#cfd0d2', 'titanium jetblack':'#1e1f22', 'titanium icyblue':'#c5d6e6', jetblack:'#1e1f22', 'jet black':'#1e1f22', 'blue shadow':'#4a5a77', coralred:'#e5604f', 'blue black':'#22304a', 'light blue':'#b9d4ea', 'light gray':'#d6d6d6', 'light green':'#cfe7c8', 'awesome navy':'#2b3550', 'awesome iceblue':'#c9dcec', 'awesome lilac':'#cdb9e3', 'awesome black':'#26262a', 'awesome lavender':'#c8bde6', 'awesome white':'#f4f4f2', 'awesome violet':'#b6a3d6', beige:'#e3d7c4', 'moonstone gray':'#7d7f86', 'platinum silver':'#d9dadc',
    // Apple extras
    'rose gold':'#e8c4b8', 'natural titanium':'#bab4aa', 'black titanium':'#3a3a3c',
    // consoles
    'jet black':'#1e1f22', 'carbon black':'#232323', 'robot white':'#f4f4f4', 'galaxy black':'#1b1d2b', 'neon red/blue':'linear-gradient(90deg,#ff4554 50%,#00c3e3 50%)', turquoise:'#4fd1c5', coral:'#f47c7c' };
  $$('[data-swatch]').forEach(d => { const k = d.dataset.swatch.toLowerCase(); d.style.setProperty('--sw', SWATCH[k] || k.split(' ').pop()); });

  $$('[data-product]').forEach(root => {
    const main = $('[data-main-img]', root);
    const thumbs = $$('[data-thumb]', root);
    const show = (src, mediaId) => { if (main) { main.src = src; main.removeAttribute('srcset'); } thumbs.forEach(t => t.classList.toggle('is-active', t.dataset.mediaId == mediaId)); };
    thumbs.forEach(t => t.addEventListener('click', () => show(t.dataset.thumb, t.dataset.mediaId)));
    $('[data-wish]', root)?.addEventListener('click', e => e.currentTarget.classList.toggle('is-on'));
    const tin = $('[data-tradein]', root);
    tin && $('input', tin).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); location.href = tin.dataset.tradein + '?q=' + encodeURIComponent(e.target.value); } });

    const json = $('[data-product-json]', root);
    if (!json) return;
    const product = JSON.parse(json.textContent);
    const cfg = JSON.parse($('[data-pdp-config]', root)?.textContent || '{}');
    const form = $('[data-product-form]', root);
    const idInput = $('[data-variant-id]', root);
    const addBtn = $('[data-add]', root);
    const sets = $$('fieldset[data-option-index]', root);
    const selected = () => sets.map(f => $('input:checked', f)?.value);
    const find = opts => product.variants.find(v => v.options.every((o, i) => o === opts[i]));

    const priceHTML = v => {
      const save = v.compare_at_price > v.price ? `<span class="pp__was"><s>${fmt(v.compare_at_price)}</s> ${cfg.compareLabel || 'new'} <span class="pp__save">Save ${fmt(v.compare_at_price - v.price)}</span></span>` : '';
      return `<div class="pp"><span class="pp__now">${fmt(v.price)}</span>${save}</div>`;
    };

    const update = (fromUser) => {
      const sel = selected();
      const variant = find(sel);
      // per-choice prices: same selection with this one value swapped
      sets.forEach(f => {
        const idx = +f.dataset.optionIndex;
        const rows = $$('.choice', f).map(label => {
          const inp = $('input', label);
          const alt = sel.slice(); alt[idx] = inp.value;
          const v = find(alt);
          return { label, v };
        });
        const prices = rows.filter(r => r.v && r.v.available).map(r => r.v.price);
        const min = Math.min(...prices);
        rows.forEach(({ label, v }) => {
          const el = $('[data-choice-price]', label);
          const sold = !v || !v.available;
          label.classList.toggle('is-soldout', sold);
          el.textContent = sold ? 'Sold out' : fmt(v.price);
          el.classList.toggle('is-best', !sold && v.price === min && prices.length > 1 && idx === cfg.cond);
        });
      });
      const condNote = $('[data-cond-note]', root);
      const capt = $('[data-cond-caption]', root);
      if (cfg.cond >= 0 && capt) capt.textContent = `Example of ${sel[cfg.cond]} (body, screen)`;

      $$('[data-opts-text]', root).forEach(el => (el.textContent = sel.join(' · ')));
      $$('[data-opt-tags]', root).forEach(el => (el.innerHTML = sel.map(s => `<span>${s}</span>`).join('')));
      const btns = [addBtn, ...$$('[data-add-proxy]', root)];
      if (!variant) { btns.forEach(b => { b.disabled = true; b.textContent = 'Unavailable'; }); $$('[data-price-block]', root).forEach(el => (el.innerHTML = '')); return; }
      idInput.value = variant.id;
      $$('form input[name="id"]').forEach(i => { if (i.closest('#pdp-installments')) { i.value = variant.id; i.dispatchEvent(new Event('change', { bubbles: true })); } });
      btns.forEach(b => { b.disabled = !variant.available; b.textContent = variant.available ? 'Add to cart' : 'Sold out'; });
      $$('[data-price-block]', root).forEach(el => (el.innerHTML = priceHTML(variant)));
      if (variant.featured_media) {
        const src = variant.featured_media.preview_image?.src || variant.featured_image?.src;
        if (src) { const url = src + (src.includes('?') ? '&' : '?') + 'width=1200'; show(url, variant.featured_media.id); $$('[data-color-img], [data-variant-thumb]', root).forEach(i => { i.src = url; i.removeAttribute('srcset'); }); }
      }
      if (fromUser) { const url = new URL(location.href); url.searchParams.set('variant', variant.id); history.replaceState({}, '', url); }
    };
    root.addEventListener('change', e => { if (e.target.closest('fieldset[data-option-index]')) update(true); });
    $$('[data-add-proxy]', root).forEach(b => b.addEventListener('click', () => form.requestSubmit()));
    update(false);

    // sticky bar + scroll progress
    const sticky = $('[data-sticky]', root), bar = $('[data-progress]', root), anchor = $('.buy__ctas', root);
    if (sticky && anchor) {
      new IntersectionObserver(([e]) => sticky.classList.toggle('is-on', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(anchor);
      addEventListener('scroll', () => { const r = root.getBoundingClientRect(); const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight))); bar.style.width = (p * 100) + '%'; }, { passive: true });
    }
  });

  // Cart drawer (AJAX)
  const drawer = $('[data-drawer]');
  const refreshCart = async () => {
    const res = await fetch(`${window.Shopify?.routes?.root || '/'}?section_id=cart-drawer-items`);
    const html = new DOMParser().parseFromString(await res.text(), 'text/html');
    const inner = html.querySelector('.shopify-section')?.innerHTML || '';
    $$('[data-drawer-body], [data-cart-page]').forEach(el => (el.innerHTML = inner));
    const cart = await (await fetch('/cart.js')).json();
    $$('[data-cart-count]').forEach(c => { c.textContent = cart.item_count; c.hidden = cart.item_count === 0; });
  };
  const openDrawer = () => { if (drawer) { drawer.hidden = false; document.body.style.overflow = 'hidden'; } };
  const closeDrawer = () => { if (drawer) { drawer.hidden = true; document.body.style.overflow = ''; } };
  $$('[data-drawer-close]').forEach(b => b.addEventListener('click', closeDrawer));
  document.addEventListener('keydown', e => e.key === 'Escape' && closeDrawer());
  $$('[data-cart-open]').forEach(a => a.addEventListener('click', e => { if (drawer) { e.preventDefault(); openDrawer(); } }));

  $$('[data-product-form]').forEach(form => form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('[data-add]', form); btn.disabled = true;
    const res = await fetch('/cart/add.js', { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
    btn.disabled = false;
    if (!res.ok) { alert((await res.json()).description || 'Could not add to cart'); return; }
    await refreshCart(); openDrawer();
  }));

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-qty]');
    if (!b) return;
    await fetch('/cart/change.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.dataset.qty, quantity: +b.dataset.val }) });
    refreshCart();
  });
})();
