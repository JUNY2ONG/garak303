// ===== 00 core: 렌더러 · 화질 단계 · 후처리(AO) =====
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

// ---------- 후처리: MSAA 타깃 → AO → 합성 ----------
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
  const outMat = mk(`
    varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tAO; uniform float aoAmt; uniform float debug; uniform float sat;
    void main(){
      vec4 c = texture2D(tColor, vUv);
      float ao = mix(1.0, texture2D(tAO, vUv).r, aoAmt);
      vec3 col = c.rgb * ao;
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = max(mix(vec3(lum), col, sat), 0.0);
      // 살짝 대비 올리고 가장자리 아주 약하게 어둡게
      vec2 q = vUv - 0.5; col *= 1.0 - dot(q, q) * 0.16;
      if (debug > 0.5) col = vec3(ao);
      gl_FragColor = vec4(col, 1.0);
      #include <encodings_fragment>
    }`, { tColor: { value: null }, tAO: { value: null }, aoAmt: { value: 1 }, sat: { value: 1.14 }, debug: { value: QS.get('ao') ? 1 : 0 } });
  let rt = null, ao1 = null, ao2 = null, ok = true, checked = false;
  function dispose() { [rt, ao1, ao2].forEach(t => t && t.dispose()); if (rt && rt.depthTexture) rt.depthTexture.dispose(); rt = ao1 = ao2 = null; }
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
    checked = false;
  }
  function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); }
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
    [aoMat, blurMat].forEach(m => { m.uniforms.tDepth.value = rt.depthTexture; m.uniforms.near.value = cam.near; m.uniforms.far.value = cam.far; });
    aoMat.uniforms.projScale.value = ao1.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    pass(aoMat, ao1);
    blurMat.uniforms.tAO.value = ao1.texture; blurMat.uniforms.dir.value.set(1 / ao1.width, 0); blurMat.uniforms.pdir.value.set(1, 0); pass(blurMat, ao2);
    blurMat.uniforms.tAO.value = ao2.texture; blurMat.uniforms.dir.value.set(0, 1 / ao1.height); blurMat.uniforms.pdir.value.set(0, 1); pass(blurMat, ao1);
    outMat.uniforms.tColor.value = rt.texture; outMat.uniforms.tAO.value = ao1.texture; outMat.uniforms.aoAmt.value = aoAmt;
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
