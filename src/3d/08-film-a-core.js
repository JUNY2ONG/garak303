// ===== 08 film (a) core: 집 소개 영상의 바탕 — 시간 곡선 · 카메라 · 문/조명 · 화면 효과 · 집 짓기 연출 · 화면 전환 =====
// 영상 시간 film.t(초) 하나로 카메라 · 문 · 조명 · 자막이 모두 정해진다.
//   (a) core   이 파일: 다른 세 파일이 쓰는 도구
//   (b) gfx    화면 글자와 3D 위치를 따라다니는 표시 (제목 · 안내선 · 치수선 · 위치 지도 · 마감재 판)
//   (c) scenes 장면 표 SCENES (카메라 동선 · 자막 · 사건)
//   (d) player 재생 (시작 · 매 프레임 · 일시정지 · 건너뛰기 · 끝내고 되돌리기)
// 좌표는 평면 cm (x, y, 높이). 카메라 키: [초, 눈 x, y, 높이, 보는 곳 x, y, 높이, 화각 배율].
const filmEl = $('film'), fSvg = $('fSvg'), fTags = $('fTags'), fStage = $('fStage');
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(parent, tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; }
const film = { on: false, ready: false, t: 0, last: 0, idx: -1, cue: 0, fresh: false, paused: false, closing: false, ff: 0, ct: 0, shadow: false, items: [], counters: [], laters: [], units: [], saved: null, offKey: '' };

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
function fCamWalk(v) {            // 방 안: 눈 위치 → 보는 곳. 초점은 보는 곳에 맞춘다
  camera.position.set(CM(v[0]), CM(v[2]), CM(v[1])); fLook.set(CM(v[3]), CM(v[5]), CM(v[4]));
  camera.up.set(0, 1, 0); camera.lookAt(fLook);
  fSetProj(filmFov(58 * (v[6] || 1)), 0.05); camera.updateMatrixWorld();
  fx.focus = camera.position.distanceTo(fLook);
}
// 바깥에서 집 가운데를 보며 도는 카메라. az = 0이면 아래쪽(남쪽)에서, -90°면 왼쪽(서쪽)에서 본다
function fCamOrbit(ty, az, pol, dist, fov) {
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
// 전체 모습 구도. 세로 화면(휴대폰)은 집을 90° 돌려 왼쪽(거실 창 쪽)에서 본다 — 긴 쪽이 세로로 놓여 훨씬 크게 보인다.
// 좌우로 흔드는 각은 바깥벽 자동 투명(updateCutaway)이 바뀌지 않는 범위로 제한.
function filmFrame(fov, pol, padPlan, padIso) {
  const port = fPortrait();
  const plan = port ? filmFit(7.9, 10.8, fov, padPlan) : filmFit(10.8, 7.9, fov, padPlan);
  const iso = port ? filmFit(9.0, 11.6, fov, padIso) : filmFit(13.6, 9.6, fov, padIso);
  const sway = port ? 0.11 : Math.min(0.24, Math.asin(fSat(4.9 / (iso * Math.sin(pol)))) * 0.9);
  return { base: port ? -Math.PI / 2 : 0, plan, iso, sway };
}

// ---------- 문 · 조명 ----------
const F_OPEN = { _: 1, 'd-ac': 0 };     // 실외기실 문은 닫아 둠 (침실 창밖으로 문짝이 보여서)
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

// ---------- 화면 효과 (00-core의 fx): 장면마다 빛 번짐 · 심도 · 색보정 · 필름 입자 ----------
const FXP = {
  open: { bloom: 0.14, thr: 0.9, contrast: 0.16, warm: 0.15, grain: 0.02, vig: 0.3, sat: 1.16 },
  day: { bloom: 0.4, thr: 0.78, contrast: 0.3, warm: 0.42, grain: 0.028, vig: 0.5, sat: 1.2, dof: 0.007 },
  night: { bloom: 0.85, thr: 0.58, contrast: 0.3, warm: 0.5, grain: 0.035, vig: 0.6, sat: 1.2, dof: 0.007 },
  end: { bloom: 0.9, thr: 0.55, contrast: 0.26, warm: 0.3, grain: 0.03, vig: 0.5, sat: 1.18 },
};
function fxSet(p) {
  Object.assign(fx, FX0, p || {});
  renderer.domElement.style.filter = p && !post.active ? 'contrast(1.07) saturate(1.1)' : '';      // 후처리가 꺼진 기기(화질 낮음)는 간단한 보정만
}

// ---------- 집 짓기 연출: 벽 물결 올리기(재질 셰이더 RISE) · 가구 채우기 ----------
function filmRise(T) {            // T: 0 = 바닥에 붙음 … 현관에서부터 차례로 올라옴 … null = 평소
  const v = T == null ? 1e3 : T;
  if (RISE.value.z !== v) { RISE.value.z = v; film.shadow = true; }
}
const RISE_END = 1 + 9.6 * RISE.value.w;         // 가장 먼 모서리까지 다 올라오는 진행 값
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
