(function () {
  'use strict';
  const H = window.HOUSE;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('plan');

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const pts = p => p.map(q => q.join(',')).join(' ');

  // ---------- 패턴 ----------
  const defs = el('defs', {}, svg);
  const hatch = el('pattern', { id: 'hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 7, height: 7, fill: '#fde2e2' }, hatch);
  el('rect', { width: 2.6, height: 7, fill: '#d92d2d' }, hatch);
  const tile = el('pattern', { id: 'tile', width: 20, height: 20, patternUnits: 'userSpaceOnUse' }, defs);
  el('rect', { width: 20, height: 20, fill: '#edf0f2' }, tile);
  el('path', { d: 'M20 0H0V20', fill: 'none', stroke: '#d3d8dc', 'stroke-width': 0.8 }, tile);
  const wood = el('pattern', { id: 'wood', width: 60, height: 60, patternUnits: 'userSpaceOnUse' }, defs);   // 장판 소프트스톤 600 각
  el('rect', { width: 60, height: 60, fill: '#ece6dc' }, wood);
  el('path', { d: 'M60 0H0V60', fill: 'none', stroke: '#d9d0c2', 'stroke-width': 0.8 }, wood);
  const entry = el('pattern', { id: 'entry', width: 60, height: 120, patternUnits: 'userSpaceOnUse' }, defs);   // 현관 600×1200
  el('rect', { width: 60, height: 120, fill: '#e2ded7' }, entry);
  el('path', { d: 'M60 0H0V120', fill: 'none', stroke: '#c9c3b9', 'stroke-width': 0.8 }, entry);

  const world = el('g', { id: 'world' }, svg);
  const items = [];   // 겹침 정리 대상 라벨
  const L = name => el('g', { id: 'L-' + name }, world);
  const gFloor = L('floor'), gExp = L('exp'), gFix = L('fix'), gFurn = L('furn'),
    gWall = L('wall'), gWin = L('win'), gDoor = L('door'), gDim = L('dim'), gLbl = L('lbl');

  // ---------- 바닥 ----------
  H.floors.forEach(f => el('polygon', { points: pts(f.poly), fill: `url(#${f.level ? 'entry' : f.type})` }, gFloor));
  H.expanded.forEach(p => el('polygon', { points: pts(p), class: 'exp' }, gExp));
  H.xboxes.forEach(p => {
    const [a, , c] = p;
    el('polygon', { points: pts(p), class: 'xbox' }, gFix);
    el('path', { d: `M${a[0]} ${a[1]}L${c[0]} ${c[1]}M${c[0]} ${a[1]}L${a[0]} ${c[1]}`, class: 'xline' }, gFix);
  });

  // ---------- 가구 ----------
  H.furniture.forEach(f => {
    if (f.type === 'faucet') {
      el('circle', { cx: f.at[0], cy: f.at[1], r: 3, class: 'fx-line' }, gFurn);
      return;
    }
    if (f.type === 'hob') {
      f.at.forEach(([x, y]) => el('circle', { cx: x, cy: y, r: 9, class: 'fx-line' }, gFurn));
      return;
    }
    if (f.type === 'toilet') {
      const [x, y] = f.at;
      const tg = el('g', f.face === 'W' ? { transform: `rotate(90 ${x} ${y})` } : {}, gFurn);
      el('rect', { x: x - 17, y: y - 36, width: 34, height: 16, rx: 3, class: 'fx' }, tg);
      el('ellipse', { cx: x, cy: y + 2, rx: 15, ry: 20, class: 'fx' }, tg);
      return;
    }
    if (f.type === 'tvstand') { const a = f.rot * Math.PI / 180, tx0 = Math.cos(a) * 56, ty0 = -Math.sin(a) * 56, px = f.at[0] + Math.sin(a) * 4, py = f.at[1] + Math.cos(a) * 4; el('circle', { cx: f.at[0], cy: f.at[1], r: 24, class: 'f-tvstand' }, gFurn); el('path', { d: `M${px - tx0} ${py - ty0}L${px + tx0} ${py + ty0}`, stroke: '#111827', 'stroke-width': 4, fill: 'none' }, gFurn); return; }
    if (f.type === 'curtain') return;
    if (f.type === 'nightstand') { const xs0 = f.poly.map(q => q[0]), ys0 = f.poly.map(q => q[1]); el('circle', { cx: (Math.min(...xs0) + Math.max(...xs0)) / 2, cy: (Math.min(...ys0) + Math.max(...ys0)) / 2, r: 20, class: 'f-nightstand' }, gFurn); return; }
    if (f.type === 'stable') { const xs0 = f.poly.map(q => q[0]), ys0 = f.poly.map(q => q[1]); el('circle', { cx: (Math.min(...xs0) + Math.max(...xs0)) / 2, cy: (Math.min(...ys0) + Math.max(...ys0)) / 2, r: (Math.max(...xs0) - Math.min(...xs0)) / 2, class: 'f-stable' }, gFurn); return; }
    const p = el('polygon', { points: pts(f.poly), class: 'f-' + f.type }, gFurn);
    if (f.label && f.type !== 'ltable') {
      const xs = f.poly.map(q => q[0]), ys = f.poly.map(q => q[1]);
      let cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      if (f.type === 'closet' && f.poly.length > 4) { cx = 812; cy = 672; }
      if (f.lat) { cx = f.lat[0]; cy = f.lat[1]; }
      if (f.type === 'robot') return p;
      if (f.type === 'hood') cy -= 0;
      const t = el('text', { x: cx, y: cy, class: 'ft' }, gFurn);
      t.textContent = f.label;
      items.push({ node: t, prio: 1, layer: gFurn });
    }
    return p;
  });

  // ---------- 배치 제안 (서재 배치안 · 화장대 위치) ----------
  const propSel = { study: 'A', vanity: '1' }, propGroups = { study: {}, vanity: {} };
  function drawProp(kind, id, list) {
    const g = el('g', {}, gFurn); propGroups[kind][id] = g;
    list.forEach(f => {
      if (f.type === 'chair') { el('circle', { cx: f.at[0], cy: f.at[1], r: 24, class: 'f-chair' }, g); return; }
      if (f.type === 'flamp' || f.type === 'plant') { el('circle', { cx: f.at[0], cy: f.at[1], r: f.type === 'plant' ? 14 : 11, class: 'f-' + f.type }, g); return; }
      if (f.type === 'frame') return;
      if (f.type === 'tvstand') { el('circle', { cx: f.at[0], cy: f.at[1], r: 24, class: 'f-tvstand' }, g); el('path', { d: `M${f.at[0] - 56} ${f.at[1] + 4}H${f.at[0] + 56}`, stroke: '#111827', 'stroke-width': 4, fill: 'none' }, g); return; }
      el('polygon', { points: pts(f.poly), class: 'f-' + f.type }, g);
      const xs = f.poly.map(q => q[0]), ys = f.poly.map(q => q[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      if (f.type === 'desk-old') { const d = { S: [0, -1], N: [0, 1], E: [-1, 0], W: [1, 0] }[f.face], vert = d[0] !== 0; el('rect', { x: cx + d[0] * 22 - (vert ? 2 : 36), y: cy + d[1] * 22 - (vert ? 36 : 2), width: vert ? 4 : 72, height: vert ? 72 : 4, fill: '#111827' }, g); }
      else if (f.label && !f.noLabel) { const t = el('text', { x: cx, y: cy, class: 'ft' }, g); t.textContent = f.label; }
    });
  }
  H.studyPlans.forEach(p => drawProp('study', p.id, p.items));
  H.vanitySpots.forEach(p => drawProp('vanity', p.id, [p.item, p.tv]));
  function applyProp() { Object.keys(propGroups).forEach(k => Object.keys(propGroups[k]).forEach(id => (propGroups[k][id].style.display = id === propSel[k] ? '' : 'none'))); }
  applyProp();
  function activeFurn() { return [...H.furniture, ...H.studyPlans.find(p => p.id === propSel.study).items, H.vanitySpots.find(p => p.id === propSel.vanity).item, H.vanitySpots.find(p => p.id === propSel.vanity).tv]; }

  // ---------- 벽 / 창 / 문 ----------
  H.walls.forEach(w => el('rect', { x: w.x0, y: w.y0, width: w.x1 - w.x0, height: w.y1 - w.y0, class: 'w-' + w.type }, gWall));
  H.windows.forEach(w => {
    const vert = (w.y1 - w.y0) > (w.x1 - w.x0);
    el('rect', { x: w.x0, y: w.y0, width: w.x1 - w.x0, height: w.y1 - w.y0, class: 'win' }, gWin);
    if (vert) {
      const m = (w.x0 + w.x1) / 2;
      el('path', { d: `M${m - 3} ${w.y0}V${w.y1}M${m + 3} ${w.y0}V${w.y1}`, class: 'win-line' }, gWin);
    } else {
      const m = (w.y0 + w.y1) / 2;
      el('path', { d: `M${w.x0} ${m - 3}H${w.x1}M${w.x0} ${m + 3}H${w.x1}`, class: 'win-line' }, gWin);
    }
  });
  H.doors.forEach(d => {
    const [hx, hy] = d.hinge, w = d.w;
    const c = [hx + d.closed[0] * w, hy + d.closed[1] * w];
    const o = [hx + d.open[0] * w, hy + d.open[1] * w];
    // 시계/반시계 방향 결정 (closed → open)
    const cross = d.closed[0] * d.open[1] - d.closed[1] * d.open[0];
    const sweep = cross > 0 ? 1 : 0;
    el('path', { d: `M${c[0]} ${c[1]}A${w} ${w} 0 0 ${sweep} ${o[0]} ${o[1]}`, class: 'door-arc' }, gDoor);
    el('path', { d: `M${hx} ${hy}L${o[0]} ${o[1]}`, class: 'door-leaf' + (d.glass || d.pvc ? ' glass' : '') }, gDoor);
    if (d.frame) {
      el('rect', { x: d.frame[0], y: hy - 4, width: 5, height: 8, class: 'jamb' }, gDoor);
      el('rect', { x: d.frame[1] - 5, y: hy - 4, width: 5, height: 8, class: 'jamb' }, gDoor);
    }
  });

  // ---------- 치수 ----------
  H.dims.forEach(d => {
    const [ax, ay] = d.a, [bx, by] = d.b;
    const vert = Math.abs(bx - ax) < Math.abs(by - ay);
    const t = 6;
    const tick = vert ? `M${ax - t} ${ay}H${ax + t}M${bx - t} ${by}H${bx + t}` : `M${ax} ${ay - t}V${ay + t}M${bx} ${by - t}V${by + t}`;
    const g = el('g', {}, gDim);
    el('path', { d: `M${ax} ${ay}L${bx} ${by}${tick}`, class: 'dim-line d-' + d.kind }, g);
    const tx = el('text', { x: (ax + bx) / 2, y: (ay + by) / 2, class: 'dim-t d-' + d.kind }, g);
    tx.textContent = d.t;
    items.push({ node: g, box: tx, prio: { real: 4, calc: 3.5, est: 2.5 }[d.kind], layer: gDim });
  });

  // ---------- 방 이름 ----------
  H.rooms.forEach(rm => {
    const [x, y] = rm.at;
    const g = el('g', {}, gLbl);
    const t = el('text', { x, y, class: rm.small ? 'rm-s' + (rm.color ? ' c-' + rm.color : '') : 'rm' }, g);
    t.textContent = rm.name;
    if (rm.size && !rm.small) {
      const s = el('text', { x, y, dy: '1.25em', class: 'rm-size d-' + rm.kind }, g);
      s.textContent = rm.size;
    }
    items.push({ node: g, prio: rm.small ? 3 : 6, layer: gLbl });
  });

  // ---------- 확대 / 이동 ----------
  const B = H.bounds;
  let s = 1, tx = 0, ty = 0, minS = 0.1, maxS = 12;
  const pad = { t: 64, b: 118, l: 8, r: 8 };
  function measurePad() {
    const hb = document.querySelector('.top .title').getBoundingClientRect();
    const fb = document.querySelector('.bottom').getBoundingClientRect();
    pad.t = hb.bottom + 6;
    pad.b = window.innerHeight - fb.top + 2;
  }
  function apply() {
    world.setAttribute('transform', `translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${s.toFixed(5)})`);
    world.style.setProperty('--u', (1 / s).toFixed(5));
  }
  function fit() {
    measurePad();
    const r = svg.getBoundingClientRect();
    const aw = r.width - pad.l - pad.r, ah = r.height - pad.t - pad.b;
    const bw = B.x1 - B.x0, bh = B.y1 - B.y0;
    s = Math.min(aw / bw, ah / bh);
    minS = s * 0.6; maxS = s * 14;
    tx = pad.l + (aw - bw * s) / 2 - B.x0 * s;
    ty = pad.t + (ah - bh * s) / 2 - B.y0 * s;
    apply();
    cull();
  }
  // 겹치는 라벨은 우선순위 낮은 것부터 숨김
  function cull() {
    const list = [];
    for (const it of items) {
      it.node.style.visibility = '';
      if (it.layer.style.display === 'none') continue;
      const r = (it.box || it.node).getBoundingClientRect();
      if (!r.width) continue;
      list.push({ it, r });
    }
    list.sort((a, b) => b.it.prio - a.it.prio);
    const placed = [];
    for (const { it, r } of list) {
      const hit = placed.some(q => r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top);
      if (hit) it.node.style.visibility = 'hidden'; else placed.push(r);
    }
  }
  let cullT = 0;
  const cullSoon = () => { clearTimeout(cullT); cullT = setTimeout(cull, 120); };
  function zoomAt(cx, cy, k) {
    const ns = Math.min(maxS, Math.max(minS, s * k));
    k = ns / s;
    tx = cx - (cx - tx) * k; ty = cy - (cy - ty) * k; s = ns;
  }
  const ptr = new Map();
  let last = null;
  function gesture() {
    const a = [...ptr.values()];
    if (!a.length) return null;
    if (a.length === 1) return { n: 1, cx: a[0].x, cy: a[0].y };
    const [p, q] = a;
    return { n: 2, cx: (p.x + q.x) / 2, cy: (p.y + q.y) / 2, d: Math.hypot(p.x - q.x, p.y - q.y) };
  }
  function pos(e) { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); ptr.set(e.pointerId, pos(e)); last = gesture(); });
  svg.addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId)) return;
    ptr.set(e.pointerId, pos(e));
    const g = gesture();
    if (last && g && last.n === g.n) {
      tx += g.cx - last.cx; ty += g.cy - last.cy;
      if (g.n === 2 && last.d > 0) zoomAt(g.cx, g.cy, g.d / last.d);
      apply();
    }
    last = g;
  });
  const end = e => { ptr.delete(e.pointerId); last = gesture(); if (!ptr.size) cullSoon(); };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e); zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015)); apply(); cullSoon(); }, { passive: false });
  let lastTap = 0;
  svg.addEventListener('pointerup', e => {
    const now = performance.now();
    if (now - lastTap < 280 && ptr.size === 0) { const p = pos(e); zoomAt(p.x, p.y, 1.8); apply(); cullSoon(); }
    lastTap = now;
  });

  document.getElementById('bFit').addEventListener('click', fit);
  document.getElementById('bIn').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.4); apply(); cull(); });
  document.getElementById('bOut').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1 / 1.4); apply(); cull(); });
  function toggle(btnId, layerIds) {
    const b = document.getElementById(btnId);
    b.addEventListener('click', () => {
      const on = !b.classList.contains('on');
      b.classList.toggle('on', on);
      layerIds.forEach(id => (document.getElementById(id).style.display = on ? '' : 'none'));
      cull();
    });
  }
  toggle('tDims', ['L-dim']);
  toggle('tFurn', ['L-furn']);
  toggle('tExp', ['L-exp']);
  const memo = document.getElementById('memo');
  const escH = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  memo.innerHTML = H.memo.map(sec => `<h3 class="${sec.kind === 'warn' ? 'warn' : ''}">${sec.kind === 'warn' ? '⚠ ' : ''}${escH(sec.title)}</h3><ul>${sec.items.map(t => `<li class="${sec.kind === 'warn' ? 'warn' : ''}">${escH(t)}</li>`).join('')}</ul>`).join('') +
    '<div class="muted">두 손가락으로 확대, 두 번 탭해도 확대돼요. 탭하면 닫혀요.</div>';
  document.getElementById('memoBtn').addEventListener('click', () => memo.classList.toggle('hidden'));
  memo.addEventListener('click', () => memo.classList.add('hidden'));
  // 가구·창 탭 → 정보
  const info = document.getElementById('info');
  let down = null;
  svg.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  svg.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 400) { down = null; return; }
    down = null;
    const p = pos(e), wx = (p.x - tx) / s, wy = (p.y - ty) / s, pad = 6 / s;
    const win = H.windows.find(w => wx >= w.x0 - pad && wx <= w.x1 + pad && wy >= w.y0 && wy <= w.y1);
    let html = '';
    if (win) html = `<b>${escH(win.name)}</b><span class="s">폭 ${Math.max(win.x1 - win.x0, win.y1 - win.y0)} · 창턱 ${win.sill} · 창 높이 ${win.top - win.sill} · 위 끝 ${win.top} cm</span><div>${win.src === 'photo' ? '사진 원근으로 계산 (±10cm)' : '도면 비율로 추정'}</div>`;
    else {
      const hit = activeFurn().filter(f => f.poly && !f.flat && f.type !== 'panel' && f.type !== 'fridgecase').map(f => { const xs = f.poly.map(q => q[0]), ys = f.poly.map(q => q[1]); return { f, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; })
        .filter(o => wx >= o.x0 && wx <= o.x1 && wy >= o.y0 && wy <= o.y1).sort((a, b) => ((a.f.type === 'upper') - (b.f.type === 'upper')) || (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0))[0];
      const pr = hit && H.products[hit.f.pid];
      if (pr) html = `<b>${escH(pr.name)}</b>${pr.brand || pr.model ? `<span class="s">${escH([pr.brand, pr.model].filter(Boolean).join(' '))}</span>` : ''}${pr.size ? `<div>${escH(pr.size)}</div>` : ''}${pr.note ? `<div>${escH(pr.note)}</div>` : ''}${pr.warn ? `<div class="w">⚠ ${escH(pr.warn)}</div>` : ''}`;
    }
    info.innerHTML = html; info.classList.toggle('hidden', !html);
  });
  info.addEventListener('click', () => info.classList.add('hidden'));
  [['pStudy', 'study', H.studyPlans], ['pVanity', 'vanity', H.vanitySpots]].forEach(([boxId, kind, list]) => {
    const box = document.getElementById(boxId);
    list.forEach(p => {
      const b = document.createElement('button'); b.className = 'chip' + (p.id === propSel[kind] ? ' on' : ''); b.textContent = p.name; box.appendChild(b);
      b.addEventListener('click', () => {
        propSel[kind] = p.id; applyProp(); box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        const li = a => a.map(t => `<div>· ${escH(t)}</div>`).join('');
        info.innerHTML = `<b>${escH(p.title)}</b><span class="s">${escH(p.summary)}</span><div style="color:#15803d;font-weight:600;margin-top:4px">좋은 점</div>${li(p.pros)}<div class="w">아쉬운 점</div>${li(p.cons)}<div style="font-weight:600;margin-top:4px">치수</div>${li(p.dims)}`;
        info.classList.remove('hidden'); cull();
      });
    });
  });

  window.addEventListener('resize', fit);
  fit();
  window.__ready = true;
})();
