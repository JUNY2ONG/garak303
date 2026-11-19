// ===== 04 furniture: 가구 · 가전 (실제 크기) =====
const furn = new THREE.Group(); world.add(furn);
const fixedG = new THREE.Group(); world.add(fixedG);      // 가구를 꺼도 남는 것(가벽)
const furnGroups = {};
const clothesGroups = [];
MAT.mirror = M(0xe8eef1, { roughness: 0.04, metalness: 1, envMapIntensity: 1.5 });
const MATX = { fridgeSide: M(0xb9b6ae, { roughness: 0.5, metalness: 0.3 }), nsBody: M(0xe6dccb, { roughness: 0.6 }) };

// 기울인 둥근 상자 (소파 등받이 등): 중심 기준 X축 회전
function tiltBox(b, mat, x0, x1, h0, h1, y0, y1, r, tilt) {
  const W = CM(x1 - x0), Hh = CM(h1 - h0), D = CM(y1 - y0);
  const g = new THREE.RoundedBoxGeometry(W, Hh, D, 2, Math.min(CM(r), W / 2 - 1e-3, Hh / 2 - 1e-3, D / 2 - 1e-3));
  worldUV(g); g.rotateX(tilt); g.translate(CM((x0 + x1) / 2), CM((h0 + h1) / 2), CM((y0 + y1) / 2));
  b.geo(mat, g, { uv: false });
}

// (y, 높이) 평면에서 두 점 A→B를 잇는 기울어진 판. thick: 두께(위쪽으로), lift: 면에서 띄우기 (cm)
function segBox(b, mat, x0, x1, yA, hA, yB, hB, thick, lift, r) {
  if (yB < yA) { let t = yA; yA = yB; yB = t; t = hA; hA = hB; hB = t; }
  const dz = yB - yA, dy = hB - hA, L = Math.hypot(dz, dy), th = Math.atan2(-dy, dz), W = CM(x1 - x0);
  const rr = Math.min(CM(r || 0), W / 2 - 1e-3, CM(thick) / 2 - 1e-3, CM(L) / 2 - 1e-3);
  const g = rr > 0.002 ? new THREE.RoundedBoxGeometry(W, CM(thick), CM(L), 2, rr) : new THREE.BoxGeometry(W, CM(thick), CM(L));
  worldUV(g); g.rotateX(th);
  const off = (lift || 0) + thick / 2, ny = Math.cos(th), nz = Math.sin(th);
  g.translate(CM((x0 + x1) / 2), CM((hA + hB) / 2 + off * ny), CM((yA + yB) / 2 + off * nz));
  b.geo(mat, g, { uv: false });
}
// 앞면 방향(face)에 맞춘 좌표계: 가로 x(가운데 0), 깊이 z(뒤 0 → 앞 D), 높이 y. 단위 m
function faceFrame(poly, face) {
  const [x0, x1, y0, y1] = bboxOf(poly), m = new THREE.Matrix4();
  let W = x1 - x0, D = y1 - y0;
  if (face === 'S') m.makeTranslation(CM((x0 + x1) / 2), 0, CM(y0));
  else if (face === 'N') { m.makeRotationY(Math.PI); m.setPosition(CM((x0 + x1) / 2), 0, CM(y1)); }
  else if (face === 'E') { m.makeRotationY(Math.PI / 2); m.setPosition(CM(x0), 0, CM((y0 + y1) / 2)); W = y1 - y0; D = x1 - x0; }
  else { m.makeRotationY(-Math.PI / 2); m.setPosition(CM(x1), 0, CM((y0 + y1) / 2)); W = y1 - y0; D = x1 - x0; }
  return { m, W: CM(W), D: CM(D) };
}
const BUILD = {
  // 하부장: 걸레받이 15, 몸통 15~82, 상판 82~85 (+개수대 구멍)
  counter(f, b, [x0, x1, y0, y1]) {
    const S = f.face !== 'N', fy = S ? y1 : y0, o = S ? -1 : 1;       // o: 앞면에서 몸통 쪽 방향
    const bodyF = fy + o * 2, back = S ? y0 : y1;
    const ys = (a, c) => [Math.min(a, c), Math.max(a, c)];
    const [by0, by1] = ys(back, bodyF);
    const sk = f.sink;
    if (sk) {                                                        // 개수대 자리는 비워서 속이 보이게
      b.boxC(MAT.cab, x0, sk[0], 15, 82, by0, by1); b.boxC(MAT.cab, sk[2], x1, 15, 82, by0, by1);
      b.boxC(MAT.cab, sk[0], sk[2], 15, 82, by0, sk[1]); b.boxC(MAT.cab, sk[0], sk[2], 15, 82, sk[3], by1);
      b.boxC(MAT.cab, sk[0], sk[2], 15, 62, sk[1], sk[3]);
      const [ty0, ty1] = ys(back, fy - o * 1.5);
      b.boxC(MAT.top, x0, sk[0], 82, 85, ty0, ty1); b.boxC(MAT.top, sk[2], x1, 82, 85, ty0, ty1);
      b.boxC(MAT.top, sk[0], sk[2], 82, 85, ty0, sk[1]); b.boxC(MAT.top, sk[0], sk[2], 82, 85, sk[3], ty1);
    } else {
      b.boxC(MAT.cab, x0, x1, 15, 82, by0, by1);
      const [ty0, ty1] = ys(back, fy - o * 1.5);
      b.boxC(MAT.top, x0, x1, 82, 85, ty0, ty1);
    }
    const [t0, t1] = ys(back, fy + o * 7);
    let segs = [[x0 + 0.5, x1 - 0.5]];                                // 로봇청소기 스테이션 자리는 걸레받이를 비움
    H.furniture.filter(q => q.type === 'robot').forEach(q => {
      const [rx0, rx1, ry0, ry1] = bboxOf(q.poly);
      if (ry1 > y0 && ry0 < y1) segs = segs.flatMap(([a, c]) => (rx1 <= a || rx0 >= c ? [[a, c]] : [[a, rx0], [rx1, c]].filter(q2 => q2[1] - q2[0] > 0.5)));
    });
    segs.forEach(([a, c]) => b.boxC(MAT.toe, a, c, 0, 15, t0, t1, { cast: false }));
    const front = (a0, a1, h0, h1) => { const [q0, q1] = ys(fy, bodyF); b.boxC(MAT.cab, a0 + 0.15, a1 - 0.15, h0 + 0.15, h1 - 0.15, q0, q1, { cast: false }); };
    const handle = (cx, h) => { const [q0, q1] = ys(fy, fy - o * 2.4); b.boxC(MAT.handle, cx - 8, cx + 8, h - 0.5, h + 0.5, q0, q1, { r: 0.4, cast: false }); };
    (f.modules || []).forEach(([a, c, kind]) => {
      const m = (a + c) / 2;
      if (kind === 'drawer2') { front(a, c, 48.5, 82); front(a, c, 15, 48.5); handle(m, 77.5); handle(m, 44); }
      else if (kind === 'drawer3') { front(a, c, 59.5, 82); front(a, c, 37.2, 59.5); front(a, c, 15, 37.2); handle(m, 78); handle(m, 55.5); handle(m, 33.2); }
      else if (kind === 'door2') { front(a, m, 15, 82); front(m, c, 15, 82); handle(m - 10, 77.5); handle(m + 10, 77.5); }
      else if (kind === 'filler') front(a, c, 15, 82);
      else if (kind === 'pullout') { front(a, c, 15, 82); const [q0, q1] = ys(fy, fy - o * 2.4); b.boxC(MAT.handle, m - 0.5, m + 0.5, 62, 78, q0, q1, { r: 0.4, cast: false }); }
    });
  },
  upper(f, b, [x0, x1, y0, y1]) {                                    // 상부장 (미카도화이트, 손잡이 없는 문 가정)
    const h0 = f.h0 || 150;
    b.boxC(MAT.cabUp, x0, x1, h0, CEIL, y0, y1 - 1.9);
    const n = f.doors || 2, w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) b.boxC(MAT.cabUp, x0 + i * w + 0.15, x0 + (i + 1) * w - 0.15, h0 - (f.hood ? 0 : 1.2), CEIL - 0.3, y1 - 1.9, y1, { cast: false });
  },
  hood(f, b, [x0, x1, y0, y1]) {                                     // 상부장 내장 후드: 아래 슬림 판만 보임
    b.boxC(MAT.steelBrushed, x0 + 0.4, x1 - 0.4, 144.2, 150, y0, y1 - 0.6, { cast: false });
    b.boxC(MAT.hoodGlass, x0 + 0.4, x1 - 0.4, 143.6, 150, y1 - 0.6, y1, { cast: false });       // 검은 유리 앞판(조작부)
    b.boxC(MAT.steel, x0 + 3, x1 - 3, 143.6, 144.2, y0 + 3, y1 - 5, { cast: false });           // 필터 판
    b.boxC(MAT.chrome, x0 + 0.4, x1 - 0.4, 143.2, 143.9, y1 - 2.2, y1, { r: 0.3, cast: false }); // 아래 스틸 립
  },
  induction(f, b, [x0, x1, y0, y1]) {                                // 화이트 세라믹 글라스
    b.boxC(MAT.induction, x0, x1, 85, 85.6, y0, y1, { r: 0.25, cast: false });
    const ring = (cx, cy, r) => { const g = new THREE.RingGeometry(CM(r) - 0.0015, CM(r), 48); g.rotateX(-Math.PI / 2); g.translate(CM(cx), 0.8565, CM(cy)); b.geo(MAT.inductionMark, g, { cast: false }); };
    ring(x0 + 15, y0 + 15, 9.5); ring(x0 + 15, y0 + 36, 9.5); ring(x1 - 17, y0 + 22, 12);
    b.cyl(MAT.chrome, 0.021, 0.023, 0.016, CM((x0 + x1) / 2 + 8), 0.864, CM(y1 - 5), 'y', { cast: false });   // 다이얼
  },
  robot(f, b, [x0, x1, y0, y1]) {                                    // 걸레받이 속 스테이션 600×147×500
    b.boxC(MAT.lgBeige, x0 + 0.3, x1 - 0.3, 10.8, f.h, y0, y1, { r: 0.6, cast: false });
    b.boxC(MAT.lgBeige, x0 + 0.3, x0 + 2.2, 0.2, 10.8, y0, y1, { cast: false }); b.boxC(MAT.lgBeige, x1 - 2.2, x1 - 0.3, 0.2, 10.8, y0, y1, { cast: false });
    b.boxC(MAT.black, x0 + 2.2, x1 - 2.2, 0.2, 10.8, y0, y0 + 1, { cast: false });
    b.cyl(MAT.charcoal, 0.17, 0.17, 0.092, CM((x0 + x1) / 2), 0.05, CM(y1 - 19), 'y', { seg: 36, cast: false });   // 로봇 본체
    b.cyl(MAT.blackGloss, 0.05, 0.05, 0.012, CM((x0 + x1) / 2), 0.1, CM(y1 - 19), 'y', { cast: false });
  },
  dw(f, b, [x0, x1, y0, y1]) {                                       // 식기세척기 앞판 (베이지) + 위 조작부
    b.boxC(MAT.lgBeige, x0 + 0.2, x1 - 0.2, 15.2, 75.6, y1 - 2, y1, { r: 0.3, cast: false });
    b.boxC(MAT.blackGloss, x0 + 0.2, x1 - 0.2, 76, 81.8, y1 - 2, y1 - 0.2, { cast: false });
    b.boxC(MAT.black, x0 + 0.5, x1 - 0.5, 15, 81.8, y1 - 2.6, y1 - 2, { cast: false });
  },
  sink(f, b, [x0, x1, y0, y1]) {                                     // 언더 싱크볼 + 수전(모양 가정)
    const t = 0.8, d0 = 63;
    b.boxC(MAT.steelBrushed, x0, x1, d0, d0 + t, y0, y1, { cast: false });
    b.boxC(MAT.steelBrushed, x0, x0 + t, d0, 84.7, y0, y1, { cast: false }); b.boxC(MAT.steelBrushed, x1 - t, x1, d0, 84.7, y0, y1, { cast: false });
    b.boxC(MAT.steelBrushed, x0, x1, d0, 84.7, y0, y0 + t, { cast: false }); b.boxC(MAT.steelBrushed, x0, x1, d0, 84.7, y1 - t, y1, { cast: false });
    b.cyl(MAT.chrome, 0.045, 0.045, 0.004, CM((x0 + x1) / 2), CM(d0 + t) + 0.002, CM((y0 + y1) / 2), 'y', { cast: false });
    const fx = CM((x0 + x1) / 2), fz = CM(y0 - 3.6), R = 0.075;
    b.cyl(MAT.chrome, 0.024, 0.027, 0.02, fx, 0.86, fz, 'y');
    b.cyl(MAT.chrome, 0.012, 0.012, 0.27, fx, 0.985, fz, 'y');
    const arc = new THREE.TorusGeometry(R, 0.012, 10, 20, Math.PI); arc.rotateY(Math.PI / 2); arc.translate(fx, 1.12, fz + R); b.geo(MAT.chrome, arc);
    b.cyl(MAT.chrome, 0.012, 0.013, 0.05, fx, 1.095, fz + 2 * R, 'y');
    b.box(MAT.chrome, fx + 0.02, fx + 0.075, 0.905, 0.92, fz - 0.008, fz + 0.008, { r: 0.006 });
  },
  faucet(f, b) {                                                     // 정수기 파우셋 48×264×188 (개수대 쪽으로)
    const x = CM(f.at[0]), z = CM(f.at[1]);
    b.cyl(MAT.chrome, 0.024, 0.026, 0.225, x, 0.85 + 0.1125, z, 'y');
    b.box(MAT.chrome, x - 0.164, x + 0.024, 1.075, 1.114, z - 0.024, z + 0.024, { r: 0.018 });
    b.box(MAT.blackGloss, x - 0.15, x - 0.03, 1.1135, 1.1155, z - 0.017, z + 0.017, { cast: false });
    b.cyl(MAT.chrome, 0.012, 0.012, 0.022, x - 0.14, 1.066, z, 'y', { cast: false });
  },
  fridge(f, b, [x0, x1, y0, y1]) {                                   // 914×1860×709: 위 2문 + 아래 서랍 2단 (제품 사진 근사)
    const D = 5.2, fy = y1;
    b.boxC(MATX.fridgeSide, x0 + 0.3, x1 - 0.3, 5, f.h - 0.4, y0, fy - D - 0.6, { r: 0.4 });
    b.boxC(MAT.black, x0 + 4, x1 - 4, 0, 5, y0 + 6, fy - D - 4, { cast: false });
    b.boxC(MAT.charcoal, x0 + 1, x1 - 1, f.h - 0.4, f.h, y0 + 4, fy - 1, { cast: false });
    const cx = (x0 + x1) / 2, door = (a0, a1, h0, h1) => b.boxC(MAT.lgBeige, a0, a1, h0, h1, fy - D, fy, { r: 0.7 });
    door(x0, cx - 0.25, 76.5, f.h - 0.5); door(cx + 0.25, x1, 76.5, f.h - 0.5);
    door(x0, x1, 41.5, 75.9); door(x0, x1, 6, 40.9);
    b.boxC(MAT.black, x0 + 1, x1 - 1, 6, f.h - 1, fy - D - 0.6, fy - D, { cast: false });
  },
  washer(f, b, [x0, x1, y0, y1]) {                                   // 워시콤보 700×990×885: 문이 세탁실 문 쪽(북)
    b.boxC(MAT.charcoal, x0, x1, 2.5, f.h, y0 + 3, y1, { r: 1.2 });
    [[x0 + 5, y0 + 9], [x1 - 5, y0 + 9], [x0 + 5, y1 - 6], [x1 - 5, y1 - 6]].forEach(([x, y]) => b.cyl(MAT.black, 0.022, 0.022, 0.03, CM(x), 0.015, CM(y), 'y', { cast: false }));
    b.boxC(MAT.lgBeigeDark, x0 + 1.5, x1 - 1.5, 27.5, f.h - 1.5, y0, y0 + 3.2, { r: 1 });
    const cx = CM((x0 + x1) / 2), zf = CM(y0);
    b.cyl(MAT.charcoal, 0.235, 0.245, 0.05, cx, 0.6, zf - 0.02, 'z', { seg: 48 });
    b.cyl(MAT.chrome, 0.205, 0.205, 0.006, cx, 0.6, zf - 0.047, 'z', { seg: 48, cast: false });
    b.cyl(MAT.washDoor, 0.19, 0.175, 0.03, cx, 0.6, zf - 0.058, 'z', { seg: 48, cast: false });
    b.boxC(MAT.blackGloss, x0 + 20, x1 - 6, 88, 94.5, y0 - 0.25, y0, { cast: false });          // 표시창
    b.cyl(MAT.chrome, 0.03, 0.03, 0.014, CM(x0 + 11), 0.913, zf - 0.007, 'z', { cast: false }); // 다이얼
    b.boxC(MAT.lgBeigeDark, x0 + 1.5, x1 - 1.5, 3.5, 25.5, y0, y0 + 3.2, { r: 1 });             // 아래 미니 세탁 서랍
    b.boxC(MAT.charcoal, x0 + 16, x1 - 16, 20.5, 22.5, y0 - 0.35, y0, { r: 0.3, cast: false });
  },
  tv(f, b, [x0, x1, y0, y1]) {                                       // 1716.6×984.1×11.2 벽걸이
    b.boxC(MAT.tvBody, x0, x1, f.h0, f.h1, y0, y1, { r: 0.25 });
    b.boxC(MAT.tvScreen, x0 + 0.5, x1 - 0.5, f.h0 + 0.5, f.h1 - 0.5, y0 - 0.12, y0, { cast: false });
    b.boxC(MAT.black, (x0 + x1) / 2 - 22, (x0 + x1) / 2 + 22, f.h0 + 30, f.h1 - 30, y1, 355, { cast: false });
  },
  sofa(f, b, [x0, x1, y0, y1], open) {                               // 포지 리클라이너 1970×1130×1000 (제품 사진 기준, 좌석 2분할)
    const AW = 22, s0 = x0 + AW, s1 = x1 - AW, mid = (s0 + s1) / 2, S = MAT.sofa, ST = MAT.sofaSeam;
    [[x0 + 4, y0 + 9, -1, -1], [x1 - 4, y0 + 9, 1, -1], [x0 + 4, y1 - 9, -1, 1], [x1 - 4, y1 - 9, 1, 1]].forEach(([x, y, sx, sy]) => {   // 가늘고 비스듬한 다크 메탈 다리
      const g = new THREE.CylinderGeometry(0.011, 0.006, 0.17, 8); g.rotateZ(sx * 0.3); g.rotateX(-sy * 0.3); g.translate(CM(x) + sx * 0.012, 0.08, CM(y) + sy * 0.012); b.geo(MAT.frameDark2, g);
    });
    b.boxC(MAT.black, s0 + 2, s1 - 2, 5, 16, y0 + 22, y1 - 18, { r: 2 });                              // 리클라이너 메커니즘
    [mid - 38, mid + 38].forEach(cx => { const g = new THREE.SphereGeometry(0.22, 16, 10); g.scale(1, 0.32, 0.9); g.translate(CM(cx), 0.09, CM(y1 - 34)); b.geo(MAT.black, g); });
    b.boxC(S, x0 + 8, x1 - 8, 16, 70, y0, y0 + 12, { r: 5 });                                         // 뒤판
    [[x0, 1], [x1 - AW, -1]].forEach(([a0, sg]) => {                                                  // 바깥으로 말린 팔걸이
      b.boxC(S, a0 + (sg > 0 ? 1.5 : 0), a0 + AW - (sg > 0 ? 0 : 1.5), 12, 55, y0 + 6, y1 - 3, { r: 8, seg: 3 });
      b.boxC(S, a0 + (sg > 0 ? 0 : -3), a0 + AW + (sg > 0 ? 3 : 0), 48.5, 63, y0 + 13, y1 - 0.5, { r: 7, seg: 4 });
      b.boxC(ST, a0 + (sg > 0 ? 0.6 : -2.4), a0 + AW + (sg > 0 ? 2.4 : -0.6), 48.1, 48.6, y0 + 16, y1 - 4, { cast: false });   // 파이핑
      const bx = sg > 0 ? a0 + 1.1 : a0 + AW - 1.9;
      b.boxC(MAT.blackGloss, bx, bx + 0.8, 35, 39.5, y1 - 42, y1 - 34, { r: 0.3, cast: false });
    });
    [[s0, mid - 0.3, true], [mid + 0.3, s1, false]].forEach(([a0, a1, canOpen]) => {
      const op = open && canOpen, c = (a0 + a1) / 2;
      b.boxC(S, a0 + 0.2, a1 - 0.2, 27, 47, y0 + 36, y1 - 9, { r: 6.5, seg: 4 });                      // 방석
      b.boxC(ST, c - 0.18, c + 0.18, 46.9, 47.15, y0 + 44, y1 - 15, { cast: false });                  // 가운데 스티치
      b.boxC(ST, a0 + 5, a1 - 5, 46.9, 47.12, y1 - 15.3, y1 - 15, { cast: false });
      if (!op) {
        b.boxC(S, a0 + 0.2, a1 - 0.2, 15, 45.5, y1 - 13.5, y1 - 0.3, { r: 5.5, seg: 4 });              // 접힌 발받침 (앞판)
        b.boxC(ST, c - 0.18, c + 0.18, 20, 42, y1 - 0.35, y1 - 0.12, { cast: false });
        tiltBox(b, S, a0 + 0.4, a1 - 0.4, 41, 85, y0 + 12, y0 + 38, 9.5, -0.17);                       // 등판
        tiltBox(b, ST, c - 0.18, c + 0.18, 48, 80, y0 + 37.9, y0 + 38.25, 0, -0.17);
        tiltBox(b, S, a0 + 1, a1 - 1, 76, 100.5, y0 + 3, y0 + 26, 10.5, -0.08);                        // 둥글게 말린 헤드레스트
      } else {                                                                                         // 리클라이닝: 등판 눕고 헤드레스트 앞으로, 발받침 나옴
        segBox(b, S, a0 + 0.4, a1 - 0.4, y0 + 42, 41, y0 + 10, 76, 17, 0, 8);
        segBox(b, S, a0 + 1, a1 - 1, y0 + 20, 80, y0 + 12, 103, 13, 3, 6);
        b.boxC(S, a0 + 0.2, a1 - 0.2, 38.5, 47, y1 - 10, y1 + 40, { r: 4, seg: 3 });
        b.boxC(ST, c - 0.18, c + 0.18, 46.9, 47.15, y1 - 6, y1 + 36, { cast: false });
        b.boxC(S, a0 + 3, a1 - 3, 16, 24, y1 + 4, y1 + 36, { r: 3.5, seg: 3 });                         // 아래 보조 패드
        [a0 + 10, a1 - 10].forEach(x => { segBox(b, MAT.black, x - 0.8, x + 0.8, y1 - 14, 14, y1 + 26, 36, 1.4, 0, 0); segBox(b, MAT.black, x - 0.8, x + 0.8, y1 - 2, 30, y1 + 18, 20, 1.4, 0, 0); });
      }
    });
    tiltBox(b, MATX.fabBeige, s0 + 6, s0 + 50, 46, 90, y0 + (open ? 44 : 39), y0 + (open ? 57 : 52), 5.8, open ? -0.55 : -0.3);   // 쿠션 2개 (분위기용)
    tiltBox(b, MATX.fabIvory, s0 + 24, s0 + 66, 46, 76, y0 + (open ? 58 : 52), y0 + (open ? 70 : 64), 5.2, open ? -0.6 : -0.38);
  },
  cabinet(f, b, [x0, x1, y0, y1]) {                                  // 붙박이 수납장 (문이 face 쪽, 모양 가정)
    b.boxC(MAT.cream, x0, x1, 0, f.h, y0, y1 - 2);
    const cx = (x0 + x1) / 2;
    b.boxC(MAT.cream, x0 + 0.2, cx - 0.15, 6, f.h - 0.4, y1 - 2, y1, { cast: false }); b.boxC(MAT.cream, cx + 0.15, x1 - 0.2, 6, f.h - 0.4, y1 - 2, y1, { cast: false });
    b.boxC(MAT.seamDark, x0, x1, 0, 6, y1 - 4, y1 - 3.6, { cast: false });
    [-2.2, 2.2].forEach(dx => b.boxC(MAT.handle, cx + dx - 0.5, cx + dx + 0.5, 95, 125, y1, y1 + 2.2, { r: 0.4, cast: false }));
  },
  bed(f, b, [x0, x1, y0, y1], open) {                                // 모션베드 2200×2000: 전동 베이스 2 + 매트리스 2 (머리 = 아래쪽 벽)
    const mid = (x0 + x1) / 2, HB = 8, by1 = y1 - HB, hh = f.headH || 100, T = f.h - 31;
    b.boxC(MAT.headboard, x0 - 1, x1 + 1, 0, hh, by1, y1, { r: 2.5 });
    [0.25, 0.5, 0.75].forEach(k => b.boxC(MAT.bedBase, x0 + (x1 - x0) * k - 0.25, x0 + (x1 - x0) * k + 0.25, 34, hh - 4, by1 - 0.25, by1, { cast: false }));   // 헤드보드 박음선
    [[x0, mid - 0.5, false], [mid + 0.5, x1, true]].forEach(([a0, a1, canOpen]) => {
      const op = open && canOpen, pc = (a0 + a1) / 2;
      [[a0 + 7, y0 + 9], [a1 - 7, y0 + 9], [a0 + 7, (y0 + by1) / 2], [a1 - 7, (y0 + by1) / 2], [a0 + 7, by1 - 10], [a1 - 7, by1 - 10]].forEach(([x, y]) => { b.cyl(MAT.steelBrushed, 0.019, 0.016, 0.12, CM(x), 0.06, CM(y), 'y'); });
      b.boxC(MAT.bedBase, a0 + 1, a1 - 1, 12, 28, y0 + 1, by1, { r: 1.5 });                           // 전동 베이스 프레임
      b.boxC(MAT.black, a0 + 12, a1 - 12, 6, 12, y0 + 60, by1 - 50, { cast: false });                 // 모터부
      [[pc - 26], [pc + 26]].forEach(([x]) => b.cyl(MAT.chrome, 0.006, 0.006, 0.2, CM(x), 0.38, CM(y0 + 0.8), 'y'));   // 매트리스 고정 바
      b.cyl(MAT.chrome, 0.006, 0.006, 0.52, CM(pc), 0.48, CM(y0 + 0.8), 'x');
      // 등판 78 · 엉덩이 28 · 허벅지 36 · 종아리 나머지
      const yH = by1 - 78, yS = yH - 28;
      const P = op ? [[by1 - 14, 31 + 45], [yH, 31], [yS, 31], [yS - 34, 31 + 12], [y0 + 3, 31 + 5]] : [[by1, 31], [yH, 31], [yS, 31], [yS - 36, 31], [y0, 31]];
      for (let i = 0; i < 4; i++) {
        segBox(b, MAT.seamDark, a0 + 1.5, a1 - 1.5, P[i][0], P[i][1] - 3, P[i + 1][0], P[i + 1][1] - 3, 3, 0, 0);          // 상판(데크)
        segBox(b, MAT.mattress, a0, a1, P[i][0] + (i ? 0.3 : 0), P[i][1], P[i + 1][0] - (i < 3 ? 0.3 : 0), P[i + 1][1], T, 0, i === 0 || i === 3 ? 5 : 3);
      }
      if (op) {
        segBox(b, MAT.linen, pc - 31, pc + 31, P[0][0] - 6, P[0][1] - 6 * 45 / 64, P[0][0] - 40, P[0][1] - 40 * 45 / 64, 12, T - 1, 6);     // 베개
        segBox(b, MAT.duvet, a0 - 0.5, a1 + 2.5, P[2][0] + 4, P[2][1], P[3][0], P[3][1], 6, T - 0.5, 3);
        segBox(b, MAT.duvet, a0 - 0.5, a1 + 2.5, P[3][0], P[3][1], P[4][0] - 3, P[4][1], 6, T - 0.5, 3);
        b.boxC(MAT.duvet, a1 - 1, a1 + 2.5, 34, 31 + 12 + T, y0 - 1, yS + 4, { r: 1.5 });
      } else {
        tiltBox(b, MAT.linen, pc - 31, pc + 31, f.h - 1, f.h + 13, by1 - 46, by1 - 4, 6.5, 0.1);       // 베개
        const dx0 = canOpen ? a0 - 0.5 : a0 - 2.5, dx1 = canOpen ? a1 + 2.5 : a1 + 0.5;
        if (!open) { if (!canOpen) { b.boxC(MAT.duvet, x0 - 2.5, x1 + 2.5, 36, f.h + 5.5, y0 - 2, by1 - 62, { r: 5, seg: 3 }); b.boxC(MAT.linen, x0 - 2.6, x1 + 2.6, f.h + 3, f.h + 7.5, by1 - 78, by1 - 56, { r: 2.2 }); } }
        else { b.boxC(MAT.duvet, dx0, dx1, 36, f.h + 5.5, y0 - 2, by1 - 62, { r: 5, seg: 3 }); b.boxC(MAT.linen, dx0 - 0.1, dx1 + 0.1, f.h + 3, f.h + 7.5, by1 - 78, by1 - 56, { r: 2.2 }); }
      }
    });
  },
  nightstand(f, b, [x0, x1, y0, y1]) {                               // 협탁: 오크 원형 + 아래 선반 + 작은 무드등 (디자인 제안)
    const cx = CM((x0 + x1) / 2), cz = CM((y0 + y1) / 2), R = CM((x1 - x0) / 2), h = CM(f.h);
    b.cyl(MAT.leaf, R, R - 0.01, 0.025, cx, h - 0.0125, cz, 'y', { seg: 40 }); b.cyl(MAT.leaf, R - 0.035, R - 0.04, 0.018, cx, 0.2, cz, 'y', { seg: 40 });
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; b.cyl(MAT.leaf, 0.014, 0.011, h - 0.02, cx + Math.cos(a) * (R - 0.045), (h - 0.02) / 2, cz + Math.sin(a) * (R - 0.045), 'y', { seg: 10 }); }
    b.cyl(MAT.white, 0.035, 0.04, 0.03, cx, h + 0.015, cz - 0.03, 'y');
    const g = new THREE.SphereGeometry(0.07, 20, 14); g.translate(cx, h + 0.09, cz - 0.03); b.geo(MATX.shade, g, { cast: false });
  },
  shoe(f, b, [x0, x1, y0, y1]) {                                     // 천장까지 붙박이, 아래 25 띄움. 문은 현관 쪽(서쪽)
    b.boxC(MAT.cream, x0 + 2, x1, f.h0, CEIL, y0, y1);
    const n = 3, w = (y1 - y0) / n;
    for (let i = 0; i < n; i++) b.boxC(MAT.cream, x0, x0 + 2, f.h0 + 0.2, CEIL - 0.4, y0 + i * w + 0.15, y0 + (i + 1) * w - 0.15, { cast: false });
    b.boxC(MAT.seamDark, x0 + 2, x0 + 2.4, f.h0, CEIL, y0, y1, { cast: false });
  },
  bath(f, b, [x0, x1, y0, y1]) {
    const t = 5;
    b.boxC(MAT.porcelain, x0, x1, 0, 14, y0, y1); b.boxC(MAT.porcelain, x0, x1, 14, f.h, y0, y0 + t, { r: 1.5 }); b.boxC(MAT.porcelain, x0, x1, 14, f.h, y1 - t, y1, { r: 1.5 });
    b.boxC(MAT.porcelain, x0, x0 + t, 14, f.h, y0, y1, { r: 1.5 }); b.boxC(MAT.porcelain, x1 - t, x1, 14, f.h, y0, y1, { r: 1.5 });
  },
  basin(f, b, [x0, x1, y0, y1]) {
    b.boxC(MAT.porcelain, x0, x1, 72, 86, y0, y1, { r: 4, seg: 3 });
    b.boxC(MAT.porcelain, x0 + 9, x1, 0, 72, y0 + 12, y1 - 12, { r: 3 });
    b.cyl(MAT.chrome, 0.012, 0.012, 0.12, CM(x1 - 5), 0.92, CM((y0 + y1) / 2), 'y');
  },
  toilet(f, b) {                                                     // face 'W': 물탱크가 오른쪽 벽, 앞이 왼쪽
    const [x, y] = f.at, W = f.face === 'W';
    if (W) b.boxC(MAT.porcelain, x + 18, x + 36, 36, 80, y - 19, y + 19, { r: 3 }); else b.boxC(MAT.porcelain, x - 18, x + 18, 36, 80, y - 34, y - 17, { r: 3 });
    const cx = W ? x - 4 : x, cy = W ? y : y + 5, sx = W ? 1.3 : 1, sz = W ? 1 : 1.3;
    const bowl = new THREE.CylinderGeometry(0.185, 0.13, 0.4, 28); bowl.scale(sx, 1, sz); bowl.translate(CM(cx), 0.2, CM(cy)); b.geo(MAT.porcelain, bowl);
    const lid = new THREE.CylinderGeometry(0.19, 0.19, 0.03, 28); lid.scale(sx, 1, sz); lid.translate(CM(cx), 0.415, CM(cy)); b.geo(MAT.porcelain, lid);
  },
  fridgecase(f, b, [x0, x1, y0, y1]) {                               // 냉장고장 (목공): 옆판 + 위 막음
    const [ix0, ix1, top] = f.inner;
    b.boxC(MAT.cabUp, x0, ix0, 0, CEIL, y0, y1); b.boxC(MAT.cabUp, ix1, x1, 0, CEIL, y0, y1);
    b.boxC(MAT.cabUp, ix0, ix1, top, CEIL, y0, y1);
  },
  tall(f, b, [x0, x1, y0, y1]) {                                     // 흰색 키큰장 + 가로로 긴 오픈 칸(안쪽 우드). 앞면 = 북쪽(y0)
    const [n0, n1] = f.niche, F = y0, B0 = y0 + 2, n = 3, w = 60, xs = (x0 + x1) / 2 - 90;
    b.boxC(MAT.toe, x0 + 0.5, x1 - 0.5, 0, 6, y0 + 6, y1, { cast: false });
    b.boxC(MAT.cabUp, x0, x1, 6, n0, B0, y1); b.boxC(MAT.cabUp, x0, x1, n1, CEIL, B0, y1);
    b.boxC(MAT.cabUp, x0, x0 + 2, n0, n1, F, y1); b.boxC(MAT.cabUp, x1 - 2, x1, n0, n1, F, y1);
    b.boxC(MAT.leaf, x0 + 2, x1 - 2, n0, n1, y1 - 2.5, y1, { cast: false });                          // 오픈 칸 안쪽: 우드
    b.boxC(MAT.leaf, x0 + 2, x1 - 2, n0, n0 + 0.6, F, y1 - 2.5, { cast: false }); b.boxC(MAT.leaf, x0 + 2, x1 - 2, n1 - 0.6, n1, F + 0.3, y1 - 2.5, { cast: false });
    b.boxC(MAT.leaf, x0 + 2, x0 + 2.6, n0, n1, F + 0.3, y1 - 2.5, { cast: false }); b.boxC(MAT.leaf, x1 - 2.6, x1 - 2, n0, n1, F + 0.3, y1 - 2.5, { cast: false });
    for (let i = 0; i < n; i++) {
      b.boxC(MAT.cabUp, xs + i * w + 0.15, xs + (i + 1) * w - 0.15, 6.3, n0 - 0.15, F, B0, { cast: false });
      b.boxC(MAT.cabUp, xs + i * w + 0.15, xs + (i + 1) * w - 0.15, n1 + 0.15, CEIL - 0.3, F, B0, { cast: false });
    }
    [[x0, xs], [xs + 180, x1]].forEach(([a, c]) => { b.boxC(MAT.cabUp, a, c - 0.15, 6.3, n0 - 0.15, F + 0.3, B0, { cast: false }); b.boxC(MAT.cabUp, a, c - 0.15, n1 + 0.15, CEIL - 0.3, F + 0.3, B0, { cast: false }); });   // 필러
  },
  ltable(f, b, [x0, x1, y0, y1]) {                                   // 무인양품 호두나무 리빙 다이닝 테이블 2: 130×65×60
    b.boxC(MAT.walnut, x0, x1, f.h - 3, f.h, y0, y1, { r: 0.6 });
    b.boxC(MAT.walnut, x0 + 5, x1 - 5, f.h - 9, f.h - 3, y0 + 4, y0 + 6.2); b.boxC(MAT.walnut, x0 + 5, x1 - 5, f.h - 9, f.h - 3, y1 - 6.2, y1 - 4);
    b.boxC(MAT.walnut, x0 + 4, x0 + 6.2, f.h - 9, f.h - 3, y0 + 5, y1 - 5, { swap: true }); b.boxC(MAT.walnut, x1 - 6.2, x1 - 4, f.h - 9, f.h - 3, y0 + 5, y1 - 5, { swap: true });
    [[x0 + 2, y0 + 2], [x1 - 7, y0 + 2], [x0 + 2, y1 - 7], [x1 - 7, y1 - 7]].forEach(([x, y]) => b.boxC(MAT.walnut, x, x + 5, 0, f.h - 3, y, y + 5, { r: 0.6 }));
  },
  stable(f, b, [x0, x1, y0, y1]) {                                   // 사이드 테이블 (디자인 가정): 호두나무 원형 상판 + 블랙 스틸
    const cx = CM((x0 + x1) / 2), cz = CM((y0 + y1) / 2), R = CM((x1 - x0) / 2), h = CM(f.h);
    b.cyl(MAT.walnut, R, R - 0.012, 0.022, cx, h - 0.011, cz, 'y', { seg: 48 });
    b.cyl(MAT.black, 0.011, 0.011, h - 0.03, cx, (h - 0.03) / 2 + 0.008, cz, 'y');
    b.cyl(MAT.black, 0.14, 0.15, 0.012, cx, 0.006, cz, 'y', { seg: 40 });
    b.cyl(MAT.walnut, 0.115, 0.105, 0.016, cx, 0.26, cz, 'y', { seg: 40 });
  },
  panel(f, b, [x0, x1, y0, y1]) { b.boxC(MAT.wall, x0, x1, -12, f.h, y0, y1); },
};

Object.assign(MATX, {
  fabBeige: M(0xcdbfa8, { roughness: 0.95, bumpMap: TEX.weave, bumpScale: 0.002, envMapIntensity: 0.3 }),
  fabIvory: M(0xe6dfd0, { roughness: 0.95, bumpMap: TEX.noise, bumpScale: 0.003, envMapIntensity: 0.3 }),
  rugIvory: M(0xffffff, { map: TEX.rug, bumpMap: TEX.rugB, bumpScale: 0.006, roughness: 1, envMapIntensity: 0.2 }),
  curtain: M(0xf4f0e8, { roughness: 1, side: THREE.DoubleSide, envMapIntensity: 0.3, transparent: true, opacity: 0.9 }),
  fabGray: M(0x8f9194, { roughness: 0.95, bumpMap: TEX.weave, bumpScale: 0.002, envMapIntensity: 0.3 }),
  rugBeige: M(0xd8cdb9, { roughness: 1, bumpMap: TEX.weave, bumpScale: 0.004, envMapIntensity: 0.2 }),
  rugGray: M(0xa9a9a6, { roughness: 1, bumpMap: TEX.weave, bumpScale: 0.004, envMapIntensity: 0.2 }),
  leafGreen: M(0x5f7d4f, { roughness: 0.7 }), pot: M(0xe8e2d6, { roughness: 0.8 }), soil: M(0x4a3a2c, { roughness: 1 }),
  shade: M(0xfff1d6, { roughness: 0.9, emissive: 0xffd9a0, emissiveIntensity: 0.9 }),
  led: new THREE.MeshBasicMaterial({ color: 0xffe2b0 }), mat: M(0x4b4d50, { roughness: 0.95 }), paper: M(0xf3efe6, { roughness: 0.9 }),
  books: [0x9c4a3c, 0x3f5568, 0xd9c9a8, 0x6f7f62, 0x2e3238, 0xc8a15a, 0xe9e4da, 0x7a5a48].map(c => M(c, { roughness: 0.85, envMapIntensity: 0.3 })),
  art: [0xc9a27e, 0x8ea3a0, 0xd8b8a0].map(c => M(c, { roughness: 0.9 })),
});
MATX.led.toneMapped = false;
const WOOD = w => (w === 'walnut' ? MAT.walnut : MAT.leaf);
const decoRand = rng(1234);
function putBooks(b, x0, x1, y, z0, depth) {                          // 책 한 줄 (가끔 비우거나 눕힘)
  let x = x0 + 0.01;
  while (x < x1 - 0.05) {
    const k = decoRand();
    if (k < 0.12) { x += 0.06 + decoRand() * 0.08; continue; }
    const w = 0.02 + decoRand() * 0.028, h = 0.17 + decoRand() * 0.09, d = Math.min(depth - 0.03, 0.14 + decoRand() * 0.06);
    b.box(MATX.books[Math.floor(decoRand() * MATX.books.length)], x, x + w, y, y + h, z0 + 0.012, z0 + 0.012 + d, { cast: false });
    x += w + 0.002;
  }
}
function putPlant(b, x, y, z, s) {                                    // 화분
  b.cyl(MATX.pot, 0.07 * s, 0.05 * s, 0.11 * s, x, y + 0.055 * s, z, 'y', { seg: 20 });
  b.cyl(MATX.soil, 0.062 * s, 0.062 * s, 0.006, x, y + 0.108 * s, z, 'y', { seg: 20, cast: false });
  for (let i = 0; i < 13; i++) {
    const a = i * 2.4, r = (0.03 + 0.06 * decoRand()) * s, hh = (0.14 + 0.24 * decoRand()) * s;
    const g = new THREE.SphereGeometry(0.05 * s, 8, 6); g.scale(0.7, 1.35, 0.1); g.rotateX(0.55 + 0.4 * decoRand()); g.rotateY(Math.PI / 2 - a); g.translate(x + Math.cos(a) * r, y + 0.1 * s + hh, z + Math.sin(a) * r); b.geo(MATX.leafGreen, g);
    b.cyl(MATX.leafGreen, 0.004, 0.004, hh, x + Math.cos(a) * r * 0.5, y + 0.1 * s + hh / 2, z + Math.sin(a) * r * 0.5, 'y', { seg: 5, cast: false });
  }
}
function putLamp(b, x, y, z) {                                        // 탁상 스탠드 (버섯형)
  b.cyl(MAT.steelBrushed, 0.055, 0.06, 0.012, x, y + 0.006, z, 'y'); b.cyl(MAT.steelBrushed, 0.008, 0.008, 0.2, x, y + 0.11, z, 'y');
  const g = new THREE.SphereGeometry(0.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.75, 1); g.translate(x, y + 0.2, z); b.geo(MATX.shade, g, { cast: false });
}
function putFrame(b, x0, x1, y0, y1, z, art) {
  b.box(MAT.leaf, x0, x1, y0, y1, z, z + 0.018, { cast: false }); b.box(MATX.paper, x0 + 0.012, x1 - 0.012, y0 + 0.012, y1 - 0.012, z + 0.018, z + 0.02, { cast: false });
  const mx = (x1 - x0) * 0.22, my = (y1 - y0) * 0.22; b.box(MATX.art[art % 3], x0 + mx, x1 - mx, y0 + my, y1 - my, z + 0.02, z + 0.021, { cast: false });
}
function putMonitor(b, x, z, dir) {                                   // 32인치 (약 71.4 × 42), dir: 화면 방향 ±1
  b.box(MAT.black, x - 0.12, x + 0.12, 0.72, 0.732, z - 0.09, z + 0.09, { r: 0.004 }); b.box(MAT.black, x - 0.025, x + 0.025, 0.73, 0.98, z - 0.01, z + 0.01);
  b.box(MAT.tvBody, x - 0.357, x + 0.357, 0.82, 1.24, z + dir * 0.012, z + dir * 0.045, { r: 0.006 });
  b.box(MAT.tvScreen, x - 0.35, x + 0.35, 0.83, 1.233, z + dir * 0.045, z + dir * 0.047, { cast: false });
}
function putSeatKit(b, x, zFront, dir) {                              // 데스크 매트 + 키보드 + 마우스
  const z0 = zFront - dir * 0.05, z1 = zFront - dir * 0.36;
  b.box(MATX.mat, x - 0.4, x + 0.4, 0.72, 0.723, Math.min(z0, z1), Math.max(z0, z1), { cast: false });
  const k0 = zFront - dir * 0.12, k1 = zFront - dir * 0.25; b.box(MAT.white, x - 0.2, x + 0.14, 0.723, 0.738, Math.min(k0, k1), Math.max(k0, k1), { r: 0.004, cast: false });
  const m0 = zFront - dir * 0.14, m1 = zFront - dir * 0.24; b.box(MAT.white, x + 0.22, x + 0.28, 0.723, 0.752, Math.min(m0, m1), Math.max(m0, m1), { r: 0.012, cast: false });
}
const BUILD_F = {
  desk2(f, b, W, D) {                                                // 원목 일체형 상판 + 블랙 스틸 다리 (제안)
    const wood = WOOD(f.wood), L = -W / 2, R = W / 2;
    b.box(wood, L, R, 0.685, 0.72, 0, D, { r: 0.006, swap: true });
    const legs = W > 2.2 ? [L + 0.06, 0, R - 0.06] : [L + 0.06, R - 0.06];
    legs.forEach(x => { if (x === 0 && (f.pedestal != null || f.double)) return; b.box(MAT.black, x - 0.02, x + 0.02, 0, 0.685, 0.06, 0.1); b.box(MAT.black, x - 0.02, x + 0.02, 0, 0.685, D - 0.1, D - 0.06); b.box(MAT.black, x - 0.02, x + 0.02, 0.645, 0.685, 0.1, D - 0.1); b.box(MAT.black, x - 0.02, x + 0.02, 0, 0.03, 0.1, D - 0.1); });
    if (f.double) { b.box(MAT.black, -0.25, 0.25, 0.56, 0.6, D / 2 - 0.06, D / 2 + 0.06, { cast: false }); f.seats.forEach(x => { const sx = CM(x); putMonitor(b, sx, D / 2 + 0.11, 1); putMonitor(b, sx, D / 2 - 0.11, -1); putSeatKit(b, sx, D, 1); putSeatKit(b, sx, 0, -1); }); }
    else {
      b.box(MAT.black, L + 0.12, R - 0.12, 0.58, 0.62, 0.03, 0.15, { cast: false });               // 케이블 트레이 (멀티탭)
      f.seats.forEach(x => { putMonitor(b, CM(x), 0.2, 1); putSeatKit(b, CM(x), D, 1); });
    }
    if (f.pedestal != null) { const x = CM(f.pedestal); b.box(MAT.white, x - 0.2, x + 0.2, 0.04, 0.6, 0.08, D - 0.06, { r: 0.004 }); [0.05, 0.24, 0.42].forEach(y => b.box(MAT.white, x - 0.197, x + 0.197, y, y + 0.175, D - 0.06, D - 0.045, { cast: false })); [[-0.15, 0.12], [0.15, 0.12], [-0.15, D - 0.1], [0.15, D - 0.1]].forEach(([dx, z]) => b.cyl(MAT.black, 0.02, 0.02, 0.04, x + dx, 0.02, z, 'x', { seg: 10 })); }
    if (f.lamp != null) putLamp(b, CM(f.lamp), 0.72, f.double ? D / 2 : 0.2);
    if (f.plant != null) putPlant(b, CM(f.plant), 0.72, f.double ? D / 2 : 0.18, 0.75);
  },
  chair(f, b) {                                                      // 패브릭 의자 + 5발 캐스터 (모양 가정). 앞 = +z
    const fab = f.tone === 'beige' ? MATX.fabBeige : f.tone === 'gray' ? MATX.fabGray : MAT.bedBase, fr = f.tone === 'beige' ? MAT.white : MAT.black;
    for (let i = 0; i < 5; i++) { const g = new THREE.BoxGeometry(0.04, 0.025, 0.3); g.translate(0, 0.065, 0.15); g.rotateY(i * Math.PI * 2 / 5); b.geo(fr, g); const c = new THREE.CylinderGeometry(0.028, 0.028, 0.03, 12); c.rotateZ(Math.PI / 2); c.translate(0, 0.028, 0.28); c.rotateY(i * Math.PI * 2 / 5); b.geo(MAT.black, c); }
    b.cyl(MAT.steelBrushed, 0.022, 0.028, 0.34, 0, 0.24, 0, 'y');
    b.box(fr, -0.2, 0.2, 0.4, 0.425, -0.18, 0.2, { r: 0.01 });
    b.box(fab, -0.24, 0.24, 0.42, 0.5, -0.22, 0.25, { r: 0.038, seg: 3 });
    const bk = new THREE.RoundedBoxGeometry(0.45, 0.5, 0.07, 3, 0.034); worldUV(bk); bk.rotateX(0.14); bk.translate(0, 0.77, -0.25); b.geo(fab, bk, { uv: false });
    const sh = new THREE.RoundedBoxGeometry(0.4, 0.44, 0.02, 2, 0.009); worldUV(sh); sh.rotateX(0.14); sh.translate(0, 0.765, -0.292); b.geo(fr, sh, { uv: false });
    b.box(fr, -0.03, 0.03, 0.42, 0.6, -0.3, -0.26);
    [-1, 1].forEach(sg => { b.box(fr, sg * 0.27 - 0.012, sg * 0.27 + 0.012, 0.44, 0.66, -0.02, 0.01); b.box(fr, sg * 0.27 - 0.03, sg * 0.27 + 0.03, 0.655, 0.68, -0.12, 0.13, { r: 0.01 }); });
  },
  bookcase(f, b, W, D) {                                             // 원목 오픈 책장 + 책·소품
    const wood = WOOD(f.wood), h = CM(f.h), n = 5, L = -W / 2, R = W / 2, cols = W > 1.05 ? 2 : 1;
    b.box(wood, L, L + 0.022, 0, h, 0, D); b.box(wood, R - 0.022, R, 0, h, 0, D); b.box(MAT.cabUp, L + 0.022, R - 0.022, 0.06, h, 0, 0.01, { cast: false });
    if (cols === 2) b.box(wood, -0.011, 0.011, 0.06, h, 0.01, D - 0.01);
    for (let i = 0; i <= n; i++) {
      const y = i === n ? h : 0.08 + (h - 0.08) * i / n; b.box(wood, L + 0.022, R - 0.022, y - 0.022, y, 0.01, D, { swap: true });
      if (i === n) break;
      for (let c = 0; c < cols; c++) {
        const x0 = cols === 2 ? (c ? 0.011 : L + 0.022) : L + 0.022, x1 = cols === 2 ? (c ? R - 0.022 : -0.011) : R - 0.022, k = decoRand();
        if (i === 0) { b.box(MATX.fabBeige, x0 + 0.03, x1 - 0.03, y, y + 0.24, 0.03, D - 0.03, { r: 0.012 }); continue; }   // 맨 아래: 수납 박스
        if (k < 0.2) putPlant(b, (x0 + x1) / 2, y, D / 2, 0.7); else if (k < 0.36) putFrame(b, (x0 + x1) / 2 - 0.1, (x0 + x1) / 2 + 0.1, y, y + 0.26, 0.04, i);
        else putBooks(b, x0, x0 + (x1 - x0) * (0.55 + 0.45 * decoRand()), y, 0, D);
      }
    }
  },
  sideboard(f, b, W, D) {                                            // 낮은 수납장: 화이트 몸통 + 원목 상판·다리
    const wood = WOOD(f.wood), h = CM(f.h), L = -W / 2, R = W / 2, n = Math.max(2, Math.round(W / 0.6));
    [[L + 0.06, 0.06], [R - 0.06, 0.06], [L + 0.06, D - 0.06], [R - 0.06, D - 0.06]].forEach(([x, z]) => b.cyl(wood, 0.018, 0.012, 0.14, x, 0.07, z, 'y'));
    b.box(MAT.cabUp, L, R, 0.14, h - 0.025, 0, D - 0.018); b.box(wood, L - 0.005, R + 0.005, h - 0.025, h, 0, D + 0.004, { r: 0.004, swap: true });
    for (let i = 0; i < n; i++) { const x0 = L + W * i / n, x1 = L + W * (i + 1) / n; b.box(MAT.cabUp, x0 + 0.002, x1 - 0.002, 0.142, h - 0.028, D - 0.018, D, { cast: false }); b.box(wood, (x0 + x1) / 2 - 0.05, (x0 + x1) / 2 + 0.05, h - 0.075, h - 0.065, D, D + 0.012, { r: 0.004, cast: false }); }
    if (f.lamp) { putLamp(b, L + 0.2, h, D / 2); putPlant(b, R - 0.2, h, D / 2, 0.8); putBooks(b, -0.15, 0.12, h, 0.06, 0.25); } else { putPlant(b, L + 0.18, h, D / 2, 0.8); b.box(MAT.white, 0.02, 0.42, h, h + 0.16, 0.04, D - 0.03, { r: 0.012 }); b.box(MAT.black, 0.06, 0.38, h + 0.16, h + 0.165, 0.08, D - 0.08, { cast: false }); }
  },
  wshelf(f, b, W, D) {                                               // 벽 선반 + 아래 간접조명 + 책·화분·액자
    const wood = WOOD(f.wood), y = CM(f.h0), L = -W / 2, R = W / 2;
    b.box(wood, L, R, y, y + 0.03, 0, D, { r: 0.004, swap: true });
    b.box(MATX.led, L + 0.04, R - 0.04, y - 0.008, y, 0.02, 0.034, { cast: false });
    const seg = W / 4;
    putBooks(b, L + 0.05, L + seg, y + 0.03, 0, D); putPlant(b, L + seg * 1.45, y + 0.03, D / 2, 0.7);
    putFrame(b, L + seg * 2.0, L + seg * 2.0 + 0.24, y + 0.03, y + 0.33, 0.03, 1); putBooks(b, L + seg * 2.9, R - 0.25, y + 0.03, 0, D); putFrame(b, R - 0.2, R - 0.04, y + 0.03, y + 0.24, 0.03, 2);
  },
  curtain(f, b) {                                                    // 속커튼: 양쪽으로 걷은 주름 + 레일
    const [x0, x1, y0, y1] = bboxOf(f.poly), xm = CM((x0 + x1) / 2), top = CM(f.h);
    b.boxC(MAT.white, x0 + 3, x0 + 6, f.h, f.h + 2.5, y0, y1, { cast: false });
    f.bunches.forEach(([a0, a1]) => {
      const n = 28, g = new THREE.PlaneGeometry(CM(a1 - a0), top - 0.03, n, 6); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) / CM(a1 - a0) + 0.5, v = p.getY(i) / (top - 0.03) + 0.5; p.setZ(i, Math.sin(u * Math.PI * 9) * 0.028 * (0.75 + 0.25 * v)); p.setX(i, p.getX(i) * (0.86 + 0.14 * v)); }
      g.computeVertexNormals(); g.rotateY(Math.PI / 2); g.translate(xm, (top + 0.03) / 2, CM((a0 + a1) / 2)); b.geo(MATX.curtain, g, { cast: false });
    });
  },
  rug(f, b, W, D) { b.box(f.tone === 'ivory' ? MATX.rugIvory : f.tone === 'gray' ? MATX.rugGray : MATX.rugBeige, -W / 2, W / 2, 0.002, 0.014, 0, D, { r: 0.005, seg: 1, cast: false }); },
  frame(f, b, W) {                                                   // 벽 액자 2~3개
    const y0 = CM(f.h0), y1 = CM(f.h), n = W > 1.2 ? 3 : 2, w = (W - 0.06 * (n - 1)) / n;
    for (let i = 0; i < n; i++) { const x0 = -W / 2 + i * (w + 0.06), dy = i % 2 ? 0.05 : 0; putFrame(b, x0, x0 + w, y0 + dy, y1 - (i % 2 ? 0 : 0.05), 0.002, i); }
  },
  flamp(f, b) {                                                      // 플로어 스탠드
    b.cyl(MAT.black, 0.13, 0.14, 0.015, 0, 0.0075, 0, 'y', { seg: 32 }); b.cyl(MAT.black, 0.008, 0.008, 1.32, 0, 0.67, 0, 'y');
    const g = new THREE.CylinderGeometry(0.11, 0.16, 0.2, 32, 1, true); g.translate(0, 1.4, 0); b.geo(MATX.shade, g, { cast: false });
    const c = new THREE.CircleGeometry(0.11, 32); c.rotateX(-Math.PI / 2); c.translate(0, 1.5, 0); b.geo(MATX.shade, c, { cast: false });
  },
  plant(f, b) { putPlant(b, 0, 0, 0, 2.3); },
  tvstand(f, b) {                                                    // 이동식 TV 스탠드 + 50인치 (참고 사진). 앞 = +z
    b.cyl(MAT.white, 0.235, 0.24, 0.022, 0, 0.011, 0, 'y', { seg: 48 }); b.cyl(MAT.white, 0.045, 0.06, 0.03, 0, 0.035, 0, 'y');
    b.cyl(MAT.white, 0.019, 0.019, 1.22, 0, 0.63, 0, 'y', { seg: 20 });
    b.box(MAT.white, -0.15, 0.15, 0.66, 0.672, -0.02, 0.2, { r: 0.005 });                             // 작은 선반
    b.box(MAT.white, -0.1, 0.1, 1.05, 1.25, 0.01, 0.03, { cast: false });                              // 브래킷
    b.box(MAT.tvBody, -0.56, 0.56, 0.825, 1.475, 0.03, 0.058, { r: 0.004 });
    b.box(MAT.tvScreen, -0.555, 0.555, 0.832, 1.47, 0.058, 0.06, { cast: false });
  },
  vanity(f, b, W, D) {                                               // 화장대 950×400×1350 (참고 사진 기준)
    const L = -W / 2, R = W / 2, pw = W * 0.315, T = 0.75, B = 0.14, g = 0.0018, fz = D - 0.018;
    [[L + 0.045, 0.05], [R - 0.045, 0.05], [L + 0.045, D - 0.05], [R - 0.045, D - 0.05]].forEach(([x, z]) => b.cyl(MAT.leaf, 0.02, 0.012, B, x, B / 2, z, 'y'));
    b.box(MAT.white, L, L + pw, B, T, 0, fz); b.box(MAT.white, R - pw, R, B, T, 0, fz); b.box(MAT.white, L + pw, R - pw, 0.62, T, 0, fz);
    b.box(MAT.white, L, R, T - 0.002, T + 0.016, 0, D, { r: 0.003 }); b.box(MAT.white, L + pw, R - pw, B + 0.2, T, 0, 0.015);
    b.box(MAT.white, L + pw, R - pw, 0.43, 0.445, 0.015, D * 0.55);                                   // 가운데 선반
    const fr = (x0, x1, y0, y1) => b.box(MAT.white, x0 + g, x1 - g, y0 + g, y1 - g, fz, D, { cast: false });
    fr(L, L + pw, 0.625, T - 0.004); fr(L, L + pw, 0.385, 0.61); fr(L, L + pw, B, 0.37);
    fr(L + pw, R - pw, 0.625, T - 0.004); fr(R - pw, R, 0.625, T - 0.004); fr(R - pw, R, B, 0.61);
    const HL = L + 0.07, HR = R - 0.07, HT = CM(f.h), HD = 0.16, sw = (HR - HL) * 0.22;              // 상부장
    b.box(MAT.white, HL, HR, T + 0.016, HT, 0, 0.012); b.box(MAT.white, HL, HL + 0.015, T + 0.016, HT, 0, HD); b.box(MAT.white, HR - 0.015, HR, T + 0.016, HT, 0, HD);
    b.box(MAT.white, HL, HR, HT - 0.015, HT, 0, HD); b.box(MAT.white, HL + sw, HL + sw + 0.015, T + 0.016, HT, 0, HD);
    [0.2, 0.39].forEach(dy => b.box(MAT.white, HL + 0.015, HL + sw, T + dy, T + dy + 0.012, 0.012, HD - 0.005));
    b.box(MAT.white, HR - sw, HR - 0.015, T + 0.016, HT - 0.015, 0.012, HD - 0.018); b.box(MAT.white, HR - sw + g, HR - g, T + 0.018, HT - g, HD - 0.018, HD, { cast: false });
    b.box(MAT.white, HL + sw + 0.015, HR - sw, HT - 0.075, HT - 0.015, 0.012, HD - 0.02);
    b.box(MAT.mirror, HL + sw + 0.03, HR - sw - 0.005, T + 0.02, HT - 0.08, 0.012, 0.018, { cast: false });
    b.box(MAT.downlight, HL + sw + 0.016, HL + sw + 0.028, T + 0.02, HT - 0.08, 0.012, 0.02, { cast: false });
  },
};
function buildFaced(f, parent) {
  let fr;
  if (f.type === 'curtain') fr = { m: null, W: 0, D: 0 };
  else if (f.at) { const m = new THREE.Matrix4().makeRotationY(f.rot != null ? THREE.MathUtils.degToRad(f.rot) : ({ S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 }[f.face] || 0)); m.setPosition(CM(f.at[0]), 0, CM(f.at[1])); fr = { m, W: 0, D: 0 }; }
  else fr = faceFrame(f.poly, f.face);
  const b = new Batch(fr.m);
  BUILD_F[f.type](f, b, fr.W, fr.D);
  const pickable = f.type !== 'rug' && f.type !== 'curtain';
  const g = b.build(parent, pickable ? { kind: 'furn', id: f.id } : null);
  furnGroups[f.id] = g; if (pickable) pickRoots.push(g);
  return g;
}
const motion = { flat: [], open: [] };
H.furniture.forEach(f => {
  if (BUILD_F[f.type] && !BUILD[f.type]) { buildFaced(f, furn); return; }
  const fn = BUILD[f.type];
  if (fn && (f.type === 'sofa' || f.type === 'bed')) {
    const mk = open => { const b = new Batch(); fn(f, b, bboxOf(f.poly), open); const g = b.build(furn, { kind: 'furn', id: f.id }); pickRoots.push(g); return g; };
    const g0 = mk(false), g1 = mk(true); g1.visible = false; motion.flat.push(g0); motion.open.push(g1); furnGroups[f.id] = g0;
    return;
  }
  if (!fn) return;
  const b = new Batch();
  fn(f, b, f.poly ? bboxOf(f.poly) : null);
  const g = b.build(f.type === 'panel' ? fixedG : furn, { kind: 'furn', id: f.id });
  furnGroups[f.id] = g; pickRoots.push(g);
});

// ---------- 옷방 가구 (옷방 3D 도안과 동일, 깊이 600) ----------
(function buildCloset() {
  // 옷방 모델 좌표(창문 벽 x=0, 좌측장 벽 z=0) → 집 좌표 (180° 회전)
  const MX = new THREE.Matrix4().makeRotationY(Math.PI); MX.setPosition(8.78, 0, 7.00);
  const DEPTH = 0.6, SH = 0.02, PH = 2.26, RC = DEPTH / 2, GW = 0.44, W = 2.8, D = 2.2;
  const L = new Batch(MX), R = new Batch(MX), ST = new Batch(MX), DR = new Batch(MX), CLa = new Batch(MX), CLb = new Batch(MX);
  const rodX = (b, a0, a1, y, z) => b.cyl(MAT.rod, 0.0125, 0.0125, a1 - a0, (a0 + a1) / 2, y, z, 'x', { seg: 12 });
  const rodZ = (b, a0, a1, y, x) => b.cyl(MAT.rod, 0.0125, 0.0125, a1 - a0, x, y, (a0 + a1) / 2, 'z', { seg: 12 });
  const rand = rng(7);
  const CL = [0x46566a, 0x9aa3ad, 0xd8cab3, 0x7a5c4a, 0x2f3a45, 0xb5c3d1, 0x878b69, 0xe9e2d4, 0x5a5a5a, 0xc7a99a].map(c => M(c, { roughness: 0.95, envMapIntensity: 0.3 }));
  const hang = (b, axis, a0, a1, yRod, c, lmin, lmax) => {
    const n = Math.floor((a1 - a0 - 0.05) / 0.072);
    for (let i = 0; i < n; i++) {
      const a = a0 + 0.045 + i * 0.072, Lh = lmin + rand() * (lmax - lmin), top = yRod - 0.045, m = CL[Math.floor(rand() * 10)];
      if (axis === 'x') b.box(m, a - 0.015, a + 0.015, top - Lh, top, c - GW / 2, c + GW / 2, { r: 0.012, seg: 1 });
      else b.box(m, c - GW / 2, c + GW / 2, top - Lh, top, a - 0.015, a + 0.015, { r: 0.012, seg: 1 });
    }
  };
  const stack = (b, x0, x1, y, z0, z1, h) => b.box(CL[Math.floor(rand() * 10)], x0, x1, y, y + h, z0, z1, { r: 0.02, seg: 1 });
  // 좌측장 (ㄱ자)
  const A = [0.078, 0.638], B = [0.666, 1.266], C = [1.294, 1.944], DD = [1.972, W];
  [0.050, 0.638, 1.266, 1.944].forEach(x => L.box(MAT.post, x, x + 0.028, 0, PH, DEPTH - 0.028, DEPTH));
  [0.12, 1.79, 2.12].forEach(y => L.box(MAT.shelf, A[0], A[1], y - SH, y, 0, DEPTH)); rodX(L, A[0], A[1], 1.71, RC);
  [0.12, 1.12, 2.12].forEach(y => L.box(MAT.shelf, B[0], B[1], y - SH, y, 0, DEPTH)); rodX(L, B[0], B[1], 2.04, RC); rodX(L, B[0], B[1], 1.04, RC);
  L.box(MAT.shelf, C[0], C[1], 2.10, 2.12, 0, DEPTH);
  const LV = [0, 1, 2, 3, 4, 5, 6].map(i => 0.12 + i * (2.0 / 6));
  LV.forEach(y => L.box(MAT.shelf, DD[0], DD[1], y - SH, y, 0, DEPTH));
  const XF = W - DEPTH, E = [0.635, 1.245];
  L.box(MAT.post, XF, XF + 0.035, 0, PH, 0.600, 0.635); L.box(MAT.post, XF, XF + 0.035, 0, PH, 1.245, 1.280);
  [0.12, 1.12, 2.12].forEach(y => L.box(MAT.shelf, XF, W, y - SH, y, E[0], E[1])); rodZ(L, E[0], E[1], 2.04, W - RC); rodZ(L, E[0], E[1], 1.04, W - RC);
  // 스타일러 SC5GMR82S 600×620×1965
  const stX = (C[0] + C[1]) / 2;
  ST.box(MAT.stylerBody, stX - 0.3, stX + 0.3, 0.012, 1.965, 0, 0.598, { r: 0.008 });
  ST.box(MAT.stylerMirror, stX - 0.298, stX + 0.298, 0.014, 1.963, 0.598, 0.62, { r: 0.004 });
  ST.box(MAT.black, stX - 0.27, stX + 0.27, 0, 0.012, 0.03, 0.57, { cast: false });
  // 우측장
  const ZF = D - DEPTH, S8 = [0.945, 1.745], S5 = [0.365, 0.910];
  [[0.330, 0.365], [0.910, 0.945], [1.745, 1.780]].forEach(p => R.box(MAT.post, p[0], p[1], 0, PH, ZF, ZF + 0.035));
  [0.12, 1.12, 2.12].forEach(y => R.box(MAT.shelf, S8[0], S8[1], y - SH, y, ZF, D)); rodX(R, S8[0], S8[1], 2.04, D - RC); rodX(R, S8[0], S8[1], 1.04, D - RC);
  [0.12, 1.12, 1.45, 1.78, 2.12].forEach(y => R.box(MAT.shelf, S5[0], S5[1], y - SH, y, ZF, D)); rodX(R, S5[0], S5[1], 1.04, D - RC);
  // 서랍장 (770 × 850, 깊이 400)
  const z0 = 0.715, z1 = 1.485, zc = (z0 + z1) / 2, fh = (0.85 - 0.045 - 0.02 - 0.012) / 4;
  DR.box(MAT.shelf, 0, 0.382, 0.04, 0.85, z0, z1, { r: 0.004 }); DR.box(MAT.shelf, 0, 0.352, 0, 0.04, z0 + 0.02, z1 - 0.02);
  for (let i = 0; i < 4; i++) { const y0 = 0.045 + i * (fh + 0.004); DR.box(MAT.post, 0.382, 0.4, y0, y0 + fh, z0 + 0.003, z1 - 0.003, { cast: false }); DR.box(MAT.rod, 0.4, 0.414, y0 + fh - 0.05, y0 + fh - 0.035, zc - 0.1, zc + 0.1, { r: 0.004, cast: false }); }
  // 옷 예시
  hang(CLa, 'x', A[0], A[1], 1.71, RC, 1.05, 1.45); hang(CLa, 'x', B[0], B[1], 2.04, RC, 0.62, 0.84); hang(CLa, 'x', B[0], B[1], 1.04, RC, 0.55, 0.84);
  hang(CLa, 'z', E[0], E[1], 2.04, W - RC, 0.62, 0.84); hang(CLa, 'z', E[0], E[1], 1.04, W - RC, 0.55, 0.84);
  hang(CLb, 'x', S8[0], S8[1], 2.04, D - RC, 0.62, 0.84); hang(CLb, 'x', S8[0], S8[1], 1.04, D - RC, 0.55, 0.84); hang(CLb, 'x', S5[0], S5[1], 1.04, D - RC, 0.55, 0.84);
  LV.slice(0, 6).forEach(y => { stack(CLa, 2.0, 2.24, y, 0.05, 0.35, 0.1 + rand() * 0.1); stack(CLa, 2.27, 2.51, y, 0.05, 0.35, 0.1 + rand() * 0.1); stack(CLa, 2.53, 2.77, y, 0.05, 0.35, 0.08 + rand() * 0.1); });
  [1.12, 1.45, 1.78].forEach(y => { stack(CLb, 0.39, 0.63, y, 1.84, 2.16, 0.12 + rand() * 0.1); stack(CLb, 0.65, 0.89, y, 1.84, 2.16, 0.12 + rand() * 0.1); });
  [['closet-l', L], ['closet-r', R], ['styler', ST], ['drawer', DR]].forEach(([id, b]) => { const g = b.build(furn, { kind: 'furn', id }); furnGroups[id] = g; pickRoots.push(g); });
  [CLa, CLb].forEach(b => { const g = b.build(furn); clothesGroups.push(g); });
})();

// ---------- 배치 제안: 서재 배치안 · 화장대 위치 (버튼으로 전환) ----------
const propG = new THREE.Group(); furn.add(propG);
const proposals = { study: { cur: 'A', groups: {} }, vanity: { cur: '1', groups: {} } };
const propItems = [];
H.studyPlans.forEach(p => { const g = new THREE.Group(); propG.add(g); proposals.study.groups[p.id] = g; p.items.forEach(it => { buildFaced(it, g); propItems.push(it); }); });
H.vanitySpots.forEach(p => { const g = new THREE.Group(); propG.add(g); proposals.vanity.groups[p.id] = g; buildFaced(p.item, g); propItems.push(p.item); buildFaced(p.tv, g); propItems.push(p.tv); });
function activeProps() { const sp = H.studyPlans.find(p => p.id === proposals.study.cur), vs = H.vanitySpots.find(p => p.id === proposals.vanity.cur); return [...sp.items, vs.item, vs.tv]; }
const allFurniture = () => [...H.furniture, ...activeProps()];
function applyProposals() {
  Object.keys(proposals).forEach(k => Object.keys(proposals[k].groups).forEach(id => (proposals[k].groups[id].visible = id === proposals[k].cur)));
}
applyProposals();
