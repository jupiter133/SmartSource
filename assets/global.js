(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Announcement close
  $$('[data-announcement] [data-close]').forEach(b => b.addEventListener('click', () => b.parentElement.remove()));

  // Mobile menu
  $('[data-menu-toggle]')?.addEventListener('click', () => $('[data-menu]')?.classList.toggle('is-open'));

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
  const SWATCH = { black:'#1b1b1f', midnight:'#1f2430', 'space black':'#2b2b2e', 'space gray':'#6e6e73', graphite:'#54524f', white:'#f5f5f2', starlight:'#f2ece0', silver:'#e3e4e5', gold:'#f2d9b3', red:'#d1001f', '(product)red':'#d1001f', blue:'#8fb3d9', 'pacific blue':'#2f4f6b', 'sierra blue':'#9bb5ce', 'deep blue':'#24344d', 'mist blue':'#a9bfd4', 'sky blue':'#bcd7ec', ultramarine:'#5a6ff0', teal:'#9fd4cf', green:'#c8dcc4', 'alpine green':'#566453', 'midnight green':'#4e5851', yellow:'#f9e479', purple:'#d9cbe8', 'deep purple':'#594f63', pink:'#f7c9cf', coral:'#ee7762', lavender:'#d8c8ef', sage:'#b7c4a6', 'cosmic orange':'#e8743b', 'desert titanium':'#bfa48f', 'natural titanium':'#bab4aa', 'white titanium':'#f2f1ed', 'black titanium':'#3a3a3c', 'blue titanium':'#3f4a5a', 'cloud white':'#f2f2f0', 'light gold':'#ead8b9', 'sky blue':'#c7dceb' };
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
