/* Sell steps: accessible tabbed walkthrough (WAI-ARIA tabs pattern, automatic activation). */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const behavior = () => (reduceMotion.matches ? 'auto' : 'smooth');

  function init(root) {
    if (root.dataset.ready) return;
    const tablist = root.querySelector('[data-tablist]');
    const tabs = [...root.querySelectorAll('[data-tab]')];
    const panels = [...root.querySelectorAll('[data-panel]')];
    const rail = root.querySelector('[data-rail]');
    if (!tablist || !tabs.length || tabs.length !== panels.length) return;
    root.dataset.ready = 'true';

    let current = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));

    // Keep the rail in view when Next/Back is pressed far down the panel.
    const bringRailIntoView = () => {
      const header = document.querySelector('.header');
      const offset = (header && getComputedStyle(header).position === 'sticky' ? header.offsetHeight : 0) + 12;
      const top = rail.getBoundingClientRect().top;
      if (top < offset || top > window.innerHeight * 0.6) {
        window.scrollTo({ top: top + window.scrollY - offset, behavior: behavior() });
      }
    };

    // Center the active pill in the scrollable row (mobile) without moving the page vertically.
    const centerTab = (tab) => {
      if (tablist.scrollWidth <= tablist.clientWidth) return;
      tablist.scrollTo({ left: tab.offsetLeft - (tablist.clientWidth - tab.offsetWidth) / 2, behavior: behavior() });
    };

    function select(index, { focus = null } = {}) {
      if (index < 0 || index >= tabs.length) return;
      const dir = index >= current ? 1 : -1;
      const changed = index !== current;

      tabs.forEach((tab, i) => {
        const on = i === index;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        tab.dataset.state = i < index ? 'done' : on ? 'current' : 'upcoming';
      });
      panels.forEach((panel, i) => { panel.hidden = i !== index; });

      const panel = panels[index];
      if (changed && !reduceMotion.matches) {
        panel.classList.remove('is-entering');
        panel.style.setProperty('--dir', dir);
        void panel.offsetWidth; // restart the animation
        panel.classList.add('is-entering');
      }

      root.style.setProperty('--i', index);
      current = index;
      centerTab(tabs[index]);

      if (focus === 'tab') tabs[index].focus();
      if (focus === 'panel') {
        bringRailIntoView();
        panel.querySelector('[data-panel-title]')?.focus({ preventScroll: true });
      }
    }

    tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i)));

    tablist.addEventListener('keydown', (e) => {
      const last = tabs.length - 1;
      const keys = {
        ArrowRight: current === last ? 0 : current + 1,
        ArrowLeft: current === 0 ? last : current - 1,
        Home: 0,
        End: last,
      };
      if (!(e.key in keys)) return;
      e.preventDefault();
      select(keys[e.key], { focus: 'tab' });
    });

    root.querySelectorAll('[data-go]').forEach((btn) => {
      btn.addEventListener('click', () => select(Number(btn.dataset.go), { focus: 'panel' }));
    });

    // Swipe left/right on the panel area (touch only).
    const area = root.querySelector('[data-panels]');
    let startX = 0;
    let startY = 0;
    area.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    area.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) select(current + (dx < 0 ? 1 : -1));
    }, { passive: true });

    root.sellStepsSelect = select;
    select(current);
  }

  const initAll = (scope = document) => scope.querySelectorAll('[data-sell-steps]').forEach(init);
  initAll();

  // Theme editor: re-init on section reload, and show the tab whose block is being edited.
  document.addEventListener('shopify:section:load', (e) => initAll(e.target));
  document.addEventListener('shopify:block:select', (e) => {
    const tab = e.target.closest('[data-tab]');
    const root = e.target.closest('[data-sell-steps]');
    if (!tab || !root || !root.sellStepsSelect) return;
    root.sellStepsSelect([...root.querySelectorAll('[data-tab]')].indexOf(tab));
  });
})();
