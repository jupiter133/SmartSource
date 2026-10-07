/* SmartSource Journal: sticky offset, dark mode toggle, device tabs, TOC highlight. */
(function () {
  var root = document.documentElement;

  function setTop() {
    var h = document.querySelector('.header');
    var sticky = h && getComputedStyle(h).position === 'sticky';
    root.style.setProperty('--jr-top', sticky ? h.offsetHeight + 'px' : '0px');
  }
  setTop();
  window.addEventListener('resize', setTop);

  document.querySelectorAll('[data-jr-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cur = root.getAttribute('data-jr-theme');
      if (!cur) cur = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      var next = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-jr-theme', next);
      try { localStorage.setItem('jr-theme', next); } catch (e) {}
    });
  });

  var saved = null;
  try { saved = localStorage.getItem('jr-device'); } catch (e) {}
  document.querySelectorAll('.device-tabs').forEach(function (wrap, wi) {
    var panes = Array.prototype.filter.call(wrap.children, function (el) { return el.tagName === 'SECTION'; });
    if (panes.length < 2) return;
    var nav = document.createElement('div');
    nav.className = 'device-tabs__nav';
    nav.setAttribute('role', 'tablist');
    var btns = panes.map(function (pane, i) {
      var b = document.createElement('button');
      var id = 'dt-' + wi + '-' + i;
      b.type = 'button';
      b.textContent = pane.getAttribute('data-label') || 'Tab ' + (i + 1);
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', id);
      pane.id = id;
      pane.setAttribute('role', 'tabpanel');
      b.addEventListener('click', function () { show(i, true); });
      nav.appendChild(b);
      return b;
    });
    function show(n, remember) {
      panes.forEach(function (p, i) { p.hidden = i !== n; btns[i].setAttribute('aria-selected', i === n ? 'true' : 'false'); });
      if (remember) {
        try { localStorage.setItem('jr-device', panes[n].getAttribute('data-label')); } catch (e) {}
      }
    }
    var start = 0;
    panes.forEach(function (p, i) { if (saved && p.getAttribute('data-label') === saved) start = i; });
    wrap.insertBefore(nav, wrap.firstChild);
    wrap.classList.add('is-ready');
    show(start, false);
  });

  var toc = document.querySelector('[data-jr-toc]');
  if (toc) {
    if (matchMedia('(max-width: 1099px)').matches) toc.removeAttribute('open');
    var links = toc.querySelectorAll('a');
    if ('IntersectionObserver' in window && links.length) {
      var map = {};
      links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && map[e.target.id]) {
            links.forEach(function (a) { a.classList.remove('is-current'); });
            map[e.target.id].classList.add('is-current');
          }
        });
      }, { rootMargin: '-20% 0px -70% 0px' });
      Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
    }
  }
})();
