// ===== 06 nav: 시점 · 둘러보기(1인칭) · 바닥 탭 이동 · 벽 보기 =====
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.1;
controls.minDistance = 1.0; controls.maxDistance = 95; controls.rotateSpeed = 0.7;
controls.screenSpacePanning = true; controls.maxPolarAngle = Math.PI * 0.495;
controls.addEventListener('change', () => invalidate());

const state = {
  mode: 'orbit',            // orbit | walk
  viewId: 'all', space: null,
  wallPref: 'full', xray: false, lowNow: null,
  doorOpen: true, motionOpen: false, showLabels: false, showDims: false, showFurn: true, measuring: false,
};
const spaceById = id => H.spaces.find(s => s.id === id);
function spaceAt(x, y) {       // cm → 공간
  return H.spaces.find(s => x >= s.rect[0] && x <= s.rect[2] && y >= s.rect[1] && y <= s.rect[3]) || null;
}
const inHouse = (x, y) => x > -5 && x < 1023 && y > -22 && y < 705;

// ---------- 걸어갈 수 있는 곳 격자 (10cm) ----------
const GRID = (function () {
  const C = 10, X0 = -20, Y0 = -30, NX = 107, NY = 76, blocked = new Uint8Array(NX * NY);
  const mark = (x0, y0, x1, y1, pad) => {
    const i0 = Math.max(0, Math.floor((x0 - pad - X0) / C)), i1 = Math.min(NX - 1, Math.floor((x1 + pad - X0 - 0.01) / C));
    const j0 = Math.max(0, Math.floor((y0 - pad - Y0) / C)), j1 = Math.min(NY - 1, Math.floor((y1 + pad - Y0 - 0.01) / C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * NX + i] = 1;
  };
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const x = X0 + (i + 0.5) * C, y = Y0 + (j + 0.5) * C; if (!(x > 0 && x < 1018 && y > 0 && y < 700) || (x > 981 && y < 225)) blocked[j * NX + i] = 1; }
  H.walls.forEach(w => mark(w.x0, w.y0, w.x1, w.y1, 14));
  H.xboxes.forEach(p => mark(p[0][0], p[0][1], p[2][0], p[2][1], 10));
  H.furniture.forEach(f => {
    if (!f.poly || f.flat || (f.h0 && f.h0 > 60) || f.type === 'sink' || f.type === 'robot' || f.type === 'dw') return;
    (f.parts || [[...f.poly[0], ...f.poly[2]]]).forEach(p => mark(Math.min(p[0], p[2]), Math.min(p[1], p[3]), Math.max(p[0], p[2]), Math.max(p[1], p[3]), 10));
  });
  H.furniture.filter(f => f.type === 'toilet').forEach(f => mark(f.at[0] - 26, f.at[1] - 20, f.at[0] + 36, f.at[1] + 20, 4));
  // 문 자리는 뚫기 (현관문 앞 바깥 한 칸 포함)
  H.doors.forEach(d => {
    const S = doorSpan(d), m0 = S.g0 + 14, m1 = S.g1 - 14;
    for (let a = m0; a <= m1; a += 5) for (let q = -26; q <= 26; q += 5) {
      const x = S.horiz ? a : S.line + q, y = S.horiz ? S.line + q : a;
      const i = Math.floor((x - X0) / C), j = Math.floor((y - Y0) / C);
      if (i >= 0 && j >= 0 && i < NX && j < NY) blocked[j * NX + i] = 0;
    }
  });
  const idx = (x, y) => { const i = Math.floor((x - X0) / C), j = Math.floor((y - Y0) / C); return i < 0 || j < 0 || i >= NX || j >= NY ? -1 : j * NX + i; };
  let dyn = [];                                                   // 배치 제안 가구 (전환되면 바뀜)
  const setDyn = items => { dyn = items.filter(f => f.type !== 'chair' && !f.flat).map(f => { const b = bboxOf(f.poly); return [b[0] - 12, b[1] + 12, b[2] - 12, b[3] + 12]; }); };
  const free = (x, y) => { const k = idx(x, y); if (k < 0 || blocked[k]) return false; for (const d of dyn) if (x > d[0] && x < d[1] && y > d[2] && y < d[3]) return false; return true; };
  const center = k => [X0 + (k % NX + 0.5) * C, Y0 + (Math.floor(k / NX) + 0.5) * C];
  function nearestFree(x, y, maxR) {
    if (free(x, y)) return [x, y];
    let best = null, bd = 1e9;
    const R = maxR || 120;
    for (let dy = -R; dy <= R; dy += C) for (let dx = -R; dx <= R; dx += C) {
      const d = dx * dx + dy * dy; if (d >= bd) continue;
      if (free(x + dx, y + dy)) { bd = d; best = center(idx(x + dx, y + dy)); }
    }
    return best;
  }
  function los(a, b) {                                            // 직선으로 갈 수 있나
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4);
    for (let i = 1; i < n; i++) { const t = i / n; if (!free(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; }
    return true;
  }
  function path(from, to) {                                       // A* → 직선으로 정리
    const s = nearestFree(from[0], from[1]), e = nearestFree(to[0], to[1]);
    if (!s || !e) return null;
    const ks = idx(s[0], s[1]), ke = idx(e[0], e[1]);
    const gs = new Float32Array(NX * NY).fill(1e9), prev = new Int32Array(NX * NY).fill(-1), open = [ks], inOpen = new Uint8Array(NX * NY);
    gs[ks] = 0; inOpen[ks] = 1;
    const hf = k => { const dx = (k % NX) - (ke % NX), dy = Math.floor(k / NX) - Math.floor(ke / NX); return Math.hypot(dx, dy); };
    let found = false, guard = 0;
    while (open.length && guard++ < 20000) {
      let bi = 0, bf = 1e9;
      for (let i = 0; i < open.length; i++) { const f = gs[open[i]] + hf(open[i]); if (f < bf) { bf = f; bi = i; } }
      const k = open.splice(bi, 1)[0]; inOpen[k] = 0;
      if (k === ke) { found = true; break; }
      const ci = k % NX, cj = Math.floor(k / NX);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= NX || nj >= NY) continue;
        const nk = nj * NX + ni; if (blocked[nk]) continue; { const c = center(nk); if (!free(c[0], c[1])) continue; }
        if (di && dj && (blocked[cj * NX + ni] || blocked[nj * NX + ci])) continue;
        const ng = gs[k] + (di && dj ? 1.414 : 1);
        if (ng < gs[nk]) { gs[nk] = ng; prev[nk] = k; if (!inOpen[nk]) { open.push(nk); inOpen[nk] = 1; } }
      }
    }
    if (!found) return null;
    let pts = []; for (let k = ke; k !== -1; k = prev[k]) pts.push(center(k));
    pts.reverse(); pts[0] = s; pts[pts.length - 1] = e;
    const out = [pts[0]]; let i = 0;
    while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !los(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
    return out;
  }
  return { free, nearestFree, path, los, blocked, NX, NY, X0, Y0, C, setDyn };
})();

// ---------- 카메라 이동(트윈) ----------
let tween = null;
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const walk = { yaw: 0, pitch: 0, path: null, seg: 0, segT: 0, keys: {}, vy: 0, vp: 0 };
function lookQuat(p, l) { const m = new THREE.Matrix4().lookAt(p, l, new V3(0, 1, 0)); return new THREE.Quaternion().setFromRotationMatrix(m); }
function setYawPitchFromQuat(q) { const e = new THREE.Euler().setFromQuaternion(q, 'YXZ'); walk.yaw = e.y; walk.pitch = clamp(e.x, -1.35, 1.35); }
function applyWalkCam() { camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ'); }
function photoFov(vf) {         // 사진 세로 화각(3:4)을 화면 비율에 맞춤
  const tv = Math.tan(THREE.MathUtils.degToRad((vf || 72) / 2)), th = tv * 0.75;
  return Math.min(92, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.max(tv, th / camera.aspect))));
}
const portrait = () => camera.aspect < 1;
// 위·아래 UI에 가려지지 않는 영역에 맞추기
function uiPad() { const h = view.clientHeight, d = $('dock').getBoundingClientRect(); return { top: 62, bottom: Math.max(0, h - d.top) + 6, h }; }
function fitDist(w, h, fov) {
  const t = Math.tan(THREE.MathUtils.degToRad(fov) / 2), P = uiPad(), k = P.h / Math.max(120, P.h - P.top - P.bottom);
  return Math.max((h / 2) / t * k, (w / 2) / (t * camera.aspect));
}
const ORBIT_VIEWS = {
  all() {
    const t = new V3(5.09, 0.6, 3.5), dir = new V3(-0.2, 1.0, 0.84).normalize();
    return { t, p: t.clone().addScaledVector(dir, fitDist(portrait() ? 11.5 : 13.6, portrait() ? 9.8 : 9.6, 30)), fov: 30 };
  },
  plan() { const t = new V3(5.09, 0, 3.5); return { t, p: new V3(5.09, fitDist(11.0, 7.9, 16) + 2.3, 3.5 + 0.02), fov: 16 }; },
};
let viewOffY = 0, viewOffDirty = false;
function applyViewOffset() {          // 전체·평면에서는 화면 중심을 UI 사이 빈 영역 가운데로
  const P = uiPad(), want = state.mode === 'orbit' && !light.inside ? (P.bottom - P.top) / 2 : 0;
  if (Math.abs(want - viewOffY) < 0.5) { if (viewOffY !== want || viewOffDirty) { viewOffY = want; viewOffDirty = false; } else return false; }
  else if (tween) viewOffY += (want - viewOffY) * 0.2; else viewOffY = want;
  const w = view.clientWidth, h = view.clientHeight;
  if (Math.abs(viewOffY) < 0.5) camera.clearViewOffset(); else camera.setViewOffset(w, h, 0, viewOffY, w, h);
  return true;
}

function setInside(v) {
  if (light.inside === v) return;
  light.inside = v; ceilG.visible = v;
  if (xboxMesh) { xboxMesh.material = v ? MAT.wall : MAT.xbox; xboxMesh.castShadow = false; }
  applyWalls(); applyRig();
}
function goOrbit(name, instant) {
  const v = ORBIT_VIEWS[name]();
  state.viewId = name; state.space = null; walk.path = null;
  const fromWalk = state.mode === 'walk';
  state.mode = 'orbit';
  const q1 = lookQuat(v.p, v.t);
  const done = () => { controls.target.copy(v.t); controls.enabled = true; controls.update(); };
  controls.enabled = false;
  if (instant) { camera.position.copy(v.p); camera.quaternion.copy(q1); camera.fov = v.fov; camera.updateProjectionMatrix(); setInside(false); done(); invalidate(4); markRooms(); return; }
  tween = { t0: performance.now(), dur: fromWalk ? 1100 : 800, p0: camera.position.clone(), q0: camera.quaternion.clone(), f0: camera.fov, p1: v.p, q1, f1: v.fov, done };
  invalidate(); markRooms();
}
// 방 안으로: p(눈 위치 m), l(바라보는 곳 m)
function goWalk(p, l, fov, opts) {
  opts = opts || {};
  const first = state.mode !== 'walk';
  state.mode = 'walk'; controls.enabled = false; walk.path = null;
  const q1 = lookQuat(p, l);
  markRooms();
  const done = () => { setYawPitchFromQuat(q1); applyWalkCam(); setInside(true); };
  if (opts.instant) { camera.position.copy(p); camera.quaternion.copy(q1); camera.fov = fov; camera.updateProjectionMatrix(); done(); invalidate(4); return; }
  tween = { t0: performance.now(), dur: first ? 1150 : 750, p0: camera.position.clone(), q0: camera.quaternion.clone(), f0: camera.fov, p1: p, q1, f1: fov, done };
  invalidate();
}
function goSpace(id, instant) {
  const s = spaceById(id); if (!s) return;
  state.viewId = id; state.space = s;
  if (s.eye) {
    const e = s.eye;
    goWalk(new V3(CM(e.p[0]), CM(e.p[2]), CM(e.p[1])), new V3(CM(e.l[0]), CM(e.l[2]), CM(e.l[1])), photoFov(e.vf), { instant });
  } else {
    const cx = (s.rect[0] + s.rect[2]) / 2, cy = (s.rect[1] + s.rect[3]) / 2, f = GRID.nearestFree(cx, cy) || [cx, cy];
    goWalk(new V3(CM(f[0]), 1.52, CM(f[1])), new V3(CM(cx), 1.3, CM(cy) + 0.5), photoFov(72), { instant });
  }
}
// 바닥의 한 점(cm)으로 들어가서 둘러보기
function enterAt(x, y, lookAt) {
  const f = GRID.nearestFree(x, y); if (!f) return false;
  const s = spaceAt(f[0], f[1]); state.space = s; state.viewId = s && s.shortcut ? s.id : null;
  const p = new V3(CM(f[0]), 1.52, CM(f[1]));
  let l = lookAt;
  if (!l) { const c = s ? [(s.rect[0] + s.rect[2]) / 2, (s.rect[1] + s.rect[3]) / 2] : [510, 350]; l = new V3(CM(c[0]), 1.3, CM(c[1])); if (l.distanceTo(p) < 0.4) l.z += 1; }
  goWalk(p, l, photoFov(72));
  return true;
}
function walkTo(x, y) {           // 걸어서 이동 (cm)
  const from = [camera.position.x * 100, camera.position.z * 100];
  const pts = GRID.path(from, [x, y]);
  if (!pts || pts.length < 2) return false;
  let len = 0; const segs = [];
  for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push(d); len += d; }
  if (len < 3) return false;
  walk.path = { pts, segs, len, t0: performance.now(), dur: clamp(len / 100 / 2.4, 0.45, 3.2) * 1000, start: [camera.position.x * 100, camera.position.z * 100] };
  tween = null; invalidate();
  return true;
}

// ---------- 벽 보기 ----------
function applyWalls() {
  const inside = light.inside || state.mode === 'walk';
  const mode = inside ? 'full' : state.wallPref;
  const wantLow = mode === 'low';
  if (wantLow !== state.lowNow) {
    state.lowNow = wantLow;
    buildStructure(wantLow ? LOW : 0);
    doorObjs.forEach(d => (d.pivot.scale.y = wantLow ? LOW / DOORH : 1));
    fixedG.scale.y = wantLow ? LOW / CEIL : 1;
    if (xboxMesh && light.inside) xboxMesh.material = MAT.wall;
    shadowDirty();
  }
  state.xray = mode === 'xray';
  wallMatsAll().forEach(m => {
    const side = Object.keys(extMats).find(k => extMats[k] === m);
    const hid = side && hiddenSide[side] && !inside;
    const tr = state.xray || hid;
    if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
    m.opacity = hid ? 0.07 : state.xray ? 0.2 : 1; m.depthWrite = !tr;
  });
  MAT.cut.visible = !state.xray;
  MAT.glass.color.set(state.xray ? 0x6aa9dc : 0xd6e8f2); MAT.glass.opacity = state.xray ? 0.5 : 0.16;
  structure.children.forEach(g => g.children.forEach(m => { if (wallMatsAll().includes(m.material)) m.castShadow = !m.material.transparent; }));
  invalidate();
}
let cutKey = '';
function updateCutaway() {        // 바깥에서 보는 쪽 바깥벽만 자동 투명
  if (state.mode !== 'orbit' || light.inside) { if (cutKey !== '') { cutKey = ''; Object.keys(hiddenSide).forEach(k => (hiddenSide[k] = false)); applyWalls(); shadowDirty(); } return; }
  const c = camera.position, h = { N: c.z < -0.2, S: c.z > 7.2, W: c.x < -0.2, E: c.x > 10.4 };
  const key = Object.keys(h).filter(k => h[k]).join('');
  if (key !== cutKey) { cutKey = key; Object.assign(hiddenSide, h); applyWalls(); shadowDirty(); }
}

// ---------- 입력: 탭 판별 + 방 안 둘러보기 ----------
const ptrs = new Map();
let tapStart = null, pinch0 = 0, fov0 = 0, lastMove = 0;
const cv = renderer.domElement;
const onTap = [];                // (x, y) 핸들러 — 07에서 등록
cv.addEventListener('pointerdown', e => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) tapStart = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, moved: false };
  else if (tapStart) tapStart.moved = true;
  if (tween && state.mode === 'orbit') { tween.done(); tween = null; }
  if (state.mode === 'walk') {
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    if (ptrs.size === 2) { const a = [...ptrs.values()]; pinch0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); fov0 = camera.fov; }
    walk.vy = walk.vp = 0;
  }
  invalidate();
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > (e.pointerType === 'mouse' ? 4 : 9)) tapStart.moved = true;
  if (state.mode !== 'walk' || tween) return;
  if (ptrs.size === 1 && tapStart && tapStart.moved) {
    const k = THREE.MathUtils.degToRad(camera.fov) / view.clientHeight * 1.15;      // 손가락을 따라 화면이 끌려오게
    walk.yaw += dx * k; walk.pitch = clamp(walk.pitch + dy * k, -1.35, 1.35);
    const now = performance.now(), dt = Math.max(8, now - lastMove); lastMove = now;
    walk.vy = dx * k / dt * 16; walk.vp = dy * k / dt * 16;
    applyWalkCam(); invalidate();
  } else if (ptrs.size === 2) {
    const a = [...ptrs.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    if (pinch0 > 0) { camera.fov = clamp(fov0 * pinch0 / d, 28, 95); camera.updateProjectionMatrix(); invalidate(); }
  }
});
function endPtr(e) {
  const had = ptrs.delete(e.pointerId);
  if (!had) return;
  if (ptrs.size < 2) pinch0 = 0;
  if (tapStart && e.pointerId === tapStart.id) {
    const ok = !tapStart.moved && performance.now() - tapStart.t < 450 && e.type === 'pointerup';
    if (performance.now() - lastMove > 90) walk.vy = walk.vp = 0;
    const t = tapStart; tapStart = null;
    if (ok) onTap.forEach(f => f(t.x, t.y));
  }
  invalidate();
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', e => {
  if (state.mode !== 'walk') return;
  e.preventDefault();
  camera.fov = clamp(camera.fov * Math.exp(e.deltaY * 0.0012), 28, 95); camera.updateProjectionMatrix(); invalidate();
}, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; walk.keys[e.key.toLowerCase()] = true; if (state.mode === 'walk') invalidate(); });
window.addEventListener('keyup', e => { walk.keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { walk.keys = {}; });

// 매 프레임: 트윈 · 걷기 · 키보드
const navHooks = { moved: [] };
function stepNav(now, dt) {
  let moving = false;
  if (tween) {
    const k = Math.min(1, (now - tween.t0) / tween.dur), e = ease(k);
    camera.position.lerpVectors(tween.p0, tween.p1, e);
    camera.quaternion.slerpQuaternions(tween.q0, tween.q1, e);
    camera.fov = lerp(tween.f0, tween.f1, e); camera.updateProjectionMatrix();
    // 방으로 날아 들어갈 때는 천장 아래로 내려온 순간부터 실내 조명
    if (state.mode === 'walk' && !light.inside && camera.position.y < CM(CEIL) - 0.05) setInside(true);
    if (state.mode === 'orbit' && light.inside && camera.position.y > CM(CEIL) + 0.05) setInside(false);
    if (k >= 1) { const d = tween.done; tween = null; d(); }
    moving = true;
  } else if (state.mode === 'walk') {
    if (walk.path) {
      const P = walk.path, k = Math.min(1, (now - P.t0) / P.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      let d = e * P.len, i = 0; while (i < P.segs.length - 1 && d > P.segs[i]) { d -= P.segs[i]; i++; }
      const t = P.segs[i] ? Math.min(1, d / P.segs[i]) : 1, a = P.pts[i], b = P.pts[i + 1];
      camera.position.x = CM(lerp(a[0], b[0], t)); camera.position.z = CM(lerp(a[1], b[1], t));
      if (k >= 1) walk.path = null;
      moving = true;
    }
    const K = walk.keys, f = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0), sd = (K.d ? 1 : 0) - (K.a ? 1 : 0), turn = (K.arrowleft ? 1 : 0) - (K.arrowright ? 1 : 0);
    if (f || sd || turn) {
      walk.path = null;
      walk.yaw += turn * 1.6 * dt;
      const sp = 1.7 * dt * 100, sy = Math.sin(walk.yaw), cy = Math.cos(walk.yaw);
      const nx = camera.position.x * 100 + (-sy * f + cy * sd) * sp, nz = camera.position.z * 100 + (-cy * f - sy * sd) * sp;
      if (GRID.free(nx, nz)) { camera.position.x = CM(nx); camera.position.z = CM(nz); }
      else if (GRID.free(nx, camera.position.z * 100)) camera.position.x = CM(nx);
      else if (GRID.free(camera.position.x * 100, nz)) camera.position.z = CM(nz);
      applyWalkCam(); moving = true;
    }
    if (!ptrs.size && (Math.abs(walk.vy) > 1e-4 || Math.abs(walk.vp) > 1e-4)) {      // 관성
      walk.yaw += walk.vy; walk.pitch = clamp(walk.pitch + walk.vp, -1.35, 1.35);
      walk.vy *= 0.88; walk.vp *= 0.88; applyWalkCam(); moving = true;
    }
    if (moving) {
      const s = spaceAt(camera.position.x * 100, camera.position.z * 100);
      if (s !== state.space) { state.space = s; navHooks.moved.forEach(fn => fn(s)); }
    }
  } else {
    controls.update();
    const dist = camera.position.distanceTo(controls.target);
    const nearWant = clamp(dist * 0.04, 0.05, 2);
    if (Math.abs(camera.near - nearWant) > 1e-3) { camera.near = nearWant; camera.updateProjectionMatrix(); }
  }
  if (state.mode === 'walk' && camera.near !== 0.05) { camera.near = 0.05; camera.updateProjectionMatrix(); }
  if (applyViewOffset()) moving = true;
  if (moving) invalidate();
  return moving;
}
