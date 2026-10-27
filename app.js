const PR = (window.PR = window.PR || {});
const C = { az: '#2f6bff', am: '#ffb400', ro: '#ff3d8b', mo: '#8b5cf6', ve: '#10b981' };
const PILAR = { 'Fuerte a los 40+': C.az, 'Baile y energía': C.ro, 'Bienestar real': C.am, 'Mentalidad y comunidad': C.mo };
const MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fInt = d3.format(',');
const fPct = d3.format('.0%');
const fPct1 = d3.format('.1%');
const fPct2 = d3.format('.2%');
const fUsd = (n) => 'US$' + d3.format(',.2f')(n);
const fCompact = (n) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const pd = (s) => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
const fDate = (s) => { const d = pd(s); return d.getUTCDate() + ' ' + MES[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
const fDay = (d) => d.getUTCDate() + ' ' + MES[d.getUTCMonth()];
const fMonth = (d) => MES[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2);
const isNum = (x) => x !== null && x !== undefined && x !== '' && !Number.isNaN(Number(x));
const PCT = new Set(['retencion_3s', 'pct_no_seguidores']);
const fmtMetric = (k, v) => (!isNum(v) ? '—' : PCT.has(k) ? fPct1(Number(v)) : Number.isInteger(Number(v)) ? fInt(Number(v)) : d3.format(',.1f')(Number(v)));
const FMT = { usd: fUsd, int: fInt, pct2: fPct2, pct1: fPct1 };

const state = { tab: 'resumen', sortKey: 'fecha', sortDir: -1, q: '', animated: new Set() };

/* ---------- helpers ---------- */
function prep(el, ids) {
  const ds = ids.map((id) => dash.data(id));
  el.replaceChildren();
  if (ds.some((d) => d.status === 'error' || d.status === 'connect' || d.status === 'declined' || d.status === 'missing')) {
    el.classList.remove('dash-skeleton');
    const f = document.createElement('div'); f.className = 'pr-fail'; f.textContent = 'Failed to load'; el.append(f);
    return null;
  }
  if (ds.some((d) => d.status !== 'ok')) { el.classList.add('dash-skeleton'); return null; }
  el.classList.remove('dash-skeleton');
  if (!state.animated.has(el.id)) { el.classList.add('pr-anim'); state.animated.add(el.id); }
  return ds.map((d) => d.data);
}
function svgIn(el, H) {
  const W = Math.max(260, el.clientWidth);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).style('display', 'block').style('overflow', 'visible');
  return { svg, W, H };
}
function textW(svg, strs, size = 12) {
  const g = svg.append('g').attr('font-size', size);
  let w = 0;
  strs.forEach((s) => { const t = g.append('text').text(s); w = Math.max(w, t.node().getComputedTextLength()); });
  g.remove();
  return Math.ceil(w);
}
function tooltip(el) {
  const tip = document.createElement('div'); tip.className = 'pr-tip'; tip.hidden = true; el.append(tip);
  return {
    show(head, lines, x, y) {
      tip.replaceChildren();
      const h = document.createElement('div'); h.className = 'd'; h.textContent = head; tip.append(h);
      lines.forEach(([color, text]) => {
        const l = document.createElement('div');
        if (color) { const s = document.createElement('span'); s.className = 'sw'; s.style.background = color; l.append(s); }
        l.append(document.createTextNode(text)); tip.append(l);
      });
      tip.hidden = false;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.min(Math.max(0, x - tw / 2), el.clientWidth - tw) + 'px';
      tip.style.top = (y - th - 12 < 0 ? y + 14 : y - th - 12) + 'px';
    },
    hide() { tip.hidden = true; },
  };
}
function gridY(g, y, ticks, x0, x1, fmt) {
  g.append('g').selectAll('line').data(ticks).join('line').attr('x1', x0).attr('x2', x1).attr('y1', (t) => y(t)).attr('y2', (t) => y(t)).style('stroke', 'var(--cds-chart-grid)');
  g.append('g').selectAll('text').data(ticks).join('text').attr('x', x0 - 8).attr('y', (t) => y(t)).attr('dy', '0.32em').attr('text-anchor', 'end').attr('font-size', 12).style('fill', 'var(--color-fg-muted)').text(fmt);
}
function gradient(svg, id, color) {
  const lg = svg.append('defs').append('linearGradient').attr('id', id).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
  [[0, .32], [.25, .2], [.5, .1], [.75, .04], [1, 0]].forEach(([o, a]) => lg.append('stop').attr('offset', o).attr('style', `stop-color:${color};stop-opacity:${a}`));
  return `url(#${id})`;
}

/* ---------- charts ---------- */
function drawArea(el, rows, key, color, fmt = fInt) {
  const pts = rows.filter((r) => isNum(r[key])).map((r) => ({ d: pd(r.fecha), v: Number(r[key]), fecha: r.fecha })).sort((a, b) => a.d - b.d);
  const { svg, W, H } = svgIn(el, 280);
  const isDaily = key === 'vistas_ig' || key === 'alcance_ig';
  const ext = d3.extent(pts, (p) => p.v);
  const y = d3.scaleLinear(isDaily ? [0, ext[1] * 1.1] : [ext[0] - (ext[1] - ext[0]) * 0.15, ext[1] + (ext[1] - ext[0]) * 0.12], [0, 0]).nice(4);
  const ticks = y.ticks(4);
  const m = { top: 24, right: 52, bottom: 28, left: textW(svg, ticks.map(fCompact)) + 12 };
  y.range([H - m.bottom, m.top]);
  const x = d3.scaleUtc(d3.extent(pts, (p) => p.d), [m.left, W - m.right]);
  const g = svg.append('g');
  gridY(g, y, ticks, m.left, W - m.right, fCompact);
  const xt = x.ticks(W < 480 ? 3 : 6);
  g.append('g').selectAll('text').data(xt).join('text').attr('x', (d) => x(d)).attr('y', H - 8).attr('text-anchor', 'middle').attr('font-size', 12).style('fill', 'var(--color-fg-muted)').text(fDay);
  if (isDaily) {
    const bw = Math.max(3, Math.min(18, (W - m.left - m.right) / pts.length - 4));
    g.append('g').selectAll('rect').data(pts).join('rect').attr('x', (p) => x(p.d) - bw / 2).attr('width', bw).attr('y', (p) => y(p.v)).attr('height', (p) => y(0) - y(p.v)).attr('rx', Math.min(4, bw / 2)).style('fill', color).attr('opacity', .85);
  } else {
    g.append('path').datum(pts).style('fill', gradient(svg, 'grad-' + el.id, color)).attr('d', d3.area().x((p) => x(p.d)).y0(H - m.bottom).y1((p) => y(p.v)));
    g.append('path').datum(pts).style('fill', 'none').style('stroke', color).attr('stroke-width', 2.5).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('d', d3.line().x((p) => x(p.d)).y((p) => y(p.v)));
  }
  const last = pts[pts.length - 1];
  g.append('circle').attr('cx', x(last.d)).attr('cy', y(last.v)).attr('r', 4.5).style('fill', color).style('stroke', 'var(--color-panel)').attr('stroke-width', 2);
  g.append('text').attr('x', x(last.d) + 8).attr('y', y(last.v)).attr('dy', '0.32em').attr('font-size', 12).attr('font-weight', 600).style('fill', 'var(--color-fg)').text(fCompact(last.v));
  const tip = tooltip(el);
  const hl = g.append('circle').attr('r', 5).style('fill', color).style('stroke', 'var(--color-panel)').attr('stroke-width', 2).attr('opacity', 0);
  const rule = g.append('line').attr('y1', m.top).attr('y2', H - m.bottom).style('stroke', 'var(--cds-chart-axis)').attr('opacity', 0);
  svg.append('rect').attr('x', m.left).attr('y', m.top).attr('width', W - m.left - m.right).attr('height', H - m.top - m.bottom).style('fill', 'transparent')
    .on('pointermove', (ev) => {
      const [px] = d3.pointer(ev);
      const p = d3.least(pts, (q) => Math.abs(x(q.d) - px));
      hl.attr('cx', x(p.d)).attr('cy', y(p.v)).attr('opacity', 1);
      rule.attr('x1', x(p.d)).attr('x2', x(p.d)).attr('opacity', 1);
      tip.show(fDate(p.fecha), [[null, fmt(p.v)]], x(p.d), y(p.v));
    })
    .on('pointerleave', () => { tip.hide(); hl.attr('opacity', 0); rule.attr('opacity', 0); });
}

function drawSpark(el, values, color) {
  el.replaceChildren();
  const W = Math.max(120, el.clientWidth), H = 34;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).style('display', 'block');
  const x = d3.scaleLinear([0, values.length - 1], [2, W - 6]);
  const y = d3.scaleLinear(d3.extent(values), [H - 3, 4]);
  svg.append('path').datum(values).style('fill', gradient(svg, 'grad-' + el.id, color)).attr('d', d3.area().x((v, i) => x(i)).y0(H).y1((v) => y(v)));
  svg.append('path').datum(values).style('fill', 'none').style('stroke', color).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('d', d3.line().x((v, i) => x(i)).y((v) => y(v)));
  svg.append('circle').attr('cx', x(values.length - 1)).attr('cy', y(values[values.length - 1])).attr('r', 3).style('fill', color);
}

function drawTrajectory(el, src, key, goalMin, goalMax, color) {
  const d = prep(el, [src, 'metas']); if (!d) return;
  const [seg, met] = d;
  const actual = seg.filter((r) => isNum(r[key])).map((r) => ({ d: pd(r.fecha), v: Number(r[key]), fecha: r.fecha })).sort((a, b) => a.d - b.d);
  const goals = met.map((m) => ({ d: pd(m.fecha), lo: Number(m[goalMin]), hi: Number(isNum(m[goalMax]) ? m[goalMax] : m[goalMin]), plazo: m.plazo, fecha: m.fecha })).sort((a, b) => a.d - b.d);
  if (!actual.length) { const f = document.createElement('div'); f.className = 'pr-fail'; f.textContent = 'Sin registros todavía'; el.append(f); return; }
  const { svg, W, H } = svgIn(el, 240);
  const allV = actual.map((a) => a.v).concat(goals.flatMap((g) => [g.lo, g.hi]));
  const y = d3.scaleLinear([d3.min(allV) * 0.8, d3.max(allV) * 1.08], [0, 0]).nice(4);
  const ticks = y.ticks(4);
  const m = { top: 30, right: 16, bottom: 28, left: textW(svg, ticks.map(fCompact)) + 12 };
  y.range([H - m.bottom, m.top]);
  const x = d3.scaleUtc([actual[0].d, d3.max(goals, (g) => g.d)], [m.left, W - m.right]);
  const g = svg.append('g');
  gridY(g, y, ticks, m.left, W - m.right, fCompact);
  const xt = x.ticks(d3.utcMonth.every(W < 420 ? 4 : 3));
  g.append('g').selectAll('text').data(xt).join('text').attr('x', (q) => x(q)).attr('y', H - 8).attr('text-anchor', 'middle').attr('font-size', 12).style('fill', 'var(--color-fg-muted)').text(fMonth);
  const base = actual[0];
  g.append('path').datum([{ d: base.d, v: base.v }].concat(goals.map((q) => ({ d: q.d, v: q.lo })))).style('fill', 'none').style('stroke', 'var(--cds-chart-reference)').attr('stroke-width', 1.5).attr('stroke-dasharray', '4 4').attr('d', d3.line().x((p) => x(p.d)).y((p) => y(p.v)));
  goals.filter((q) => q.hi > q.lo).forEach((q) => g.append('line').attr('x1', x(q.d)).attr('x2', x(q.d)).attr('y1', y(q.lo)).attr('y2', y(q.hi)).style('stroke', color).attr('stroke-width', 8).attr('stroke-linecap', 'round').attr('opacity', 0.25));
  g.append('g').selectAll('circle').data(goals).join('circle').attr('cx', (q) => x(q.d)).attr('cy', (q) => y(q.lo)).attr('r', 5).style('fill', 'var(--color-panel)').style('stroke', color).attr('stroke-width', 2);
  g.append('g').selectAll('text').data(goals).join('text').attr('x', (q) => x(q.d)).attr('y', (q) => y(q.hi) - 10).attr('text-anchor', (q, i) => (i === goals.length - 1 ? 'end' : 'middle')).attr('font-size', 12).attr('font-weight', 600).style('fill', 'var(--color-fg)').text((q) => (q.hi > q.lo ? fCompact(q.lo) + '–' + fCompact(q.hi) : fCompact(q.lo)));
  g.append('path').datum(actual).style('fill', 'none').style('stroke', color).attr('stroke-width', 2.5).attr('stroke-linecap', 'round').attr('d', d3.line().x((p) => x(p.d)).y((p) => y(p.v)));
  g.append('g').selectAll('circle').data(actual).join('circle').attr('cx', (p) => x(p.d)).attr('cy', (p) => y(p.v)).attr('r', 5).style('fill', color).style('stroke', 'var(--color-panel)').attr('stroke-width', 2);
  const last = actual[actual.length - 1];
  g.append('text').attr('x', x(last.d) + 9).attr('y', y(last.v) + 16).attr('font-size', 12).attr('font-weight', 600).style('fill', 'var(--color-fg)').text('Hoy ' + fCompact(last.v));
  const pts = actual.map((p) => ({ d: p.d, v: p.v, head: fDate(p.fecha), line: 'Real: ' + fInt(p.v) })).concat(goals.map((q) => ({ d: q.d, v: q.lo, head: q.plazo + ' · ' + fDate(q.fecha), line: 'Meta: ' + fInt(q.lo) + (q.hi > q.lo ? ' a ' + fInt(q.hi) : '') })));
  const tip = tooltip(el);
  svg.append('rect').attr('x', m.left).attr('y', 0).attr('width', W - m.left - m.right).attr('height', H - m.bottom).style('fill', 'transparent')
    .on('pointermove', (ev) => { const [px] = d3.pointer(ev); const p = d3.least(pts, (q) => Math.abs(x(q.d) - px)); tip.show(p.head, [[color, p.line]], x(p.d), y(p.v)); })
    .on('pointerleave', () => tip.hide());
}

function drawDonut(el, rows, opts) {
  const { svg, W, H } = svgIn(el, opts.H || 240);
  const legW = opts.legend ? Math.max(...rows.map((d) => Math.max(textW(svg, [d.label]), textW(svg, [d.sub])))) + 22 : 0;
  const size = Math.max(90, Math.min(H - 10, opts.legend ? W - legW - 24 : W, 210));
  const r = size / 2, cx = opts.legend ? r + 4 : W / 2, cy = H / 2;
  const pie = d3.pie().value((d) => d.v).sort(null).padAngle(0.025);
  const arc = d3.arc().innerRadius(r * 0.62).outerRadius(r).cornerRadius(4);
  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);
  const tip = tooltip(el);
  g.selectAll('path').data(pie(rows)).join('path').attr('d', arc).style('fill', (d) => d.data.color)
    .on('pointermove', (ev, d) => { const [px, py] = d3.pointer(ev, svg.node()); tip.show(d.data.label, [[d.data.color, d.data.tip]], px, py); })
    .on('pointerleave', () => tip.hide());
  g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.1em').attr('font-family', 'var(--font-anthropic-serif)').attr('font-size', Math.round(r * 0.36)).style('fill', 'var(--color-fg)').text(opts.center);
  g.append('text').attr('text-anchor', 'middle').attr('dy', '1.5em').attr('font-size', 12).style('fill', 'var(--color-fg-muted)').text(opts.centerSub);
  if (opts.legend) {
    const lx = cx + r + 18;
    const lg = svg.append('g');
    rows.forEach((d, i) => {
      const yy = cy - (rows.length * 40) / 2 + i * 40 + 14;
      lg.append('circle').attr('cx', lx + 5).attr('cy', yy - 4).attr('r', 5).style('fill', d.color);
      lg.append('text').attr('x', lx + 16).attr('y', yy).attr('font-size', 12).style('fill', 'var(--color-fg)').text(d.label);
      lg.append('text').attr('x', lx + 16).attr('y', yy + 16).attr('font-size', 12).style('fill', 'var(--color-fg-muted)').text(d.sub);
    });
  }
}

function drawHBars(el, rows, o) {
  const H = Math.max(160, rows.length * 34 + 16);
  const { svg, W } = svgIn(el, H);
  const lw = Math.min(W * 0.42, textW(svg, rows.map((r) => r.label)) + 10);
  const vw = textW(svg, rows.map((r) => o.fmt(r.v))) + 10;
  const x = d3.scaleLinear([0, d3.max(rows, (r) => Math.max(r.v, r.mark || 0))], [lw, W - vw]);
  const band = d3.scaleBand(rows.map((r) => r.label), [8, H - 8]).padding(0.3);
  const bh = Math.min(22, band.bandwidth());
  const g = svg.append('g');
  const tip = tooltip(el);
  rows.forEach((r) => {
    const yy = band(r.label) + band.bandwidth() / 2;
    let lab = r.label;
    g.append('text').attr('x', lw - 10).attr('y', yy).attr('dy', '0.32em').attr('text-anchor', 'end').attr('font-size', 12).attr('font-weight', r.strong ? 600 : 400).style('fill', 'var(--color-fg)').text(lab);
    g.append('rect').attr('x', lw).attr('y', yy - bh / 2).attr('width', W - vw - lw).attr('height', bh).attr('rx', bh / 2).style('fill', 'var(--cds-chart-grid)').attr('opacity', .6);
    g.append('rect').attr('x', lw).attr('y', yy - bh / 2).attr('width', Math.max(bh, x(r.v) - lw)).attr('height', bh).attr('rx', bh / 2).style('fill', r.color)
      .on('pointermove', (ev) => { const [px, py] = d3.pointer(ev, svg.node()); tip.show(r.label, [[r.color, r.tip || o.fmt(r.v)]], px, py); })
      .on('pointerleave', () => tip.hide());
    if (isNum(r.mark)) g.append('line').attr('x1', x(r.mark)).attr('x2', x(r.mark)).attr('y1', yy - bh / 2 - 4).attr('y2', yy + bh / 2 + 4).style('stroke', 'var(--color-fg)').attr('stroke-width', 2).attr('stroke-linecap', 'round');
    g.append('text').attr('x', W - vw + 8).attr('y', yy).attr('dy', '0.32em').attr('font-size', 12).attr('font-weight', 600).style('fill', 'var(--color-fg)').text(o.fmt(r.v));
  });
}

function drawScatter(el, pts, o) {
  const { svg, W, H } = svgIn(el, 240);
  const xs = d3.scaleLinear([0, d3.max(pts, (p) => p.x) * 1.15], [0, 0]).nice(4);
  const ys = d3.scaleLinear([0, d3.max(pts, (p) => p.y) * 1.15], [0, 0]).nice(4);
  const yt = ys.ticks(4);
  const m = { top: 14, right: 16, bottom: 40, left: textW(svg, yt.map(o.yFmt)) + 12 };
  xs.range([m.left, W - m.right]); ys.range([H - m.bottom, m.top]);
  const r = d3.scaleSqrt([0, d3.max(pts, (p) => p.r)], [3, Math.min(22, W / 24)]);
  const g = svg.append('g');
  gridY(g, ys, yt, m.left, W - m.right, o.yFmt);
  const xt = xs.ticks(W < 420 ? 3 : 5);
  g.append('g').selectAll('text').data(xt).join('text').attr('x', (t) => xs(t)).attr('y', H - m.bottom + 18).attr('text-anchor', 'middle').attr('font-size', 12).style('fill', 'var(--color-fg-muted)').text(o.xFmt);
  g.append('text').attr('x', W - m.right).attr('y', H - 4).attr('text-anchor', 'end').attr('font-size', 12).style('fill', 'var(--color-fg-muted)').text(o.xLabel + ' →');
  g.append('text').attr('x', m.left).attr('y', m.top - 2).attr('font-size', 12).style('fill', 'var(--color-fg-muted)').text('↑ ' + o.yLabel);
  const tip = tooltip(el);
  g.append('g').selectAll('circle').data(pts.slice().sort((a, b) => b.r - a.r)).join('circle')
    .attr('cx', (p) => xs(p.x)).attr('cy', (p) => ys(p.y)).attr('r', (p) => r(p.r)).style('fill', (p) => p.color).attr('fill-opacity', (p) => (p.strong ? 0.9 : 0.55)).style('stroke', (p) => p.color).attr('stroke-width', 1.5)
    .on('pointermove', (ev, p) => tip.show(p.label, [[p.color, o.xLabel + ': ' + o.xFmt(p.x)], [null, o.yLabel + ': ' + o.yFmt(p.y)]].concat(p.extra ? [[null, p.extra]] : []), xs(p.x), ys(p.y) - r(p.r)))
    .on('pointerleave', () => tip.hide());
  if (o.labels) {
    pts.forEach((p) => {
      const tx = xs(p.x) + r(p.r) + 4;
      const anchorEnd = tx > W - 90;
      g.append('text').attr('x', anchorEnd ? xs(p.x) - r(p.r) - 4 : tx).attr('y', ys(p.y)).attr('dy', '0.32em').attr('text-anchor', anchorEnd ? 'end' : 'start').attr('font-size', 11).attr('font-weight', p.strong ? 600 : 400).style('fill', 'var(--color-fg)').attr('pointer-events', 'none').text(p.label);
    });
  }
}

function drawPyramid(el, rows) {
  const H = rows.length * 34 + 30;
  const { svg, W } = svgIn(el, H);
  const lab = textW(svg, rows.map((r) => r.rango)) + 16;
  const mid = W / 2;
  const maxV = d3.max(rows, (r) => Math.max(Number(r.mujeres), Number(r.hombres)));
  const half = (W - lab) / 2 - 40;
  const x = d3.scaleLinear([0, maxV], [0, half]);
  const band = d3.scaleBand(rows.map((r) => r.rango), [6, H - 24]).padding(0.25);
  const bh = Math.min(22, band.bandwidth());
  const g = svg.append('g');
  const tip = tooltip(el);
  rows.forEach((r) => {
    const yy = band(r.rango) + band.bandwidth() / 2;
    const hv = Number(r.hombres), mv = Number(r.mujeres);
    g.append('text').attr('x', mid).attr('y', yy).attr('dy', '0.32em').attr('text-anchor', 'middle').attr('font-size', 12).style('fill', 'var(--color-fg)').text(r.rango);
    g.append('rect').attr('x', mid - lab / 2 - Math.max(4, x(hv))).attr('y', yy - bh / 2).attr('width', Math.max(4, x(hv))).attr('height', bh).attr('rx', 4).style('fill', C.az)
      .on('pointermove', (ev) => { const [px, py] = d3.pointer(ev, svg.node()); tip.show(r.rango, [[C.az, 'Hombres: ' + fPct1(hv)]], px, py); }).on('pointerleave', () => tip.hide());
    g.append('rect').attr('x', mid + lab / 2).attr('y', yy - bh / 2).attr('width', Math.max(4, x(mv))).attr('height', bh).attr('rx', 4).style('fill', C.ro)
      .on('pointermove', (ev) => { const [px, py] = d3.pointer(ev, svg.node()); tip.show(r.rango, [[C.ro, 'Mujeres: ' + fPct1(mv)]], px, py); }).on('pointerleave', () => tip.hide());
    g.append('text').attr('x', mid - lab / 2 - Math.max(4, x(hv)) - 6).attr('y', yy).attr('dy', '0.32em').attr('text-anchor', 'end').attr('font-size', 11).style('fill', 'var(--color-fg-muted)').text(fPct(hv));
    g.append('text').attr('x', mid + lab / 2 + Math.max(4, x(mv)) + 6).attr('y', yy).attr('dy', '0.32em').attr('font-size', 11).style('fill', 'var(--color-fg-muted)').text(fPct(mv));
  });
  g.append('text').attr('x', mid - lab / 2 - 4).attr('y', H - 4).attr('text-anchor', 'end').attr('font-size', 12).style('fill', 'var(--color-fg-muted)').text('← Hombres');
  g.append('text').attr('x', mid + lab / 2 + 4).attr('y', H - 4).attr('font-size', 12).style('fill', 'var(--color-fg-muted)').text('Mujeres →');
}

function drawHeatmap(el, rows) {
  const dias = d3.sort(d3.groups(rows, (r) => r.dia), (a) => Number(a[1][0].orden_dia)).map((a) => a[0]);
  const horas = d3.sort(d3.groups(rows, (r) => r.hora), (a) => Number(a[1][0].orden_hora)).map((a) => a[0]);
  const H = dias.length * 28 + 30;
  const { svg, W } = svgIn(el, H);
  const lw = textW(svg, dias) + 10;
  const x = d3.scaleBand(horas, [lw, W]).padding(0.08);
  const y = d3.scaleBand(dias, [0, H - 24]).padding(0.1);
  const best = d3.greatest(rows, (r) => Number(r.actividad));
  const g = svg.append('g');
  const tip = tooltip(el);
  g.append('g').selectAll('text').data(dias).join('text').attr('x', lw - 8).attr('y', (d) => y(d) + y.bandwidth() / 2).attr('dy', '0.32em').attr('text-anchor', 'end').attr('font-size', 12).style('fill', 'var(--color-fg-muted)').text((d) => d);
  const step = W - lw < 300 ? 2 : 1;
  g.append('g').selectAll('text').data(horas.filter((_, i) => i % step === 0)).join('text').attr('x', (h) => x(h) + x.bandwidth() / 2).attr('y', H - 6).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', 'var(--color-fg-muted)').text((h) => h);
  g.append('g').selectAll('rect').data(rows).join('rect')
    .attr('x', (r) => x(r.hora)).attr('y', (r) => y(r.dia)).attr('width', x.bandwidth()).attr('height', y.bandwidth()).attr('rx', 5)
    .style('fill', C.ro).attr('fill-opacity', (r) => 0.08 + 0.92 * Number(r.actividad))
    .style('stroke', (r) => (r === best ? 'var(--color-fg)' : 'none')).attr('stroke-width', 2)
    .on('pointermove', (ev, r) => tip.show(r.dia + ' · ' + r.hora, [[C.ro, 'Actividad: ' + fPct(Number(r.actividad)) + ' del pico']], x(r.hora) + x.bandwidth() / 2, y(r.dia)))
    .on('pointerleave', () => tip.hide());
  return best;
}

function drawRing(el, value, big, label, color) {
  el.replaceChildren();
  const s = 104, r = 42, c = 2 * Math.PI * r;
  const svg = d3.select(el).append('svg').attr('width', s).attr('height', s).attr('viewBox', `0 0 ${s} ${s}`);
  svg.append('circle').attr('cx', s / 2).attr('cy', s / 2).attr('r', r).style('fill', 'none').style('stroke', 'rgba(255,255,255,.25)').attr('stroke-width', 9);
  svg.append('circle').attr('cx', s / 2).attr('cy', s / 2).attr('r', r).style('fill', 'none').style('stroke', color).attr('stroke-width', 9).attr('stroke-linecap', 'round')
    .attr('stroke-dasharray', `${c * Math.min(1, value)} ${c}`).attr('transform', `rotate(-90 ${s / 2} ${s / 2})`);
  svg.append('text').attr('x', s / 2).attr('y', s / 2).attr('dy', '0.35em').attr('text-anchor', 'middle').attr('font-family', 'var(--font-anthropic-serif)').attr('font-size', 24).style('fill', '#fff').text(big);
  const l = document.createElement('span'); l.className = 'lbl'; l.textContent = label; el.append(l);
}

/* ---------- me gusta por publicación (con tope para el viral) ---------- */
function drawPostBars(el, posts) {
  const pts = posts.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).slice(-14);
  const { svg, W, H } = svgIn(el, 280);
  const vals = pts.map((p) => Number(p.me_gusta)).sort((a, b) => a - b);
  const p80 = d3.quantile(vals, 0.8);
  const max = vals[vals.length - 1];
  const cap = max > p80 * 3 ? Math.ceil((p80 * 1.6) / 50) * 50 : max * 1.1;
  const y = d3.scaleLinear([0, cap], [0, 0]).nice(4);
  const ticks = y.ticks(4);
  const m = { top: 26, right: 8, bottom: 30, left: textW(svg, ticks.map(fInt)) + 12 };
  y.range([H - m.bottom, m.top]);
  const x = d3.scaleBand(pts.map((p) => p.codigo), [m.left, W - m.right]).padding(0.28);
  const g = svg.append('g');
  gridY(g, y, ticks, m.left, W - m.right, fInt);
  const tip = tooltip(el);
  const bw = Math.min(32, x.bandwidth());
  pts.forEach((p, i) => {
    const v = Number(p.me_gusta);
    const over = v > y.domain()[1];
    const cx = x(p.codigo) + x.bandwidth() / 2;
    const top = over ? m.top - 6 : y(v);
    const col = p.tipo === 'Reel' ? C.ro : C.az;
    const r = g.append('rect').attr('x', cx - bw / 2).attr('width', bw).attr('y', top).attr('height', Math.max(2, y(0) - top)).attr('rx', Math.min(5, bw / 2)).style('fill', col).style('cursor', 'pointer');
    if (over) {
      g.append('path').attr('d', `M${cx - bw / 2 - 2},${m.top + 10} L${cx + bw / 2 + 2},${m.top + 4} M${cx - bw / 2 - 2},${m.top + 16} L${cx + bw / 2 + 2},${m.top + 10}`).style('stroke', 'var(--color-panel)').attr('stroke-width', 3);
      g.append('text').attr('x', cx).attr('y', m.top - 12).attr('text-anchor', 'middle').attr('font-size', 12).attr('font-weight', 600).style('fill', 'var(--color-fg)').text(fInt(v));
    }
    r.on('pointermove', () => tip.show(fDate(p.fecha) + ' · ' + p.tipo + (p.fijada ? ' · fijada' : ''), [[col, fInt(v) + ' me gusta · ' + fInt(p.comentarios) + ' comentarios'], [null, String(p.texto || '').slice(0, 48)]], cx, top))
      .on('pointerleave', () => tip.hide())
      .on('click', () => window.open(p.url, '_blank', 'noopener'));
  });
  const step = Math.ceil(pts.length / Math.max(2, Math.floor((W - m.left) / 64)));
  g.append('g').selectAll('text').data(pts.filter((_, i) => i % step === 0)).join('text')
    .attr('x', (p) => x(p.codigo) + x.bandwidth() / 2).attr('y', H - 8).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', 'var(--color-fg-muted)').text((p) => fDay(pd(p.fecha)));
  g.append('line').attr('x1', m.left).attr('x2', W - m.right).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--cds-chart-axis)');
}

/* ---------- pestañas ---------- */
const PAGES = ['resumen', 'publicaciones', 'estadisticas', 'metas'];
const tabs = document.querySelectorAll('.pr-tab');
function showTab(name, push) {
  state.tab = name;
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  document.querySelectorAll('.pr-page').forEach((p) => (p.hidden = p.dataset.page !== name));
  if (push) dash.setLink(name);
  render();
}
tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab, true)));
document.querySelectorAll('#tb-posts th[data-k] button').forEach((b) => b.addEventListener('click', () => {
  const k = b.parentElement.dataset.k;
  state.sortDir = state.sortKey === k ? -state.sortDir : (k === 'texto' || k === 'tipo' ? 1 : -1);
  state.sortKey = k;
  render();
}));
document.getElementById('post-search').addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); render(); });

function cell(tr, txt, cls) { const c = document.createElement('td'); if (cls) c.className = cls; if (txt instanceof Node) c.append(txt); else c.textContent = txt; tr.append(c); return c; }
function bar(v, color) { const s = document.createElement('span'); s.className = 'pr-bar'; const i = document.createElement('i'); i.style.width = Math.min(100, Math.max(0, v * 100)) + '%'; i.style.background = color; s.append(i); return s; }
function withBar(v, max, color, text) { const f = document.createDocumentFragment(); f.append(bar(v / max, color), document.createTextNode(text)); return f; }
function pill(text, color) { const s = document.createElement('span'); s.className = 'pr-pill'; s.style.background = `color-mix(in srgb, ${color} 16%, transparent)`; const d = document.createElement('i'); d.className = 'pr-dot'; d.style.background = color; d.style.width = '8px'; d.style.height = '8px'; s.append(d, document.createTextNode(text)); return s; }
function link(text, href) { const a = document.createElement('a'); a.className = 'pr-link'; a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text; return a; }

function fillValues() {
  document.querySelectorAll('.pr-kpi-value').forEach((el) => {
    const src = el.dataset.source, f = el.dataset.field;
    const ds = dash.data(src);
    if (ds.status === 'loading') { el.classList.add('dash-skeleton'); return; }
    el.classList.remove('dash-skeleton');
    if (ds.status !== 'ok') { el.textContent = '—'; return; }
    let v, k = f;
    if (el.dataset.where) { const [wk, val] = el.dataset.where.split('='); const r = ds.data.find((x) => String(x[wk]) === val); v = r ? r[f] : null; k = val; }
    else v = ds.data[Number(el.dataset.row || 0)]?.[f];
    if (!isNum(v)) { el.textContent = '—'; return; }
    if (k === 'interaccion_prom') el.textContent = fPct2(Number(v));
    else el.textContent = fmtMetric(k, v);
  });
  const u = dash.data('ultimo');
  document.querySelectorAll('[data-note]').forEach((n) => {
    n.replaceChildren();
    if (u.status !== 'ok') return;
    const r = u.data.find((x) => x.metrica === n.dataset.note);
    if (!r || !isNum(r.valor)) { n.textContent = 'Pendiente: llega con la próxima captura'; return; }
    if (isNum(r.cambio)) {
      const c = Number(r.cambio); const s = document.createElement('span'); s.className = c > 0 ? 'up' : c < 0 ? 'down' : '';
      s.textContent = (c > 0 ? '+' : c < 0 ? '−' : '±') + (PCT.has(n.dataset.note) ? d3.format('.1f')(Math.abs(c) * 100) + ' pts' : fInt(Math.abs(c)));
      n.append(s, document.createTextNode(' desde el ' + fDate(r.fecha_anterior)));
    } else n.textContent = 'Al ' + fDate(r.fecha) + (n.dataset.note === 'vistas_30d_ig' ? ' · media kit' : '');
  });
}

function render() {
  fillValues();
  const prog = dash.data('progreso');
  const p3 = prog.status === 'ok' ? prog.data.find((r) => r.id === 'mes3') : null;
  const igu = dash.data('ig_ultimo');
  const last = igu.status === 'ok' ? igu.data[0] : null;

  // encabezado
  const tk = document.getElementById('takeaway');
  if (prog.status === 'ok') {
    const next = prog.data.find((r) => isNum(r.faltan) && Number(r.faltan) > 0);
    tk.replaceChildren();
    if (next) {
      const b1 = document.createElement('b'); b1.dataset.source = 'progreso'; b1.dataset.field = 'faltan'; b1.dataset.where = 'id=' + next.id; b1.textContent = fInt(next.faltan);
      const b2 = document.createElement('b'); b2.dataset.source = 'progreso'; b2.dataset.field = 'por_semana'; b2.dataset.where = 'id=' + next.id; b2.textContent = fInt(next.por_semana);
      tk.append('Faltan ', b1, ` seguidores para la meta de ${MESL[pd(next.fecha).getUTCMonth()]} (${fDate(next.fecha)}): unos `, b2, ' por semana.');
    } else tk.textContent = 'Todas las metas de seguidores del plan están cumplidas. El tablero sigue registrando cada día.';
  } else if (prog.status !== 'loading') tk.textContent = '—';
  const est = dash.data('estado');
  if (last) {
    let txt = 'Perfil público de Instagram, revisado cada día a las 5:00 a. m. Último conteo: ' + fDate(last.fecha) + '.';
    if (est.status === 'ok' && est.data && est.data.ok === false) {
      txt += ' La revisión del ' + fDate(String(est.data.ultimo_intento).slice(0, 10)) + ' no pudo leer Instagram; se reintenta mañana.';
      document.getElementById('aviso').classList.add('warn');
    }
    document.getElementById('aviso-auto').textContent = txt;
  }
  if (p3) {
    drawRing(document.getElementById('ring-seg'), Number(p3.avance), fPct(Number(p3.avance)), 'de 18K seguidores (enero)', C.am);
    if (isNum(p3.avance_vistas)) drawRing(document.getElementById('ring-vis'), Number(p3.avance_vistas), fPct(Number(p3.avance_vistas)), 'de 150K vistas en 30 días', '#ffffff');
    document.getElementById('mini-seg').style.width = Math.min(100, Number(p3.avance) * 100) + '%';
    if (isNum(p3.avance_vistas)) document.getElementById('mini-vis').style.width = Math.min(100, Number(p3.avance_vistas) * 100) + '%';
  }
  const ns = document.getElementById('note-seg'); ns.replaceChildren();
  if (last) {
    if (isNum(last.cambio)) {
      const c = Number(last.cambio); const s = document.createElement('span'); s.className = c > 0 ? 'up' : c < 0 ? 'down' : '';
      s.textContent = (c > 0 ? '+' : c < 0 ? '−' : '±') + fInt(Math.abs(c));
      ns.append(s, document.createTextNode(' desde el ' + fDate(last.fecha_anterior) + (last.seguidores_texto ? ' · Instagram muestra ' + last.seguidores_texto : '')));
    } else ns.textContent = 'Al ' + fDate(last.fecha);
  }
  const u = dash.data('ultimo');
  if (u.status === 'ok') { const r = u.data.find((x) => x.metrica === 'vistas_30d_ig'); document.getElementById('note-vis').textContent = r && isNum(r.valor) ? 'Al ' + fDate(r.fecha) + ' · de su captura más reciente' : 'Pendiente de captura'; }
  const kp = dash.data('kpi_posts');
  if (kp.status === 'ok') document.getElementById('note-freq').textContent = d3.format('.1f')(kp.data[0].por_semana) + ' por semana · meta del plan: 4';

  const t = state.tab;
  if (t === 'resumen') {
    const el = document.getElementById('ch-likes'); const d = prep(el, ['ig_posts']); if (d) drawPostBars(el, d[0]);
    const et = document.getElementById('ch-tipo'); const dt = prep(et, ['por_tipo']);
    if (dt) drawHBars(et, dt[0].map((r) => ({ label: r.tipo === 'Reel' ? 'Reels' : 'Posts', v: Number(r.mediana_me_gusta), color: r.tipo === 'Reel' ? C.ro : C.az, tip: fInt(r.mediana_me_gusta) + ' me gusta (mediana) · ' + r.publicaciones + ' publicaciones · promedio ' + fInt(r.me_gusta_prom) })), { fmt: fInt });
    drawTrajectory(document.getElementById('ch-seg'), 'ig_diario', 'seguidores', 'seguidores_min', 'seguidores_max', C.az);
  }

  // publicaciones
  const pc = dash.data('posts_calc');
  const tbp = document.querySelector('#tb-posts tbody'); tbp.replaceChildren();
  if (pc.status === 'ok') {
    const maxV = d3.max(pc.data, (p) => Number(p.me_gusta));
    const k = state.sortKey, dir = state.sortDir;
    pc.data.filter((p) => !state.q || (String(p.texto) + ' ' + p.tipo).toLowerCase().includes(state.q))
      .sort((a, b) => { const x = a[k], y = b[k]; if (typeof x === 'number' || typeof y === 'number') return ((Number(x) || 0) - (Number(y) || 0)) * dir; return String(x ?? '').localeCompare(String(y ?? '')) * dir; })
      .forEach((p) => {
        const tr = document.createElement('tr'); tr.dataset.key = p.codigo;
        cell(tr, fDate(p.fecha));
        const tc = cell(tr, link(String(p.texto || 'Ver publicación'), p.url), 'wrap');
        if (p.fijada) { const s = document.createElement('span'); s.className = 'pr-pin'; s.textContent = 'Fijada'; tc.append(s); }
        cell(tr, pill(p.tipo, p.tipo === 'Reel' ? C.ro : C.az));
        cell(tr, withBar(Number(p.me_gusta), maxV, p.tipo === 'Reel' ? C.ro : C.az, fInt(p.me_gusta)), 'num');
        cell(tr, fInt(p.comentarios), 'num');
        cell(tr, isNum(p.interaccion) ? fPct2(Number(p.interaccion)) : '—', 'num');
        tbp.append(tr);
      });
    document.querySelectorAll('#tb-posts th[data-k]').forEach((th) => th.setAttribute('aria-sort', th.dataset.k === k ? (dir > 0 ? 'ascending' : 'descending') : 'none'));
  }
  if (t === 'publicaciones') {
    const top = document.getElementById('top-posts'); top.replaceChildren();
    if (pc.status === 'ok') {
      top.classList.remove('dash-skeleton');
      pc.data.slice().sort((a, b) => Number(b.me_gusta) - Number(a.me_gusta)).slice(0, 3).forEach((p, i) => {
        const col = p.tipo === 'Reel' ? C.ro : C.az;
        const card = document.createElement('div'); card.className = 'pr-post pr-anim';
        const th = document.createElement('a'); th.className = 'pr-thumb'; th.href = p.url; th.target = '_blank'; th.rel = 'noopener';
        th.style.background = `linear-gradient(140deg, ${col}, ${i === 0 ? C.mo : col === C.ro ? C.mo : C.ve})`;
        th.style.textDecoration = 'none';
        const rk = document.createElement('span'); rk.className = 'rank'; rk.textContent = '#' + (i + 1);
        const fm = document.createElement('span'); fm.className = 'fmt'; fm.textContent = p.tipo + ' · ' + fDate(p.fecha);
        const tt = document.createElement('span'); tt.className = 't'; tt.textContent = p.texto;
        th.append(rk, fm, tt);
        const st = document.createElement('div'); st.className = 'pr-post-stats';
        [['Me gusta', 'me_gusta', fInt], ['Comentarios', 'comentarios', fInt], ['Interacción', 'interaccion', fPct2]].forEach(([lab, f, fm2]) => {
          const d = document.createElement('div'); const s = document.createElement('span'); s.textContent = lab;
          const b = document.createElement('b'); b.dataset.source = 'posts_calc'; b.dataset.field = f; b.dataset.where = 'codigo=' + encodeURIComponent(p.codigo); b.textContent = isNum(p[f]) ? fm2(Number(p[f])) : '—';
          d.append(s, b); st.append(d);
        });
        card.append(th, st); top.append(card);
      });
    } else if (pc.status === 'loading') top.classList.add('dash-skeleton');
  }

  // sus estadísticas
  const s = dash.data('seguimiento');
  const wb = document.querySelector('#tb-semanal tbody'); wb.replaceChildren();
  if (s.status === 'ok') {
    const cols = ['fecha', 'vistas_30d_ig', 'compartidos_prom_reel', 'guardados_prom_reel', 'retencion_3s', 'pct_no_seguidores', 'mensajes_directos', 'seguidores_nuevos_semana', 'nota'];
    s.data.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).forEach((r) => {
      const tr = document.createElement('tr');
      cols.forEach((c) => { if (c === 'fecha') cell(tr, r.fecha); else if (c === 'nota') cell(tr, r.nota || ''); else cell(tr, fmtMetric(c, r[c]), 'num'); });
      wb.append(tr);
    });
  }

  // metas
  if (t === 'metas') {
    drawTrajectory(document.getElementById('ch-seg2'), 'ig_diario', 'seguidores', 'seguidores_min', 'seguidores_max', C.az);
    drawTrajectory(document.getElementById('ch-vis'), 'seguimiento', 'vistas_30d_ig', 'vistas_30d', 'vistas_30d', C.ro);
  }
  const tb = document.querySelector('#tb-progreso tbody'); tb.replaceChildren();
  if (prog.status === 'ok') prog.data.forEach((r) => {
    const tr = document.createElement('tr'); tr.dataset.key = r.id;
    cell(tr, r.plazo); cell(tr, fDate(r.fecha)); cell(tr, fInt(r.meta_seguidores), 'num');
    cell(tr, isNum(r.avance) ? withBar(Number(r.avance), 1, C.az, fPct(Number(r.avance))) : '—');
    cell(tr, isNum(r.faltan) ? fInt(r.faltan) : '—', 'num');
    cell(tr, isNum(r.por_semana) ? fInt(r.por_semana) : '—', 'num');
    cell(tr, fInt(r.meta_vistas), 'num');
    cell(tr, isNum(r.avance_vistas) ? withBar(Number(r.avance_vistas), 1, C.ro, fPct(Number(r.avance_vistas))) : '—');
    cell(tr, r.otra_meta || '—', 'wrap');
    tb.append(tr);
  });
}

const startTab = location.hash.slice(1);
if (PAGES.includes(startTab)) showTab(startTab, false);
else tabs[0].setAttribute('aria-selected', 'true');
dash.onData(render);
