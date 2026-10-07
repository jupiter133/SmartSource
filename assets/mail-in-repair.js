/* SmartSource Mail-In Repair: sub-nav, quote flow (Lane A standard, Lane B diagnosis-first), analytics. */
(function () {
  'use strict';

  /* ---------- Sub-nav (all Mail-In Repair pages) ---------- */
  var sub = document.querySelector('[data-mir-subnav]');
  if (sub) {
    var tg = sub.querySelector('[data-mir-subnav-toggle]');
    if (tg) tg.addEventListener('click', function () {
      var open = sub.classList.toggle('is-open');
      tg.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    var h = document.querySelector('.header');
    var setTop = function () { document.documentElement.style.setProperty('--mir-top', (h ? Math.max(0, Math.round(h.getBoundingClientRect().bottom)) : 0) + 'px'); };
    setTop(); window.addEventListener('resize', setTop); window.addEventListener('scroll', setTop, { passive: true });
  }

  /* ---------- Analytics ---------- */
  function track(name, data) {
    data = data || {};
    try { window.dataLayer = window.dataLayer || []; window.dataLayer.push(Object.assign({ event: 'mir_' + name }, data)); } catch (e) {}
    try { if (window.Shopify && Shopify.analytics && Shopify.analytics.publish) Shopify.analytics.publish('mir_' + name, data); } catch (e) {}
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-mir-track]');
    if (t) track('click', { target: t.getAttribute('data-mir-track') });
  });

  var app = document.querySelector('[data-mir-app]');
  var dataEl = document.getElementById('mir-data');
  if (!app || !dataEl) return;
  var D;
  try { D = JSON.parse(dataEl.textContent); } catch (e) { return; }

  /* ---------- Helpers ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (cents) { return '$' + (Math.round(cents) / 100).toFixed(2); };
  var dollars = function (n) { return money(Math.round(Number(n || 0) * 100)); };
  var uniq = function (a) { return a.filter(function (x, i) { return x != null && a.indexOf(x) === i; }); };
  var lines = function (txt) { return String(txt || '').split(/\n/).map(function (l) { return l.split('|').map(function (x) { return x.trim(); }); }).filter(function (l) { return l[0]; }); };

  var REGIONS = lines(D.regions).map(function (l) { return { name: l[0], prefixes: (l[1] || '').split(',').map(function (x) { return x.trim().toUpperCase(); }), days: Number(l[2] || 3), surcharge: Number(l[3] || 0) }; });
  var TAX = lines(D.tax).map(function (l) { return { code: l[0], name: l[1], rate: Number(l[2] || 0), label: l[3] || 'Tax' }; });
  var PREFIX_PROV = { A: 'NL', B: 'NS', C: 'PE', E: 'NB', G: 'QC', H: 'QC', J: 'QC', K: 'ON', L: 'ON', M: 'ON', N: 'ON', P: 'ON', R: 'MB', S: 'SK', T: 'AB', V: 'BC', Y: 'YT' };
  var TIER_ORDER = D.tiers.map(function (t) { return t.key; });
  var tierInfo = function (key) { for (var i = 0; i < D.tiers.length; i++) if (D.tiers[i].key === key) return D.tiers[i]; return { key: key, name: key, desc: '', ph: false }; };
  var ISSUE_ICON = { 'Screen': '📱', 'Battery': '🔋', 'Charging port': '🔌', 'Back glass': '🪟', 'Rear camera': '📷', 'Camera': '📷', 'Speaker': '🔊', 'Microphone': '🎙️', 'Buttons': '🔘', 'Face ID': '🙂' };
  var SPECIAL = [
    { key: 'Water damage', icon: '💧' }, { key: 'No power', label: "Won't turn on", icon: '⚡' }, { key: 'Data recovery', icon: '💾' },
    { key: 'Motherboard / micro-soldering', label: 'Motherboard fault', icon: '🔬' }, { key: 'Boot loop', icon: '🔁' }
  ];

  function addBusinessDays(n) {
    var d = new Date(); var added = 0;
    while (added < n) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6) added++; }
    return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function regionFor(postal) {
    var p = String(postal || '').toUpperCase().replace(/\s/g, '');
    if (!/^[ABCEGHJ-NPRSTVXY]\d[A-Z]/.test(p)) return null;
    var first = p[0], rural = p[1] === '0';
    var reg = null;
    REGIONS.forEach(function (r) { if (!reg && r.prefixes.indexOf(first) > -1) reg = r; });
    var prov = PREFIX_PROV[first] || (first === 'X' ? (/^X0[ABC]/.test(p) ? 'NU' : 'NT') : null);
    return reg ? { name: reg.name, days: reg.days + (rural ? 2 : 0), surcharge: reg.surcharge, rural: rural, prov: prov } : null;
  }
  var taxFor = function (code) { for (var i = 0; i < TAX.length; i++) if (TAX[i].code === code) return TAX[i]; return null; };

  var models = D.models.filter(function (m) { return !m.diag; });
  var diag = D.models.filter(function (m) { return m.diag; })[0];
  var modelBy = function (h) { for (var i = 0; i < models.length; i++) if (models[i].handle === h) return models[i]; return null; };

  /* ---------- State ---------- */
  var KEY = 'mir-quote-v1';
  var S = { lane: 'a', step: 'brand', brand: null, category: null, model: null, spec: null, issues: [], tiers: {}, postal: '', prov: '', service: null, device: null, sym: {} };
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  var qs = new URLSearchParams(location.search);
  var preset = app.getAttribute('data-preset-model');
  var presetLane = app.getAttribute('data-preset-lane') || qs.get('lane');
  var presetService = app.getAttribute('data-preset-service') || qs.get('service');
  if (qs.get('q')) { try { S = Object.assign(S, JSON.parse(decodeURIComponent(escape(atob(qs.get('q')))))); S.step = 'quote'; } catch (e) {} }
  else if (preset || presetLane) {
    if (presetLane === 'b') { S.lane = 'b'; S.step = 'device'; if (presetService) S.service = presetService; }
    if (preset && modelBy(preset)) { var pm = modelBy(preset); S.model = pm.handle; S.brand = pm.brand; S.category = pm.category; S.step = S.lane === 'b' ? (S.service ? 'symptoms' : 'service') : (specsOf(pm).length ? 'spec' : 'issues'); }
  } else if (saved && saved.step && saved.step !== 'brand') { S = Object.assign(S, saved); S._restored = true; }
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  function specsOf(m) { return uniq(m.variants.map(function (v) { return v.spec; })); }
  function variantsFor(m) { return m.variants.filter(function (v) { return !S.spec || !v.spec || v.spec === S.spec; }); }
  function issuesOf(m) { return uniq(variantsFor(m).map(function (v) { return v.issue; })); }
  function tierOptions(m, issue) {
    return variantsFor(m).filter(function (v) { return v.issue === issue && (v.stock || v.oos === 'show'); })
      .sort(function (a, b) { return TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier); });
  }
  function chosenVariant(m, issue) {
    var opts = tierOptions(m, issue); if (!opts.length) return null;
    if (opts.length === 1) return opts[0];
    var k = S.tiers[issue]; for (var i = 0; i < opts.length; i++) if (opts[i].tier === k) return opts[i];
    return null;
  }

  var STEPS_A = ['brand', 'model', 'spec', 'issues', 'tiers', 'quote'];
  var STEPS_B = ['device', 'service', 'symptoms', 'fee'];
  function stepList() {
    if (S.lane === 'b') return S.model || S.device ? STEPS_B : STEPS_B;
    var m = modelBy(S.model);
    return STEPS_A.filter(function (s) {
      if (s === 'spec') return !m || specsOf(m).length > 0;
      if (s === 'tiers') return !m || !S.issues.length || S.issues.some(function (i) { return tierOptions(m, i).length > 1; });
      return true;
    });
  }
  function go(step) { S.step = step; save(); render(); track('step', { lane: S.lane, step: step, model: S.model, service: S.service }); app.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  function next() { var l = stepList(); var i = l.indexOf(S.step); if (i < l.length - 1) go(l[i + 1]); }
  function back() { var l = stepList(); var i = l.indexOf(S.step); if (i > 0) go(l[i - 1]); else if (S.lane === 'b') { S.lane = 'a'; go('brand'); } }
  function reset() { S = { lane: 'a', step: 'brand', brand: null, category: null, model: null, spec: null, issues: [], tiers: {}, postal: S.postal, prov: S.prov, service: null, device: null, sym: {} }; save(); track('restart'); render(); }

  /* ---------- Rendering ---------- */
  function shell(title, sub, body, opts) {
    opts = opts || {};
    var l = stepList(); var i = Math.max(0, l.indexOf(S.step));
    var pct = Math.round(((i + 1) / l.length) * 100);
    return '<div class="mir-app__top">' +
      (i > 0 || S.lane === 'b' ? '<button type="button" class="mir-back" data-act="back" aria-label="Back">← Back</button>' : '<span></span>') +
      '<span class="mir-lane">' + (S.lane === 'b' ? 'Specialized repair · diagnosis first' : 'Standard repair · instant quote') + '</span>' +
      '<button type="button" class="mir-restart" data-act="reset">Start over</button></div>' +
      '<div class="mir-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>' +
      (S._restored ? '<p class="mir-note">Welcome back. We saved your progress.</p>' : '') +
      '<h2 class="mir-q">' + title + '</h2>' + (sub ? '<p class="mir-sub">' + sub + '</p>' : '') + body;
  }

  function brandStep() {
    var brands = uniq(models.filter(function (m) { return m.category === 'phone'; }).map(function (m) { return m.brand; }));
    var cats = [['tablet', 'Tablets', '📲'], ['laptop', 'Laptops', '💻'], ['console', 'Consoles', '🎮']];
    var html = '<div class="mir-tiles">' + brands.map(function (b) {
      return '<button type="button" class="mir-tile mir-tile--brand" data-act="brand" data-v="' + esc(b) + '"><span class="mir-tile__logo">' + (b === 'Apple' ? '📱' : b === 'Samsung' ? '🌌' : esc(b.charAt(0))) + '</span><span>' + esc(b === 'Apple' ? 'iPhone' : b === 'Samsung' ? 'Samsung Galaxy' : b) + '</span></button>';
    }).join('') + cats.map(function (c) {
      return '<button type="button" class="mir-tile" data-act="cat" data-v="' + c[0] + '"><span class="mir-tile__logo">' + c[2] + '</span><span>' + c[1] + '</span></button>';
    }).join('') + '<a class="mir-tile" href="' + D.manualUrl + '" data-mir-track="manual_from_brand"><span class="mir-tile__logo">✉️</span><span>Something else</span></a></div>' +
      '<button type="button" class="mir-link" data-act="laneb">Water damage, won\'t turn on, or data recovery? Start a specialized repair →</button>';
    return shell('What do you need fixed?', 'Pick your device. Exact price in under a minute.', html);
  }

  function modelStep() {
    var list = models.filter(function (m) { return S.category && S.category !== 'phone' ? m.category === S.category : (m.brand === S.brand && m.category === 'phone'); });
    if (!list.length) return shell('We\'ll quote this one by hand', 'We don\'t have instant prices for this device type yet. Send us the details and we\'ll reply with an exact quote.', '<a class="btn btn--accent mir-big" href="' + D.manualUrl + '" data-mir-track="manual_no_models">Get a manual quote</a>');
    var popular = list.filter(function (m) { return m.popular; }); if (!popular.length) popular = list.slice(0, 8);
    var html = '<label class="mir-search"><span class="visually-hidden">Search your model</span><input type="search" placeholder="Search your model, e.g. iPhone 15 Pro" data-mir-search autocomplete="off" list="mir-models"></label>' +
      '<datalist id="mir-models">' + list.map(function (m) { return '<option value="' + esc(m.title) + '">'; }).join('') + '</datalist>' +
      '<p class="mir-label">Popular</p><div class="mir-tiles mir-tiles--models" data-mir-models>' + list.map(function (m) {
        return '<button type="button" class="mir-tile mir-tile--model' + (popular.indexOf(m) > -1 ? '' : ' is-extra') + '" data-act="model" data-v="' + esc(m.handle) + '" data-name="' + esc(m.title.toLowerCase()) + '">' + esc(m.title) + '</button>';
      }).join('') + '</div>' +
      (list.length > popular.length ? '<button type="button" class="mir-link" data-act="allmodels">Show all ' + list.length + ' models</button>' : '') +
      '<a class="mir-link" href="' + D.manualUrl + '" data-mir-track="manual_model_missing">My model isn\'t listed →</a>';
    return shell('Which model?', null, html);
  }

  function specStep() {
    var m = modelBy(S.model); var specs = specsOf(m);
    return shell('Which version?', 'This changes the part we use or the price.', '<div class="mir-tiles">' + specs.map(function (s) {
      return '<button type="button" class="mir-tile' + (S.spec === s ? ' is-on' : '') + '" data-act="spec" data-v="' + esc(s) + '">' + esc(s) + '</button>';
    }).join('') + '</div>');
  }

  function issuesStep() {
    var m = modelBy(S.model); var iss = issuesOf(m);
    var html = '<div class="mir-tiles mir-tiles--issues">' + iss.map(function (i) {
      var on = S.issues.indexOf(i) > -1;
      var from = tierOptions(m, i).map(function (v) { return v.price; }).sort(function (a, b) { return a - b; })[0];
      return '<button type="button" class="mir-tile mir-tile--issue' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-act="issue" data-v="' + esc(i) + '"><span class="mir-tile__icon">' + (ISSUE_ICON[i] || '🔧') + '</span><span>' + esc(i) + '</span>' + (from ? '<small>from ' + money(from) + '</small>' : '<small>Quote by hand</small>') + '</button>';
    }).join('') + '</div>' +
      (D.bundle > 0 ? '<p class="mir-note">Fixing 2 or more things? You save ' + D.bundle + '% on the bundle.</p>' : '') +
      '<p class="mir-label">Something worse?</p><div class="mir-tiles mir-tiles--special">' + SPECIAL.map(function (s) {
        return '<button type="button" class="mir-tile mir-tile--special" data-act="special" data-v="' + esc(s.key) + '"><span class="mir-tile__icon">' + s.icon + '</span><span>' + esc(s.label || s.key) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="mir-actions"><button type="button" class="btn btn--accent mir-big" data-act="next"' + (S.issues.length ? '' : ' disabled') + '>Continue</button></div>';
    return shell('What\'s wrong with your ' + esc(m.title) + '?', 'Pick everything that needs fixing.', html);
  }

  function tiersStep() {
    var m = modelBy(S.model);
    var multi = S.issues.filter(function (i) { return tierOptions(m, i).length > 1; });
    var common = TIER_ORDER.filter(function (k) { return multi.length > 1 && multi.every(function (i) { return tierOptions(m, i).some(function (v) { return v.tier === k; }); }); });
    var html = (common.length ? '<div class="mir-same"><span>Apply the same tier to everything:</span>' + common.map(function (k) { return '<button type="button" class="mir-chip" data-act="alltier" data-v="' + esc(k) + '">' + esc(tierInfo(k).name) + '</button>'; }).join('') + '</div>' : '') +
      multi.map(function (issue) {
        return '<fieldset class="mir-tierset"><legend>' + (ISSUE_ICON[issue] || '🔧') + ' ' + esc(issue) + '</legend><div class="mir-tiers">' + tierOptions(m, issue).map(function (v) {
          var t = tierInfo(v.tier); var on = S.tiers[issue] === v.tier;
          var days = v.days + (v.stock ? 0 : v.oosDays);
          return '<button type="button" class="mir-tiercard' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-act="tier" data-issue="' + esc(issue) + '" data-v="' + esc(v.tier) + '">' +
            (v.rec ? '<span class="mir-badge mir-badge--rec">Recommended</span>' : '') +
            (v.ph ? '<span class="mir-badge mir-badge--ph">PLACEHOLDER</span>' : '') +
            '<span class="mir-tiercard__name">' + esc(t.name) + '</span>' +
            '<span class="mir-tiercard__what">' + esc(v.desc || t.desc) + '</span>' +
            '<span class="mir-tiercard__price">' + money(v.price) + '</span>' +
            '<span class="mir-tiercard__meta">' + Math.round(v.warranty / 30) + '-month warranty · ' + days + ' business day' + (days === 1 ? '' : 's') + ' repair' + (v.stock ? '' : ' (part on order)') + '</span>' +
            '</button>';
        }).join('') + '</div></fieldset>';
      }).join('') +
      (D.tierHelper ? '<p class="mir-helper">💡 ' + esc(D.tierHelper) + '</p>' : '') +
      '<div class="mir-actions"><button type="button" class="btn btn--accent mir-big" data-act="next"' + (multi.every(function (i) { return S.tiers[i]; }) ? '' : ' disabled') + '>See my quote</button></div>';
    return shell('Pick your part quality', 'Each option shows exactly what you get.', html);
  }

  function computeQuote() {
    var m = modelBy(S.model); var items = [];
    S.issues.forEach(function (i) { var v = chosenVariant(m, i); if (v) items.push({ issue: i, v: v }); });
    var sub = items.reduce(function (s, it) { return s + it.v.price; }, 0);
    var disc = items.length > 1 && D.bundle > 0 ? Math.round(sub * D.bundle / 100) : 0;
    var reg = regionFor(S.postal);
    var ship = Math.round((Number(D.shipFee) + (reg ? reg.surcharge : 0)) * 100);
    var prov = S.prov || (reg && reg.prov) || '';
    var tx = taxFor(prov);
    var taxable = sub - disc + ship;
    var tax = tx ? Math.round(taxable * tx.rate / 100) : 0;
    var repairDays = items.reduce(function (d, it) { return Math.max(d, it.v.days + (it.v.stock ? 0 : it.v.oosDays)); }, 0);
    var shipDays = reg ? reg.days : 3;
    return { m: m, items: items, sub: sub, disc: disc, ship: ship, tax: tax, tx: tx, total: taxable + tax, reg: reg, prov: prov, repairDays: repairDays, shipDays: shipDays,
      ph: items.some(function (it) { return it.v.ph; }), buyable: items.every(function (it) { return it.v.buyable; }) };
  }

  function provSelect(val) {
    return '<select data-mir-prov aria-label="Province"><option value="">Province</option>' + TAX.map(function (t) { return '<option value="' + t.code + '"' + (t.code === val ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select>';
  }

  function quoteStep() {
    var q = computeQuote();
    if (!q.items.length) return shell('We\'ll quote this one by hand', 'There\'s no instant price for this combination yet.', '<a class="btn btn--accent mir-big" href="' + D.manualUrl + '">Get a manual quote</a>');
    var valid = new Date(); valid.setDate(valid.getDate() + Number(D.validDays || 14));
    var canBook = D.live && !q.ph && q.buyable;
    var rows = q.items.map(function (it) {
      var t = tierInfo(it.v.tier);
      return '<li class="mir-line"><div><strong>' + esc(it.issue) + '</strong>' + (it.v.ph ? ' <span class="mir-badge mir-badge--ph">PLACEHOLDER</span>' : '') +
        (it.v.tier ? '<span class="mir-line__tier">Part: ' + esc(t.name) + ' · ' + esc(it.v.desc || t.desc) + '</span>' : '') +
        '<span class="mir-line__meta">Parts ' + dollars(it.v.parts) + ' · Labour ' + dollars(it.v.labour) + ' · ' + Math.round(it.v.warranty / 30) + '-month warranty</span></div><span class="mir-line__price">' + money(it.v.price) + '</span></li>';
    }).join('');
    var total = '<dl class="mir-totals">' +
      (q.disc ? '<div><dt>Bundle discount (' + D.bundle + '%)</dt><dd>−' + money(q.disc) + '</dd></div>' : '') +
      '<div><dt>Shipping both ways' + (q.reg && q.reg.surcharge ? ' (incl. ' + esc(q.reg.name) + ' surcharge)' : '') + '</dt><dd>' + (q.ship ? money(q.ship) : 'Included') + '</dd></div>' +
      '<div><dt>' + (q.tx ? esc(q.tx.label) + ' (' + q.tx.rate + '%, ' + esc(q.tx.code) + ')' : 'Tax') + '</dt><dd>' + (q.tx ? money(q.tax) : 'Enter postal code') + '</dd></div>' +
      '<div class="mir-totals__total"><dt>Total (CAD)</dt><dd>' + money(q.total) + '</dd></div></dl>';
    var tl = '<ol class="mir-timeline"><li><b>' + q.shipDays + ' day' + (q.shipDays === 1 ? '' : 's') + '</b>Ships to us</li><li><b>' + q.repairDays + ' day' + (q.repairDays === 1 ? '' : 's') + '</b>Repair &amp; testing</li><li><b>' + q.shipDays + ' day' + (q.shipDays === 1 ? '' : 's') + '</b>Ships back</li></ol>' +
      '<p class="mir-eta">Estimated back with you: <strong>' + addBusinessDays(q.shipDays * 2 + q.repairDays) + '</strong> <small>(business days, from drop-off today' + (q.reg ? ', ' + esc(q.reg.name) + (q.reg.rural ? ' rural' : '') : '') + ')</small></p>';
    var html = (!D.live || q.ph ? '<div class="mir-preview">⚠️ ' + esc(D.t.preview || 'Preview pricing, not final') + '. Booking opens once our final prices are live.</div>' : '') +
      '<div class="mir-quote"><div class="mir-quote__main"><p class="mir-label">' + esc(q.m.title) + (S.spec ? ' · ' + esc(S.spec) : '') + '</p><ul class="mir-lines">' + rows + '</ul>' +
      '<div class="mir-where"><label>Postal code <input type="text" inputmode="text" autocomplete="postal-code" maxlength="7" placeholder="A1A 1A1" value="' + esc(S.postal) + '" data-mir-postal></label><label>Province ' + provSelect(q.prov) + '</label></div>' +
      total + '</div><div class="mir-quote__side"><p class="mir-label">Timeline</p>' + tl +
      '<p class="mir-valid">Quote valid until ' + valid.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) + '. Prepaid, insured shipping label included.</p></div></div>' +
      '<div class="mir-actions mir-actions--quote"><button type="button" class="btn btn--accent mir-big" data-act="book"' + (canBook ? '' : ' disabled aria-disabled="true"') + '>' + esc(D.t.book || 'Book this repair') + ' · ' + money(q.total) + '</button>' +
      '<button type="button" class="btn" data-act="savequote">Save / share quote</button><a class="btn" data-mir-track="email_quote" href="' + mailto(q) + '">Email me this quote</a></div>' +
      '<div class="mir-sticky" aria-hidden="true"><span>' + money(q.total) + '<small>' + (q.ph || !D.live ? 'Preview' : 'Total') + '</small></span><button type="button" class="btn btn--accent" data-act="book"' + (canBook ? '' : ' disabled') + ' tabindex="-1">Book repair</button></div>';
    return shell('Your quote', null, html);
  }

  function quoteLink() {
    var s = { lane: S.lane, model: S.model, spec: S.spec, issues: S.issues, tiers: S.tiers, postal: S.postal, prov: S.prov, brand: S.brand, category: S.category };
    return location.origin + '/pages/mail-in-repair/quote?q=' + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  }
  function mailto(q) {
    var body = 'My SmartSource mail-in repair quote\n\n' + q.m.title + '\n' + q.items.map(function (it) { return '- ' + it.issue + (it.v.tier ? ' (' + tierInfo(it.v.tier).name + ')' : '') + ': ' + money(it.v.price); }).join('\n') + '\nTotal (CAD): ' + money(q.total) + '\n\nOpen it again: ' + quoteLink();
    return 'mailto:?subject=' + encodeURIComponent('My repair quote: ' + q.m.title) + '&body=' + encodeURIComponent(body);
  }

  /* ----- Lane B ----- */
  var DEVICE_CLASS = { phone: 'Phone', tablet: 'Tablet', laptop: 'Laptop', console: 'Console' };
  function deviceStep() {
    var brands = uniq(models.map(function (m) { return m.brand; }));
    var html = '<div class="mir-tiles mir-tiles--models">' + models.filter(function (m) { return m.popular; }).concat(models.filter(function (m) { return !m.popular; })).slice(0, 12).map(function (m) {
      return '<button type="button" class="mir-tile mir-tile--model' + (S.model === m.handle ? ' is-on' : '') + '" data-act="bmodel" data-v="' + esc(m.handle) + '">' + esc(m.title) + '</button>';
    }).join('') + '</div><p class="mir-label">Not listed? Pick the type</p><div class="mir-tiles">' + Object.keys(DEVICE_CLASS).map(function (k) {
      return '<button type="button" class="mir-tile' + (!S.model && S.device === DEVICE_CLASS[k] ? ' is-on' : '') + '" data-act="bdevice" data-v="' + DEVICE_CLASS[k] + '">' + DEVICE_CLASS[k] + '</button>';
    }).join('') + '</div>';
    return shell('Which device?', 'We diagnose first, then send you a firm quote. Nothing gets repaired until you approve it.', html);
  }
  function services() { return diag ? uniq(diag.variants.map(function (v) { return v.service; })) : SPECIAL.map(function (s) { return s.key; }); }
  function serviceStep() {
    var info = { 'Water damage': '💧', 'No power': '⚡', 'Data recovery': '💾', 'Motherboard / micro-soldering': '🔬', 'Boot loop': '🔁', 'Board-level fault': '🧩' };
    return shell('What happened?', null, '<div class="mir-tiles mir-tiles--issues">' + services().map(function (s) {
      return '<button type="button" class="mir-tile mir-tile--issue' + (S.service === s ? ' is-on' : '') + '" data-act="service" data-v="' + esc(s) + '"><span class="mir-tile__icon">' + (info[s] || '🔧') + '</span><span>' + esc(s === 'No power' ? "Won't turn on" : s) + '</span></button>';
    }).join('') + '</div>' + (S.service === 'Water damage' ? waterNow() : ''));
  }
  function waterNow() { return '<div class="mir-warn"><strong>Do this right now:</strong> don\'t charge it, don\'t turn it on, don\'t put it in rice. Ship it as fast as you can. Corrosion keeps spreading.</div>'; }
  function symptomsStep() {
    var y = S.sym;
    var html = '<form class="mir-form" data-mir-sym>' + (S.service === 'Water damage' ? waterNow() : '') +
      '<label>What happened? <textarea name="what" rows="3" required placeholder="e.g. Dropped it in the sink yesterday. Screen flashed, then went black.">' + esc(y.what || '') + '</textarea></label>' +
      '<label>When did it happen? <select name="when"><option>Today</option><option>1–3 days ago</option><option>This week</option><option>More than a week ago</option></select></label>' +
      '<fieldset class="mir-yn"><legend>Is the data on it important?</legend><label><input type="radio" name="data" value="Yes"' + (y.data === 'Yes' ? ' checked' : '') + '> Yes</label><label><input type="radio" name="data" value="No"' + (y.data === 'No' ? ' checked' : '') + '> No</label></fieldset>' +
      '<fieldset class="mir-yn"><legend>Do you know the passcode?</legend><label><input type="radio" name="pass" value="Yes"' + (y.pass === 'Yes' ? ' checked' : '') + '> Yes</label><label><input type="radio" name="pass" value="No"' + (y.pass === 'No' ? ' checked' : '') + '> No</label></fieldset>' +
      '<label>Photos (optional) <input type="file" name="photo" accept="image/*" data-mir-photo></label>' +
      '<div class="mir-actions"><button type="submit" class="btn btn--accent mir-big">See diagnostic fee</button></div></form>';
    return shell('Tell us the symptoms', 'Two minutes. It helps the tech start faster.', html);
  }
  function diagVariant() {
    if (!diag) return null; var m = modelBy(S.model); var cls = m ? DEVICE_CLASS[m.category] : S.device;
    var hit = null; diag.variants.forEach(function (v) { if (v.service === S.service && (!v.device || v.device === cls) && !hit) hit = v; });
    return hit;
  }
  function feeStep() {
    var v = diagVariant(); var m = modelBy(S.model);
    if (!v) return shell('We\'ll quote this one by hand', 'No diagnostic price for this yet.', '<a class="btn btn--accent mir-big" href="' + D.manualUrl + '">Get a manual quote</a>');
    var reg = regionFor(S.postal); var shipDays = reg ? reg.days : 3;
    var canBook = D.live && !v.ph && v.buyable;
    var range = v.low && v.high ? dollars(v.low) + '–' + dollars(v.high) : 'Quote after diagnosis';
    var html = (!D.live || v.ph ? '<div class="mir-preview">⚠️ ' + esc(D.t.preview || 'Preview pricing, not final') + '. Booking opens once our final prices are live.</div>' : '') +
      '<div class="mir-quote"><div class="mir-quote__main"><p class="mir-label">' + esc(m ? m.title : S.device) + ' · ' + esc(S.service) + '</p>' +
      '<ul class="mir-lines"><li class="mir-line"><div><strong>Diagnostic fee</strong>' + (v.ph ? ' <span class="mir-badge mir-badge--ph">PLACEHOLDER</span>' : '') + '<span class="mir-line__meta">Paid now. Covers inspection and a firm quote.</span></div><span class="mir-line__price">' + money(v.price) + '</span></li>' +
      '<li class="mir-line"><div><strong>Typical repair price</strong><span class="mir-line__meta">Range from past repairs. Your firm quote comes after diagnosis.</span></div><span class="mir-line__price">' + range + '</span></li></ul>' +
      '<div class="mir-where"><label>Postal code <input type="text" maxlength="7" placeholder="A1A 1A1" value="' + esc(S.postal) + '" data-mir-postal></label></div>' +
      '<ol class="mir-rules"><li>You pay the diagnostic fee and ship it with our prepaid label.</li><li>We diagnose it, usually within ' + (v.days || 3) + ' business days of arrival.</li><li>You get a firm quote. Nothing is repaired until you approve it.</li><li>Decline? You only pay the diagnostic fee and we ship it back.</li></ol></div>' +
      '<div class="mir-quote__side"><p class="mir-label">Timeline</p><ol class="mir-timeline"><li><b>' + shipDays + 'd</b>Ships to us</li><li><b>' + (v.days || 3) + 'd</b>Diagnosis</li><li><b>Your call</b>Approve quote</li></ol></div></div>' +
      '<div class="mir-actions mir-actions--quote"><button type="button" class="btn btn--accent mir-big" data-act="bookb"' + (canBook ? '' : ' disabled aria-disabled="true"') + '>Pay diagnostic fee · ' + money(v.price) + '</button></div>';
    return shell('Diagnosis first', null, html);
  }

  function render() {
    var map = { brand: brandStep, model: modelStep, spec: specStep, issues: issuesStep, tiers: tiersStep, quote: quoteStep, device: deviceStep, service: serviceStep, symptoms: symptomsStep, fee: feeStep };
    app.innerHTML = '<div class="mir-app__body">' + (map[S.step] || brandStep)() + '</div>';
    delete S._restored;
    if (S.step === 'quote') { var q = computeQuote(); track('quote_view', { model: S.model, items: q.items.map(function (it) { return it.issue + ':' + (it.v.tier || '-'); }).join(','), total: q.total / 100, placeholder: q.ph }); }
    if (S.step === 'fee') track('diag_fee_view', { service: S.service, model: S.model || S.device });
  }

  /* ---------- Events ---------- */
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.getAttribute('data-act'), v = b.getAttribute('data-v');
    switch (a) {
      case 'back': back(); break;
      case 'reset': reset(); break;
      case 'next': next(); break;
      case 'laneb': S.lane = 'b'; track('lane_b_start', { from: 'brand' }); go('device'); break;
      case 'brand': S.brand = v; S.category = 'phone'; track('brand', { brand: v }); go('model'); break;
      case 'cat': S.category = v; S.brand = null; track('category', { category: v }); go('model'); break;
      case 'allmodels': app.querySelectorAll('.is-extra').forEach(function (x) { x.classList.remove('is-extra'); }); b.remove(); break;
      case 'model': S.model = v; S.spec = null; S.issues = []; S.tiers = {}; track('model', { model: v }); go(specsOf(modelBy(v)).length ? 'spec' : 'issues'); break;
      case 'spec': S.spec = v; track('spec', { spec: v }); go('issues'); break;
      case 'issue':
        var i = S.issues.indexOf(v); if (i > -1) S.issues.splice(i, 1); else S.issues.push(v);
        track('issue_toggle', { issue: v, on: i === -1 }); save(); render(); break;
      case 'special': S.lane = 'b'; S.service = v; track('lane_b_start', { from: 'issues', service: v }); go('symptoms'); break;
      case 'tier': S.tiers[b.getAttribute('data-issue')] = v; track('tier_pick', { model: S.model, issue: b.getAttribute('data-issue'), tier: v }); save(); render(); break;
      case 'alltier': var m = modelBy(S.model); S.issues.forEach(function (is) { if (tierOptions(m, is).some(function (x) { return x.tier === v; })) S.tiers[is] = v; }); track('tier_apply_all', { tier: v }); save(); render(); break;
      case 'savequote':
        var link = quoteLink();
        if (navigator.share) navigator.share({ title: 'My repair quote', url: link }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { b.textContent = 'Link copied ✓'; });
        track('quote_save'); break;
      case 'book': book(); break;
      case 'bmodel': S.model = v; S.device = null; go(S.service ? 'symptoms' : 'service'); break;
      case 'bdevice': S.device = v; S.model = null; go(S.service ? 'symptoms' : 'service'); break;
      case 'service': S.service = v; track('service', { service: v }); go('symptoms'); break;
      case 'bookb': bookB(); break;
    }
  });
  app.addEventListener('input', function (e) {
    if (e.target.matches('[data-mir-search]')) {
      var term = e.target.value.toLowerCase().trim();
      app.querySelectorAll('[data-mir-models] .mir-tile').forEach(function (t) { t.classList.toggle('is-extra', term ? t.getAttribute('data-name').indexOf(term) === -1 : false); t.hidden = term && t.getAttribute('data-name').indexOf(term) === -1; });
      var exact = models.filter(function (m) { return m.title.toLowerCase() === term; })[0];
      if (exact) { S.model = exact.handle; S.issues = []; S.tiers = {}; go(specsOf(exact).length ? 'spec' : 'issues'); }
    }
  });
  app.addEventListener('change', function (e) {
    if (e.target.matches('[data-mir-postal]')) {
      S.postal = e.target.value.toUpperCase().trim(); var r = regionFor(S.postal); if (r && r.prov) S.prov = r.prov;
      track('postal', { region: r ? r.name : 'invalid', rural: r ? r.rural : null }); save(); render();
    }
    if (e.target.matches('[data-mir-prov]')) { S.prov = e.target.value; save(); render(); }
  });
  app.addEventListener('submit', function (e) {
    if (!e.target.matches('[data-mir-sym]')) return;
    e.preventDefault(); var f = new FormData(e.target);
    S.sym = { what: f.get('what'), when: f.get('when'), data: f.get('data'), pass: f.get('pass') };
    track('symptoms_done', { service: S.service, data_important: S.sym.data, passcode: S.sym.pass, photo: !!(f.get('photo') && f.get('photo').size) });
    photoFile = f.get('photo') && f.get('photo').size ? f.get('photo') : null;
    go('fee');
  });
  var photoFile = null;

  function quoteId() { return 'Q' + Date.now().toString(36).toUpperCase(); }
  function book() {
    var q = computeQuote(); if (!D.live || q.ph || !q.buyable) return;
    if (!q.prov) { var pi = $('[data-mir-postal]', app); if (pi) { pi.focus(); pi.setCustomValidity('Enter your postal code for tax and shipping'); pi.reportValidity(); } return; }
    var id = quoteId(); var eta = addBusinessDays(q.shipDays * 2 + q.repairDays);
    var items = q.items.map(function (it) {
      var t = tierInfo(it.v.tier);
      return { id: it.v.id, quantity: 1, properties: { 'Device': q.m.title + (S.spec ? ' (' + S.spec + ')' : ''), 'Repair': it.issue, 'Part tier': it.v.tier ? t.name : 'Standard', 'What you get': it.v.desc || t.desc, 'Warranty': Math.round(it.v.warranty / 30) + ' months', 'Ships from': (q.reg ? q.reg.name : '') + ' ' + q.prov, 'Est. return': eta, 'Quote ID': id, '_lane': 'A' } };
    });
    track('book_start', { quote: id, total: q.total / 100, tiers: q.items.map(function (it) { return it.v.tier || '-'; }).join(',') });
    fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items: items }) })
      .then(function (r) { if (!r.ok) throw r; return r.json(); })
      .then(function () { track('book_checkout', { quote: id }); try { localStorage.removeItem(KEY); } catch (e) {} location.href = '/checkout'; })
      .catch(function () { alert('Sorry, we couldn\'t start your booking. Please try again or contact us.'); track('book_error', { quote: id }); });
  }
  function bookB() {
    var v = diagVariant(); if (!v || !D.live || v.ph || !v.buyable) return;
    var m = modelBy(S.model); var id = quoteId();
    var f = new FormData();
    f.append('id', v.id); f.append('quantity', 1);
    var props = { 'Device': m ? m.title : S.device, 'Service': S.service, 'What happened': S.sym.what || '', 'When': S.sym.when || '', 'Data important': S.sym.data || '', 'Passcode known': S.sym.pass || '', 'Quote ID': id, '_lane': 'B' };
    Object.keys(props).forEach(function (k) { f.append('properties[' + k + ']', props[k]); });
    if (photoFile) f.append('properties[Photo]', photoFile);
    track('diag_book_start', { quote: id, service: S.service });
    fetch('/cart/add.js', { method: 'POST', body: f, headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw r; return r.json(); })
      .then(function () { try { localStorage.removeItem(KEY); } catch (e) {} location.href = '/checkout'; })
      .catch(function () { alert('Sorry, we couldn\'t start your booking. Please try again or contact us.'); });
  }

  track('app_view', { page: location.pathname, preset: preset || null, lane: S.lane });
  render();
})();
