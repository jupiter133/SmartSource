/* "Best time to sell" chart: today's offer and estimated future values (today x the theme's percentages), as an inline SVG.
   window.SellChart.render(el, { title, now, f: [97, 91, 83], level: 3 }). Elements with [data-sell-chart][data-now] render on load. */
(() => {
  if (window.SellChart) return;
  const NS = 'http://www.w3.org/2000/svg';
  const STEPS = [{ t: 0, label: 'Now' }, { t: 1, label: '1 month' }, { t: 3, label: '3 months' }, { t: 6, label: '6 months' }];
  const money = (n) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
  let uid = 0;

  const node = (tag, attrs = {}, text) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const svgNode = (tag, attrs = {}) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  };
  // Smooth curve through points (Catmull-Rom as cubic Beziers); `from`/`to` pick a stretch of it.
  const curve = (pts, from = 0, to = pts.length - 1) => {
    let d = `M${pts[from].x.toFixed(1)},${pts[from].y.toFixed(1)}`;
    for (let i = from; i < to; i += 1) {
      const p0 = pts[Math.max(0, i - 1)]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  };

  function render(el, opts) {
    const now = Math.round(Number(opts.now) || 0);
    if (!el || now <= 0) { if (el) { el.replaceChildren(); el.hidden = true; } return; }
    const f = (opts.f && opts.f.length === 3 ? opts.f : [97, 91, 83]).map((x) => Math.min(100, Math.max(1, Number(x) || 100)));
    const vals = [now, ...f.map((p) => Math.round(now * p / 100))];
    const W = 600; const H = 190; const L = 14; const R = 14; const T = 22; const B = 18;
    const hi = vals[0]; const lo = Math.min(...vals, hi * 0.7); // fixed baseline so the drop isn't exaggerated
    const span = hi - lo || hi * 0.1 || 1;
    const pts = STEPS.map((s, i) => ({ x: L + (s.t / 6) * (W - L - R), y: T + ((hi - vals[i]) / span) * (H - T - B) }));
    const id = `sell-chart-${++uid}`;

    const svg = svgNode('svg', { class: 'vchart__svg', viewBox: `0 0 ${W} ${H}`, role: 'img', focusable: 'false' });
    const summary = `Estimated trade-in value${opts.title ? ` for ${opts.title}` : ''}: now ${money(vals[0])}; in 1 month about ${money(vals[1])}; in 3 months about ${money(vals[2])}; in 6 months about ${money(vals[3])}. Future values are estimates.`;
    svg.setAttribute('aria-label', summary);
    const defs = svgNode('defs');
    const grad = svgNode('linearGradient', { id, x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.append(svgNode('stop', { offset: '0', class: 'vchart__stop-a' }), svgNode('stop', { offset: '1', class: 'vchart__stop-b' }));
    defs.append(grad);
    svg.append(defs);
    pts.slice(1).forEach((p) => svg.append(svgNode('line', { class: 'vchart__grid', x1: p.x, x2: p.x, y1: T - 8, y2: H - B + 8 })));
    svg.append(svgNode('path', { class: 'vchart__area', d: `${curve(pts)} L${pts[3].x},${H} L${pts[0].x},${H} Z`, fill: `url(#${id})` }));
    svg.append(svgNode('path', { class: 'vchart__line', d: curve(pts, 0, 1) }));
    svg.append(svgNode('path', { class: 'vchart__line vchart__line--est', d: curve(pts, 1, 3) }));
    pts.slice(1).forEach((p) => svg.append(svgNode('circle', { class: 'vchart__pt', cx: p.x, cy: p.y, r: 4.5 })));
    svg.append(svgNode('circle', { class: 'vchart__halo', cx: pts[0].x, cy: pts[0].y, r: 12 }));
    svg.append(svgNode('circle', { class: 'vchart__dot', cx: pts[0].x, cy: pts[0].y, r: 6 }));

    const head = node('div', { class: 'vchart__head' });
    head.append(node('span', { class: 'vchart__pill' }, 'Best time to sell'));
    if (opts.title) head.append(node(`h${Math.min(6, Math.max(2, Number(opts.level) || 3))}`, { class: 'vchart__title' }, `${opts.title} trade-in value`));
    const chips = node('ul', { class: 'vchart__chips', role: 'list', 'aria-hidden': 'true' });
    STEPS.forEach((s, i) => {
      const li = node('li', i === 0 ? { class: 'is-now' } : {});
      li.append(node('span', {}, s.label), node('strong', {}, `${money(vals[i])}${i ? '*' : ''}`));
      chips.append(li);
    });
    const card = node('div', { class: 'vchart' });
    card.append(head, node('div', { class: 'vchart__plot' }), chips, node('p', { class: 'vchart__foot' }, '*Future values are estimates and may vary over time.'));
    card.querySelector('.vchart__plot').append(svg);
    el.replaceChildren(card);
    el.hidden = false;
  }

  window.SellChart = { render };
  const boot = () => document.querySelectorAll('[data-sell-chart][data-now]').forEach((el) => render(el, {
    title: el.dataset.title, now: el.dataset.now, f: (el.dataset.f || '').split(',').filter(Boolean), level: el.dataset.level,
  }));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
