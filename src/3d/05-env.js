// ===== 05 env: 하늘·도시 배경 · 조명 =====
const SKY_R = 110, SKY_Y0 = -70, SKY_Y1 = 86, EYE_ALT = 55;      // 눈높이가 지상 55m쯤(20층)이라고 보고 그림
// 창밖 풍경: 보내 준 현장 사진 2장을 참고해 그린 그림 (근사, 실제 건물 위치와 같지는 않음).
// 방향각 az: 0 = 아래(남) · 90 = 오른쪽(동: 세탁실 · 주방 · 서재 창) · 180 = 위(북) · 270 = 왼쪽(서: 거실 · 침실 창)
//   창밖을 볼 때: 동쪽 창에서 오른쪽 = az가 작아지는 쪽(남), 서쪽 창에서 오른쪽 = az가 작아지는 쪽(북)
//   서쪽(거실 사진): 단풍 든 산 능선, 흰 아파트 단지, 앞쪽에 붉은 벽돌 + 초록 지붕 학교, 오른쪽 가까이에 같은 단지 동
//   동쪽(세탁실 사진): 붉은 단풍 숲, 앞쪽에 초록 지붕 저층. 롯데월드타워는 정동이 아니라 오른쪽(동남, az 62)으로 비껴 있어
//   세탁실 창에서 오른쪽을 보면 보이고 주방에서 정면으로는 안 보인다 (사용자 확인). 그 오른쪽에 짙은 유리 고층
function paintCity(night) {
  const W = tierName === 'low' ? 2048 : 4096, Hc = W / 4;
  return canvasOf(W, Hc, g => {
    const r = rng(97), pxm = Hc / (SKY_Y1 - SKY_Y0);                         // px per m (세로)
    const yh = Hc * (1 - (1.5 - SKY_Y0) / (SKY_Y1 - SKY_Y0));               // 지평선
    const yAt = slope => yh - slope * SKY_R * pxm;                            // slope = 높이/거리
    const xAt = az => az / 360 * W, wAt = (m, dist) => (m / dist) / (2 * Math.PI) * W;
    const dAz = (a, c) => { const d = Math.abs(a - c) % 360; return d > 180 ? 360 - d : d; };
    const lobe = (a, c, w) => Math.exp(-Math.pow(dAz(a, c) / w, 2));          // 방향 c 근처에서 1, 멀어지면 0
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    // 하늘
    const sky = g.createLinearGradient(0, 0, 0, yh);
    if (night) { sky.addColorStop(0, '#0b1222'); sky.addColorStop(0.7, '#1b2742'); sky.addColorStop(1, '#3a3f58'); }
    else { sky.addColorStop(0, '#5f9bd8'); sky.addColorStop(0.55, '#9fc4e6'); sky.addColorStop(1, '#d6e4ee'); }
    g.fillStyle = sky; g.fillRect(0, 0, W, yh + 2);
    if (!night) {                                                            // 해 쪽 하늘을 밝게 + 엷은 구름
      const sx = xAt(288), gr = g.createRadialGradient(sx, yh - Hc * 0.2, 0, sx, yh - Hc * 0.2, Hc * 0.75);
      gr.addColorStop(0, 'rgba(255,246,225,0.75)'); gr.addColorStop(1, 'rgba(255,246,225,0)');
      g.fillStyle = gr; g.fillRect(sx - Hc, 0, Hc * 2, yh);
      for (let i = 0; i < 22; i++) {
        const cx = r() * W, cy = yh * (0.12 + r() * 0.62), cw = W * (0.03 + r() * 0.07), ch = Hc * (0.012 + r() * 0.02);
        for (let k = 0; k < 7; k++) {
          const px = cx + (r() - 0.5) * cw * 1.6, py = cy + (r() - 0.5) * ch * 2, rad = cw * (0.25 + r() * 0.35);
          for (const ox of [-W, 0, W]) { const gr2 = g.createRadialGradient(px + ox, py, 0, px + ox, py, rad); gr2.addColorStop(0, 'rgba(255,255,255,0.2)'); gr2.addColorStop(1, 'rgba(255,255,255,0)'); g.save(); g.translate(0, py); g.scale(1, 0.32); g.translate(0, -py); g.fillStyle = gr2; g.fillRect(px + ox - rad, py - rad, rad * 2, rad * 2); g.restore(); }
        }
      }
    } else {
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.5})`; g.fillRect(r() * W, r() * yh * 0.8, 1.3, 1.3); }
      const gr = g.createLinearGradient(0, yh - Hc * 0.22, 0, yh); gr.addColorStop(0, 'rgba(255,170,90,0)'); gr.addColorStop(1, 'rgba(255,170,90,0.22)'); g.fillStyle = gr; g.fillRect(0, yh - Hc * 0.22, W, Hc * 0.22);
    }
    // 산 (능선 3겹, 주기 함수라 이음매 없음). bump: 방향에 따라 더 높게, tint: 그 위에 덧칠할 단풍빛
    const ridge = (base, amp, col0, col1, bump, tint) => {
      const ph = [0, 1, 2, 3, 4].map(() => r() * 6.283), fr = [3, 5, 8, 13, 21];
      g.beginPath(); g.moveTo(0, yh + 4);
      for (let x = 0; x <= W; x += 4) {
        const a = x / W * 6.283; let h = 0;
        fr.forEach((f, i) => { h += Math.sin(a * f + ph[i]) / (i + 1.2); });
        g.lineTo(x, yAt(base + amp * (0.55 + 0.45 * h) + (bump ? bump(x / W * 360) : 0)));
      }
      g.lineTo(W, yh + 4); g.closePath();
      const gr = g.createLinearGradient(0, yAt(base + amp * 1.6), 0, yh); gr.addColorStop(0, col0); gr.addColorStop(1, col1);
      g.fillStyle = gr; g.fill();
      if (tint) { const gx = g.createLinearGradient(0, 0, W, 0); for (let i = 0; i <= 24; i++) gx.addColorStop(i / 24, tint(i * 15)); g.fillStyle = gx; g.fill(); }
    };
    const westUp = k => az => k * (lobe(az, 228, 42) + 0.45 * lobe(az, 292, 30));      // 서쪽 창에서 오른쪽(북서)으로 갈수록 능선이 높음
    if (night) { ridge(0.06, 0.035, '#141b2c', '#1a2236', westUp(0.03)); ridge(0.035, 0.03, '#101726', '#161e30', westUp(0.035)); }
    else {
      ridge(0.07, 0.035, '#a3b7ca', '#c0cdd8', westUp(0.03));
      ridge(0.045, 0.03, '#8f9fa3', '#b3bdbb', westUp(0.04), az => `rgba(168,124,90,${(0.32 * lobe(az, 295, 60)).toFixed(3)})`);
      ridge(0.022, 0.022, '#8a8f78', '#a9a48d', westUp(0.03), az => `rgba(176,118,74,${(0.4 * lobe(az, 290, 70) + 0.22 * lobe(az, 70, 60)).toFixed(3)})`);
    }
    // 땅 (멀수록 뿌옇게)
    const gd = g.createLinearGradient(0, yh, 0, Hc);
    if (night) { gd.addColorStop(0, '#20263a'); gd.addColorStop(0.3, '#151a28'); gd.addColorStop(1, '#0e1119'); }
    else { gd.addColorStop(0, '#c2c9cc'); gd.addColorStop(0.12, '#a9aea8'); gd.addColorStop(0.5, '#8d8f86'); gd.addColorStop(1, '#75776f'); }
    g.fillStyle = gd; g.fillRect(0, yh, W, Hc - yh);
    // 건물 · 나무 목록 (먼 것부터 그림)
    const haze = night ? [34, 40, 60] : [200, 210, 218];
    const list = [];
    for (let i = 0; i < 1500; i++) {
      const u = r(), az = r() * 360, dist = 110 + Math.pow(u, 1.7) * 3400, west = lobe(az, 275, 65), east = lobe(az, 92, 60);
      const tall = dist > 300 && r() < (dist > 800 ? 0.55 : 0.3) * (1 + 0.7 * west);
      const B = { az, dist, h: tall ? 42 + r() * 44 : 5 + r() * 16, w: tall ? 22 + r() * 50 : 9 + r() * 22, d: 11 + r() * 8, tall, c: r(), k: r() };
      if (tall && west > 0.4 && r() < 0.7) B.col = [238, 236, 228];                                            // 서쪽: 흰 아파트 단지
      if (!tall && dist < 420 && r() < 0.35 + 0.3 * (west + east)) B.roof = [74, 150, 104];                      // 초록 방수 지붕
      list.push(B);
    }
    for (let i = 0; i < 9; i++) list.push({ az: 240 + i * 8.5 + r() * 4, dist: 125 + r() * 110, h: 15 + r() * 5, w: 44 + r() * 30, d: 16, tall: false, c: r(), k: 0.9, col: [158, 86, 66], roof: [74, 150, 104], win: [236, 232, 222] });   // 서쪽 앞: 붉은 벽돌 학교
    list.push({ az: 236, dist: 56, h: 84, w: 22, d: 14, tall: true, c: 0, k: 0.9, col: [232, 232, 228], near: true });                                // 서쪽 오른편 가까이: 같은 단지 동
    for (let i = 0; i < 8; i++) list.push({ az: 50 - i * 3.6 - r() * 1.5, dist: 480 + r() * 300, h: 96 + r() * 24, w: 26 + r() * 9, d: 20, tall: true, c: 0, k: 0.9, col: [62, 72, 86], win: [150, 170, 190], roof: [50, 58, 70] });   // 동쪽 오른편: 짙은 유리 고층
    list.push({ az: 7, dist: 330, h: 80, w: 26, d: 14, tall: true, c: 0, k: 0.9, col: [226, 226, 222] });
    list.push({ lotte: true, az: 62, dist: 1600 });
    for (let i = 0; i < 90; i++) { const e = i % 2, az = (e ? 72 : 272) + (r() - 0.5) * 150; list.push({ trees: true, east: !!e, az, dist: 130 + Math.pow(r(), 1.4) * 520, w: 30 + r() * 60, c: r() }); }   // 단풍 숲
    list.sort((a, b) => b.dist - a.dist);
    const wallCols = [[236, 232, 224], [226, 226, 222], [214, 208, 198], [240, 236, 226], [205, 198, 190]], roofCols = [[150, 152, 150], [110, 150, 120], [120, 140, 165], [172, 168, 160], [150, 120, 100]];
    const blobs = (cx, y, w, tr, cols, n, hz) => { for (let k = 0; k < n; k++) { const ts = mix(cols[Math.floor(r() * cols.length)], haze, hz); for (const ox of [-W, 0, W]) { g.fillStyle = `rgb(${ts})`; g.beginPath(); g.arc(cx + ox + (r() - 0.5) * w, y - tr * (0.2 + r() * 0.5), tr * (0.7 + r() * 0.6), 0, 6.283); g.fill(); } } };
    list.forEach(B => {
      const hz = 1 - Math.exp(-B.dist / 1500), cx = xAt(B.az);
      if (B.trees) {                                                                                             // 단풍 숲 (동쪽은 붉게, 서쪽은 노랗게)
        if (night) return;
        const cols = B.east ? [[150, 52, 44], [176, 72, 48], [196, 110, 52], [120, 60, 46]] : [[214, 170, 60], [200, 128, 50], [226, 190, 80], [124, 140, 80]];
        blobs(cx, yAt(-EYE_ALT / B.dist), Math.max(6, wAt(B.w, B.dist)), Math.max(2, wAt(7, B.dist)), cols, 12, hz * 0.8); return;
      }
      if (B.lotte) {                                                                                             // 롯데월드타워 (555m): 위로 갈수록 가늘어지고 끝이 둘로 갈라짐
        const yB = yAt(-EYE_ALT / B.dist), yT = yAt((555 - EYE_ALT) / B.dist), hw = wAt(74, B.dist) / 2, Ht = yB - yT, hk = 0.42;
        const half = t => hw * (1 - 0.74 * Math.pow(t, 1.6));
        const body = night ? [34, 44, 70] : mix([150, 178, 208], haze, hk), dark = night ? [22, 28, 46] : mix([104, 134, 172], haze, hk), lite = night ? [60, 80, 120] : mix([196, 216, 236], haze, hk);
        for (const ox of [-W, 0, W]) {
          const x0 = cx + ox;
          g.beginPath(); g.moveTo(x0 - hw, yB);
          for (let i = 0; i <= 24; i++) { const t = i / 24; g.lineTo(x0 - half(t), yB - Ht * t); }
          g.lineTo(x0 - hw * 0.07, yT + Ht * 0.012); g.lineTo(x0, yT + Ht * 0.03); g.lineTo(x0 + hw * 0.07, yT + Ht * 0.012);
          for (let i = 24; i >= 0; i--) { const t = i / 24; g.lineTo(x0 + half(t), yB - Ht * t); }
          g.closePath();
          const gr = g.createLinearGradient(x0 - hw, 0, x0 + hw, 0); gr.addColorStop(0, `rgb(${lite})`); gr.addColorStop(0.45, `rgb(${body})`); gr.addColorStop(0.55, `rgb(${dark})`); gr.addColorStop(1, `rgb(${body})`);
          g.fillStyle = gr; g.fill();
          g.strokeStyle = `rgba(${night ? '150,190,255' : mix([70, 96, 132], haze, hk)},${night ? 0.7 : 0.55})`; g.lineWidth = Math.max(1, hw * 0.07);
          g.beginPath(); g.moveTo(x0, yB - Ht * 0.06); g.lineTo(x0, yT + Ht * 0.03); g.stroke();                 // 가운데 이음선
          [0.16, 0.33, 0.5, 0.66, 0.8, 0.9].forEach(t => { const h2 = half(t) * 0.82; g.fillStyle = night ? 'rgba(210,225,255,0.85)' : `rgba(${mix([78, 100, 130], haze, hk)},0.7)`; g.fillRect(x0 - h2, yB - Ht * t, h2 * 2, Math.max(1, Ht * 0.008)); });   // 기계층 띠
          if (night) { const gl = g.createRadialGradient(x0, yT, 0, x0, yT, hw * 3); gl.addColorStop(0, 'rgba(190,215,255,0.6)'); gl.addColorStop(1, 'rgba(190,215,255,0)'); g.fillStyle = gl; g.fillRect(x0 - hw * 3, yT - hw * 3, hw * 6, hw * 6); }
        }
        return;
      }
      const w = Math.max(1.5, wAt(B.w, B.dist));
      const yTop = yAt((B.h - EYE_ALT) / B.dist), yBot = yAt(-EYE_ALT / B.dist), yRoof = yAt((B.h - EYE_ALT) / (B.dist + B.d));
      let col = B.col || wallCols[Math.floor(B.c * wallCols.length)], roof = B.roof || roofCols[Math.floor(B.k * roofCols.length)];
      if (night) { col = [26, 30, 42]; roof = [20, 23, 33]; } else if (!B.tall && !B.col) col = mix(col, [170, 165, 155], 0.25);
      const cs = mix(col, haze, hz), rs = mix(roof, haze, hz), sd = mix(mix(col, [90, 95, 105], 0.35), haze, hz);
      const wc = night ? null : mix(B.win || [96, 112, 128], haze, hz);
      for (const ox of [-W, 0, W]) {
        const x = cx + ox - w / 2; if (x > W || x + w < 0) continue;
        if (yRoof < yTop) { g.fillStyle = `rgb(${rs})`; g.fillRect(x, yRoof, w, yTop - yRoof + 1); }
        g.fillStyle = `rgb(${cs})`; g.fillRect(x, yTop, w, yBot - yTop);
        g.fillStyle = `rgb(${sd})`; g.fillRect(x + w * 0.72, yTop, w * 0.28, yBot - yTop);      // 그늘진 옆면
        const fl = B.tall ? 2.9 : 3.2, rows = Math.floor(B.h / fl), rh = (yBot - yTop) / Math.max(1, rows);
        if (rh > 2.2 && w > 10) {                                                               // 창
          const cols = Math.max(2, Math.floor(B.w / 3.4)), cw = w * 0.72 / cols;
          for (let j = 0; j < rows; j++) { if (yTop + j * rh > Hc) break; for (let i = 0; i < cols; i++) {
            if (night) { if (r() < 0.38) { g.fillStyle = r() < 0.75 ? 'rgba(255,214,140,0.9)' : 'rgba(220,235,255,0.85)'; g.fillRect(x + i * cw + cw * 0.2, yTop + j * rh + rh * 0.25, cw * 0.6, rh * 0.5); } }
            else { g.fillStyle = `rgba(${wc},${B.near ? 0.75 : 0.55 - hz * 0.3})`; g.fillRect(x + i * cw + cw * 0.18, yTop + j * rh + rh * 0.28, cw * 0.64, rh * 0.46); if (B.near) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + i * cw + cw * 0.1, yTop + j * rh + rh * 0.8, cw * 0.8, rh * 0.12); } }
          } }
        } else if (night && r() < 0.8) {
          for (let k = 0; k < Math.max(2, w * (yBot - yTop) / 30); k++) if (r() < 0.5) { g.fillStyle = 'rgba(255,214,140,0.8)'; g.fillRect(x + r() * w, yTop + r() * (yBot - yTop), 1.2, 1.2); }
        }
      }
      if (!night && !B.tall && B.dist < 900 && B.k < 0.5) blobs(cx, yBot, w * 2.4, Math.max(1.5, wAt(5, B.dist)), [[196, 120, 48], [214, 170, 60], [120, 140, 80], [176, 90, 50]], 4, hz);      // 가로수 (가을빛)
    });
    if (!night) { const hz2 = g.createLinearGradient(0, yh - Hc * 0.05, 0, yh + Hc * 0.1); hz2.addColorStop(0, 'rgba(222,230,236,0)'); hz2.addColorStop(0.35, 'rgba(222,230,236,0.42)'); hz2.addColorStop(1, 'rgba(222,230,236,0)'); g.fillStyle = hz2; g.fillRect(0, yh - Hc * 0.05, W, Hc * 0.15); }
  });
}
const backdrop = new THREE.Group(); backdrop.visible = false; scene.add(backdrop);
const skyTex = {};
const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, toneMapped: false, fog: false, depthWrite: false });
const capTop = new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide }), capBot = new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide });
(function buildBackdrop() {
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(SKY_R, SKY_R, SKY_Y1 - SKY_Y0, 72, 1, true), skyMat);
  cyl.position.set(5, (SKY_Y0 + SKY_Y1) / 2, 3.5);
  const t = new THREE.Mesh(new THREE.CircleGeometry(SKY_R, 48), capTop); t.rotation.x = Math.PI / 2; t.position.set(5, SKY_Y1 - 0.05, 3.5);
  const b = new THREE.Mesh(new THREE.CircleGeometry(SKY_R, 48), capBot); b.rotation.x = -Math.PI / 2; b.position.set(5, SKY_Y0 + 0.05, 3.5);
  backdrop.add(cyl, t, b);
})();
function setSky(night) {
  const k = night ? 'night' : 'day';
  if (!skyTex[k]) { const t = new THREE.CanvasTexture(paintCity(night)); t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping; t.anisotropy = MAX_ANISO; skyTex[k] = t; }
  skyMat.map = skyTex[k]; skyMat.needsUpdate = true;
  capTop.color.set(night ? '#0b1222' : '#6ea6dd'); capBot.color.set(night ? '#0e1119' : '#75776f');
}
// 전체 보기 배경 (스튜디오)
const studioBg = (function () {
  const mk = (a, b) => { const t = new THREE.CanvasTexture(canvasOf(4, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); })); t.encoding = THREE.sRGBEncoding; return t; };
  return { day: mk('#d9e2e8', '#ebe8e2'), night: mk('#1c2233', '#3a3d47') };
})();

// ---------- 조명 ----------
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
const hemi = new THREE.HemisphereLight(0xffffff, 0xb9ad9b, 0.5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1de, 2);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -8.2, right: 8.2, top: 8.2, bottom: -8.2, near: 1, far: 40 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2.2;
scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.2 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(5, -0.125, 3.5); ground.receiveShadow = true; scene.add(ground);
// 창으로 들어오는 하늘빛 (낮, 방 안) — 그림자 없는 보조광
const fillDefs = [[70, 177, 1.0], [185, 505, 0.7], [925, 108, 0.75], [962, 362, 0.8], [822, 554, 0.5]];
const fills = fillDefs.map(([x, y, k]) => { const l = new THREE.PointLight(0xfff3e4, 0, 6.5, 1.6); l.position.set(CM(x), 1.45, CM(y)); l.userData.k = k; l.visible = false; scene.add(l); return l; });
// 실내등 (저녁): 다운라이트 묶음마다 하나 + 옷방 중앙등 + 표시가 없던 현관 · 세탁실 기본등(가정)
const lampDefs = [
  ...H.lightGroups.map(g => { const n = g.pts.length; return [g.pts.reduce((s, p) => s + p[0], 0) / n, g.pts.reduce((s, p) => s + p[1], 0) / n, 0.34 + 0.13 * n]; }),
  ...H.ceilingLamps.map(L => [L.at[0], L.at[1], 0.85]), [483, 50, 0.5], [958, 590, 0.4],
];
const lamps = lampDefs.map(([x, y, k]) => { const l = new THREE.PointLight(0xffe0b4, 0, 6, 1.5); l.position.set(CM(x), 2.12, CM(y)); l.userData.k = k; l.visible = false; scene.add(l); return l; });
// 다운라이트 밝기(0~1) · 색온도(K). 보기 옵션에서 바꿈
const dl = { b: 0.8, k: 3500 };
try { const sv = JSON.parse(localStorage.getItem('house3d.dl') || 'null'); if (sv && sv.b >= 0 && sv.b <= 1 && sv.k >= 2700 && sv.k <= 6500) Object.assign(dl, sv); } catch (e) { /* 무시 */ }
const kelvinCol = new THREE.Color(), dlTmp = new THREE.Color();
function kelvinRGB(K) {           // 색온도 → 빛 색 (근사식)
  const t = K / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  // 눈(카메라)이 조명 색에 어느 정도 적응하는 것을 감안해 흰색 쪽으로 절반쯤 당김 — 안 그러면 3000K대가 주황색 방이 됨
  return kelvinCol.setRGB(clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255).lerp(dlTmp.set(0xffffff), 0.5).convertSRGBToLinear();
}

let allMats = null;
function collectMats() {
  const set = new Set();
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.isMeshStandardMaterial) set.add(m); }); });
  [MAT, MATX, extMats].forEach(d => Object.values(d).forEach(m => { if (m.isMeshStandardMaterial) set.add(m); }));
  allMats = [...set]; allMats.forEach(m => { if (m.userData.env0 == null) m.userData.env0 = m.envMapIntensity; });
}
const light = { night: false, inside: false };
const LK = { fill: 0.92, lamp: 0.56 };
function applyRig() {
  const { night, inside } = light, T = tier;
  if (!allMats) collectMats();
  let env, aoAmt;
  if (!night) {
    if (inside) { sun.position.set(5 - 11.5, 1 + 8.2, 3.5 + 4.2); sun.intensity = 2.5; sun.color.set(0xffe6c6); hemi.intensity = T.fill ? 0.3 : 0.46; env = T.fill ? 0.6 : 0.8; hemi.color.set(0xfff8ee); hemi.groundColor.set(0xe6d8c4); }      // 흰 벽지가 회색으로 보이지 않게 실내 주변광을 올림 (15차)
    else { sun.position.set(5 - 3.0, 13, 3.5 + 4.6); sun.intensity = 0.95; sun.color.set(0xfff1dc); hemi.intensity = 0.1; env = 0.3; hemi.color.set(0xffffff); hemi.groundColor.set(0xc9bca8); }
  } else {
    if (inside) { sun.intensity = 0; hemi.intensity = (T.fill ? 0.1 : 0.34) * (0.25 + 0.95 * dl.b); env = (T.fill ? 0.18 : 0.34) * (0.3 + 0.9 * dl.b); hemi.color.copy(kelvinRGB(dl.k)); hemi.groundColor.set(0x8a7a66); }
    else { sun.position.set(5 - 3.0, 13, 3.5 + 4.6); sun.intensity = 0.16; sun.color.set(0xbfd0ff); hemi.intensity = T.fill ? 0.07 : 0.25; env = 0.14; hemi.color.set(0xffe9cc); hemi.groundColor.set(0x8a7a66); }
  }
  sun.visible = sun.intensity > 0;
  sun.target.position.set(5, inside ? 1 : 0, 3.5); sun.target.updateMatrixWorld();
  fills.forEach(l => { l.visible = T.fill && !night && inside; l.intensity = l.userData.k * LK.fill; });
  const lc = kelvinRGB(dl.k);
  lamps.forEach(l => { l.visible = T.fill && night && dl.b > 0.01; l.intensity = l.userData.k * LK.lamp * dl.b * 1.25; l.color.copy(lc); });
  allMats.forEach(m => { m.envMapIntensity = m.userData.env0 * env; });
  if (night) MAT.downlight.color.copy(lc).lerp(dlTmp.set(0xffffff), 0.3).multiplyScalar(0.3 + 0.7 * dl.b).convertLinearToSRGB(); else MAT.downlight.color.set(0xfbf8f0);
  MAT.tvScreen.envMapIntensity = MAT.tvScreen.userData.env0 * (night ? 0.5 : 1);
  backdrop.visible = inside; ground.visible = !inside && !night;
  scene.background = inside ? null : studioBg[night ? 'night' : 'day'];
  if (inside) setSky(night);
  const ms = tier.shadow;
  if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  shadowDirty();
}
