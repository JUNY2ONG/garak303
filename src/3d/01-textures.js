// ===== 01 textures: 마감재 텍스처(캔버스로 근사) · 재질 =====
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
function canvasOf(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
// meters: 텍스처 한 장이 덮는 실제 크기(m)
function texOf(canvas, mw, mh, color) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (color) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = MAX_ANISO;
  t.repeat.set(1 / mw, 1 / (mh || mw));
  return t;
}
function speckle(g, W, Hh, r, n, cols, size) {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; const z = size * (0.5 + r()); g.fillRect(r() * W, r() * Hh, z, z); }
}
function clouds(g, W, Hh, r, n, rgb, a, smin, smax) {
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * Hh, rad = W * ((smin || 0.08) + r() * ((smax || 0.33) - (smin || 0.08)));
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {       // 이어 붙여도 티 안 나게
      const cx = x + ox * W, cy = y + oy * Hh;
      if (cx + rad < 0 || cx - rad > W || cy + rad < 0 || cy - rad > Hh) continue;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const al = a * (0.4 + 0.6 * r());
      gr.addColorStop(0, `rgba(${rgb},${al})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
  }
}
function veins(g, W, Hh, r, n, rgb, a, slope) {
  for (let i = 0; i < n; i++) {
    g.strokeStyle = `rgba(${rgb},${a * (0.4 + r() * 0.6)})`; g.lineWidth = 0.6 + r() * 2.2;
    let x = r() * W - W * 0.2, y = r() * Hh; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 16; k++) { x += (0.3 + r() * 0.7) * W * 0.09; y += (r() - 0.5 + (slope || 0)) * Hh * 0.05; g.lineTo(x, y); }
    g.stroke();
  }
}
// 세로결 나무 무늬 (필름): 밑색 + 가는 결 + 무늬결(카테드랄)
function woodGrain(g, W, Hh, r, base, dark, light, o) {
  o = o || {};
  g.fillStyle = base; g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 26; i++) {                        // 넓은 색띠
    const x = r() * W, w = W * (0.03 + r() * 0.1);
    const gr = g.createLinearGradient(x, 0, x + w, 0), c = r() < 0.5 ? dark : light, a = 0.05 + r() * 0.08;
    gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(0.5, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(x, 0, w, Hh); g.fillRect(x - W, 0, w, Hh);
  }
  const n = o.lines || 520;
  for (let i = 0; i < n; i++) {                         // 가는 세로 결
    const x0 = r() * W; g.strokeStyle = r() < 0.6 ? `rgba(${dark},${0.04 + r() * 0.1})` : `rgba(${light},${0.05 + r() * 0.1})`;
    g.lineWidth = 0.5 + r() * 1.3; g.beginPath();
    let x = x0; const y0 = r() * Hh, len = Hh * (0.3 + r() * 0.9); g.moveTo(x, y0);
    for (let y = y0; y < y0 + len; y += Hh / 24) { x += (r() - 0.5) * 2.2; g.lineTo(x, y); }
    g.stroke();
  }
  const cath = o.cathedral == null ? 4 : o.cathedral;
  for (let i = 0; i < cath; i++) {                      // 무늬결
    const cx = W * (0.12 + r() * 0.76), cy = r() * Hh, wv = W * (0.035 + r() * 0.03), hv = Hh * (0.22 + r() * 0.2);
    for (let k = 0; k < 7; k++) {
      g.strokeStyle = `rgba(${dark},${0.07 + r() * 0.06})`; g.lineWidth = 1 + r() * 1.2;
      for (let oy = -1; oy <= 1; oy++) { g.beginPath(); g.ellipse(cx, cy + oy * Hh, wv * (0.25 + k * 0.42), hv * (0.3 + k * 0.33), 0, 0, Math.PI * 2); g.stroke(); }
    }
  }
}
// 색 캔버스에서 밝기 요철(범프) 캔버스 만들기
function bumpFrom(src, contrast, extra) {
  return canvasOf(src.width, src.height, (g, W, Hh) => {       // (ctx.filter는 사파리에서 안 돼서 직접 계산)
    const img = src.getContext('2d').getImageData(0, 0, W, Hh), d = img.data, k = contrast || 1.6;
    let mean = 0;
    for (let i = 0; i < d.length; i += 16) mean += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    mean /= d.length / 16;
    for (let i = 0; i < d.length; i += 4) {
      const v = clamp(128 + (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 - mean) * k * 4, 0, 255);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    g.putImageData(img, 0, 0);
    if (extra) extra(g, W, Hh);
  });
}
function grid(g, W, Hh, nx, ny, color, lw) {
  g.fillStyle = color;
  for (let i = 0; i < nx; i++) g.fillRect(Math.round(i * W / nx) - lw / 2, 0, lw, Hh);
  for (let j = 0; j < ny; j++) g.fillRect(0, Math.round(j * Hh / ny) - lw / 2, W, lw);
  g.fillRect(W - lw / 2, 0, lw, Hh); g.fillRect(0, Hh - lw / 2, W, lw);
}

const TEX = {};
const TS = tierName === 'low' ? 512 : 1024;
(function buildTextures() {
  // 장판: LX 지아사랑애 소프트스톤 — 밝은 그레이지 스톤, 600각 (가정). 한 장 = 1.2m (2×2칸)
  const floorC = canvasOf(TS, TS, (g, W, Hh) => {
    const r = rng(11); g.fillStyle = '#d9d2c8'; g.fillRect(0, 0, W, Hh);
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,252,246' : '168,156,140'},${0.03 + r() * 0.05})`; g.fillRect(tx * W / 2, ty * Hh / 2, W / 2, Hh / 2); }
    clouds(g, W, Hh, r, 46, '176,164,148', 0.075); clouds(g, W, Hh, r, 36, '246,243,236', 0.09);
    clouds(g, W, Hh, r, 220, '150,138,122', 0.05, 0.004, 0.02); clouds(g, W, Hh, r, 220, '250,247,240', 0.07, 0.004, 0.02);
    speckle(g, W, Hh, r, W * 26, ['rgba(126,112,96,0.22)', 'rgba(252,250,245,0.3)', 'rgba(176,162,146,0.22)'], W / 900);
  });
  const floorB = bumpFrom(floorC, 2.2, (g, W, Hh) => grid(g, W, Hh, 2, 2, 'rgba(0,0,0,0.75)', Math.max(2, W / 340)));
  grid(floorC.getContext('2d'), TS, TS, 2, 2, 'rgba(142,128,110,0.6)', Math.max(1.5, TS / 480));
  TEX.floor = texOf(floorC, 1.2, 1.2, true); TEX.floorB = texOf(floorB, 1.2, 1.2);

  // 현관 타일: 아주세라믹 612-30 (600×1200) — 한 장 = 1.2m × 1.2m (가로 2장)
  const entryC = canvasOf(TS, TS, (g, W, Hh) => {
    const r = rng(23); g.fillStyle = '#d6d1c7'; g.fillRect(0, 0, W, Hh);
    clouds(g, W, Hh, r, 50, '244,241,234', 0.16); clouds(g, W, Hh, r, 34, '160,152,140', 0.1);
    veins(g, W, Hh, r, 30, '150,142,130', 0.3, -0.5); veins(g, W, Hh, r, 22, '255,255,252', 0.42, -0.5);
    speckle(g, W, Hh, r, W * 5, ['rgba(130,120,108,0.2)', 'rgba(255,255,255,0.3)'], W / 800);
  });
  const entryB = bumpFrom(entryC, 1.8, (g, W, Hh) => grid(g, W, Hh, 2, 1, 'rgba(0,0,0,0.8)', Math.max(2, W / 300)));
  grid(entryC.getContext('2d'), TS, TS, 2, 1, 'rgba(128,120,108,0.75)', Math.max(2, TS / 380));
  TEX.entry = texOf(entryC, 1.2, 1.2, true); TEX.entryB = texOf(entryB, 1.2, 1.2);

  // 벽지: LX 베스띠 디아 회벽 / 블랑 그레이 — 한 장 = 1m
  const wallC = canvasOf(TS, TS, (g, W, Hh) => {
    const r = rng(5); g.fillStyle = '#efece6'; g.fillRect(0, 0, W, Hh);
    clouds(g, W, Hh, r, 70, '255,255,252', 0.07); clouds(g, W, Hh, r, 50, '205,198,186', 0.045);
    clouds(g, W, Hh, r, 500, '200,193,182', 0.05, 0.004, 0.018); clouds(g, W, Hh, r, 500, '255,255,253', 0.08, 0.004, 0.018);
    speckle(g, W, Hh, r, W * 40, ['rgba(186,178,166,0.16)', 'rgba(255,255,255,0.3)'], W / 1100);
  });
  TEX.wall = texOf(wallC, 1.0, 1.0, true); TEX.wallB = texOf(bumpFrom(wallC, 3.2), 1.0, 1.0);

  // 도어 필름: 보닥 LW101 (밝은 베이지 오크, 무늬결) — 한 장 = 0.6m × 1.2m
  const doorC = canvasOf(TS / 2, TS, (g, W, Hh) => woodGrain(g, W, Hh, rng(31), '#cdb891', '128,98,58', '236,220,188', { cathedral: 5 }));
  TEX.door = texOf(doorC, 0.6, 1.2, true); TEX.doorB = texOf(bumpFrom(doorC, 2.4), 0.6, 1.2);
  // 하부장: 한솔 에버오크내추럴 (곧은 결) — 한 장 = 0.6m × 1.2m
  const oakC = canvasOf(TS / 2, TS, (g, W, Hh) => woodGrain(g, W, Hh, rng(47), '#d6ab78', '150,100,50', '244,214,170', { cathedral: 1, lines: 640 }));
  TEX.oak = texOf(oakC, 0.6, 1.2, true); TEX.oakB = texOf(bumpFrom(oakC, 2.4), 0.6, 1.2);

  const walC = canvasOf(TS / 2, TS, (g, W, Hh) => woodGrain(g, W, Hh, rng(59), '#6e4c35', '40,24,14', '150,110,80', { cathedral: 3, lines: 600 }));
  TEX.walnut = texOf(walC, 0.6, 1.2, true); TEX.walnutB = texOf(bumpFrom(walC, 2.4), 0.6, 1.2);
  // 상판: 판테온 갤럭시 어반 화이트 — 한 장 = 1m
  const topC = canvasOf(TS / 2, TS / 2, (g, W, Hh) => {
    const r = rng(53); g.fillStyle = '#dedfdb'; g.fillRect(0, 0, W, Hh);
    clouds(g, W, Hh, r, 40, '246,247,244', 0.16); clouds(g, W, Hh, r, 22, '186,186,180', 0.08);
    speckle(g, W, Hh, r, W * 3, ['rgba(150,150,144,0.3)', 'rgba(255,255,255,0.5)', 'rgba(120,120,116,0.18)'], W / 320);
  });
  TEX.top = texOf(topC, 1.0, 1.0, true);
  // 주방 벽 타일: 아주세라믹 88015 (800×800) — 한 장 = 0.8m
  const ktC = canvasOf(TS, TS, (g, W, Hh) => {
    const r = rng(61); g.fillStyle = '#e9e6e0'; g.fillRect(0, 0, W, Hh);
    clouds(g, W, Hh, r, 46, '250,248,244', 0.16); clouds(g, W, Hh, r, 28, '190,183,172', 0.07);
    veins(g, W, Hh, r, 12, '198,190,178', 0.22, 0.2);
    speckle(g, W, Hh, r, W * 4, ['rgba(160,150,138,0.18)', 'rgba(255,255,255,0.35)'], W / 800);
  });
  const ktB = bumpFrom(ktC, 1.4, (g, W, Hh) => grid(g, W, Hh, 1, 1, 'rgba(0,0,0,0.85)', Math.max(2, W / 260)));
  grid(ktC.getContext('2d'), TS, TS, 1, 1, 'rgba(168,160,148,0.8)', Math.max(2, TS / 340));
  TEX.ktile = texOf(ktC, 0.8, 0.8, true); TEX.ktileB = texOf(ktB, 0.8, 0.8);
  // 욕실·발코니 타일 (추정): 300각 회색 타일 — 한 장 = 0.6m
  const tC = canvasOf(256, 256, (g, W, Hh) => {
    const r = rng(71); g.fillStyle = '#dcdedd'; g.fillRect(0, 0, W, Hh);
    clouds(g, W, Hh, r, 30, '245,246,246', 0.2); clouds(g, W, Hh, r, 20, '170,174,176', 0.1);
    grid(g, W, Hh, 2, 2, 'rgba(150,156,160,0.9)', 3);
  });
  TEX.tile = texOf(tC, 0.6, 0.6, true);
  // 패브릭/가죽용 잔요철
  const nC = canvasOf(256, 256, (g, W, Hh) => {
    const r = rng(83); g.fillStyle = '#808080'; g.fillRect(0, 0, W, Hh);
    speckle(g, W, Hh, r, 9000, ['rgba(0,0,0,0.25)', 'rgba(255,255,255,0.25)'], 1.6);
    clouds(g, W, Hh, r, 120, '255,255,255', 0.12, 0.01, 0.05); clouds(g, W, Hh, r, 120, '0,0,0', 0.12, 0.01, 0.05);
  });
  TEX.noise = texOf(nC, 0.25, 0.25);
  const rugC = canvasOf(512, 512, (g, W, Hh) => {         // 아이보리 텍스처 러그 (굵은 짜임 + 은은한 줄)
    const r = rng(91); g.fillStyle = '#e9e2d3'; g.fillRect(0, 0, W, Hh);
    for (let y = 0; y < Hh; y += 6) for (let x = 0; x < W; x += 6) { const k = r(); g.fillStyle = `rgba(${k < 0.5 ? '255,252,244' : '176,164,144'},${0.1 + r() * 0.2})`; g.beginPath(); g.arc(x + 3 + (r() - 0.5) * 2, y + 3 + (r() - 0.5) * 2, 2.6, 0, 6.283); g.fill(); }
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(190,176,152,0.16)'; g.fillRect(0, i * 64 + 28, W, 5); }
    clouds(g, W, Hh, r, 30, '255,252,244', 0.1); clouds(g, W, Hh, r, 20, '170,158,138', 0.06);
  });
  TEX.rug = texOf(rugC, 0.8, 0.8, true); TEX.rugB = texOf(bumpFrom(rugC, 2.6), 0.8, 0.8);
  const wv = canvasOf(128, 128, (g, W, Hh) => {           // 직물 짜임
    g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, W, Hh);
    for (let y = 0; y < Hh; y += 4) for (let x = 0; x < W; x += 4) { g.fillStyle = ((x + y) / 4) % 2 ? '#9a9a9a' : '#606060'; g.fillRect(x, y, 3, 3); }
  });
  TEX.weave = texOf(wv, 0.08, 0.08);
})();

// 모루 유리: 세로 골 (노멀맵 + 밝기 줄무늬). 한 장 = 골 4개 = 4.8cm
(function () {
  const N = 64, P = 16;
  const nC = canvasOf(N, 4, (g) => { const im = g.createImageData(N, 4); for (let y = 0; y < 4; y++) for (let x = 0; x < N; x++) { const a = (x % P) / P * Math.PI * 2, nx = Math.cos(a) * 0.75, nz = Math.sqrt(1 - nx * nx), i = (y * N + x) * 4; im.data[i] = 128 + nx * 127; im.data[i + 1] = 128; im.data[i + 2] = 128 + nz * 127; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); });
  const cC = canvasOf(N, 4, (g) => { for (let x = 0; x < N; x++) { const v = 205 + Math.round(45 * Math.sin((x % P) / P * Math.PI * 2)); g.fillStyle = `rgb(${v},${v + 3},${v + 4})`; g.fillRect(x, 0, 1, 4); } });
  TEX.moruN = texOf(nC, 0.048, 0.048); TEX.moru = texOf(cC, 0.048, 0.048, true);
})();
// ---------- 재질 ----------
const M = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0, envMapIntensity: 0.6 }, o || {}));
const MAT = {
  // 마감재표
  floor: M(0xffffff, { map: TEX.floor, bumpMap: TEX.floorB, bumpScale: 0.0016, roughness: 0.62, envMapIntensity: 0.5 }),
  entry: M(0xffffff, { map: TEX.entry, bumpMap: TEX.entryB, bumpScale: 0.002, roughness: 0.42, envMapIntensity: 0.8 }),
  wall: M(0xffffff, { map: TEX.wall, bumpMap: TEX.wallB, bumpScale: 0.0012, roughness: 0.96, envMapIntensity: 0.6 }),
  bearing: M(0xffffff, { map: TEX.wall, bumpMap: TEX.wallB, bumpScale: 0.0012, roughness: 0.96, envMapIntensity: 0.6 }),
  thin: M(0xe9ebec, { roughness: 0.9 }),
  ktile: M(0xffffff, { map: TEX.ktile, bumpMap: TEX.ktileB, bumpScale: 0.0015, roughness: 0.36, envMapIntensity: 0.9 }),
  tile: M(0xffffff, { map: TEX.tile, roughness: 0.55 }),
  leaf: M(0xffffff, { map: TEX.door, bumpMap: TEX.doorB, bumpScale: 0.0006, roughness: 0.55 }),       // 보닥 LW101
  casing: M(0xf0ebe5, { roughness: 0.5 }),                                                           // 보닥 S126
  cab: M(0xffffff, { map: TEX.door, bumpMap: TEX.doorB, bumpScale: 0.0006, roughness: 0.5 }),         // 하부장: 방문 필름(LW101) 톤 (요청)
  walnut: M(0xffffff, { map: TEX.walnut, bumpMap: TEX.walnutB, bumpScale: 0.0008, roughness: 0.5 }),   // 호두나무
  cabUp: M(0xfbfaf5, { roughness: 0.62 }),                                                           // 미카도화이트 SM
  top: M(0xffffff, { map: TEX.top, roughness: 0.3, envMapIntensity: 1.0 }),                          // 갤럭시 어반 화이트
  // 구조
  cut: M(0x55524c, { roughness: 0.9, envMapIntensity: 0.2 }),          // 벽 자른 면
  ceiling: M(0xfaf9f6, { roughness: 0.97, envMapIntensity: 0.6 }),
  slab: M(0xcfc9be, { roughness: 0.9 }),
  frame: M(0xf7f7f5, { roughness: 0.42 }),                              // 창호·중문 프레임 (흰색)
  frameDark: M(0xb9bcbe, { roughness: 0.4, metalness: 0.4 }),
  glass: M(0xd6e8f2, { transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0, envMapIntensity: 2.2, depthWrite: false }),
  moru: M(0xeef4f5, { map: TEX.moru, normalMap: TEX.moruN, normalScale: new THREE.Vector2(1.6, 1.6), transparent: true, opacity: 0.62, roughness: 0.12, metalness: 0.1, envMapIntensity: 2.2 }),   // 모루(세로 골) 유리
  satin: M(0xf7f9f9, { transparent: true, opacity: 0.93, roughness: 0.75, envMapIntensity: 0.35 }),   // 백사틴 유리
  pvc: M(0xfafaf8, { roughness: 0.38, envMapIntensity: 0.8 }),
  frost: M(0xf2f5f6, { transparent: true, opacity: 0.86, roughness: 0.65, envMapIntensity: 0.4 }),
  sillTop: M(0xf1eee8, { roughness: 0.4 }),
  rail: M(0xf4f4f2, { roughness: 0.5, metalness: 0.1 }),
  xbox: M(0x9aa1ab, { transparent: true, opacity: 0.22, depthWrite: false }),
  frontDoor: M(0xb9b3a8, { roughness: 0.55, metalness: 0.15 }),
  // 공통
  white: M(0xfaf9f6, { roughness: 0.5 }),
  cream: M(0xf1ebdf, { roughness: 0.6 }),
  handle: M(0xa9adb2, { roughness: 0.32, metalness: 0.75, envMapIntensity: 1.2 }),
  steel: M(0xc9ccd0, { roughness: 0.28, metalness: 0.85, envMapIntensity: 1.3 }),
  steelBrushed: M(0xbfc2c5, { roughness: 0.45, metalness: 0.8, envMapIntensity: 1.0 }),
  chrome: M(0xe6e8ea, { roughness: 0.1, metalness: 1, envMapIntensity: 1.6 }),
  black: M(0x1b1c1e, { roughness: 0.4 }),
  blackGloss: M(0x0c0d10, { roughness: 0.08, metalness: 0.1, envMapIntensity: 1.8 }),
  seam: M(0x8f887d, { roughness: 0.9 }),
  seamDark: M(0x3a3936, { roughness: 0.9 }),
  toe: M(0x2f2e2c, { roughness: 0.7 }),
  porcelain: M(0xfdfdfb, { roughness: 0.16, envMapIntensity: 1.1 }),
  // 가전
  lgBeige: M(0xe9e2d3, { roughness: 0.38, envMapIntensity: 0.9 }),      // LG 오브제 베이지 (제품 사진 근사)
  lgBeigeDark: M(0xcfc6b4, { roughness: 0.4 }),
  charcoal: M(0x3a3b3e, { roughness: 0.45, metalness: 0.2 }),
  washDoor: M(0x15171a, { roughness: 0.08, metalness: 0.3, envMapIntensity: 1.6 }),
  induction: M(0xf4f4f1, { roughness: 0.1, envMapIntensity: 1.3 }),
  inductionMark: M(0xc8c8c4, { roughness: 0.3 }),
  hoodGlass: M(0x17181b, { roughness: 0.08, envMapIntensity: 1.6 }),
  stylerBody: M(0x2c2f34, { roughness: 0.35, metalness: 0.3 }),
  stylerMirror: M(0x596069, { roughness: 0.06, metalness: 0.85, envMapIntensity: 1.5 }),
  tvBody: M(0x18191c, { roughness: 0.35, metalness: 0.5 }),
  tvScreen: M(0x050608, { roughness: 0.32, metalness: 0.1, envMapIntensity: 0.55 }),
  // 가구
  frameDark2: M(0x4a4541, { roughness: 0.3, metalness: 0.85, envMapIntensity: 1.2 }),
  sofa: M(0xcbc8c0, { roughness: 0.5, bumpMap: TEX.noise, bumpScale: 0.0012, envMapIntensity: 0.5 }),      // 밝은 그레이 가죽 (제품 사진 근사)
  sofaSeam: M(0x9f9b93, { roughness: 0.7 }),
  bedBase: M(0x6c6d70, { roughness: 0.95, bumpMap: TEX.weave, bumpScale: 0.002, envMapIntensity: 0.3 }),
  headboard: M(0x8b8b8c, { roughness: 0.95, bumpMap: TEX.weave, bumpScale: 0.002, envMapIntensity: 0.3 }),
  mattress: M(0xf2f0eb, { roughness: 0.92, bumpMap: TEX.weave, bumpScale: 0.0012, envMapIntensity: 0.3 }),
  linen: M(0xf7f5f1, { roughness: 0.95, bumpMap: TEX.noise, bumpScale: 0.002, envMapIntensity: 0.3 }),
  duvet: M(0xdcdfe2, { roughness: 0.95, bumpMap: TEX.noise, bumpScale: 0.003, envMapIntensity: 0.3 }),
  nightstand: M(0xffffff, { map: TEX.door, roughness: 0.55 }),
  shelf: M(0xf2ead9, { roughness: 0.7 }),                              // 옷방 크림화이트 선반
  post: M(0xfcfcfa, { roughness: 0.45 }),                              // 옷방 화이트 기둥
  rod: M(0xc3c8ce, { roughness: 0.3, metalness: 0.8, envMapIntensity: 1.2 }),
  downlight: new THREE.MeshBasicMaterial({ color: 0xfffaf0 }),
  downlightRing: M(0xf2f1ee, { roughness: 0.5 }),
};
MAT.downlight.toneMapped = false;
// 바깥벽: 방향별로 따로(바깥에서 보는 쪽만 투명하게)
const extMats = {}, hiddenSide = {};
['N', 'S', 'W', 'E'].forEach(s => { extMats[s] = MAT.wall.clone(); hiddenSide[s] = false; });
const wallMatsAll = () => [MAT.wall, MAT.bearing, MAT.thin, ...Object.values(extMats)];
