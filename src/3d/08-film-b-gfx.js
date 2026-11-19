// ===== 08 film (b) gfx: 화면 글자 · 3D 위치를 따라다니는 표시 · 위치 지도 · 마감재 판 =====
// 글자는 CSS 애니메이션(지연 = --d + 건너뛰기 보정 --o), 3D 위치를 따라다니는 것은 매 프레임(filmOverlay) 계산한다.

// ---------- 화면 글자 ----------
function fAdd(html, cls) {
  const el = document.createElement('div');
  el.className = cls; el.style.setProperty('--o', (-film.ff).toFixed(2) + 's'); el.innerHTML = html; fStage.appendChild(el);
  return el;
}
function fLater(dt, fn) { film.laters.push({ t: film.t - film.ff + dt, fn }); }
function fOut(el) { if (!el || !el.parentNode) return; if (film.ff > 0.45) { el.remove(); return; } el.classList.add('f-out'); fLater(0.45, () => el.remove()); }
const fChars = (s, d0, step) => [...s].map((c, i) => `<span class="an a-up" style="--d:${(d0 + i * step).toFixed(2)}s">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
function fCount(el, t0) { el.querySelectorAll('[data-n]').forEach(n => film.counters.push({ el: n, to: +n.dataset.n, t0, last: -1 })); }
const fNum = s => esc(s).replace(/\d+(\.\d+)?/g, m => `<span data-n="${m}">0</span>`);
function lowerThird(ch) {         // 장면 제목: 번호 · 이름 · 크기(숫자 올라감) · 한 줄 설명
  const sp = spaceById(ch.id), m = sp && sp.size ? /^(.*?)(?:\s*\((.*)\))?$/.exec(sp.size) : null;
  const size = m ? `<div class="sz an a-rise" style="--d:.7s"><span>${fNum(m[1])}</span><u>cm</u>${ch.kind ? `<em class="kk-${ch.kind}">${KIND[ch.kind]}</em>` : ''}</div>` : '';
  const el = fAdd(`<div class="no"><b class="an a-fade" style="--d:.05s">${ch.no}</b><i class="an a-line" style="--d:.15s"></i><span class="an a-fade" style="--d:.3s">${ch.en}</span></div>` +
    `<h2>${fChars(ch.name, 0.2, 0.08)}</h2>${size}<p class="an a-rise" style="--d:.85s">${esc(ch.desc)}</p>`, 'f-lt');
  fCount(el, film.ct + 0.75);
  return el;
}
function stepCap(kick, text, extra) {
  return fAdd(`<div class="k an a-fade">${kick}</div><h3>${fChars(text, 0.08, 0.035)}</h3>${extra || ''}`, 'f-cap');
}

// ---------- 마감재 판: 실제 3D 재질의 무늬를 잘라 붙인 견본 ----------
const FIN_TEX = { floor: 'floor', wall: 'wall', doorFilm: 'door', lower: 'door', top: 'top', ktile: 'ktile', entryTile: 'entry' };
function finishBoard() {
  const el = fAdd(`<div class="hd"><div class="k an a-fade">MATERIALS</div><h3>${fChars('우리집 마감재', 0.08, 0.05)}</h3></div><div class="grid"></div>`, 'f-board');
  const grid = el.querySelector('.grid');
  H.finishes.forEach((f, i) => {
    const d = document.createElement('div'); d.className = 'fsw an a-pop'; d.style.setProperty('--d', (0.35 + i * 0.09).toFixed(2) + 's');
    const tex = TEX[FIN_TEX[f.id]];
    if (tex && tex.image) d.appendChild(canvasOf(220, 104, g => { const im = tex.image, sw = im.width * 0.62; g.drawImage(im, 0, 0, sw, sw * 104 / 220, 0, 0, 220, 104); }));
    else { const c = document.createElement('i'); c.style.background = f.color; d.appendChild(c); }
    d.insertAdjacentHTML('beforeend', `<b>${esc(f.part)}</b><span>${esc(f.model)}</span>`);
    grid.appendChild(d);
  });
  return el;
}

// ---------- 위치 지도: 방 장면에서 지금 어느 방을 어디서 보고 있는지 ----------
const fLoc = { el: $('fLoc'), base: null, s: 1, w: 0, h: 0, room: null, x0: -30, y0: -30, x1: 1048, y1: 730 };
function locBuild() {
  const cssW = window.innerWidth < 760 ? 104 : 148, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (fLoc.base && fLoc.cssW === cssW) return;
  fLoc.cssW = cssW; fLoc.w = Math.round(cssW * dpr); fLoc.s = fLoc.w / (fLoc.x1 - fLoc.x0); fLoc.h = Math.round((fLoc.y1 - fLoc.y0) * fLoc.s);
  fLoc.el.width = fLoc.w; fLoc.el.height = fLoc.h; fLoc.el.style.width = cssW + 'px';
  fLoc.base = canvasOf(fLoc.w, fLoc.h, g => {
    const s = fLoc.s; g.setTransform(s, 0, 0, s, -fLoc.x0 * s, -fLoc.y0 * s);
    H.floors.forEach(f => { g.beginPath(); f.poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = 'rgba(255,255,255,.13)'; g.fill(); });
    g.fillStyle = 'rgba(255,255,255,.82)'; H.walls.forEach(w => g.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0));
    g.fillStyle = 'rgba(140,196,255,.95)'; H.windows.forEach(w => g.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0));
  });
}
function locDraw(tl) {
  const sc = SCENES[film.idx], on = !!(sc && sc.ch);
  if (fLoc.on !== on) { fLoc.on = on; fLoc.el.classList.toggle('on', on); }
  if (!on) return;
  locBuild();
  const g = fLoc.el.getContext('2d'), s = fLoc.s, X = x => (x - fLoc.x0) * s, Y = y => (y - fLoc.y0) * s;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, fLoc.w, fLoc.h);
  const r = spaceById(sc.ch.id).rect, k = eOutCubic(fSeg(tl, 0.5, 1.1));
  g.fillStyle = `rgba(231,116,58,${(0.9 * k).toFixed(2)})`; g.fillRect(X(r[0]), Y(r[1]), (r[2] - r[0]) * s, (r[3] - r[1]) * s);
  g.drawImage(fLoc.base, 0, 0);
  const px = X(camera.position.x * 100), py = Y(camera.position.z * 100), dir = camera.getWorldDirection(fTmp), a = Math.atan2(dir.z, dir.x), R = 150 * s;
  const gr = g.createRadialGradient(px, py, 0, px, py, R); gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(px, py); g.arc(px, py, R, a - 0.5, a + 0.5); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, 3.2 * fLoc.w / fLoc.cssW, 0, 6.283); g.fill();
}

// ---------- 3D 위치를 따라다니는 표시 ----------
const P3 = a => new V3(CM(a[0]), CM(a[2]), CM(a[1]));
function callout(at, t0, t1, title, sub, o) {     // 점 + 꺾인 안내선 + 이름 상자
  const el = document.createElement('div'); el.className = 'f-co'; el.style.opacity = 0;
  el.innerHTML = `<div class="bx">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`; fTags.appendChild(el);
  const g = svgEl(fSvg, 'g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', visibility: 'hidden' });
  const it = Object.assign({ kind: 'co', el, g, pos: P3(at), t0, t1, w: 0, h: 0 }, o || {});
  it.u = svgEl(g, 'path', { stroke: 'rgba(20,14,8,.4)', 'stroke-width': 4.5 }); it.l = svgEl(g, 'path', { stroke: '#fff', 'stroke-width': 1.8 });
  it.ring = svgEl(g, 'circle', { stroke: '#fff', 'stroke-width': 1.5 }); it.dot = svgEl(g, 'circle', { fill: '#d9622b', stroke: '#fff', 'stroke-width': 2 });
  film.items.push(it); return it;
}
const coProd = (pid, at, t0, t1, o) => { const p = H.products[pid]; return callout(at, t0, t1, (o && o.title) || p.name, (o && o.sub) || [p.brand, p.model].filter(Boolean).join(' '), o); };
function dimLine(d, t0, t1) {     // 평면 위에서 자라나는 치수선 (H.dims 한 줄)
  const el = document.createElement('div'); el.className = 'f-dm k-' + d.kind; el.style.opacity = 0; fTags.appendChild(el);
  const col = d.kind === 'real' ? '#c0266d' : '#6f6a60';
  const path = svgEl(fSvg, 'path', { stroke: col, 'stroke-width': 1.7, fill: 'none', 'stroke-linecap': 'round', visibility: 'hidden' });
  const m = /^(\D*)(\d+)(.*)$/.exec(d.t);
  film.items.push({ kind: 'dm', el, g: path, a: P3([d.a[0], d.a[1], 3]), b: P3([d.b[0], d.b[1], 3]), t0, t1, pre: m[1], val: +m[2], post: m[3], last: -1 });
}
function planDraw(t0, t1) {       // 도면 단계: 벽과 창이 선을 긋듯 그려짐 (벽이 올라오면 사라짐)
  const g = svgEl(fSvg, 'g', { visibility: 'hidden' });
  const mk = (r, col) => ({ r, horiz: (r.x1 - r.x0) >= (r.y1 - r.y0), el: svgEl(g, 'polygon', { fill: col }), d: Math.hypot((r.x0 + r.x1) / 2 - 485, (r.y0 + r.y1) / 2) / 900 * 1.2 });
  const list = [...H.walls.map(w => mk(w, w.type === 'bearing' ? '#b3261e' : '#35322d')), ...H.windows.map(w => mk(w, '#5b9bd8'))];
  film.items.push({ kind: 'wl', g, list, t0, t1 });
}
function roomTag(r, t0, t1) {
  const el = document.createElement('div'); el.className = 'f-rt'; el.style.opacity = 0;
  el.innerHTML = esc(r.name) + (r.size ? `<i>${esc(r.size)}</i>` : ''); fTags.appendChild(el);
  film.items.push({ kind: 'rt', el, pos: P3([r.at[0], r.at[1], 105]), t0, t1 });
}
function filmClear() {
  film.items.forEach(it => { if (it.el) it.el.remove(); if (it.g) it.g.remove(); });
  film.items = []; film.counters = [];
  film.laters.forEach(l => l.fn()); film.laters = [];
  fStage.innerHTML = '';
}
let fW = 1, fH = 1;
const fTmp = new V3();
function fProj(v) { fTmp.copy(v).project(camera); return fTmp.z > -1 && fTmp.z < 1 ? [(fTmp.x + 1) / 2 * fW, (1 - fTmp.y) / 2 * fH] : null; }
const fHide = it => { if (it.shown !== false) { it.shown = false; if (it.el) it.el.style.opacity = 0; if (it.g) it.g.setAttribute('visibility', 'hidden'); } };
const fXY = (x, y) => { fTmp.set(CM(x), 0.012, CM(y)).project(camera); return ((fTmp.x + 1) / 2 * fW).toFixed(1) + ',' + ((1 - fTmp.y) / 2 * fH).toFixed(1); };
function filmOverlay(tl) {
  const topPad = 78, botPad = fH * 0.3, placed = [];
  if (fLoc.on) placed.push([fW - fLoc.cssW - 40, fW, 60, (fW < 760 ? 80 : fH * 0.085) + fLoc.h / fLoc.w * fLoc.cssW + 22]);      // 위치 지도 자리는 비워 둠
  for (const it of film.items) {
    if (tl < it.t0 || tl >= it.t1) { fHide(it); continue; }
    const ko = 1 - fSeg(tl, it.t1 - 0.35, it.t1);
    if (it.kind === 'wl') {
      for (const q of it.list) {
        const k = eOutCubic(fSeg(tl, it.t0 + q.d, it.t0 + q.d + 0.6)), r = q.r;
        if (q.k === k && k === 0) continue;
        q.k = k;
        const x1 = q.horiz ? lerp(r.x0, r.x1, k) : r.x1, y1 = q.horiz ? r.y1 : lerp(r.y0, r.y1, k);
        q.el.setAttribute('points', k <= 0 ? '' : `${fXY(r.x0, r.y0)} ${fXY(x1, r.y0)} ${fXY(x1, y1)} ${fXY(r.x0, y1)}`);
      }
      it.g.setAttribute('visibility', 'visible'); it.g.setAttribute('opacity', (0.92 * (1 - fSeg(tl, it.t1 - 0.9, it.t1))).toFixed(2));
      it.shown = true; continue;
    }
    if (it.kind === 'dm') {
      const a = fProj(it.a), b = a && fProj(it.b); if (!b) { fHide(it); continue; }
      const k = eOutCubic(fSeg(tl, it.t0, it.t0 + 0.8)), ex = lerp(a[0], b[0], k), ey = lerp(a[1], b[1], k);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L * 5, ny = (b[0] - a[0]) / L * 5;
      it.g.setAttribute('d', `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}M${(a[0] - nx).toFixed(1)} ${(a[1] - ny).toFixed(1)}L${(a[0] + nx).toFixed(1)} ${(a[1] + ny).toFixed(1)}M${(ex - nx).toFixed(1)} ${(ey - ny).toFixed(1)}L${(ex + nx).toFixed(1)} ${(ey + ny).toFixed(1)}`);
      it.g.setAttribute('visibility', 'visible'); it.g.setAttribute('opacity', ko.toFixed(2));
      const n = Math.round(it.val * k); if (n !== it.last) { it.last = n; it.el.textContent = it.pre + n + it.post; }
      it.el.style.opacity = (Math.min(1, k * 4) * ko).toFixed(2);
      it.el.style.transform = `translate(${((a[0] + b[0]) / 2).toFixed(1)}px,${((a[1] + b[1]) / 2).toFixed(1)}px) translate(-50%,-50%)`;
      it.shown = true; continue;
    }
    const p = fProj(it.pos);
    if (!p || p[0] < -20 || p[0] > fW + 20 || p[1] < 40 || p[1] > fH - 20) { fHide(it); continue; }
    if (it.kind === 'rt') {
      const k = fSeg(tl, it.t0, it.t0 + 0.45);
      it.el.style.opacity = (Math.min(1, k * 3) * ko).toFixed(2);
      it.el.style.transform = `translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px) translate(-50%,-50%) scale(${eOutBack(k).toFixed(3)})`;
      it.shown = true; continue;
    }
    // 안내선: 점 → 비스듬히 → 가로로 → 상자
    if (!it.w) { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; }
    const right = it.side ? it.side === 'r' : p[0] < fW * 0.5, sx = right ? 1 : -1, up = it.up === false ? -1 : 1;
    const ex = p[0] + sx * 24, ey0 = p[1] - up * (it.rise || 40);
    const lx = clamp(right ? ex + 16 : ex - 16 - it.w, 12, fW - 12 - it.w);
    let ly = clamp(ey0 - it.h / 2, topPad, fH - botPad - it.h);
    for (const q of placed) if (lx < q[1] + 6 && lx + it.w > q[0] - 6 && ly < q[3] + 6 && ly + it.h > q[2] - 6) ly = q[2] - 8 - it.h > topPad ? q[2] - 8 - it.h : q[3] + 8;      // 겹치면 위(안 되면 아래)로 비킴
    placed.push([lx, lx + it.w, ly, ly + it.h]);
    const jy = ly + it.h / 2, jx = right ? lx : lx + it.w;
    const kd = eOutBack(fSeg(tl, it.t0, it.t0 + 0.4)), kl = eOutCubic(fSeg(tl, it.t0 + 0.12, it.t0 + 0.6)), kb = eOutCubic(fSeg(tl, it.t0 + 0.4, it.t0 + 0.85));
    const d = `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${ex.toFixed(1)} ${jy.toFixed(1)}L${jx.toFixed(1)} ${jy.toFixed(1)}`;
    const len = Math.hypot(ex - p[0], jy - p[1]) + Math.abs(jx - ex);
    [it.u, it.l].forEach(q => { q.setAttribute('d', d); q.setAttribute('stroke-dasharray', len.toFixed(1)); q.setAttribute('stroke-dashoffset', (len * (1 - kl)).toFixed(1)); });
    const pulse = ((tl - it.t0) % 1.7) / 1.7;
    it.dot.setAttribute('cx', p[0].toFixed(1)); it.dot.setAttribute('cy', p[1].toFixed(1)); it.dot.setAttribute('r', (4.5 * kd).toFixed(2));
    it.ring.setAttribute('cx', p[0].toFixed(1)); it.ring.setAttribute('cy', p[1].toFixed(1)); it.ring.setAttribute('r', (5 + pulse * 13).toFixed(1)); it.ring.setAttribute('opacity', ((1 - pulse) * 0.9 * kd).toFixed(2));
    it.g.setAttribute('visibility', 'visible'); it.g.setAttribute('opacity', ko.toFixed(2));
    it.el.style.opacity = (kb * ko).toFixed(2);
    it.el.style.transform = `translate(${(lx - sx * 12 * (1 - kb)).toFixed(1)}px,${ly.toFixed(1)}px)`;
    it.el.style.clipPath = kb >= 1 ? '' : right ? `inset(-30px ${((1 - kb) * 100).toFixed(1)}% -30px -30px)` : `inset(-30px -30px -30px ${((1 - kb) * 100).toFixed(1)}%)`;
    it.shown = true;
  }
  for (const c of film.counters) { const n = Math.round(c.to * eOutExpo(fSeg(tl, c.t0, c.t0 + 1.1))); if (n !== c.last) { c.last = n; c.el.textContent = n; } }
  locDraw(tl);
}
