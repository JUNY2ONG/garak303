// ===== 08 film: 집 소개 영상 (모션그래픽 투어) =====
// 영상 시간 film.t(초) 하나로 카메라 · 문 · 조명 · 자막이 모두 정해진다. 장면은 SCENES 표, 장면 안의 사건은 cues([초, 함수]).
// 화면 글자는 CSS 애니메이션(지연 = --d + --o), 3D 위치를 따라다니는 표시(치수선 · 방 이름 · 안내선)는 매 프레임 계산한다.
// 좌표는 평면 cm (x, y, 높이). 카메라 키: [초, 눈 x, y, 높이, 보는 곳 x, y, 높이, 화각 배율].
const filmEl = $('film'), fSvg = $('fSvg'), fTags = $('fTags'), fStage = $('fStage');
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(parent, tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; }
const film = { on: false, ready: false, t: 0, last: 0, idx: -1, cue: 0, fresh: false, paused: false, closing: false, ff: 0, ct: 0, shadow: false, items: [], counters: [], laters: [], units: [], saved: null, wallK: 1, popOn: false };

// ---------- 움직임 곡선 ----------
const fSat = k => clamp(k, 0, 1);
const fSeg = (t, a, b) => fSat((t - a) / (b - a));
const eOutCubic = k => 1 - Math.pow(1 - k, 3);
const eOutExpo = k => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
const eOutBack = k => { const c = 1.6, q = k - 1; return 1 + (c + 1) * q * q * q + c * q * q; };
// 키 사이를 부드럽게 잇는 곡선 (시간 간격이 달라도 속도가 이어짐). flow0/flow1: 처음/끝에서 멈추지 않고 움직이는 채로
function fTrack(rows, flow0, flow1) {
  const K = rows.map(r => ({ t: r[0], v: r.slice(1) })), n = K.length, dim = K[0].v.length;
  const m = K.map(() => new Array(dim).fill(0)), out = new Array(dim);
  for (let d = 0; d < dim; d++) {
    for (let i = 1; i < n - 1; i++) m[i][d] = (K[i + 1].v[d] - K[i - 1].v[d]) / (K[i + 1].t - K[i - 1].t);
    if (flow0) m[0][d] = (K[1].v[d] - K[0].v[d]) / (K[1].t - K[0].t);
    if (flow1) m[n - 1][d] = (K[n - 1].v[d] - K[n - 2].v[d]) / (K[n - 1].t - K[n - 2].t);
  }
  return t => {
    if (t <= K[0].t) return K[0].v;
    if (t >= K[n - 1].t) return K[n - 1].v;
    let i = 0; while (t > K[i + 1].t) i++;
    const h = K[i + 1].t - K[i].t, s = (t - K[i].t) / h, s2 = s * s, s3 = s2 * s;
    const a = 2 * s3 - 3 * s2 + 1, b = (s3 - 2 * s2 + s) * h, c = -2 * s3 + 3 * s2, e = (s3 - s2) * h;
    for (let d = 0; d < dim; d++) out[d] = a * K[i].v[d] + b * m[i][d] + c * K[i + 1].v[d] + e * m[i + 1][d];
    return out;
  };
}

// ---------- 카메라 ----------
const fLook = new V3();
const fPortrait = () => camera.aspect < 1;
function filmFov(base) {          // base = 가로 화면의 세로 화각. 세로 화면에서는 넓혀서 좌우가 덜 잘리게
  return lerp(base, Math.min(92, base + 28), fSat((1.25 - camera.aspect) / 0.7));
}
function fSetProj(fov, near) {
  if (Math.abs(camera.fov - fov) > 1e-3 || Math.abs(camera.near - near) > 1e-4) { camera.fov = fov; camera.near = near; camera.updateProjectionMatrix(); }
}
function fCamWalk(v) {            // 방 안: 눈 위치 → 보는 곳
  camera.position.set(CM(v[0]), CM(v[2]), CM(v[1])); fLook.set(CM(v[3]), CM(v[5]), CM(v[4]));
  camera.up.set(0, 1, 0); camera.lookAt(fLook);
  fSetProj(filmFov(58 * (v[6] || 1)), 0.05); camera.updateMatrixWorld();
}
function fCamOrbit(ty, az, pol, dist, fov) {     // 바깥: 집 가운데를 보며 도는 카메라
  const sp = Math.sin(pol);
  fLook.set(5.09, ty, 3.5);
  camera.position.set(5.09 + dist * sp * Math.sin(az), ty + dist * Math.cos(pol), 3.5 + dist * sp * Math.cos(az));
  camera.up.set(0, 1, 0); camera.lookAt(fLook);
  fSetProj(fov, clamp(dist * 0.04, 0.05, 2)); camera.updateMatrixWorld();
}
function filmFit(w, h, fov, padK) {              // 폭 w · 높이 h (m)가 화면에 들어오는 거리
  const t = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  return Math.max((h / 2) / t * (padK || 1.3), (w / 2) / (t * camera.aspect) * 1.04);
}
// 좌우 바깥벽이 자동 투명으로 바뀌지 않는 회전 한계 (updateCutaway 기준: 카메라 x < -0.2 또는 > 10.4)
const filmAzMax = (dist, pol) => Math.asin(fSat(4.9 / (dist * Math.sin(pol))));

// ---------- 문 · 환경 ----------
function filmDoors(map) {         // 0 = 닫힘, 1 = 열림. '_' = 나머지 문
  doorObjs.forEach(o => {
    const k = map[o.d.id] != null ? map[o.d.id] : map._, a = lerp(o.a0, o.a1, k);
    if (o.cur !== a) { o.cur = a; o.pivot.rotation.y = a; film.shadow = true; }
  });
}
function filmEnv(inside, night) {
  const ch = light.night !== night;
  light.night = night; state.mode = inside ? 'walk' : 'orbit';
  if (light.inside !== inside) setInside(inside); else { applyWalls(); if (ch) applyRig(); }
}

const F_OPEN = { _: 1, 'd-ac': 0 };

// ---------- 집 짓기 연출: 벽 올리기 · 가구 채우기 ----------
function filmWallK(k) {
  if (film.wallK === k) return;
  film.wallK = k; structure.scale.y = k; fixedG.scale.y = k; doorObjs.forEach(o => (o.pivot.scale.y = k)); film.shadow = true;
}
function filmUnits() {            // 가구를 방 순서대로 줄 세움 (하나씩 톡톡 올라오게)
  const order = ['living', 'entry', 'hall', 'kitchen', 'study', 'closet', 'laundry', 'bath', 'bed', 'balcony', 'ac'];
  const list = [], box = new THREE.Box3(), c = new V3();
  world.updateMatrixWorld(true);
  const add = g => {
    if (!g.visible || !g.children.length) return;
    box.setFromObject(g); if (box.isEmpty()) return; box.getCenter(c);
    const sp = spaceAt(c.x * 100, c.z * 100);
    list.push({ g, cx: c.x, cz: c.z, room: sp ? Math.max(0, order.indexOf(sp.id)) : 5, s: 1 });
  };
  furn.children.forEach(g => { if (g !== propG) add(g); });
  Object.keys(proposals).forEach(k => proposals[k].groups[proposals[k].cur].children.forEach(add));
  list.sort((a, b) => (a.room - b.room) || (a.cx - b.cx));
  list.forEach((u, i) => (u.d = i / list.length * 2.4));
  return list;
}
function filmUnitsAt(tl, t0) {    // t0부터 차례로 등장. tl이 없으면 모두 원래대로
  film.units.forEach(u => {
    const k = tl == null ? 1 : fSeg(tl, t0 + u.d, t0 + u.d + 0.6), s = k <= 0 ? 0 : k >= 1 ? 1 : eOutBack(k);
    if (u.s === s) return;
    u.s = s; u.g.visible = s > 0;
    u.g.scale.setScalar(Math.max(s, 1e-3)); u.g.position.set(u.cx * (1 - s), 0, u.cz * (1 - s));     // 자기 자리(바닥 가운데) 기준으로 커짐
    film.shadow = true;
  });
}

// ---------- 화면 전환 가림막 ----------
const wipe = {
  el: $('fWipe'), txt: $('fWipeTxt'),
  set(html) { this.txt.style.setProperty('--o', (-film.ff).toFixed(2) + 's'); this.txt.innerHTML = html || ''; },
  cover(html) { this.set(html); this.el.className = 'f-wipe cover'; },
  hold(html) { this.set(html); this.el.className = 'f-wipe hold'; },
  reveal() { if (/cover|hold/.test(this.el.className)) this.el.className = 'f-wipe reveal'; },
  clear() { this.el.className = 'f-wipe'; this.txt.innerHTML = ''; },
};

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
  const mk = (r, col) => ({ r, horiz: (r.x1 - r.x0) >= (r.y1 - r.y0), el: svgEl(g, 'polygon', { fill: col }), d: (r.x0 + r.x1) / 2036 * 0.9 + (r.y0 + r.y1) / 1400 * 0.45 });
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
  fW = view.clientWidth; fH = view.clientHeight;
  const topPad = 78, botPad = fH * 0.3, placed = [];
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
}

// ---------- 장면 ----------
const CH = {
  entry: { id: 'entry', no: '01', name: '현관', en: 'ENTRANCE', desc: '유리 중문과 천장까지 닿는 신발장' },
  living: { id: 'living', no: '02', name: '거실', en: 'LIVING ROOM', kind: 'real', desc: '확장 발코니까지 이어지는 전면창, 리클라이너 소파와 77인치 TV' },
  kitchen: { id: 'kitchen', no: '03', name: '주방', en: 'KITCHEN · DINING', kind: 'calc', desc: '냉장고 깊이에 맞춘 상·하부장과 맞은편 키큰장' },
  study: { id: 'study', no: '04', name: '서재', en: 'STUDY', kind: 'real', desc: '둘이 함께 쓰는 작업실 — 배치안 네 가지' },
  closet: { id: 'closet', no: '05', name: '옷방', en: 'DRESSING ROOM', kind: 'real', desc: 'ㄱ자 시스템장과 스타일러 자리' },
  bed: { id: 'bed', no: '06', name: '침실', en: 'BEDROOM', kind: 'real', desc: '모션베드와 화장대, 저녁의 침실' },
};
const chWipe = ch => `<div class="w-ch"><b>${ch.no}</b><span><em>${ch.en}</em><strong>${ch.name}</strong></span></div>`;
const TITLE_HTML = `<div class="w-title"><div class="kick an a-fade" style="--d:.15s">OUR HOME · 3D TOUR</div>` +
  `<h1><span class="ln">${fChars('우리집을', 0.3, 0.06)}</span><span class="ln">${fChars('소개합니다', 0.55, 0.06)}</span></h1>` +
  `<div class="rule an a-line" style="--d:1.0s;transform-origin:50% 50%"></div><div class="sub an a-rise" style="--d:1.2s">실측 치수로 지은 3D 도면 · 1분 투어</div></div>`;

// 현관 → 거실은 끊지 않고 한 번에 걸어 들어간다 (현관 장면 7.5초 + 거실 장면)
const ENTRY_DUR = 7.5;
const camEL = fTrack([
  [0.0, 498, -240, 150, 487, -20, 116, 1],
  [3.1, 494, -176, 150, 486, 30, 116, 1],
  [4.5, 486, -20, 150, 498, 160, 117, 1],
  [5.7, 483, 70, 150, 484, 250, 114, 1],
  [7.0, 474, 138, 150, 330, 230, 112, 1],
  [8.6, 452, 166, 150, 150, 170, 122, 1],
  [11.0, 416, 196, 148, 40, 178, 122, 1],
  [13.0, 378, 226, 146, 262, 60, 76, 1],
  [14.3, 362, 208, 146, 262, 205, 60, 1],
  [15.8, 356, 196, 146, 272, 354, 122, 1],
], false, false);
const camKitchen = fTrack([
  [0.0, 455, 372, 150, 690, 262, 96, 1],
  [3.4, 490, 362, 150, 702, 265, 96, 1],
  [5.8, 575, 348, 148, 830, 300, 108, 1],
  [8.5, 628, 346, 148, 850, 395, 118, 1],
], true, true);
const camStudy = fTrack([
  [0.0, 546, 181, 154, 700, 140, 122, 1],
  [2.6, 616, 160, 154, 840, 82, 98, 1.06],
  [9.5, 640, 130, 152, 862, 96, 92, 1.06],
], true, true);
const camCloset = fTrack([
  [0.0, 646, 440, 152, 720, 600, 120, 1],
  [2.6, 640, 505, 150, 800, 625, 115, 1.06],
  [5.2, 648, 540, 150, 870, 600, 105, 1.06],
  [7.5, 664, 556, 150, 880, 572, 98, 1.06],
], true, true);
const camBed = fTrack([
  [0.0, 500, 398, 148, 300, 470, 112, 1],
  [2.4, 442, 408, 148, 250, 524, 90, 1],
  [4.8, 408, 432, 148, 240, 604, 70, 1],
  [7.2, 404, 490, 148, 210, 392, 104, 1],
  [9.0, 402, 500, 148, 200, 390, 104, 1],
], true, true);

const SCENES = [
  { id: 'open', label: '도면에서 집으로', dur: 14, theme: 'lt', inside: false, night: false,
    enter() {
      wipe.set(TITLE_HTML);
      filmDoors(F_OPEN);
      film.units = filmUnits(); filmUnitsAt(-1, 0); filmWallK(0.003);
      const ds = H.dims.filter(d => /^\d+$/.test(d.t) && +d.t >= 100 && d.kind !== 'est');
      ds.forEach((d, i) => dimLine(d, 3.9 + i * 0.24, 7.7));
      H.rooms.filter(r => !r.small && r.kind !== 'est').forEach((r, i) => roomTag(r, 9.3 + i * 0.16, 13.3));
      planDraw(3.3, 7.6);
    },
    exit() { filmUnitsAt(null); filmWallK(1); },
    cues: [
      [3.3, () => wipe.reveal()],
      [3.6, s => (s.cap = stepCap('STEP 01', '실측 치수에서 시작해서', '<div class="lg an a-fade" style="--d:.5s"><span><i class="dot d-real"></i>실측</span><span><i class="dot d-est"></i>계산</span><span>단위 cm</span></div>'))],
      [6.5, s => { fOut(s.cap); s.cap = stepCap('STEP 02', '벽을 세우고'); }],
      [8.5, s => { fOut(s.cap); s.cap = stepCap('STEP 03', '가구와 가전을 채우면'); }],
      [11.0, s => { fOut(s.cap); s.cap = stepCap('OUR HOME', '미리 살아 보는 우리집'); }],
    ],
    update(tl) {
      filmWallK(Math.max(0.003, ease(fSeg(tl, 6.6, 8.8))));
      filmUnitsAt(tl, 8.5);
      const kt = ease(fSeg(tl, 6.4, 10.6)), fov = lerp(16, 30, kt), pol = lerp(0.012, 0.712, kt), port = fPortrait();
      const dist = lerp(filmFit(10.8, 7.9, fov, port ? 1.55 : 1.75), filmFit(port ? 11.5 : 13.6, 9.6, fov, 1.55), kt) * lerp(1.08, 1, eOutCubic(fSeg(tl, 3.2, 8)));
      const A = Math.min(0.24, filmAzMax(dist, 0.712) * 0.9);
      fCamOrbit(lerp(0, 0.6, kt), -A * (0.8 * kt + 0.2 * fSeg(tl, 10.6, 14)), pol, dist, fov);
    } },
  { id: 'entry', ch: CH.entry, dur: ENTRY_DUR, inside: true, night: false,
    enter() {
      filmDoors({ _: 1, 'd-ac': 0, 'd-front': 0, 'd-mid': 0 });
      coProd('lock', [521, -27, 105], 1.15, 2.5, { side: 'l', rise: 60 });
      callout([483, 105, 207], 3.2, 4.6, '유리 중문', '흰 프레임 · 간유리 여닫이', { rise: 30 });
      coProd('shoe', [533, 88, 150], 3.9, 5.2, { sub: '천장까지 · 현관 왼쪽 칸', rise: 10 });
    },
    cues: [[0.5, s => (s.lt = lowerThird(CH.entry))], [6.6, s => fOut(s.lt)]],
    update(tl) {
      filmDoors({ _: 1, 'd-ac': 0, 'd-front': ease(fSeg(tl, 1.9, 3.2)), 'd-mid': ease(fSeg(tl, 3.9, 5.1)) });
      fCamWalk(camEL(tl));
    } },
  { id: 'living', ch: CH.living, dur: 9.5, cut: false, inside: true, night: false,
    enter() {
      filmDoors(F_OPEN);
      callout([2, 177, 150], 2.4, 4.8, '거실 전면창', '폭 227 · 창턱 10 cm (사진 계산)', { rise: 20 });
      coProd('sofa', [280, 62, 98], 5.1, 7.2, { rise: 46 });
      coProd('ltable', [280, 197, 61], 6.5, 7.8, { title: '소파 앞 테이블', sub: '무인양품 호두나무 130 × 65', up: false, rise: 30 });
      coProd('tv', [280, 353, 172], 7.9, 9.4, { rise: 30 });
    },
    cues: [[0.25, s => (s.lt = lowerThird(CH.living))]],
    update(tl) { fCamWalk(camEL(tl + ENTRY_DUR)); } },
  { id: 'kitchen', ch: CH.kitchen, dur: 8.5, inside: true, night: false,
    enter() {
      filmDoors(F_OPEN);
      coProd('induction', [590, 262, 88], 1.0, 3.1, { rise: 64 });
      coProd('dw', [665, 296, 50], 1.5, 3.6, { up: false, rise: 26 });
      coProd('fridge', [845, 296, 150], 2.1, 4.3, { rise: 40 });
      coProd('purifier', [785, 248, 100], 4.7, 6.4, { rise: 50 });
      coProd('tallcab', [790, 399, 112], 6.6, 8.2, { title: '키큰장', sub: '바닥~천장 · 가운데 오픈 칸', rise: 50 });
    },
    cues: [[0.6, s => (s.lt = lowerThird(CH.kitchen))]],
    update(tl) { fCamWalk(camKitchen(tl)); } },
  { id: 'study', ch: CH.study, dur: 9.5, inside: true, night: false,
    enter(s) { filmDoors(F_OPEN); s.pl = null; },
    exit() { if (film.saved && proposals.study.cur !== film.saved.study) setProposal('study', film.saved.study); proposals.study.groups[proposals.study.cur].scale.setScalar(1); proposals.study.groups[proposals.study.cur].position.set(0, 0, 0); },
    cues: [[0.6, s => (s.lt = lowerThird(CH.study))], [1.3, s => filmPlan(s, 0)], [3.4, s => filmPlan(s, 1)], [5.3, s => filmPlan(s, 2)], [7.2, s => filmPlan(s, 3)]],
    update(tl) {
      fCamWalk(camStudy(tl));
      const g = proposals.study.groups[proposals.study.cur], k = film.planT == null ? 1 : fSeg(tl, film.planT, film.planT + 0.5), s = lerp(0.9, 1, eOutBack(k));
      if (g.scale.x !== s) { g.scale.setScalar(s); g.position.set(7.9 * (1 - s), 0, 1.07 * (1 - s)); film.shadow = true; }       // 서재 가운데 기준으로 살짝 튀어나오듯
    } },
  { id: 'closet', ch: CH.closet, dur: 7.5, inside: true, night: false,
    enter() {
      filmDoors(F_OPEN);
      coProd('styler', [700, 638, 150], 1.2, 3.2, { rise: 30 });
      coProd('closetL', [800, 640, 190], 3.2, 5.6, { title: 'ㄱ자 시스템장', sub: '2750 + 1280 꺾임 · 깊이 600', rise: 16 });
      coProd('drawer', [848, 590, 88], 5.2, 6.9, { rise: 50 });
    },
    cues: [[0.6, s => (s.lt = lowerThird(CH.closet))]],
    update(tl) { fCamWalk(camCloset(tl)); } },
  { id: 'bed', ch: CH.bed, dur: 9, inside: true, night: true,
    enter() {
      filmDoors(F_OPEN);
      coProd('bed', [276, 560, 66], 2.6, 5.0, { rise: 70 });
      const vs = H.vanitySpots.find(p => p.id === proposals.vanity.cur), b = bboxOf(vs.item.poly);
      if (b[2] > 300) coProd('vanity', [(b[0] + b[1]) / 2, b[3], 122], 6.4, 8.4, { side: 'l', rise: 46 });
      callout([vs.tv.at[0], vs.tv.at[1] + 6, 140], 6.0, 8.2, 'TV 50" 이동식 스탠드', '화면이 침대 쪽을 봐요', { side: 'l', rise: 70 });
    },
    cues: [[0.6, s => (s.lt = lowerThird(CH.bed))]],
    update(tl) { fCamWalk(camBed(tl)); } },
  { id: 'end', label: '엔딩', dur: 8, last: true, inside: false, night: true, offX: -0.17,
    enter() { filmDoors(F_OPEN); },
    cues: [[1.3, () => fAdd(`<div><div class="kick an a-fade">OUR HOME</div><h2>${fChars('우리집 3D', 0.12, 0.06)}</h2><p class="an a-rise" style="--d:.7s">실측 치수 · 가전 · 마감재까지<br>이 파일 하나에 담았어요</p></div>` +
      `<div class="acts an a-rise" style="--d:1.1s"><button class="sec" data-f="replay"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>다시 보기</button>` +
      `<button class="pri" data-f="explore">직접 둘러보기<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>`, 'f-end')]],
    update(tl) {
      const port = fPortrait(), fov = 30, pol = 0.76, dist = filmFit(port ? 11.5 : 13.6, 9.6, fov, port ? 1.3 : 1.4);
      const A = Math.min(0.22, filmAzMax(dist, pol) * 0.9);
      fCamOrbit(0.6, A * Math.sin((tl - 3) * 0.2), pol, dist * lerp(1.1, 1, eOutCubic(fSeg(tl, 0, 6))), fov);
    } },
];
function filmPlan(s, i) {         // 서재 배치안을 차례로 보여 줌
  const p = H.studyPlans[i]; if (!p) return;
  if (proposals.study.cur !== p.id) { const g = proposals.study.groups[proposals.study.cur]; g.scale.setScalar(1); g.position.set(0, 0, 0); setProposal('study', p.id); }
  film.planT = film.ct;
  if (!s.pl) { s.pl = document.createElement('div'); s.pl.className = 'f-plan an a-rise'; s.pl.innerHTML = `<div class="dots">${H.studyPlans.map(() => '<i></i>').join('')}</div><div class="nm"></div>`; s.lt.appendChild(s.pl); }
  s.pl.querySelectorAll('.dots i').forEach((d, k) => d.classList.toggle('on', k === i));
  const nm = s.pl.querySelector('.nm'); nm.innerHTML = `<span class="an a-up" style="--o:${(-film.ff).toFixed(2)}s">${esc(p.name)}</span>`;
}
(function filmInit() {            // 장면 시작 시각 · 전환 가림막 · 진행 막대
  let t = 0;
  SCENES.forEach((s, i) => {
    s.t0 = t; t += s.dur; s.cues = s.cues || [];
    if (s.ch) s.wipe = chWipe(s.ch);
    if (i > 0) { s.cues.push([0.45, () => wipe.reveal()]); if (s.cut !== false) SCENES[i - 1].cues.push([SCENES[i - 1].dur - 0.75, () => wipe.cover(s.wipe)]); }
  });
  SCENES.forEach(s => s.cues.sort((a, b) => a[0] - b[0]));
  film.total = t;
  $('fProg').innerHTML = SCENES.map(s => `<i style="flex:${s.dur}"><b></b></i>`).join('');
  film.bars = [...$('fProg').querySelectorAll('b')];
})();

// ---------- 재생 ----------
const F_ICON = { pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>', play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>' };
function filmEnter(i) {
  const cur = SCENES[film.idx];
  if (cur) { if (cur.exit) cur.exit(); filmClear(); }
  film.idx = i; film.cue = 0; film.fresh = true; film.planT = null;
  const s = SCENES[i];
  $('fChap').textContent = s.ch ? s.ch.no + ' ' + s.ch.name : s.label;
}
function filmSetup() {            // 가림막이 화면을 다 덮은 뒤 한 번
  film.ready = true;
  state.wallPref = 'full'; furn.visible = true; dimG.visible = false;
  camera.clearViewOffset(); viewOffY = 0; film.offKey = '';
}
function filmStep(now) {
  const dtm = Math.min(400, now - film.last); film.last = now;
  if (!film.paused && !film.closing) film.t += dtm / 1000;
  invalidate();
  if (film.t < 0 || film.closing) return true;                        // 가림막이 덮이는 동안은 그대로 둠
  if (!film.ready) filmSetup();
  if (film.idx < 0) filmEnter(0);
  while (!SCENES[film.idx].last && film.t >= SCENES[film.idx].t0 + SCENES[film.idx].dur) filmEnter(film.idx + 1);
  const s = SCENES[film.idx], tl = film.t - s.t0;
  if (film.fresh) {
    film.fresh = false; film.ff = tl; film.ct = 0;
    filmEl.classList.toggle('lt', s.theme === 'lt'); filmEl.classList.toggle('shade', s.theme !== 'lt');
    filmEnv(s.inside, s.night); s.enter(s);
  }
  while (film.cue < s.cues.length && s.cues[film.cue][0] <= tl) { const c = s.cues[film.cue++]; film.ct = c[0]; film.ff = tl - c[0]; c[1](s); }
  film.ff = 0;
  if (film.laters.length) film.laters = film.laters.filter(l => (l.t <= film.t ? (l.fn(), false) : true));
  s.update(tl);
  fW = view.clientWidth; fH = view.clientHeight;
  const ox = s.offX && !fPortrait() ? Math.round(s.offX * fW) : 0, ok = ox + ':' + fW + ':' + fH;       // 화면 중심 옮기기 (엔딩 가로 화면)
  if (ok !== film.offKey) { film.offKey = ok; if (ox) camera.setViewOffset(fW, fH, ox, 0, fW, fH); else camera.clearViewOffset(); }
  if (film.shadow) { film.shadow = false; shadowDirty(); }
  filmOverlay(tl);
  film.bars.forEach((b, j) => { const k = j < film.idx ? 1 : j > film.idx ? 0 : fSat(tl / s.dur); if (b._k !== k) { b._k = k; b.style.transform = `scaleX(${k.toFixed(4)})`; } });
  return true;
}
function filmPause(p, quiet) {
  film.paused = p; filmEl.classList.toggle('paused', p);
  $('fPause').innerHTML = p ? F_ICON.play : F_ICON.pause;
  const f = $('fFlash'); f.innerHTML = p ? F_ICON.pause : F_ICON.play; f.className = 'f-flash';
  if (!quiet) { void f.offsetWidth; f.className = p ? 'f-flash stay' : 'f-flash go'; }
}
function filmStart() {
  if (film.on) return;
  hideCard(); closeSheets(); if (state.measuring) setMeasuring(false);
  MAP.big = false; mapSet(false, false);
  tween = null; walk.path = null; walk.vy = walk.vp = 0; controls.enabled = false;
  film.saved = { night: light.night, wallPref: state.wallPref, study: proposals.study.cur };
  document.body.classList.add('film'); filmEl.classList.add('on'); filmEl.classList.remove('lt', 'shade');
  film.on = true; film.ready = false; film.closing = false; film.idx = -1; film.t = -0.72; film.last = performance.now();
  filmPause(false, true); film.bars.forEach(b => { b._k = 0; b.style.transform = 'scaleX(0)'; });
  $('fChap').textContent = '';
  wipe.cover(''); invalidate();
}
function filmRestore() {
  const cur = SCENES[film.idx];
  if (cur && cur.exit) cur.exit();
  filmClear(); film.idx = -1;
  if (film.ready) {
    filmUnitsAt(null); filmWallK(1);
    state.wallPref = film.saved.wallPref; light.night = film.saved.night;
    furn.visible = state.showFurn; dimG.visible = state.showDims;
  }
  film.on = false; film.ready = false; film.closing = false;
  document.body.classList.remove('film'); filmEl.classList.remove('lt', 'shade', 'paused');
  goOrbit('all', true); applyWalls(); applyRig(); viewOffDirty = true; markRooms();
}
function filmStop() {
  if (!film.on || film.closing) return;
  film.closing = true; filmEl.classList.remove('paused');
  if (!/cover|hold/.test(wipe.el.className)) wipe.cover('');
  setTimeout(() => { filmRestore(); wipe.reveal(); setTimeout(() => { if (!film.on) { filmEl.classList.remove('on'); wipe.clear(); } }, 820); }, 700);
}
function filmGo(i) {              // 장면 처음으로 (가림막을 덮은 채 시작해서 걷어 냄)
  if (!film.on || film.closing || film.t < 0) return;
  i = clamp(i, 0, SCENES.length - 1);
  filmEnter(i); film.t = SCENES[i].t0; film.ff = 0;
  wipe.hold(SCENES[i].wipe || '');
  if (film.paused) filmPause(false, true);
}
function filmSeek(t, pause) {     // 검증용: 아무 시각으로나
  if (!film.on) filmStart();
  let i = 0; while (!SCENES[i].last && t >= SCENES[i].t0 + SCENES[i].dur) i++;
  filmEnter(i); film.t = t; wipe.clear();
  if (i === 0 && t < 3.3) wipe.hold('');
  filmPause(!!pause, true);
}
$('bFilm').addEventListener('click', filmStart);
$('fClose').addEventListener('click', filmStop);
$('fPause').addEventListener('click', () => filmPause(!film.paused));
$('fZones').addEventListener('click', e => {
  const z = e.target.dataset.z; if (!z || !film.on || film.t < 0) return;
  const s = SCENES[film.idx] || SCENES[0];
  if (z === 'toggle') { if (!s.last) filmPause(!film.paused); }
  else if (z === 'next') { if (!s.last) filmGo(film.idx + 1); }
  else filmGo(film.t - s.t0 > 2.5 || film.idx === 0 ? film.idx : film.idx - 1);
});
fStage.addEventListener('click', e => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  if (b.dataset.f === 'replay') filmGo(0); else filmStop();
});
window.addEventListener('keydown', e => {
  if (!film.on) return;
  if (e.key === 'Escape') filmStop();
  else if (e.key === ' ') { e.preventDefault(); filmPause(!film.paused); }
  else if (e.key === 'ArrowRight') filmGo(film.idx + 1);
  else if (e.key === 'ArrowLeft') filmGo(film.idx - 1);
});
