// ===== 10 real: 실사 렌더 (실험) — 지금 보는 장면을 경로 추적(path tracing)으로 다시 그린다 =====
// three-gpu-pathtracer 0.0.12 + three-mesh-bvh (vendor/). 카메라를 고정하고 빛이 튀는 경로를 계속 쌓아(샘플) 점점 깨끗해지는 방식.
// 평소 화면의 가짜 보조광 대신 '하늘 + 해'가 창으로 들어와 벽·바닥에 튀는 빛을 실제로 계산한다. 낮 장면 전용(실내등은 아직 광원으로 안 넣음).
THREE.mergeBufferGeometries = THREE.BufferGeometryUtils.mergeBufferGeometries;      // UMD 빌드가 THREE 전역에서 찾는 이름
THREE.mergeVertices = THREE.BufferGeometryUtils.mergeVertices;
const real = { on: false, busy: false, pt: null, mat: null, quad: null, bg: null, env: null, hidden: [], t0: 0, last: 0, max: 0, scale: 1, built: false, stats: {} };
const realEl = $('real'), realMsg = $('realMsg');

// 창밖 풍경(원통 그림 skyTex)을 구면 그림으로 옮김: 보이는 배경(8비트, 선명) + 조명용(실수, 작게 + 해)
function realSky() {
  setSky(false);
  const src = skyTex.day.image, W = 4096, Hh = 2048;
  const bg = canvasOf(W, Hh, g => {
    g.fillStyle = '#6ea6dd'; g.fillRect(0, 0, W, Hh / 2); g.fillStyle = '#75776f'; g.fillRect(0, Hh / 2, W, Hh / 2);
    // 구면 u = atan2(z, x) / 2π + 0.5, 원통 u = atan2(x, z) / 2π  →  원통 u = 0.75 − 구면 u (좌우 반전 + 밀기)
    for (let j = 0; j < Hh; j++) {
      const el = (0.5 - (j + 0.5) / Hh) * Math.PI; if (Math.abs(el) > 1.2) continue;
      const y = 1.5 + SKY_R * Math.tan(el), v = (y - SKY_Y0) / (SKY_Y1 - SKY_Y0); if (v < 0 || v > 1) continue;
      const sy = Math.min(src.height - 1, Math.floor((1 - v) * src.height));
      for (const tx of [0.75 * W, 1.75 * W]) { g.save(); g.translate(tx, 0); g.scale(-1, 1); g.drawImage(src, 0, sy, src.width, 1, 0, j, W, 1); g.restore(); }
    }
  });
  const bgTex = new THREE.CanvasTexture(bg); bgTex.encoding = THREE.sRGBEncoding; bgTex.flipY = true; bgTex.minFilter = THREE.LinearFilter; bgTex.generateMipmaps = false;
  // 조명용: 512 × 256 실수. 아래 줄 = 아래쪽(−y). 해는 평소 실내 조명의 해 방향 그대로
  const ew = 512, eh = 256, small = canvasOf(ew, eh, g => g.drawImage(bg, 0, 0, ew, eh)).getContext('2d').getImageData(0, 0, ew, eh).data;
  const data = new Float32Array(ew * eh * 4), lin = c => Math.pow(c / 255, 2.2);
  const sd = new V3(-11.5, 8.2, 4.2).normalize(), cosR = Math.cos(THREE.MathUtils.degToRad(2.6));
  for (let j = 0; j < eh; j++) {
    const phi = (1 - (j + 0.5) / eh) * Math.PI, sp = Math.sin(phi), cy = Math.cos(phi), sj = eh - 1 - j;
    for (let i = 0; i < ew; i++) {
      const th = ((i + 0.5) / ew - 0.5) * 2 * Math.PI, dx = sp * Math.cos(th), dz = sp * Math.sin(th), o = (j * ew + i) * 4, s = (sj * ew + i) * 4;
      let r = lin(small[s]), g2 = lin(small[s + 1]), b = lin(small[s + 2]);
      if (cy < 0) { r *= 0.5; g2 *= 0.5; b *= 0.5; }                               // 지평선 아래(땅 · 건물)는 덜 밝게
      if (dx * sd.x + cy * sd.y + dz * sd.z > cosR) { r += 150; g2 += 132; b += 104; }     // 해
      data[o] = r; data[o + 1] = g2; data[o + 2] = b; data[o + 3] = 1;
    }
  }
  const env = new THREE.DataTexture(data, ew, eh, THREE.RGBAFormat, THREE.FloatType);
  env.mapping = THREE.EquirectangularReflectionMapping; env.minFilter = env.magFilter = THREE.LinearFilter; env.needsUpdate = true;
  return { bgTex, env };
}
function realBuild() {            // 장면 → BVH · 재질 · 텍스처 (한 번만, 가구 배치가 바뀌면 다시)
  const P = window.ThreePathTracer, t0 = performance.now();
  real.mat = new P.PhysicalPathTracingMaterial();
  real.pt = new P.PathTracingRenderer(renderer);
  real.pt.camera = camera; real.pt.material = real.mat; real.pt.alpha = false;
  real.quad = new THREE.FullScreenQuad(new THREE.MeshBasicMaterial({ map: real.pt.target.texture }));
  scene.updateMatrixWorld(true);
  // 합치려면 도형 형식이 같아야 해서(색인 없는 삼각형) 보이는 메시마다 복사본을 만들어 넘긴다
  const list = [], swap = new Map();
  const ptMat = m => { if (!m.normalMap) return m; if (!swap.has(m)) { const c = m.clone(); c.normalMap = null; swap.set(m, c); } return swap.get(m); };      // 노멀맵 재질은 이 버전의 합치기에서 오류가 나서 빼고 넘김
  scene.traverseVisible(o => {
    if (!o.isMesh || !o.geometry.attributes.uv || !o.geometry.attributes.normal) return;
    for (let q = o.parent; q; q = q.parent) if (!q.visible) return;
    const pm = new THREE.Mesh(o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, Array.isArray(o.material) ? o.material.map(ptMat) : ptMat(o.material));
    pm.matrixAutoUpdate = false; pm.matrix.copy(o.matrixWorld); pm.updateMatrixWorld(true); list.push(pm);
  });
  const { bvh, textures, materials, lights } = new P.PathTracingSceneGenerator().generate(list);
  const geo = bvh.geometry, m = real.mat;
  m.bvh.updateFrom(bvh);
  m.attributesArray.updateFrom(geo.attributes.normal, geo.attributes.tangent, geo.attributes.uv, geo.attributes.color);
  m.materialIndexAttribute.updateFrom(geo.attributes.materialIndex);
  const ts = IS_TOUCH ? 512 : 1024;
  m.textures.setTextures(renderer, ts, ts, textures);
  m.materials.updateFrom(materials, textures);
  m.lights.updateFrom(lights);
  const sky = realSky(); real.bg = sky.bgTex; real.env = sky.env;
  m.envMapInfo.updateFrom(sky.env); m.backgroundMap = sky.bgTex;
  m.environmentIntensity = +QS.get('ptEnv') || 5; m.bounces = +QS.get('ptBounce') || 5; m.filterGlossyFactor = 0.5;
  m.setDefine('FEATURE_DOF', 0);
  real.stats = { tris: geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3, mats: materials.length, texs: textures.length, buildMs: Math.round(performance.now() - t0) };
  real.built = true;
}
function realPrep(on) {           // 경로 추적에 넣지 않을 것 숨기기 / 되돌리기
  if (on) { real.hidden = [backdrop, ground, selG, dimG, meas.g].filter(o => o.visible); real.hidden.forEach(o => (o.visible = false)); }
  else { real.hidden.forEach(o => (o.visible = true)); real.hidden = []; }
}
function realStart() {
  if (real.on || real.busy || film.on) return;
  if (!GL2 || !window.ThreePathTracer) { toast('이 기기에서는 실사 렌더를 쓸 수 없어요', 3000); return; }
  if (light.night) { toast('실사 렌더(실험)는 낮 조명에서만 돼요', 3000); return; }
  real.busy = true; closeSheets(); hideCard();
  realEl.classList.add('on'); realMsg.innerHTML = '실사 렌더 준비 중…<small>장면을 빛 계산용으로 바꾸고 있어요 (처음 한 번, 몇 초~수십 초)</small>';
  setTimeout(() => {
    try {
      realPrep(true);
      if (!real.built) realBuild();
      realPrep(false);
      const w = view.clientWidth, h = view.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2), sc = +QS.get('ptScale') || (IS_TOUCH ? 0.6 : 0.75);
      real.pt.setSize(Math.round(w * dpr * sc), Math.round(h * dpr * sc));
      const tl = +QS.get('ptTiles') || (IS_TOUCH ? 3 : 2); real.pt.tiles.set(tl, tl);
      real.pt.reset(); real.max = +QS.get('ptMax') || 600;
      camera.updateMatrixWorld();
      tween = null; walk.path = null; walk.vy = walk.vp = 0; controls.enabled = false;
      real.on = true; real.t0 = performance.now(); document.body.classList.add('real');
    } catch (e) {
      realPrep(false); realEl.classList.remove('on'); toast('실사 렌더를 시작하지 못했어요: ' + esc(e.message || e), 5000); console.error(e);
    }
    real.busy = false;
  }, 60);
}
function realStep(now) {          // 그리기 루프에서 매 프레임
  const pt = real.pt;
  if (pt.samples < real.max) {
    const t = performance.now();
    do { pt.update(); } while (performance.now() - t < 12 && pt.samples < real.max);       // 한 프레임에 조금씩
  }
  renderer.setRenderTarget(null);
  real.quad.material.map = pt.target.texture; real.quad.render(renderer);
  if (now - real.last > 250) {
    real.last = now;
    const n = Math.floor(pt.samples), sec = ((now - real.t0) / 1000).toFixed(0);
    realMsg.innerHTML = n >= real.max ? `실사 렌더 완료 · 샘플 ${n}<small>${sec}초 걸림 · 화면을 길게 눌러 저장할 수 있어요</small>` : `실사 렌더 중 · 샘플 ${n} / ${real.max}<small>${sec}초 · 오래 둘수록 깨끗해져요</small>`;
  }
  invalidate();
}
function realStop() {
  if (!real.on) return;
  real.on = false; document.body.classList.remove('real'); realEl.classList.remove('on');
  if (state.mode === 'orbit') controls.enabled = true;
  viewOffDirty = true; invalidate(4);
}
$('realClose').addEventListener('click', realStop);
$('oReal').addEventListener('click', realStart);
window.addEventListener('keydown', e => { if (real.on && e.key === 'Escape') realStop(); });
window.addEventListener('resize', () => { if (real.on) realStop(); });
window.__house.real = { start: realStart, stop: realStop, state: real };
if (QS.get('real')) setTimeout(realStart, 600);
