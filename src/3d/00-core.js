// ===== 00 core: 렌더러 · 화질 단계 · 후처리(AO · 빛 번짐 · 심도 · 색보정) =====
const H = window.HOUSE;
const V3 = THREE.Vector3, V2 = THREE.Vector2;
const CM = v => v / 100;
const CEIL = H.H, DOORH = H.doorH, LOW = 110;
const $ = id => document.getElementById(id);
const QS = new URLSearchParams(location.search);
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const view = $('view');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  const f = $('fatal'); f.style.display = 'flex';
  f.textContent = '이 기기/브라우저에서 3D(WebGL)를 열 수 없어요. 다른 브라우저(크롬·사파리)로 열어 보세요.';
  $('loading').classList.add('off');
  throw e;
}
const GL2 = renderer.capabilities.isWebGL2;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
view.appendChild(renderer.domElement);
renderer.domElement.setAttribute('tabindex', '0');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 260);
camera.rotation.order = 'YXZ';

// ---------- 화질 단계 ----------
const TIERS = {
  low: { name: '낮음', dpr: 1.25, post: false, shadow: 1024, samples: 0, aoScale: 0, aoN: 0, fill: false },
  mid: { name: '보통', dpr: 1.75, post: true, shadow: 2048, samples: 4, aoScale: 0.5, aoN: 9, fill: true },
  high: { name: '높음', dpr: 2, post: true, shadow: 4096, samples: 4, aoScale: 1, aoN: 14, fill: true },
};
let qualPref = 'auto';
try { qualPref = localStorage.getItem('house3d.q') || 'auto'; } catch (e) { /* file:// 에서 막힐 수 있음 */ }
if (QS.get('q')) qualPref = QS.get('q');
if (!TIERS[qualPref]) qualPref = 'auto';
let tierName = qualPref === 'auto' ? (IS_TOUCH || Math.min(screen.width, screen.height) < 700 ? 'mid' : 'high') : qualPref;
if (!GL2 && tierName !== 'low') tierName = 'low';
let tier = TIERS[tierName];
const qualityHooks = [];          // 단계가 바뀔 때 부를 함수들

let needRender = 3;
function invalidate(n) { needRender = Math.max(needRender, n || 2); }
function shadowDirty() { renderer.shadowMap.needsUpdate = true; invalidate(); }

// ---------- 후처리: MSAA 타깃 → AO → (빛 번짐) → 합성(심도 · 색보정 · 입자) ----------
// fx 기본값 = 평소 화면 그대로. 집 소개 영상(08-film-*)만 장면마다 바꾼다. dof = 흐림 반경(화면 높이 대비), focus = 초점 거리(m)
const FX0 = { bloom: 0, thr: 0.7, dof: 0, focus: 3, expo: 1, contrast: 0, warm: 0, sat: 1.14, vig: 0.16, grain: 0 };
const fx = Object.assign({}, FX0);
const post = (function () {
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quad.frustumCulled = false; quadScene.add(quad);
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const mk = (fs, uniforms, defines) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, defines: defines || {}, depthTest: false, depthWrite: false, toneMapped: false });
  const DEPTH_FN = `
    uniform sampler2D tDepth; uniform mat4 projInv; uniform float near; uniform float far;
    float rawDepth(vec2 uv){ return texture2D(tDepth, uv).x; }
    float viewZ(float d){ return (near * far) / ((far - near) * d - far); }
    vec3 viewPos(vec2 uv){ float d = rawDepth(uv); vec4 c = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); vec4 v = projInv * c; return v.xyz / v.w; }`;
  const aoMat = mk(`
    varying vec2 vUv; uniform vec2 res; uniform float projScale; uniform float radius; uniform float intensity;
    ${DEPTH_FN}
    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    void main(){
      vec3 P = viewPos(vUv);
      if (-P.z > 45.0) { gl_FragColor = vec4(1.0); return; }
      vec2 px = 1.0 / res;
      vec3 Pr = viewPos(vUv + vec2(px.x, 0.0)), Pl = viewPos(vUv - vec2(px.x, 0.0));
      vec3 Pu = viewPos(vUv + vec2(0.0, px.y)), Pd = viewPos(vUv - vec2(0.0, px.y));
      vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
      vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
      vec3 N = normalize(cross(dx, dy));
      float rW = radius, rPx = radius * projScale / -P.z, maxPx = res.y * 0.09;
      if (rPx > maxPx) { rW *= maxPx / rPx; rPx = maxPx; }      // 가까운 물체는 반경을 줄여 과하게 어두워지지 않게
      if (rPx < 1.5) { gl_FragColor = vec4(1.0); return; }
      float noise = ign(gl_FragCoord.xy), k = rW / radius;
      float sum = 0.0; float r2 = rW * rW;
      for (int i = 0; i < NS; i++) {
        float t = (float(i) + 0.5) / float(NS);
        float ang = 6.2831853 * (noise + float(i) * 0.61803399);
        vec2 suv = vUv + vec2(cos(ang), sin(ang)) * (rPx * sqrt(t)) * px;
        vec3 v = viewPos(suv) - P;
        float vv = dot(v, v), vn = dot(v, N);
        float f = max(r2 - vv, 0.0);
        sum += f * f * f * max((vn - 0.014 * k) / (vv + 0.001 * k * k), 0.0);
      }
      float ao = max(0.0, 1.0 - sum * intensity * 5.0 / (r2 * r2 * r2 * float(NS)));
      ao = mix(1.0, max(ao, 0.28), smoothstep(45.0, 25.0, -P.z) * smoothstep(0.15, 1.3, -P.z));
      gl_FragColor = vec4(ao, ao, ao, 1.0);
    }`, { tDepth: { value: null }, projInv: { value: new THREE.Matrix4() }, near: { value: 0.05 }, far: { value: 260 },
    res: { value: new V2(1, 1) }, projScale: { value: 500 }, radius: { value: 0.45 }, intensity: { value: 0.3 } }, { NS: 9 });
  const blurMat = mk(`
    varying vec2 vUv; uniform sampler2D tAO; uniform vec2 dir; uniform vec2 pdir;
    ${DEPTH_FN}
    void main(){
      float z0 = viewZ(rawDepth(vUv));
      float slope = dot(vec2(dFdx(z0), dFdy(z0)), pdir);          // 비스듬한 면에서도 번지게
      float tol = 0.03 + 0.012 * abs(z0);
      float sum = texture2D(tAO, vUv).r * 0.2; float wsum = 0.2;
      for (int i = 1; i <= 4; i++) {
        float w = 0.2 - float(i) * 0.035;
        for (int s = -1; s <= 1; s += 2) {
          float o = float(i * s);
          vec2 uv = vUv + dir * o;
          float z = viewZ(rawDepth(uv));
          float ww = w * max(0.0, 1.0 - abs(z - (z0 + slope * o)) / tol);
          sum += texture2D(tAO, uv).r * ww; wsum += ww;
        }
      }
      gl_FragColor = vec4(vec3(sum / wsum), 1.0);
    }`, { tAO: { value: null }, tDepth: { value: null }, projInv: { value: new THREE.Matrix4() }, near: { value: 0.05 }, far: { value: 260 }, dir: { value: new V2() }, pdir: { value: new V2() } });
  // 밝은 곳만 뽑아 1/4 크기로 (빛 번짐용)
  const brightMat = mk(`
    varying vec2 vUv; uniform sampler2D tColor; uniform vec2 px; uniform float thr;
    void main(){
      vec3 c = (texture2D(tColor, vUv + px * vec2(-1.0, -1.0)).rgb + texture2D(tColor, vUv + px * vec2(1.0, -1.0)).rgb + texture2D(tColor, vUv + px * vec2(-1.0, 1.0)).rgb + texture2D(tColor, vUv + px * vec2(1.0, 1.0)).rgb) * 0.25;
      float l = max(c.r, max(c.g, c.b));
      gl_FragColor = vec4(c * smoothstep(thr, thr + 0.22, l), 1.0);
    }`, { tColor: { value: null }, px: { value: new V2() }, thr: { value: 0.7 } });
  const gaussMat = mk(`
    varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 dir;
    void main(){
      vec3 c = texture2D(tSrc, vUv).rgb * 0.227027;
      c += (texture2D(tSrc, vUv + dir * 1.384615).rgb + texture2D(tSrc, vUv - dir * 1.384615).rgb) * 0.316216;
      c += (texture2D(tSrc, vUv + dir * 3.230769).rgb + texture2D(tSrc, vUv - dir * 3.230769).rgb) * 0.070270;
      gl_FragColor = vec4(c, 1.0);
    }`, { tSrc: { value: null }, dir: { value: new V2() } });
  // 합성: (심도) → 음영 → 빛 번짐 → 색보정 → 가장자리 어둡게 → 필름 입자
  const outMat = mk(`
    varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tAO; uniform sampler2D tBloomA; uniform sampler2D tBloomB;
    uniform float aoAmt; uniform float debug; uniform float sat; uniform float vig; uniform float bloom; uniform float expo; uniform float contrast; uniform float warm; uniform float grain; uniform float seed;
    uniform float dof; uniform float focus; uniform vec2 px;
    ${DEPTH_FN}
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 col = texture2D(tColor, vUv).rgb;
      if (dof > 0.0) {                                           // 초점에서 먼 곳만 흐리게 (초점 안쪽 물체가 번져 들어오지 않게 가중치)
        float z = -viewZ(rawDepth(vUv)), c0 = clamp(abs(z - focus) / (focus * 0.9 + 0.4) - 0.12, 0.0, 1.0);
        if (c0 > 0.02) {
          float rot = hash(gl_FragCoord.xy) * 6.2831853, wsum = 1.0; vec3 sum = col;
          for (int i = 0; i < DOF_N; i++) {
            float fi = float(i), r = sqrt((fi + 0.5) / float(DOF_N)), a = rot + fi * 2.3999632;
            vec2 uv = vUv + vec2(cos(a), sin(a)) * r * c0 * dof * px;
            float zi = -viewZ(rawDepth(uv)), ci = clamp(abs(zi - focus) / (focus * 0.9 + 0.4) - 0.12, 0.0, 1.0);
            float w = clamp(ci / c0 + 0.08, 0.0, 1.0);
            sum += texture2D(tColor, uv).rgb * w; wsum += w;
          }
          col = sum / wsum;
        }
      }
      float ao = mix(1.0, texture2D(tAO, vUv).r, aoAmt);
      col *= ao;
      if (bloom > 0.0) col += (texture2D(tBloomA, vUv).rgb * 0.6 + texture2D(tBloomB, vUv).rgb * 0.8) * bloom;
      col *= expo;
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = max(mix(vec3(lum), col, sat), 0.0);
      if (contrast != 0.0 || warm != 0.0) {
        vec3 g = sqrt(min(col, 1.0));                            // 대략 감마 공간에서 S자 대비
        g = mix(g, g * g * (3.0 - 2.0 * g), contrast);
        col = g * g * vec3(1.0 + warm * 0.07, 1.0 + warm * 0.012, 1.0 - warm * 0.085);
      }
      vec2 q = vUv - 0.5; col *= 1.0 - dot(q, q) * vig;
      if (grain > 0.0) col += (hash(gl_FragCoord.xy + seed * 91.7) - 0.5) * grain * (0.35 + 0.65 * sqrt(max(col.g, 0.0)));
      if (debug > 0.5) col = vec3(ao);
      gl_FragColor = vec4(col, 1.0);
      #include <encodings_fragment>
    }`, { tColor: { value: null }, tAO: { value: null }, tBloomA: { value: null }, tBloomB: { value: null }, tDepth: { value: null }, projInv: { value: new THREE.Matrix4() }, near: { value: 0.05 }, far: { value: 260 },
    aoAmt: { value: 1 }, sat: { value: 1.14 }, vig: { value: 0.16 }, bloom: { value: 0 }, expo: { value: 1 }, contrast: { value: 0 }, warm: { value: 0 }, grain: { value: 0 }, seed: { value: 0 },
    dof: { value: 0 }, focus: { value: 3 }, px: { value: new V2() }, debug: { value: QS.get('ao') ? 1 : 0 } }, { DOF_N: 12 });
  let rt = null, ao1 = null, ao2 = null, bl = null, ok = true, checked = false, frameNo = 0;
  function dispose() { [rt, ao1, ao2].concat(bl || []).forEach(t => t && t.dispose()); if (rt && rt.depthTexture) rt.depthTexture.dispose(); rt = ao1 = ao2 = bl = null; }
  function setSize(w, h) {
    dispose();
    if (!tier.post || !ok) return;
    const depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    depthTexture.minFilter = depthTexture.magFilter = THREE.NearestFilter;
    rt = new THREE.WebGLRenderTarget(w, h, { samples: tier.samples, depthTexture, depthBuffer: true, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    rt.texture.encoding = THREE.sRGBEncoding;
    const aw = Math.max(2, Math.round(w * tier.aoScale)), ah = Math.max(2, Math.round(h * tier.aoScale));
    const o = { depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
    ao1 = new THREE.WebGLRenderTarget(aw, ah, o); ao2 = new THREE.WebGLRenderTarget(aw, ah, o);
    aoMat.uniforms.res.value.set(aw, ah);
    if (aoMat.defines.NS !== tier.aoN) { aoMat.defines.NS = tier.aoN; aoMat.needsUpdate = true; }
    const dn = tier.aoScale >= 1 ? 12 : 8; if (outMat.defines.DOF_N !== dn) { outMat.defines.DOF_N = dn; outMat.needsUpdate = true; }
    checked = false;
  }
  function bloomTargets() {               // 빛 번짐은 영상에서만 쓰므로 처음 쓸 때 만든다 (1/4 · 1/8 크기)
    const mkT = d => { const t = new THREE.WebGLRenderTarget(Math.max(2, Math.round(rt.width / d)), Math.max(2, Math.round(rt.height / d)), { depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false }); t.texture.encoding = THREE.sRGBEncoding; return t; };
    bl = [mkT(4), mkT(4), mkT(8), mkT(8)];
  }
  function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); }
  function gauss(src, tmp, n) {           // src ↔ tmp 가로·세로 번갈아 n번, 결과는 src
    for (let i = 0; i < n; i++) {
      gaussMat.uniforms.tSrc.value = src.texture; gaussMat.uniforms.dir.value.set((1 + i) / src.width, 0); pass(gaussMat, tmp);
      gaussMat.uniforms.tSrc.value = tmp.texture; gaussMat.uniforms.dir.value.set(0, (1 + i) / src.height); pass(gaussMat, src);
    }
  }
  function render(sc, cam, aoAmt) {
    if (!tier.post || !ok || !rt) { renderer.setRenderTarget(null); renderer.render(sc, cam); return; }
    renderer.setRenderTarget(rt); renderer.render(sc, cam);
    if (!checked) {                       // 기기가 이 타깃을 못 쓰면 바로 직접 그리기로
      checked = true;
      const gl = renderer.getContext();
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE || gl.getError() !== gl.NO_ERROR) {
        ok = false; dispose(); renderer.setRenderTarget(null); renderer.render(sc, cam); return;
      }
    }
    const pi = aoMat.uniforms.projInv.value.copy(cam.projectionMatrixInverse);
    blurMat.uniforms.projInv.value.copy(pi);
    [aoMat, blurMat, outMat].forEach(m => { m.uniforms.tDepth.value = rt.depthTexture; m.uniforms.near.value = cam.near; m.uniforms.far.value = cam.far; });
    aoMat.uniforms.projScale.value = ao1.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    pass(aoMat, ao1);
    blurMat.uniforms.tAO.value = ao1.texture; blurMat.uniforms.dir.value.set(1 / ao1.width, 0); blurMat.uniforms.pdir.value.set(1, 0); pass(blurMat, ao2);
    blurMat.uniforms.tAO.value = ao2.texture; blurMat.uniforms.dir.value.set(0, 1 / ao1.height); blurMat.uniforms.pdir.value.set(0, 1); pass(blurMat, ao1);
    const U = outMat.uniforms;
    if (fx.bloom > 0) {
      if (!bl) bloomTargets();
      brightMat.uniforms.tColor.value = rt.texture; brightMat.uniforms.px.value.set(1 / rt.width, 1 / rt.height); brightMat.uniforms.thr.value = fx.thr; pass(brightMat, bl[0]);
      gauss(bl[0], bl[1], 2);
      gaussMat.uniforms.tSrc.value = bl[0].texture; gaussMat.uniforms.dir.value.set(0, 0); pass(gaussMat, bl[2]);
      gauss(bl[2], bl[3], 3);
      U.tBloomA.value = bl[0].texture; U.tBloomB.value = bl[2].texture;
    }
    U.tColor.value = rt.texture; U.tAO.value = ao1.texture; U.aoAmt.value = aoAmt;
    U.bloom.value = fx.bloom; U.expo.value = fx.expo; U.contrast.value = fx.contrast; U.warm.value = fx.warm; U.sat.value = fx.sat; U.vig.value = fx.vig;
    U.grain.value = fx.grain; U.seed.value = (frameNo = (frameNo + 1) % 64);
    U.dof.value = fx.dof * rt.height; U.focus.value = fx.focus; U.px.value.set(1 / rt.width, 1 / rt.height);
    pass(outMat, null);
  }
  return { setSize, render, get active() { return !!(tier.post && ok && rt); } };
})();

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, tier.dpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  camera.aspect = w / h; camera.updateProjectionMatrix();
  post.setSize(Math.round(w * dpr), Math.round(h * dpr));
  invalidate(3);
}
function setTier(name, fromAuto) {
  if (!TIERS[name]) return;
  if (!GL2) name = 'low';
  tierName = name; tier = TIERS[name];
  resize();
  qualityHooks.forEach(f => f(fromAuto));
  shadowDirty();
}
