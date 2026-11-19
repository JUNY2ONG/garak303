// ===== 03 structure: 바닥 · 천장 · 벽 · 창 · 문 =====
const pickRoots = [];            // 탭으로 고를 수 있는 것들
const floorMeshes = [];          // 바닥(탭해서 이동)
const occluders = [];            // 이름표 가림 판정용
const world = new THREE.Group(); scene.add(world);

function polyShape(poly) {
  const s = new THREE.Shape();
  poly.forEach(([x, y], i) => (i ? s.lineTo(CM(x), -CM(y)) : s.moveTo(CM(x), -CM(y))));
  return s;
}
// ---------- 바닥 ----------
(function buildFloors() {
  H.floors.forEach(f => {
    if (f.type === 'wood') {                         // 두께 12cm 슬래브 (현관 자리는 비어서 단차가 생김)
      const g = new THREE.ExtrudeGeometry(polyShape(f.poly), { depth: 0.12, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, [MAT.floor, MAT.slab]);
      m.position.y = -0.12; m.receiveShadow = true; m.userData.floor = 'floor';
      world.add(m); floorMeshes.push(m);
      return;
    }
    const g = new THREE.ShapeGeometry(polyShape(f.poly));
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, f.level ? MAT.entry : MAT.tile);
    m.position.y = f.level ? CM(f.level) + 0.001 : 0.002;
    m.receiveShadow = true; m.userData.floor = f.level ? 'entryTile' : 'tile';
    world.add(m); floorMeshes.push(m);
  });
  const b = new Batch();
  b.boxC(MAT.slab, 440, 530, -12, 0, -20, 0, { cast: false });   // 현관문 문턱 아래
  b.boxC(MAT.slab, 435, 588, -24, -12, 0, 105, { cast: false }); // 현관 바닥 아래
  b.build(world);
})();

// ---------- 천장 (방 안에서만 보임) + 다운라이트 ----------
const ceilG = new THREE.Group(); ceilG.visible = false; world.add(ceilG);
(function buildCeiling() {
  const outline = [[-20, -20], [1001, -20], [1001, 205], [1038, 205], [1038, 720], [-20, 720]];
  const g = new THREE.ExtrudeGeometry(polyShape(outline), { depth: 0.12, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, MAT.ceiling);
  m.position.y = CM(CEIL); m.castShadow = true; m.receiveShadow = true;
  ceilG.add(m);
  const b = new Batch();
  H.lights.forEach(([x, y]) => {
    const ring = new THREE.RingGeometry(0.04, 0.055, 28); ring.rotateX(Math.PI / 2); ring.translate(CM(x), CM(CEIL) - 0.002, CM(y));
    b.geo(MAT.downlightRing, ring, { cast: false });
    const disc = new THREE.CircleGeometry(0.04, 28); disc.rotateX(Math.PI / 2); disc.translate(CM(x), CM(CEIL) - 0.0015, CM(y));
    b.geo(MAT.downlight, disc, { cast: false });
  });
  b.build(ceilG);
})();

// ---------- 구조 (벽 · 창 · 문 위 벽) — 벽 낮추기 때 다시 생성 ----------
let structure = null, xboxMesh = null;
const winGroups = {};
function wallInfo(w) {
  const horiz = (w.x1 - w.x0) >= (w.y1 - w.y0);
  return horiz ? { horiz, a0: w.x0, a1: w.x1, p0: w.y0, p1: w.y1 } : { horiz, a0: w.y0, a1: w.y1, p0: w.x0, p1: w.x1 };
}
function winInfo(win, horiz) {
  return horiz ? { a0: win.x0, a1: win.x1, p0: win.y0, p1: win.y1 } : { a0: win.y0, a1: win.y1, p0: win.x0, p1: win.x1 };
}
function doorSpan(d) {            // 문 구멍: { horiz, g0, g1, line }
  const horiz = d.closed[1] === 0;
  const ha = horiz ? d.hinge[0] : d.hinge[1], line = horiz ? d.hinge[1] : d.hinge[0];
  const ta = ha + (horiz ? d.closed[0] : d.closed[1]) * d.w;
  return { horiz, g0: Math.min(ha, ta), g1: Math.max(ha, ta), line };
}
function buildStructure(cut) {
  if (structure) {
    pickRoots.splice(0, pickRoots.length, ...pickRoots.filter(o => !o.userData.structural));
    disposeGroup(structure); occluders.length = 0;
  }
  structure = new THREE.Group(); world.add(structure);
  const top = cut || CEIL;
  const walls = new Batch(), trim = new Batch();
  // ab: 벽 방향 기준으로 상자 넣기
  const put = (b, mat, horiz, a0, a1, h0, h1, p0, p1, o) => horiz ? b.boxC(mat, a0, a1, h0, h1, p0, p1, o) : b.boxC(mat, p0, p1, h0, h1, a0, a1, o);
  H.walls.forEach(w => {
    const I = wallInfo(w);
    const mat = w.side ? extMats[w.side] : w.type === 'bearing' ? MAT.bearing : w.type === 'thin' ? MAT.thin : MAT.wall;
    const piece = (s0, s1, h0, h1) => {
      if (s1 - s0 < 0.5 || h1 - h0 < 0.5) return;
      put(walls, mat, I.horiz, s0, s1, h0 === 0 ? -12 : h0, h1, I.p0, I.p1);
      if (h1 === top) put(walls, MAT.cut, I.horiz, s0, s1, h1, h1 + 0.4, I.p0, I.p1, { cast: false });
    };
    const wins = H.windows.map(win => Object.assign(winInfo(win, I.horiz), { win }))
      .filter(o => o.a0 < I.a1 && o.a1 > I.a0 && o.p0 < I.p1 && o.p1 > I.p0)
      .map(o => ({ a0: Math.max(I.a0, o.a0), a1: Math.min(I.a1, o.a1), sill: o.win.sill, top: o.win.top }))
      .sort((a, b) => a.a0 - b.a0);
    let c = I.a0;
    wins.forEach(o => {
      piece(c, o.a0, 0, top);
      piece(o.a0, o.a1, 0, Math.min(o.sill, top));
      if (o.top < top) piece(o.a0, o.a1, o.top, top);
      c = o.a1;
    });
    piece(c, I.a1, 0, top);
    // 걸레받이 (보닥 S126, 높이 8 가정, 바깥벽은 안쪽 면만)
    if (I.a1 - I.a0 > 12 && w.type !== 'thin') {
      const faces = [];
      if (!w.side || w.side === 'S' || w.side === 'E') faces.push([I.p0 - 1.2, I.p0]);
      if (!w.side || w.side === 'N' || w.side === 'W') faces.push([I.p1, I.p1 + 1.2]);
      faces.forEach(([q0, q1]) => put(trim, MAT.casing, I.horiz, I.a0, I.a1, 0, 8, q0, q1, { cast: false }));
    }
  });
  // 문 위 벽 + 문선
  H.doors.forEach(d => {
    const S = doorSpan(d);
    const wobj = H.walls.find(w => { const I = wallInfo(w); return I.horiz === S.horiz && S.line >= I.p0 - 0.5 && S.line <= I.p1 + 0.5 &&
      (Math.abs(I.a1 - S.g0) < 8 || Math.abs(I.a0 - S.g1) < 8); });
    if (d.frame || !wobj) return;
    const wall = wallInfo(wobj), g0 = S.g0, g1 = S.g1;
    const mat = wobj.side ? extMats[wobj.side] : MAT.wall;
    if (top > DOORH) {
      put(walls, mat, S.horiz, g0 - 6, g1 + 6, DOORH, top, wall.p0, wall.p1, { cast: false });
      put(walls, MAT.cut, S.horiz, g0 - 6, g1 + 6, top, top + 0.4, wall.p0, wall.p1, { cast: false });
    }
    const ch = Math.min(DOORH + 6, top), cs = (a0, a1, h0, h1, q0, q1) => put(trim, MAT.casing, S.horiz, a0, a1, h0, h1, q0, q1, { cast: false });
    [[wall.p0 - 1.5, wall.p0], [wall.p1, wall.p1 + 1.5]].forEach(([q0, q1]) => {
      cs(g0 - 6, g0, 0, ch, q0, q1); cs(g1, g1 + 6, 0, ch, q0, q1);
      if (top > DOORH) cs(g0 - 6, g1 + 6, DOORH, DOORH + 6, q0, q1);
    });
    // 문틀 안쪽 면
    cs(g0 - 1.2, g0, 0, Math.min(DOORH, top), wall.p0, wall.p1); cs(g1, g1 + 1.2, 0, Math.min(DOORH, top), wall.p0, wall.p1);
    if (top > DOORH) cs(g0, g1, DOORH - 1.2, DOORH, wall.p0, wall.p1);
  });
  // 중문 틀 (현관, 사진 기준): 양쪽 문틀 + 위쪽 벽
  H.doors.filter(d => d.frame).forEach(d => {
    const [fx0, fx1] = d.frame, y = d.hinge[1], t = Math.min(DOORH, top);
    trim.boxC(MAT.frame, fx0, fx0 + 5, -12, t, y - 5, y + 5, { cast: false });
    trim.boxC(MAT.frame, fx1 - 5, fx1, -12, t, y - 5, y + 5, { cast: false });
    if (top > DOORH) {
      trim.boxC(MAT.frame, fx0, fx1, DOORH, DOORH + 4, y - 5, y + 5, { cast: false });
      walls.boxC(MAT.wall, 427, fx1, DOORH + 4, top, y - 5, y + 5, { cast: false });
      walls.boxC(MAT.cut, 427, fx1, top, top + 0.4, y - 5, y + 5, { cast: false });
    }
  });
  // 주방 벽 타일 88015: 메인 카운터 뒤 상판~상부장, 반대편 카운터 뒤 상판~천장 (가정)
  if (top > 85) {
    trim.boxC(MAT.ktile, 545, 797, 85, Math.min(150, top), 225, 225.8, { cast: false });

  }
  const wg = walls.build(structure, { kind: 'wall' }); wg.userData.structural = true;
  wg.children.forEach(m => { if (m.material !== MAT.cut) occluders.push(m); });
  const tg = trim.build(structure, { kind: 'wall' }); tg.userData.structural = true;
  pickRoots.push(wg, tg);

  // 창: 바깥 틀 + 미닫이 창짝 + 유리 + 창대
  H.windows.forEach(win => {
    if (cut && win.sill >= cut) return;
    const horiz = (win.x1 - win.x0) >= (win.y1 - win.y0);
    const I = winInfo(win, horiz), b = new Batch();
    const t = Math.min(win.top, top), full = t === win.top, pm = (I.p0 + I.p1) / 2;
    const fr = (mat, a0, a1, h0, h1, q0, q1) => put(b, mat, horiz, a0, a1, h0, h1, q0, q1, { cast: false });
    const F = 5, dp = 7;                              // 바깥 틀 폭 5, 깊이 14
    fr(MAT.frame, I.a0, I.a1, win.sill, win.sill + F, pm - dp, pm + dp);
    if (full) fr(MAT.frame, I.a0, I.a1, t - F, t, pm - dp, pm + dp);
    fr(MAT.frame, I.a0, I.a0 + F, win.sill, t, pm - dp, pm + dp);
    fr(MAT.frame, I.a1 - F, I.a1, win.sill, t, pm - dp, pm + dp);
    const n = win.panes || Math.max(2, Math.round((I.a1 - I.a0) / 110));
    const in0 = I.a0 + F, in1 = I.a1 - F, step = (in1 - in0) / n, S = 4.5, ov = 2.2;
    const h0 = win.sill + F, h1 = t - (full ? F : 0);
    for (let i = 0; i < n; i++) {
      const q = pm + (i % 2 ? 2.4 : -2.4);            // 번갈아 앞·뒤 레일
      const s0 = in0 + i * step - (i ? ov : 0), s1 = in0 + (i + 1) * step + (i < n - 1 ? ov : 0);
      fr(MAT.frame, s0, s0 + S, h0, h1, q - 1.8, q + 1.8); fr(MAT.frame, s1 - S, s1, h0, h1, q - 1.8, q + 1.8);
      fr(MAT.frame, s0 + S, s1 - S, h0, h0 + S, q - 1.8, q + 1.8);
      if (full) fr(MAT.frame, s0 + S, s1 - S, h1 - S, h1, q - 1.8, q + 1.8);
      fr(MAT.glass, s0 + S, s1 - S, h0 + S, h1 - (full ? S : 0), q - 0.3, q + 0.3);
    }
    if (win.sill > 30) {                              // 창대 (실내 쪽)
      const q0 = win.inner > 0 ? I.p1 - 1 : I.p0 - 4, q1 = win.inner > 0 ? I.p1 + 4 : I.p0 + 1;
      fr(MAT.sillTop, I.a0 - 3, I.a1 + 3, win.sill - 2.5, win.sill, q0, q1);
    }
    if (win.rail && !cut) {                           // 바깥 난간 (거실 사진 기준, 높이 약 110 가정)
      const q = win.inner > 0 ? I.p0 - 6 : I.p1 + 6, R = 110, B = win.sill + 8;
      fr(MAT.rail, I.a0, I.a1, R - 4, R, q - 2, q + 2); fr(MAT.rail, I.a0, I.a1, B, B + 3, q - 1.5, q + 1.5);
      for (let a = I.a0 + 6; a < I.a1 - 3; a += 11.4) fr(MAT.rail, a - 0.8, a + 0.8, B + 3, R - 4, q - 0.8, q + 0.8);
    }
    const g = b.build(structure, { kind: 'win', id: win.id }); g.userData.structural = true;
    pickRoots.push(g); winGroups[win.id] = g;
  });
  // X 표시 칸 (덕트·설비 추정)
  if (!cut) {
    const xb = new Batch();
    H.xboxes.forEach(p => xb.boxC(MAT.xbox, p[0][0], p[2][0], 0, CEIL, p[0][1], p[2][1], { cast: false }));
    const g = xb.build(structure, { kind: 'xbox' }); g.userData.structural = true;
    xboxMesh = g.children[0]; pickRoots.push(g);
  } else xboxMesh = null;
}

// ---------- 문짝 ----------
const doorObjs = [];
H.doors.forEach(d => {
  const pivot = new THREE.Group();
  pivot.position.set(CM(d.hinge[0]), 0, CM(d.hinge[1]));
  world.add(pivot);
  const w = CM(d.w), h = CM(DOORH) - 0.015, b = new Batch();
  const lever = (side) => {                           // 레버 손잡이 (모양 가정)
    const z = side * 0.02;
    b.cyl(MAT.handle, 0.026, 0.026, 0.012, w - 0.065, 1.0, z + side * 0.006, 'z', { cast: false });
    b.cyl(MAT.handle, 0.009, 0.009, 0.05, w - 0.065, 1.0, z + side * 0.03, 'z', { cast: false });
    b.box(MAT.handle, w - 0.19, w - 0.055, 0.991, 1.009, z + side * 0.046, z + side * 0.062, { r: 0.006, cast: false });
  };
  if (d.glass) {                                      // 유리 중문: 흰 프레임 + 간유리 + 긴 바 손잡이 (사진)
    const fw = 0.045, y0 = -0.11;                     // 현관 바닥(-12)까지 내려옴
    b.box(MAT.frame, 0.003, fw, y0, h, -0.02, 0.02, { cast: false }); b.box(MAT.frame, w - fw, w - 0.003, y0, h, -0.02, 0.02, { cast: false });
    b.box(MAT.frame, fw, w - fw, y0, y0 + 0.07, -0.02, 0.02, { cast: false }); b.box(MAT.frame, fw, w - fw, h - 0.05, h, -0.02, 0.02, { cast: false });
    b.box(MAT.frost, fw, w - fw, y0 + 0.07, h - 0.05, -0.005, 0.005, { cast: false });
    [-1, 1].forEach(sg => {
      b.cyl(MAT.steelBrushed, 0.0125, 0.0125, 1.15, w - 0.1, 1.05, sg * 0.062, 'y', { cast: false });
      [0.56, 1.54].forEach(y => b.cyl(MAT.steelBrushed, 0.007, 0.007, 0.045, w - 0.1, y, sg * 0.04, 'z', { cast: false }));
    });
  } else if (d.pvc) {                                 // 흰색 PVC 시스템 여닫이 문 + 모루/백사틴 유리 (사진)
    const fw = 0.09, t = 0.03, gm = d.pvc === 'moru' ? MAT.moru : MAT.satin;
    b.box(MAT.pvc, 0.003, fw, 0.008, h, -t, t, { r: 0.006 }); b.box(MAT.pvc, w - fw, w - 0.003, 0.008, h, -t, t, { r: 0.006 });
    b.box(MAT.pvc, fw, w - fw, 0.008, 0.008 + fw, -t, t); b.box(MAT.pvc, fw, w - fw, h - fw, h, -t, t);
    [-1, 1].forEach(sg => {                           // 유리 누름대 + 레버 손잡이(긴 받침)
      b.box(MAT.pvc, fw, fw + 0.012, 0.008 + fw, h - fw, sg * 0.012 - 0.004, sg * 0.012 + 0.004, { cast: false }); b.box(MAT.pvc, w - fw - 0.012, w - fw, 0.008 + fw, h - fw, sg * 0.012 - 0.004, sg * 0.012 + 0.004, { cast: false });
      b.box(MAT.casing, w - 0.066, w - 0.032, 0.9, 1.12, sg > 0 ? t : -t - 0.012, sg > 0 ? t + 0.012 : -t, { r: 0.005, cast: false });
      b.cyl(MAT.casing, 0.009, 0.009, 0.045, w - 0.049, 1.04, sg * (t + 0.03), 'z', { cast: false });
      b.box(MAT.casing, w - 0.17, w - 0.04, 1.03, 1.05, sg * (t + 0.045) - 0.008, sg * (t + 0.045) + 0.008, { r: 0.006, cast: false });
      b.cyl(MAT.casing, 0.011, 0.011, 0.012, w - 0.049, 0.94, sg * (t + 0.016), 'z', { cast: false });
    });
    b.box(gm, fw, w - fw, 0.008 + fw, h - fw, -0.006, 0.006, { cast: false });
  } else if (d.id === 'd-front') {                    // 현관문 (색 가정) + 도어락 L100 78×264×80
    b.box(MAT.frontDoor, 0.003, w - 0.003, -0.11, h, -0.022, 0.022);
    [-1, 1].forEach(sg => {
      b.box(MAT.black, w - 0.128, w - 0.05, 0.92, 1.184, sg > 0 ? 0.022 : -0.062, sg > 0 ? 0.062 : -0.022, { r: 0.008, cast: false });
      b.box(MAT.black, w - 0.21, w - 0.07, 0.955, 0.975, sg > 0 ? 0.07 : -0.09, sg > 0 ? 0.09 : -0.07, { r: 0.007, cast: false });
      b.cyl(MAT.black, 0.011, 0.011, 0.03, w - 0.089, 0.965, sg * 0.072, 'z', { cast: false });
    });
  } else {
    b.box(MAT.leaf, 0.003, w - 0.003, 0.008, h, -0.02, 0.02);
    lever(1); lever(-1);
  }
  const g = b.build(pivot, { kind: 'door', id: d.id });
  pickRoots.push(g);
  const ang = v => Math.atan2(-v[1], v[0]);
  let a0 = ang(d.closed), a1 = ang(d.open);
  if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
  if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
  pivot.rotation.y = a1;
  doorObjs.push({ d, pivot, a0, a1, cur: a1 });
});
