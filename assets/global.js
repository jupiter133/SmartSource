(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Announcement close
  $$('[data-announcement] [data-close]').forEach(b => b.addEventListener('click', () => b.parentElement.remove()));

  // Mobile menu
  $('[data-menu-toggle]')?.addEventListener('click', () => $('[data-menu]')?.classList.toggle('is-open'));

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

  // Product: thumbs, variants, condition guide
  const money = cents => (cents / 100).toLocaleString(document.documentElement.lang || 'en', { style: 'currency', currency: window.Shopify?.currency?.active || 'USD' });
  $$('[data-product]').forEach(root => {
    const main = $('[data-main-img]', root);
    $$('[data-thumb]', root).forEach(t => t.addEventListener('click', () => { if (main) { main.src = t.dataset.thumb; main.removeAttribute('srcset'); } }));
    $('[data-cond-guide]', root)?.addEventListener('click', () => { const p = $('[data-cond-panel]', root); p.hidden = !p.hidden; });

    const json = $('[data-product-json]', root);
    if (!json) return;
    const product = JSON.parse(json.textContent);
    const idInput = $('[data-variant-id]', root);
    const addBtn = $('[data-add]', root);
    const priceWrap = $('[data-price-wrap]', root);

    const update = () => {
      const selected = $$('fieldset[data-option-index]', root).map(f => $('input:checked', f)?.value);
      const variant = product.variants.find(v => v.options.every((o, i) => o === selected[i]));
      // grey out values that don't exist with the other current selections
      $$('fieldset[data-option-index]', root).forEach(f => {
        const idx = +f.dataset.optionIndex;
        $$('input', f).forEach(inp => {
          const ok = product.variants.some(v => v.available && v.options[idx] === inp.value && v.options.every((o, i) => i === idx || o === selected[i]));
          inp.closest('.opt__btn').classList.toggle('is-unavailable', !ok);
        });
      });
      if (!variant) { addBtn.disabled = true; addBtn.textContent = 'Unavailable'; return; }
      idInput.value = variant.id;
      addBtn.disabled = !variant.available;
      addBtn.textContent = variant.available ? 'Add to cart' : 'Sold out';
      const cmp = variant.compare_at_price > variant.price
        ? `<span class="price__new"><s>${money(variant.compare_at_price)}</s> new</span><span class="price__save">Save ${money(variant.compare_at_price - variant.price)}</span>` : '';
      priceWrap.innerHTML = `<div class="price"><span class="price__now">${money(variant.price)}</span>${cmp}</div>`;
      if (variant.featured_image && main) { main.src = variant.featured_image.src; main.removeAttribute('srcset'); }
      const url = new URL(location.href); url.searchParams.set('variant', variant.id); history.replaceState({}, '', url);
    };
    root.addEventListener('change', e => { if (e.target.closest('fieldset[data-option-index]')) update(); });
    update();
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
