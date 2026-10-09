/* Mobile plans: tabs, prepaid multi-step request, postpaid/financing request, calculator, device configurator. */
(function () {
  'use strict';
  var root = document.querySelector('[data-mp]');
  if (!root || root.__mp) return;
  root.__mp = true;

  var LOCALE = (root.getAttribute('data-locale') || 'en').toLowerCase();
  var i18nEl = root.querySelector('[data-mp-i18n]') || document.querySelector('[data-mp-i18n]');
  var I18N = {
    help: i18nEl ? i18nEl.getAttribute('data-help') : 'Help me choose',
    byod: i18nEl ? i18nEl.getAttribute('data-byod') : 'Bring my own phone',
    upfront: i18nEl ? i18nEl.getAttribute('data-upfront-tpl') : '%U + taxes | %M/mo',
    payLabel: (i18nEl && i18nEl.getAttribute('data-pay-label')) || 'Pay %U upfront',
    upfrontTaxes: (i18nEl && i18nEl.getAttribute('data-upfront-taxes')) || '%U upfront + taxes',
    perMo: (i18nEl && i18nEl.getAttribute('data-per-mo')) || ' /mo.'
  };
  var store = {
    get: function (k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };

  function money(n) {
    n = Math.round(Number(n) * 100) / 100;
    var s = n % 1 === 0 ? String(n) : n.toFixed(2);
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, LOCALE === 'fr' ? ' ' : ',');
    return LOCALE === 'fr' ? s.replace('.', ',') + ' $' : '$' + s;
  }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function num(v) { var n = parseFloat(String(v || '').replace(',', '.')); return isNaN(n) ? null : n; }

  /* ---------- modals ---------- */
  var lastFocus = null;
  function openModal(m) {
    if (!m) return;
    lastFocus = document.activeElement;
    m.hidden = false;
    document.documentElement.classList.add('mp-lock');
    requestAnimationFrame(function () { m.classList.add('is-open'); });
    var f = $('input:not([type=hidden]):not([disabled]):not([tabindex="-1"]), select, button', $('[data-mp-formbody]:not([hidden])', m) || m);
    if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }
  function closeModal(m) {
    if (!m || m.hidden) return;
    m.classList.remove('is-open');
    m.hidden = true;
    document.documentElement.classList.remove('mp-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $$('[data-mp-modal]').forEach(function (m) {
    $$('[data-mp-close]', m).forEach(function (b) { b.addEventListener('click', function () { closeModal(m); }); });
    m.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal(m);
      if (e.key === 'Tab') {
        var f = $$('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]):not([tabindex="-1"]), select:not([disabled]), textarea', m).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  });

  /* ---------- form helpers: validation, backup, submit ---------- */
  function validate(scope) {
    var ok = true, first = null;
    $$('input, select, textarea', scope).forEach(function (el) {
      if (el.disabled || el.type === 'hidden' || el.hasAttribute('data-mp-hp')) return;
      if (el.closest('[hidden]')) return;
      var valid = el.checkValidity();
      if (el.type === 'radio') {
        var group = $$('input[type=radio][name="' + el.name + '"]', scope);
        valid = !el.required || group.some(function (r) { return r.checked; });
      }
      var wrap = el.closest('.mp-field, .mp-check, .mp-radios') || el;
      wrap.classList.toggle('is-invalid', !valid);
      el.setAttribute('aria-invalid', valid ? 'false' : 'true');
      if (!valid) { ok = false; if (!first) first = el; }
    });
    if (first) first.focus();
    return ok;
  }
  function backupKey(form) { return 'mp-backup-' + form.id; }
  function backup(form) {
    var data = {};
    $$('input, select, textarea', form).forEach(function (el) {
      if (!el.name || el.hasAttribute('data-mp-hp') || el.name === 'form_type' || el.name === 'utf8') return;
      if (el.type === 'radio' || el.type === 'checkbox') { if (el.checked) data[el.name + '::' + el.value] = true; }
      else data[el.name] = el.value;
    });
    store.set(backupKey(form), data);
  }
  function restore(form) {
    var data = store.get(backupKey(form));
    if (!data) return;
    $$('input, select, textarea', form).forEach(function (el) {
      if (!el.name || el.hasAttribute('data-mp-hp') || el.name === 'form_type' || el.name === 'utf8') return;
      if (el.type === 'radio' || el.type === 'checkbox') el.checked = !!data[el.name + '::' + el.value];
      else if (data[el.name] != null && (el.value === '' || el.type === 'hidden')) el.value = data[el.name];
    });
  }
  function setField(form, key, val) { var el = $('[data-mp-field="' + key + '"]', form); if (el) el.value = val == null ? '' : val; }
  function bodyFrom(form) {
    var lines = [];
    $$('input, select, textarea', form).forEach(function (el) {
      if (el.disabled || !el.name || el.hasAttribute('data-mp-hp')) return;
      var m = el.name.match(/^contact\[(.+)\]$/);
      if (!m || m[1] === 'body' || m[1] === 'tags') return;
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
      if (!el.value) return;
      lines.push(m[1] + ': ' + el.value);
    });
    return lines.join('\n');
  }
  function guardSubmit(form, before) {
    form.addEventListener('input', function () { backup(form); });
    form.addEventListener('change', function () { backup(form); });
    form.addEventListener('submit', function (e) {
      var hp = $('[data-mp-hp]', form);
      if (hp && hp.value) { e.preventDefault(); return; }
      if (!validate($('[data-mp-formbody]', form))) { e.preventDefault(); var er = $('[data-mp-errors]', form); if (er) er.hidden = false; return; }
      if (before) before();
      setField(form, 'page', location.pathname);
      setField(form, 'body', bodyFrom(form));
      backup(form);
      store.set('mp-last', { form: form.id, tab: currentTab || null, sel: form.__sel || null });
      var btn = $('[type=submit]', form);
      if (btn) { btn.disabled = true; btn.textContent = btn.getAttribute('data-sending') || btn.textContent; }
    });
  }
  function postState(form) {
    var s = $('[data-mp-posted]', form);
    return { posted: s && s.getAttribute('data-mp-posted') === '1', errors: s && s.getAttribute('data-mp-haserrors') === '1' };
  }
  function showSuccess(form) {
    $('[data-mp-formbody]', form).hidden = true;
    $('[data-mp-success]', form).hidden = false;
    var m = form.closest('[data-mp-modal]');
    var pr = m && $('.mp-progress', m); if (pr) pr.hidden = true;
    var sl = m && $('[data-mp-steplabel]', m); if (sl) sl.hidden = true;
    store.del(backupKey(form));
  }

  /* ---------- postpaid / financing request ---------- */
  var ppModal = $('#MpPostpaid');
  var ppForm = $('#MpPostpaidForm');
  function openPostpaid(sel) {
    if (!ppForm) return;
    ppForm.__sel = sel;
    var items = [];
    var type = sel.type;
    if (type === 'financing') {
      items.push([sel.device, [sel.model !== sel.device ? sel.model : '', sel.storage, sel.colour, sel.sim].filter(Boolean).join(' · ')]);
      if (sel.payment) items.push([sel.payment, '']);
      if (sel.plan) items.push([sel.plan, sel.planPrice != null ? money(sel.planPrice) + '/mo' : '']);
      if (sel.estimate) items.push([sel.estimate, '']);
    } else if (type === 'byod') {
      items.push([sel.plan, sel.planPrice != null ? money(sel.planPrice) + '/mo' : '']);
      items.push([I18N.byod, '']);
    } else if (type === 'promo') {
      items.push([sel.plan, '']);
    } else {
      items.push([I18N.help, '']);
    }
    var ul = $('[data-mp-summary]', ppForm);
    ul.innerHTML = '';
    items.forEach(function (it) {
      var li = document.createElement('li');
      var s = document.createElement('strong'); s.textContent = it[0]; li.appendChild(s);
      if (it[1]) { var sm = document.createElement('span'); sm.textContent = it[1]; li.appendChild(sm); }
      ul.appendChild(li);
    });
    var typeLabel = { financing: 'Postpaid + phone on financing', byod: 'Postpaid, bring my own phone', promo: 'Postpaid promo', help: 'Help me choose' }[type];
    setField(ppForm, 'type', typeLabel);
    setField(ppForm, 'selection', type === 'help' ? 'Help me choose' : type === 'byod' ? 'Bring my own phone' : (sel.plan || ''));
    setField(ppForm, 'plan', sel.plan || '');
    setField(ppForm, 'device', sel.device || '');
    setField(ppForm, 'model', sel.model || '');
    setField(ppForm, 'storage', sel.storage || '');
    setField(ppForm, 'colour', sel.colour || '');
    setField(ppForm, 'sim', sel.sim || '');
    setField(ppForm, 'payment', sel.payment || '');
    setField(ppForm, 'estimate', sel.estimate || '');
    setField(ppForm, 'tags', { financing: 'postpaid, financing', byod: 'postpaid, byod', promo: 'postpaid', help: 'postpaid' }[type]);
    $('[data-mp-formbody]', ppForm).hidden = false;
    $('[data-mp-success]', ppForm).hidden = true;
    openModal(ppModal);
  }
  if (ppForm) {
    guardSubmit(ppForm, function () {
      var sel = ppForm.__sel || { type: 'help' };
      var name = ($('[name="contact[name]"]', ppForm).value || '').trim();
      var subj;
      if (sel.type === 'financing') subj = '[POSTPAID] ' + (sel.plan ? sel.plan + ' + ' : '') + (sel.model || sel.device) + (sel.storage ? ' ' + sel.storage : '');
      else if (sel.type === 'byod') subj = '[POSTPAID BYOD] ' + sel.plan;
      else if (sel.type === 'promo') subj = '[POSTPAID] ' + sel.plan;
      else subj = '[POSTPAID] Help me choose';
      setField(ppForm, 'subject', subj + ' - ' + name);
    });
    $('[data-mp-edit]', ppForm).addEventListener('click', function () {
      var sel = ppForm.__sel || {};
      closeModal(ppModal);
      if (tabsReady) setTab(sel.type === 'financing' ? 'financing' : 'postpaid', true);
    });
  }

  /* ---------- tabs (plans page) ---------- */
  var currentTab = null, tabsReady = false;
  var tabs = $$('[data-mp-tab]', root);
  function setTab(name, scroll) {
    if (!tabs.length) return;
    if (['prepaid', 'postpaid', 'financing'].indexOf(name) < 0) name = 'prepaid';
    currentTab = name;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-mp-tab') === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    $$('[data-mp-panel]', root).forEach(function (p) { p.hidden = p.getAttribute('data-mp-panel') !== name; });
    try {
      var u = new URL(location.href);
      u.searchParams.set('tab', name);
      if (name !== 'postpaid') u.searchParams.delete('byod');
      u.searchParams.delete('contact_posted');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (e) {}
    if (scroll) {
      var bar = $('[data-mp-tabsbar]', root);
      var y = bar.getBoundingClientRect().top + window.scrollY - stickyTop();
      if (window.scrollY > y || scroll === 'force') window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }
  function stickyTop() {
    var h = document.querySelector('.header');
    return h ? h.getBoundingClientRect().height : 0;
  }
  if (tabs.length) {
    tabsReady = true;
    var setTop = function () { root.style.setProperty('--mp-top', stickyTop() + 'px'); };
    setTop(); window.addEventListener('resize', setTop);
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { setTab(t.getAttribute('data-mp-tab'), true); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        var n = tabs[(i + d + tabs.length) % tabs.length];
        n.focus(); setTab(n.getAttribute('data-mp-tab'));
      });
    });
    var params = new URLSearchParams(location.search);
    var last = store.get('mp-last');
    var startTab = params.get('tab') || (params.has('contact_posted') && last && last.tab) || 'prepaid';
    if (params.get('byod') === '1') startTab = 'postpaid';
    setTab(startTab);
    if (params.get('byod') === '1') {
      var hint = $('[data-mp-byodhint]', root); if (hint) hint.hidden = false;
      setTimeout(function () { var g = $('#MpPostpaidPlans'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
    }
    $$('[data-mp-gotab]', root).forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); setTab(b.getAttribute('data-mp-gotab'), 'force'); });
    });

    /* prepaid sub-tabs */
    var terms = $$('[data-mp-term]', root);
    terms.forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-mp-term');
        terms.forEach(function (x) { var on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
        $$('[data-mp-termgrid]', root).forEach(function (g) { g.hidden = g.getAttribute('data-mp-termgrid') !== t; });
      });
    });

    /* brand chips */
    $$('[data-mp-devgroup]', root).forEach(function (grp) {
      var chips = $$('[data-mp-brand]', grp);
      chips.forEach(function (c) {
        c.addEventListener('click', function () {
          var b = c.getAttribute('data-mp-brand'), shown = 0;
          chips.forEach(function (x) { var on = x === c; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
          $$('[data-mp-devices] .mp-device', grp).forEach(function (d) {
            var on = b === 'all' || d.getAttribute('data-brand') === b;
            d.hidden = !on; if (on) shown++;
          });
          var nr = $('[data-mp-noresults]', grp); if (nr) nr.hidden = shown > 0;
        });
      });
    });
    $$('[data-mp-goto]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var t = document.querySelector(b.getAttribute('data-mp-goto'));
        if (t) t.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      });
    });

    /* postpaid triggers */
    $$('[data-mp-byod]', root).forEach(function (b) {
      b.addEventListener('click', function () { openPostpaid({ type: 'byod', plan: b.getAttribute('data-mp-byod'), planPrice: num(b.getAttribute('data-price')) }); });
    });
    $$('[data-mp-promo]', root).forEach(function (b) {
      b.addEventListener('click', function () { openPostpaid({ type: 'promo', plan: b.getAttribute('data-mp-promo') }); });
    });
    $$('[data-mp-help]', root).forEach(function (b) { b.addEventListener('click', function () { openPostpaid({ type: 'help' }); }); });
  }

  /* ---------- prepaid multi-step request ---------- */
  var prModal = $('#MpPrepaid');
  var prForm = $('#MpPrepaidForm');
  var step = 1, STEPS = 5;
  function showStep(n) {
    step = n;
    $$('.mp-step', prForm).forEach(function (f) { f.hidden = Number(f.getAttribute('data-step')) !== n; });
    $('[data-mp-progress]', prModal).style.width = (n / STEPS * 100) + '%';
    var sl = $('[data-mp-steplabel]', prModal); sl.textContent = sl.getAttribute('data-tpl').replace('%N', n);
    $('[data-mp-prev]', prForm).hidden = n === 1;
    $('[data-mp-next]', prForm).hidden = n === STEPS;
    $('[data-mp-send]', prForm).hidden = n !== STEPS;
    if (n === STEPS) buildReview();
    var body = $('.mp-modal__panel', prModal); if (body) body.scrollTop = 0;
  }
  function toggleCond(key, on) {
    $$('[data-mp-if="' + key + '"]', prForm).forEach(function (c) {
      c.hidden = !on;
      $$('input, select, textarea', c).forEach(function (el) { el.disabled = !on; });
    });
  }
  function selectedPlan() { return $('input[name="contact[Plan]"]:checked', prForm); }
  function syncPrepaid() {
    if (!prForm) return;
    var nr = $('input[data-mp-number]:checked', prForm);
    toggleCond('transfer', nr && nr.value === 'Transfer my number');
    var sim = $('input[data-mp-sim]:checked', prForm);
    toggleCond('ship', !sim || sim.value === 'Ship me a SIM');
    var ph = $('input[data-mp-phone]:checked', prForm);
    var want = ph && ph.value === 'I want a SmartSource phone';
    toggleCond('have', !want); toggleCond('want', want);
    var p = selectedPlan();
    var bundle = want && p && p.getAttribute('data-eligible') === '1' && Number(root.getAttribute('data-bundle')) > 0;
    var bn = $('[data-mp-bundlenote]', prForm); if (bn) bn.hidden = !bundle;
    setField(prForm, 'bundle', bundle ? money(root.getAttribute('data-bundle')) + ' off a SmartSource phone' : '');
    return bundle;
  }
  function buildReview() {
    var dl = $('[data-mp-review]', prForm);
    dl.innerHTML = '';
    $$('fieldset.mp-step', prForm).forEach(function (fs) {
      if (fs.getAttribute('data-step') === '5') return;
      $$('input, select, textarea', fs).forEach(function (el) {
        if (el.disabled || el.hasAttribute('data-mp-hp') || !el.name) return;
        if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
        if (!el.value) return;
        var lab = el.name.replace(/^contact\[|\]$/g, '');
        var lbl = el.id && $('label[for="' + el.id + '"]', prForm);
        if (lbl) lab = lbl.textContent.trim();
        var dt = document.createElement('dt'); dt.textContent = lab;
        var dd = document.createElement('dd'); dd.textContent = el.type === 'checkbox' ? '✓' : el.value;
        dl.appendChild(dt); dl.appendChild(dd);
      });
    });
  }
  function openPrepaid(handle) {
    if (!prForm) return;
    if (handle) { var r = $('input[data-plan-handle="' + handle + '"]', prForm); if (r) r.checked = true; }
    $('[data-mp-formbody]', prForm).hidden = false;
    $('[data-mp-success]', prForm).hidden = true;
    syncPrepaid();
    showStep(handle ? 2 : 1);
    openModal(prModal);
  }
  if (prForm) {
    prForm.addEventListener('change', syncPrepaid);
    $('[data-mp-next]', prForm).addEventListener('click', function () {
      var fs = $('.mp-step[data-step="' + step + '"]', prForm);
      if (validate(fs)) showStep(Math.min(STEPS, step + 1));
    });
    $('[data-mp-prev]', prForm).addEventListener('click', function () { showStep(Math.max(1, step - 1)); });
    prForm.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && step < STEPS) { e.preventDefault(); $('[data-mp-next]', prForm).click(); }
    });
    guardSubmit(prForm, function () {
      var bundle = syncPrepaid();
      var p = selectedPlan();
      var name = ($('[name="contact[name]"]', prForm).value || '').trim();
      setField(prForm, 'subject', '[PREPAID] ' + (p ? p.getAttribute('data-plan-short') : 'Koodo') + ' - ' + name);
      setField(prForm, 'tags', bundle ? 'prepaid, bundle' : 'prepaid');
    });
    $$('[data-mp-activate]', root).forEach(function (b) {
      b.addEventListener('click', function () { openPrepaid(b.getAttribute('data-mp-activate')); });
    });
  }
  /* "Back to plans" just closes the drawer when already on the plans page */
  $$('[data-mp-backplans]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (!tabsReady) return;
      e.preventDefault();
      closeModal(a.closest('[data-mp-modal]'));
    });
  });

  /* ---------- savings calculator ---------- */
  var calc = $('[data-mp-calc]', root);
  if (calc) {
    var tplOurs = ($('[data-calc-tpl-ours]', calc) || {}).innerHTML || 'Phone %P + plan %L';
    var run = function () {
      var opt = $('[data-calc-plan]', calc).selectedOptions[0];
      if (!opt) return;
      var price = num(opt.getAttribute('data-price')) || 0;
      var term = num(opt.getAttribute('data-term')) || 30;
      var cycles = Math.ceil(730 / term);
      var phone = Math.max(0, num($('[data-calc-phone]', calc).value) || 0);
      var buying = $('[data-calc-buying]', calc).checked;
      var disc = buying && opt.getAttribute('data-eligible') === '1' ? (num(root.getAttribute('data-bundle')) || 0) : 0;
      var phoneCost = buying ? Math.max(0, phone - disc) : 0;
      var planCost = price * cycles;
      var ours = phoneCost + planCost;
      var pp = num(root.getAttribute('data-calc-postpaid')) || 0;
      var fin = num(root.getAttribute('data-calc-financing')) || 0;
      var theirs = (pp + fin) * 24;
      $('[data-calc-ours]', calc).textContent = money(Math.round(ours));
      $('[data-calc-theirs]', calc).textContent = money(Math.round(theirs));
      $('[data-calc-ours-break]', calc).textContent = tplOurs.replace('%P', money(Math.round(phoneCost)).replace(/\s?\$/, '')).replace('%L', money(Math.round(planCost)).replace(/\s?\$/, ''));
      $('[data-calc-theirs-break]', calc).textContent = tplOurs.replace('%P', money(Math.round(fin * 24)).replace(/\s?\$/, '')).replace('%L', money(Math.round(pp * 24)).replace(/\s?\$/, ''));
      var save = $('[data-calc-save]', calc);
      var diff = Math.round(theirs - ours);
      save.textContent = diff > 0 ? save.getAttribute('data-tpl').replace('%A', money(diff)) : save.getAttribute('data-none');
      save.classList.toggle('is-none', diff <= 0);
    };
    calc.addEventListener('input', run); calc.addEventListener('change', run); run();
  }

  /* ---------- device detail ---------- */
  var dev = document.querySelector('[data-mp-device]');
  if (dev) {
    var matrix = {};
    try { matrix = JSON.parse(($('[data-mp-matrix]', dev) || {}).textContent || '{}') || {}; } catch (e) { matrix = {}; }
    var cfg = function (k) { var el = $('input[data-mp-cfg="' + k + '"]:checked', dev); return el ? el.value : ''; };
    var payBox = $('[data-mp-payments]', dev);
    var lookup = function (model, storage) {
      var m = matrix[model] || matrix['*'] || {};
      var list = m[storage] || m['*'];
      return Array.isArray(list) ? list.filter(function (o) { return o && num(o.monthly) != null; }) : [];
    };
    var lastKey = '';
    var renderPayments = function () {
      var key = cfg('model') + '|' + cfg('storage');
      if (key === lastKey) return;
      lastKey = key;
      var opts = lookup(cfg('model'), cfg('storage'));
      payBox.innerHTML = '';
      opts.forEach(function (o, i) {
        var lab = document.createElement('label'); lab.className = 'mp-radio';
        var inp = document.createElement('input'); inp.type = 'radio'; inp.name = 'mp-pay'; inp.value = String(i); inp.checked = i === 0;
        var card = document.createElement('span'); card.className = 'mp-radio__card mp-pay';
        var up = money(num(o.upfront) || 0);
        var t = document.createElement('strong'); t.className = 'mp-pay__label'; t.textContent = o.label || I18N.payLabel.replace('%U', up);
        var div = document.createElement('span'); div.className = 'mp-pay__div'; div.setAttribute('aria-hidden', 'true');
        var s = document.createElement('span'); s.className = 'mp-pay__amts';
        var s1 = document.createElement('span'); s1.textContent = I18N.upfrontTaxes.replace('%U', up);
        var s2 = document.createElement('strong'); s2.textContent = money(num(o.monthly)); var s3 = document.createElement('small'); s3.textContent = I18N.perMo; s2.appendChild(s3);
        s.appendChild(s1); s.appendChild(s2);
        card.appendChild(t); card.appendChild(div); card.appendChild(s);
        if (o.return_option) card.classList.add('is-return');
        lab.appendChild(inp); lab.appendChild(card); payBox.appendChild(lab);
        inp.addEventListener('change', updateEstimate);
      });
      $('[data-mp-noprice]', dev).hidden = opts.length > 0;
    };
    var currentPayment = function () {
      var opts = lookup(cfg('model'), cfg('storage'));
      var r = $('input[name="mp-pay"]:checked', dev);
      return r ? opts[Number(r.value)] : null;
    };
    var planEl = function () { return $('input[data-mp-cfg="plan"]:checked', dev); };
    var est = $('[data-mp-estimate]', dev);
    var updateEstimate = function () {
      var p = currentPayment(), pl = planEl();
      var planPrice = pl ? num(pl.getAttribute('data-price')) : null;
      if (!p) est.textContent = est.getAttribute('data-noprice');
      else if (!pl || planPrice == null) est.textContent = est.getAttribute('data-pending');
      else est.textContent = est.getAttribute('data-tpl').replace('%D', money(num(p.monthly))).replace('%P', money(planPrice));
      return { p: p, pl: pl, planPrice: planPrice };
    };
    dev.addEventListener('change', function (e) {
      if (!e.target.matches('[data-mp-cfg]')) return;
      if (e.target.getAttribute('data-mp-cfg') === 'colour') { var cn = $('[data-mp-colourname]', dev); if (cn) cn.textContent = e.target.value; }
      renderPayments(); updateEstimate();
    });
    renderPayments(); updateEstimate();

    $$('[data-mp-thumb]', dev).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = b.getAttribute('data-mp-thumb');
        $$('[data-mp-slide]', dev).forEach(function (s) { s.hidden = s.getAttribute('data-mp-slide') !== i; });
        $$('[data-mp-thumb]', dev).forEach(function (x) { x.classList.toggle('is-active', x === b); });
      });
    });
    var tip = $('[data-mp-tip]', dev);
    if (tip) tip.addEventListener('click', function () {
      var body = $('[data-mp-tipbody]', dev); body.hidden = !body.hidden;
      tip.setAttribute('aria-expanded', body.hidden ? 'false' : 'true');
    });
    $('[data-mp-continue]', dev).addEventListener('click', function () {
      var st = updateEstimate();
      var p = st.p;
      openPostpaid({
        type: 'financing',
        device: dev.getAttribute('data-device'),
        model: cfg('model') || dev.getAttribute('data-device'),
        storage: cfg('storage'), colour: cfg('colour'), sim: cfg('sim'),
        payment: p ? (p.label || 'Pay ' + money(num(p.upfront) || 0) + ' upfront') + ': ' + money(num(p.upfront) || 0) + ' + taxes | ' + money(num(p.monthly)) + '/mo' : 'Request pricing for this configuration',
        plan: st.pl ? st.pl.value : '', planPrice: st.planPrice,
        estimate: p && st.planPrice != null ? 'Estimated monthly: ' + money(num(p.monthly)) + ' + ' + money(st.planPrice) + ' /mo + taxes' : ''
      });
    });
  }

  /* ---------- after a contact post: reopen the right form, show success or errors ---------- */
  var last = store.get('mp-last');
  [prForm, ppForm].forEach(function (form) {
    if (!form) return;
    var st = postState(form);
    var mine = last && last.form === form.id;
    if (!mine) return;
    var modal = form.closest('[data-mp-modal]');
    if (st.posted) {
      form.__sel = last.sel;
      showSuccess(form);
      openModal(modal);
      store.del('mp-last');
    } else if (st.errors) {
      restore(form);
      if (form === ppForm && last.sel) { openPostpaid(last.sel); restore(form); }
      else if (form === prForm) { syncPrepaid(); showStep(4); openModal(modal); }
      var er = $('[data-mp-errors]', form); if (er) er.hidden = false;
    }
  });
})();
