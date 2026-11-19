// ===== 07 ui: 이름표 · 정보 카드 · 치수 · 거리 재기 · 지도 · 시트 =====
const furnById = {}; H.furniture.forEach(f => (furnById[f.id] = f)); propItems.forEach(f => (furnById[f.id] = f));
GRID.setDyn(activeProps());
const winById = {}; H.windows.forEach(w => (winById[w.id] = w));
const doorById = {}; H.doors.forEach(d => (doorById[d.id] = d));
const KIND = { real: '실측', photo: '사진 계산', est: '추정', calc: '계산' };
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const fmt = v => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));

// ---------- 토스트 ----------
let toastT = 0;
function toast(msg, ms) { const t = $('toast'); t.innerHTML = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 3200); }

// ---------- 이름표 (화면에 얹는 글자) ----------
const layer = $('labels'), labels = [];
function addLabel(html, x, y, h, cls, prio, type) {
  const el = document.createElement('div');
  el.className = 'lbl ' + cls; el.innerHTML = html; el.style.display = 'none'; layer.appendChild(el);
  const L = { el, pos: new V3(CM(x), CM(h), CM(y)), prio, type: type || 'name', w: 0, h: 0, occ: false, shown: false };
  labels.push(L); return L;
}
function removeLabel(L) { const i = labels.indexOf(L); if (i >= 0) labels.splice(i, 1); L.el.remove(); }
H.rooms.forEach(r => {
  if (r.small) addLabel(esc(r.name), r.at[0], r.at[1], 100, 'tag' + (r.color ? ' c-' + r.color : ''), 2);
  else addLabel(`${esc(r.name)}${r.size ? `<i>${esc(r.size)}</i>` : ''}`, r.at[0], r.at[1], 105, 'room', 5);
});
H.furniture.forEach(f => {
  if (!f.label || f.type === 'counter' || f.type === 'sink' || f.type === 'upper') return;
  const p = H.products[f.pid] || {};
  let x, y, h;
  if (f.poly) { const [x0, x1, y0, y1] = bboxOf(f.parts ? [[f.parts[1][0], f.parts[1][1]], [f.parts[1][2], f.parts[1][3]]] : f.poly); x = (x0 + x1) / 2; y = (y0 + y1) / 2; h = Math.min((f.h1 || f.h || 80) + 12, 205); }
  else { x = f.at[0]; y = f.at[1]; h = 122; }
  if (f.type === 'tv') { y -= 8; h = 186; } if (f.type === 'hood') { y = 296; h = 140; } if (f.type === 'fridge') { y = 300; h = 150; } if (f.type === 'tall') { y = 395; h = 150; }
  if (f.type === 'shoe') { x = 526; h = 150; } if (f.type === 'cabinet') { y = bboxOf(f.poly)[3] + 6; h = 150; } if (f.type === 'robot') { y = 300; h = 22; }
  if (f.type === 'dw') { y = 300; h = 55; } if (f.type === 'closet') h = 150; if (f.type === 'styler') { y = 632; h = 150; }
  if (f.id === 'closet-l') { y = 636; } if (f.id === 'closet-r') { y = 544; }
  const short = f.label.replace(/ \d+×\d+$/, '');
  const L = addLabel((p.warn ? '⚠ ' : '') + esc(short), x, y, h, 'tag' + (p.warn ? ' warn' : ''), p.warn ? 1.8 : 1.4);
  L.fid = f.id;
});
propItems.forEach(f => { if (!f.label || f.noLabel) return; const [x0, x1, y0, y1] = bboxOf(f.poly); const L = addLabel(esc(f.label) + ' <span style="opacity:.6">제안</span>', (x0 + x1) / 2, (y0 + y1) / 2, Math.min(f.h + 12, 158), 'tag', 1.3); L.fid = f.id; L.grp = furnGroups[f.id]; });
const ray = new THREE.Raycaster(), tmpV = new V3(), tmpV2 = new V3();
const furnBoxes = Object.keys(furnGroups).filter(id => !['faucet', 'induction', 'robot', 'sink', 'hood', 'dw', 'closet-l', 'closet-r', 'curtain-l', 'curtain-b'].includes(id)).map(id => ({ id, box: new THREE.Box3().setFromObject(furnGroups[id]).expandByScalar(-0.03) }));
let lastOcc = 0;
function updateOcclusion(now) {
  if (now - lastOcc < 160) return;
  lastOcc = now;
  const cp = camera.position;
  for (const L of labels) {
    if (L.type === 'meas') { L.occ = false; continue; }
    const dir = tmpV.copy(L.pos).sub(cp), dist = dir.length(); dir.normalize();
    ray.set(cp, dir); ray.near = 0; ray.far = dist - 0.06;
    L.occ = !state.xray && ray.intersectObjects(occluders, false).length > 0;
    if (!L.occ && state.showFurn && L.type !== 'dim') {              // 큰 가구 뒤에 있는 이름표도 숨김 (상자로 빠르게)
      for (const fb of furnBoxes) { if (fb.id === L.fid) continue; const hit = ray.ray.intersectBox(fb.box, tmpV2); if (hit && hit.distanceTo(cp) < dist - 0.06 && !fb.box.containsPoint(cp)) { L.occ = true; break; } }
    }
  }
}
function updateLabels() {
  const w = view.clientWidth, h = view.clientHeight, cand = [], walkMode = state.mode === 'walk';
  const topPad = 58, botPad = h - $('dock').getBoundingClientRect().top + 4;
  for (const L of labels) {
    const on = L.type === 'meas' || (L.type === 'dim' ? state.showDims : state.showLabels && !(L.fid && !state.showFurn) && !(L.grp && !L.grp.parent.visible));
    let vis = on && !L.occ;
    if (vis) {
      tmpV.copy(L.pos).project(camera);
      if (tmpV.z > 1 || tmpV.z < -1 || Math.abs(tmpV.x) > 1.02 || Math.abs(tmpV.y) > 1.02) vis = false;
      else {
        L.sx = (tmpV.x + 1) / 2 * w; L.sy = (1 - tmpV.y) / 2 * h;
        const d = L.pos.distanceTo(camera.position);
        if (walkMode && L.type !== 'meas' && (d > 9 || d < 0.35)) vis = false;
        if (L.type !== 'meas' && (L.sy < topPad || L.sy > h - botPad)) vis = false;
        L.d = d;
      }
    }
    if (!vis) { if (L.shown) { L.el.style.display = 'none'; L.shown = false; } continue; }
    cand.push(L);
  }
  cand.sort((a, b) => (b.prio - a.prio) || (a.d - b.d));
  const placed = [];
  for (const L of cand) {
    if (!L.w) { L.el.style.display = ''; L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; if (!L.shown) L.el.style.display = 'none'; }
    const r = { x0: L.sx - L.w / 2 - 2, x1: L.sx + L.w / 2 + 2, y0: L.sy - L.h / 2 - 2, y1: L.sy + L.h / 2 + 2 };
    if (L.type !== 'meas' && placed.some(q => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) { if (L.shown) { L.el.style.display = 'none'; L.shown = false; } continue; }
    placed.push(r);
    if (!L.shown) { L.el.style.display = ''; L.shown = true; }
    L.el.style.transform = `translate(${L.sx.toFixed(1)}px,${L.sy.toFixed(1)}px) translate(-50%,-50%)`;
  }
}

// ---------- 선택 표시 ----------
const selG = new THREE.Group(); selG.visible = false; scene.add(selG);
const selFill = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xd9622b, transparent: true, opacity: 0.13, depthWrite: false, toneMapped: false }));
const selEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xd9622b, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false }));
selEdge.renderOrder = 50; selG.add(selFill, selEdge);
function select(obj) {
  if (!obj) { selG.visible = false; invalidate(); return; }
  const box = new THREE.Box3().setFromObject(obj), s = box.getSize(new V3()), c = box.getCenter(new V3());
  selG.position.copy(c); selG.scale.set(s.x + 0.025, s.y + 0.025, s.z + 0.025); selG.visible = true; invalidate();
}

// ---------- 정보 카드 ----------
const card = $('card');
let cardActs = {};
function showCard(html, acts) {
  cardActs = acts || {};
  card.innerHTML = `<button class="x" data-a="close" aria-label="닫기">×</button>${html}`;
  card.classList.add('on');
  if (window.innerWidth < 760) card.style.bottom = (window.innerHeight - $('dock').getBoundingClientRect().top + 8) + 'px'; else card.style.bottom = '';
}
function hideCard() { if (card.classList.contains('on')) { card.classList.remove('on'); select(null); } }
card.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; if (a === 'close') hideCard(); else if (cardActs[a]) cardActs[a](); });
const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');
function cardFurn(id) {
  const f = furnById[id], p = H.products[f.pid] || { name: f.label || id };
  const sub = [p.brand, p.model].filter(Boolean).join(' ');
  showCard(`<h3>${esc(p.name)}</h3>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}<dl>${row('크기', p.size && esc(p.size))}${row('마감', p.finish && esc(p.finish))}</dl>` +
    `${p.note ? `<div class="note">${esc(p.note)}</div>` : ''}${p.warn ? `<div class="wn">⚠ ${esc(p.warn)}</div>` : ''}`);
  select(furnGroups[id]);
}
function cardWin(id) {
  const w = winById[id], k = w.src === 'photo' ? 'photo' : 'est', horiz = (w.x1 - w.x0) >= (w.y1 - w.y0), wd = horiz ? w.x1 - w.x0 : w.y1 - w.y0;
  showCard(`<h3>${esc(w.name)}<span class="k ${k}">${KIND[k]}</span></h3><dl>${row('폭', fmt(wd) + ' cm')}${row('창턱 높이', fmt(w.sill) + ' cm (바닥에서)')}${row('창 높이', fmt(w.top - w.sill) + ' cm')}${row('창 위 끝', fmt(w.top) + ' cm · 천장까지 ' + fmt(CEIL - w.top))}</dl>` +
    `<div class="note">${w.src === 'photo' ? '사진 원근으로 계산한 값이라 ±10cm쯤 오차가 있을 수 있어요.' : '도면 비율로 추정한 창이에요. 위치·크기 확인이 필요해요.'}</div>`);
  select(winGroups[id]);
}
function cardDoor(id, obj) {
  const d = doorById[id];
  showCard(`<h3>${esc(d.name)}<span class="k ${d.kind === 'photo' ? 'photo' : 'est'}">${d.kind === 'photo' ? '사진' : '추정'}</span></h3><dl>${row('문짝 폭', fmt(d.w) + ' cm')}${row('높이', DOORH + ' cm (추정)')}${row('마감', d.pvc ? (d.pvc === 'moru' ? '흰색 PVC 프레임(LX 하우시스) + 모루 유리(세로 줄무늬, 반투명)' : '흰색 PVC 프레임(LX 하우시스) + 백사틴 유리(젖빛, 불투명)') : d.glass ? '흰 프레임 + 간유리' : d.id === 'd-front' ? '색상 가정' : '도어 필름 보닥 LW101 · 문선 보닥 S126')}</dl>${d.note ? `<div class="note">${esc(d.note)}</div>` : ''}`);
  select(obj);
}
function cardSpace(s, x, y) {
  const fl = s.id === 'entry' ? H.finishes.find(f => f.id === 'entryTile') : ['bath', 'laundry', 'balcony', 'ac'].includes(s.id) ? null : H.finishes.find(f => f.id === 'floor');
  const acts = { go: () => { hideCard(); enterAt(x, y); markRooms(); } };
  showCard(`<h3>${esc(s.full || s.name)}${s.est ? '<span class="k est">추정</span>' : ''}</h3><dl>${row('크기', s.size ? esc(s.size) + ' cm' : '')}${row('천장고', CEIL + ' cm')}${row('바닥', fl ? esc(fl.model) : '타일 (추정)')}${row('벽', s.id === 'bath' ? '' : 'LX 베스띠 디아 회벽 블랑 그레이')}</dl>` +
    `<div class="acts"><button data-a="go">여기서 둘러보기</button></div>`, acts);
}

// ---------- 창·높이 치수 ----------
const dimG = new THREE.Group(); dimG.visible = false; scene.add(dimG);
const dimLabels = [];
(function buildDims() {
  const COL = { real: 0xc0266d, photo: 0x1d5fd1, est: 0x6f6a60 };
  const segs = { real: [], photo: [], est: [] };
  const line = (k, a, b) => segs[k].push(a[0], a[1], a[2], b[0], b[1], b[2]);       // m
  const tick = (k, p, axis) => { const d = 0.035; if (axis === 'x') line(k, [p[0] - d, p[1], p[2]], [p[0] + d, p[1], p[2]]); else if (axis === 'y') line(k, [p[0], p[1] - d, p[2]], [p[0], p[1] + d, p[2]]); else line(k, [p[0], p[1], p[2] - d], [p[0], p[1], p[2] + d]); };
  const lab = (t, k, x, y, h) => { const L = addLabel(t, x, y, h, 'dim k-' + k, 3, 'dim'); dimLabels.push(L); };
  H.windows.forEach(w => {
    const k = w.src === 'photo' ? 'photo' : 'est';
    const xi = w.inner > 0 ? w.x1 + 1.2 : w.x0 - 1.2, X = CM(xi), ya = w.y0 + 14, yb = w.y1 - 14, Z = CM(ya);
    line(k, [X, 0, Z], [X, CM(w.top), Z]);
    [0, w.sill, w.top].forEach(hh => tick(k, [X, CM(hh), Z], 'z'));
    if (w.sill >= 30) lab('창턱 ' + fmt(w.sill), k, xi, ya, w.sill / 2); else lab('창턱 ' + fmt(w.sill), k, xi, ya, w.sill + 9);
    lab('높이 ' + fmt(w.top - w.sill), k, xi, ya, (w.sill + w.top) / 2);
    const hh = CM(Math.max(w.sill + 18, w.top - 16));
    line(k, [X, hh, CM(w.y0)], [X, hh, CM(w.y1)]); tick(k, [X, hh, CM(w.y0)], 'y'); tick(k, [X, hh, CM(w.y1)], 'y');
    lab('폭 ' + fmt(w.y1 - w.y0), k, xi, (w.y0 + w.y1) / 2 + 14, Math.max(w.sill + 18, w.top - 16));
    lab('위 끝 ' + fmt(w.top), k, xi, yb, w.top - 6);
  });
  // 천장고: 방 모서리마다 하나
  [['living', 127, 3, 'est'], ['bed', 127, 697, 'photo'], ['study', 601, 3, 'photo'], ['closet', 601, 483, 'est'], ['kitchen', 1015, 467, 'est']].forEach(([id, x, y, k]) => {
    const X = CM(x), Z = CM(y); line(k, [X, 0, Z], [X, CM(CEIL), Z]); tick(k, [X, 0, Z], 'x'); tick(k, [X, CM(CEIL), Z], 'x');
    lab('천장 ' + CEIL, k, x, y, 150);
  });
  Object.keys(segs).forEach(k => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs[k], 3));
    dimG.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: COL[k], toneMapped: false })));
  });
})();

// ---------- 거리 재기 ----------
const meas = { pts: [], g: new THREE.Group(), label: null };
scene.add(meas.g);
const measMat = new THREE.MeshBasicMaterial({ color: 0xd9622b, depthTest: false, toneMapped: false, transparent: true });
const measLineMat = new THREE.LineBasicMaterial({ color: 0xd9622b, depthTest: false, toneMapped: false, transparent: true });
function measClear() {
  meas.pts = []; while (meas.g.children.length) { const c = meas.g.children.pop(); c.geometry.dispose(); }
  if (meas.label) { removeLabel(meas.label); meas.label = null; }
  $('measText').innerHTML = '잴 곳의 <b>첫 번째 점</b>을 탭하세요'; invalidate();
}
function measAdd(p) {
  if (meas.pts.length >= 2) measClear();
  meas.pts.push(p.clone());
  const s = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), measMat); s.position.copy(p); s.renderOrder = 60; meas.g.add(s);
  if (meas.pts.length === 1) $('measText').innerHTML = '<b>두 번째 점</b>을 탭하세요';
  else {
    const [a, b] = meas.pts, d = a.distanceTo(b) * 100, hz = Math.hypot(b.x - a.x, b.z - a.z) * 100, dv = Math.abs(b.y - a.y) * 100;
    const g = new THREE.BufferGeometry().setFromPoints([a, b]); const l = new THREE.Line(g, measLineMat); l.renderOrder = 59; meas.g.add(l);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    meas.label = addLabel(`${d.toFixed(1)} cm<small>수평 ${hz.toFixed(1)} · 높이차 ${dv.toFixed(1)}</small>`, mid.x * 100, mid.z * 100, mid.y * 100, 'meas', 9, 'meas');
    $('measText').innerHTML = `<b>${d.toFixed(1)} cm</b> · 수평 ${hz.toFixed(1)} · 높이차 ${dv.toFixed(1)}<br>다시 재려면 새 점을 탭하세요`;
  }
  invalidate();
}
function setMeasuring(on) {
  state.measuring = on; $('tMeas').classList.toggle('on', on); $('measBar').classList.toggle('on', on);
  if (on) { hideCard(); measClear(); } else measClear();
}
function updateMeasScale() {       // 점 크기를 화면에서 일정하게
  const k = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / view.clientHeight * 2;
  meas.g.children.forEach(c => { if (c.isMesh) c.scale.setScalar(Math.max(0.004, c.position.distanceTo(camera.position) * k * 5.5)); });
}

// ---------- 탭 처리 ----------
const ndc = new V2();
function pickAt(x, y) {
  const r = cv.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera); ray.near = 0; ray.far = 200;
  const roots = pickRoots.filter(o => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; });
  const hits = ray.intersectObjects([...roots, ...floorMeshes], true);
  for (const h of hits) {
    if (h.object.userData.floor) return { kind: 'floor', hit: h };
    let o = h.object; while (o && !o.userData.pick) o = o.parent;
    if (!o) continue;
    const pk = o.userData.pick;
    if (pk.kind === 'wall' && h.object.material.transparent && h.object.material.opacity < 0.5) continue;      // 투명해진 벽은 통과
    if (pk.kind === 'win' && h.object.material === MAT.glass && state.mode === 'orbit') { return { kind: 'win', id: pk.id, obj: o, hit: h }; }
    return { kind: pk.kind, id: pk.id, obj: o, hit: h };
  }
  return null;
}
function reticleAt(x, y) { const r = $('reticle'); r.style.left = x + 'px'; r.style.top = y + 'px'; r.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => r.classList.remove('on'))); }
onTap.push((x, y) => {
  if (tween) return;
  const p = pickAt(x, y);
  if (state.measuring) { if (p) measAdd(p.hit.point); return; }
  if (!p) { hideCard(); return; }
  if (p.kind === 'furn') { cardFurn(p.id); return; }
  if (p.kind === 'win') { cardWin(p.id); return; }
  if (p.kind === 'door') { cardDoor(p.id, p.obj); return; }
  if (p.kind === 'floor') {
    const px = p.hit.point.x * 100, py = p.hit.point.z * 100;
    if (state.mode === 'walk') {
      hideCard();
      if (walkTo(px, py)) reticleAt(x, y); else toast('거기로는 갈 수 없어요', 1500);
    } else {
      const s = spaceAt(px, py);
      if (s && inHouse(px, py)) { cardSpace(s, px, py); select(null); } else hideCard();
    }
    return;
  }
  hideCard();
});

// ---------- 평면 지도 (미니맵) ----------
const mapWrap = $('mapWrap'), mapCv = $('minimap');
const MAP = { x0: -32, y0: -32, x1: 1050, y1: 732, base: null, big: false, s: 1, w: 0, h: 0 };
function mapBuild() {
  const big = MAP.big, cssW = big ? Math.min(560, window.innerWidth - 24) : (window.innerWidth < 500 ? 128 : 168);
  const ratio = (MAP.y1 - MAP.y0) / (MAP.x1 - MAP.x0), dpr = Math.min(2, window.devicePixelRatio || 1);
  MAP.w = Math.round(cssW * dpr); MAP.h = Math.round(cssW * ratio * dpr); MAP.s = MAP.w / (MAP.x1 - MAP.x0);
  mapCv.width = MAP.w; mapCv.height = MAP.h; mapWrap.style.width = cssW + 'px';
  MAP.base = canvasOf(MAP.w, MAP.h, g => {
    const s = MAP.s; g.setTransform(s, 0, 0, s, -MAP.x0 * s, -MAP.y0 * s);
    const poly = (p, fill, stroke, lw) => { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
    g.fillStyle = '#fbfaf6'; g.fillRect(MAP.x0, MAP.y0, MAP.x1 - MAP.x0, MAP.y1 - MAP.y0);
    H.floors.forEach(f => poly(f.poly, f.type === 'wood' ? '#ece6da' : f.level ? '#dcd6ca' : '#e2e5e6'));
    allFurniture().forEach(f => { if (!f.poly || ['robot', 'induction', 'hood', 'dw', 'sink', 'upper', 'panel', 'fridgecase', 'frame', 'wshelf', 'tvstand', 'curtain'].includes(f.type)) return; if (f.type === 'rug') { poly(f.poly, 'rgba(160,150,135,.28)'); return; } poly(f.poly, f.type === 'counter' ? '#d9bc93' : '#d5cfc3', big ? 'rgba(80,70,55,.45)' : null, 1.2 / s); });
    H.walls.forEach(w => { g.fillStyle = w.type === 'bearing' ? '#b3261e' : '#3d3a35'; g.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0); });
    H.windows.forEach(w => { g.fillStyle = '#6aa5dc'; g.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0); });
    if (big) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      H.spaces.forEach(sp => { if (sp.id === 'hall' || sp.id === 'ac') return; const cx = (sp.rect[0] + sp.rect[2]) / 2 + (sp.id === 'living' ? 60 : 0), cy = (sp.rect[1] + sp.rect[3]) / 2; g.font = `700 ${12.5 * dpr / s}px sans-serif`; g.lineWidth = 3.5 * dpr / s; g.strokeStyle = 'rgba(255,255,255,.85)'; g.strokeText(sp.name, cx, cy); g.fillStyle = '#2a2824'; g.fillText(sp.name, cx, cy); });
    }
  });
  mapDraw();
}
function mapDraw() {
  if (!mapWrap.classList.contains('on') || !MAP.base) return;
  const g = mapCv.getContext('2d'), s = MAP.s;
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(MAP.base, 0, 0);
  if (state.mode !== 'walk' && !light.inside) return;
  const px = (camera.position.x * 100 - MAP.x0) * s, py = (camera.position.z * 100 - MAP.y0) * s;
  const dir = camera.getWorldDirection(tmpV), a = Math.atan2(dir.z, dir.x), hf = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
  const R = (MAP.big ? 150 : 190) * s;
  const gr = g.createRadialGradient(px, py, 0, px, py, R); gr.addColorStop(0, 'rgba(217,98,43,.5)'); gr.addColorStop(1, 'rgba(217,98,43,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(px, py); g.arc(px, py, R, a - hf, a + hf); g.closePath(); g.fill();
  const rr = (MAP.big ? 7 : 5) * Math.min(2, window.devicePixelRatio || 1);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, rr, 0, 6.283); g.fill();
  g.fillStyle = '#d9622b'; g.beginPath(); g.arc(px, py, rr * 0.68, 0, 6.283); g.fill();
}
function mapSet(on, big) {
  MAP.big = !!big; mapWrap.classList.toggle('on', on); mapWrap.classList.toggle('big', on && MAP.big);
  $('tMap').classList.toggle('on', on && MAP.big);
  if (on) mapBuild();
}
let mapSmallPref = true;
function mapAuto() { if (MAP.big) return; mapSet(mapSmallPref && state.mode === 'walk', false); }
mapCv.addEventListener('click', e => {
  if (!MAP.big) { mapSet(true, true); return; }
  const r = mapCv.getBoundingClientRect(), x = MAP.x0 + (e.clientX - r.left) / r.width * (MAP.x1 - MAP.x0), y = MAP.y0 + (e.clientY - r.top) / r.height * (MAP.y1 - MAP.y0);
  if (!inHouse(x, y) || !GRID.nearestFree(x, y, 60)) { toast('집 안쪽을 탭해 주세요', 1400); return; }
  hideCard();
  if (state.mode === 'walk') { if (!walkTo(x, y)) enterAt(x, y); } else enterAt(x, y);
  MAP.big = false; mapAuto(); markRooms();
});
$('mapHint').addEventListener('click', () => { MAP.big = false; mapAuto(); });

// ---------- 시트 ----------
const sheets = ['sheetOpt', 'sheetMemo'].map($);
function openSheet(id) { sheets.forEach(s => s.classList.toggle('on', s.id === id)); $('scrim').classList.add('on'); hideCard(); }
function closeSheets() { sheets.forEach(s => s.classList.remove('on')); $('scrim').classList.remove('on'); }
$('scrim').addEventListener('click', closeSheets);
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheets));
sheets.forEach(s => {                        // 아래로 끌어 닫기
  const hd = s.querySelector('header'); let y0 = null;
  hd.addEventListener('pointerdown', e => { y0 = e.clientY; });
  hd.addEventListener('pointermove', e => { if (y0 != null && e.clientY - y0 > 60) { y0 = null; closeSheets(); } });
  hd.addEventListener('pointerup', () => { y0 = null; });
});

// 메모
(function buildMemo() {
  const DOT = { warn: '', real: 'd-real', photo: 'd-photo', est: 'd-est', new: 'd-new', info: 'd-info' };
  let html = '';
  H.memo.forEach(sec => {
    const ul = `<ul>${sec.items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
    if (sec.kind === 'warn') html += `<div class="m-warn"><h4>⚠ ${esc(sec.title)}</h4>${ul}</div>`;
    else html += `<h4><i class="dot ${DOT[sec.kind] || 'd-info'}"></i>${esc(sec.title)}</h4>${ul}`;
    if (sec.kind === 'info' && /마감재/.test(sec.title)) html += `<table>${H.finishes.map(f => `<tr><td><i class="sw" style="background:${f.color}"></i>${esc(f.part)}</td><td>${esc(f.model)}${f.note ? ` <span style="color:var(--mute)">(${esc(f.note)})</span>` : ''}</td></tr>`).join('')}</table>`;
  });
  $('memoBody').innerHTML = html;
  $('warnCount').textContent = H.memo.filter(s => s.kind === 'warn').reduce((n, s) => n + s.items.length, 0);
})();
$('bMemo').addEventListener('click', () => openSheet('sheetMemo'));
// 작업 인계 정보 (다른 세션에서 이어가기)
(function handoffUI() {
  const src = $('handoff'); if (!src) return;
  const box = document.createElement('div'); box.className = 'handoff';
  box.innerHTML = '<h4><i class="dot d-info"></i>작업 인계 정보</h4><div class="hintline" style="margin-top:0">이 HTML 파일 하나에 인계 문서와 모든 소스가 들어 있어요. 다른 Claude 세션에 이 파일을 주고 "파일 안의 handoff 문서를 읽고 이어서 작업해 줘"라고 하면 돼요.</div><div class="hbtns"><button id="hoShow">내용 보기</button><button id="hoCopy">인계 문서 복사</button></div><textarea id="hoText" readonly hidden></textarea>';
  $('memoBody').appendChild(box);
  const BS = String.fromCharCode(92), ta = $('hoText'); ta.value = src.textContent.split('<' + BS + '/script').join('</scr' + 'ipt').trim();
  $('hoShow').addEventListener('click', () => { ta.hidden = !ta.hidden; $('hoShow').textContent = ta.hidden ? '내용 보기' : '내용 접기'; });
  $('hoCopy').addEventListener('click', async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(ta.value); ok = true; } catch (e) { /* 아래 방법으로 */ }
    if (!ok) { ta.hidden = false; $('hoShow').textContent = '내용 접기'; ta.focus(); ta.select(); try { ok = document.execCommand('copy'); } catch (e) { ok = false; } }
    toast(ok ? '인계 문서를 복사했어요' : '복사가 막혀 있어요. 선택된 글을 길게 눌러 복사해 주세요', 2600);
  });
})();

// ---------- 방 바로가기 ----------
const roomsBar = $('rooms');
(function buildRooms() {
  const mk = (id, name) => { const b = document.createElement('button'); b.dataset.v = id; b.textContent = name; b.setAttribute('role', 'tab'); roomsBar.appendChild(b); };
  mk('all', '전체'); mk('plan', '평면');
  const sep = document.createElement('span'); sep.className = 'sep'; roomsBar.appendChild(sep);
  H.spaces.filter(s => s.shortcut).forEach(s => mk(s.id, s.name));
})();
function markRooms() {
  roomsBar.querySelectorAll('button').forEach(b => { const on = b.dataset.v === state.viewId; b.classList.toggle('on', on); if (on && b.scrollIntoView) { const r = b.getBoundingClientRect(), pr = roomsBar.getBoundingClientRect(); if (r.left < pr.left || r.right > pr.right) roomsBar.scrollLeft += r.left - pr.left - 40; } });
  const w = $('where');
  if (state.mode === 'orbit') w.textContent = state.viewId === 'plan' ? '위에서 본 평면' : '방을 탭해 보세요';
  else w.textContent = (state.space ? state.space.name : '집 안') + ' 둘러보는 중';
  mapAuto(); propBarUpdate();
}
let walkHinted = false;
roomsBar.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  hideCard();
  const v = b.dataset.v;
  if (v === 'all' || v === 'plan') goOrbit(v);
  else { goSpace(v); if (!walkHinted) { walkHinted = true; toast('드래그로 둘러보고, <b>바닥을 탭</b>하면 그 자리로 걸어가요', 4200); } }
  markRooms();
});
navHooks.moved.push(s => { state.viewId = s && s.shortcut ? s.id : null; markRooms(); });

// ---------- 옵션 ----------
$('tOpt').addEventListener('click', () => openSheet('sheetOpt'));
const segInit = (id, attr, fn) => { const box = $(id); box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset[attr]); }); };
const segSet = (id, attr, v) => $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset[attr] === v));
segInit('wallMode', 'w', v => { state.wallPref = v; if (state.mode === 'walk') toast('벽 보기는 전체·평면 시점에서 적용돼요', 2200); applyWalls(); shadowDirty(); });
const tog = (id, fn, also) => { const b = $(id); b.addEventListener('click', () => { const on = !b.classList.contains('on'); b.classList.toggle('on', on); if (also) $(also).classList.toggle('on', on); fn(on); invalidate(3); }); };
tog('oDoor', on => { state.doorOpen = on; });
tog('oFurn', on => { state.showFurn = on; furn.visible = on; hideCard(); shadowDirty(); });
tog('oLabels', on => { state.showLabels = on; });
const setDims = on => { state.showDims = on; dimG.visible = on; if (on) toast('<span style="color:#f7a8cc">■</span> 실측 <span style="color:#9cc0ff">■</span> 사진 계산 <span style="color:#d6d2c8">■</span> 추정 (cm)', 3000); };
tog('oDims', setDims, 'tDims'); tog('tDims', setDims, 'oDims');
tog('oMotion', on => { state.motionOpen = on; motion.flat.forEach(g => (g.visible = !on)); motion.open.forEach(g => (g.visible = on)); ['sofa', 'bed'].forEach((id, i) => (furnGroups[id] = (on ? motion.open : motion.flat)[i])); hideCard(); shadowDirty(); if (on) toast('소파 왼쪽 자리와 침대 오른쪽을 펼쳤어요 (각도는 가정)', 2600); });
// ---------- 배치 제안 (서재 배치안 · 화장대 위치) ----------
const PROP = { study: { list: H.studyPlans, label: '서재 배치안', space: 'study' }, vanity: { list: H.vanitySpots, label: '화장대 위치', space: 'bed' } };
function propCard(kind) {
  const P = PROP[kind], p = P.list.find(q => q.id === proposals[kind].cur);
  const li = a => a.map(t => `<li>${esc(t)}</li>`).join('');
  const sp = kind === 'vanity' ? (p.id === '3' ? 'study' : 'bed') : 'study', acts = { go: () => { hideCard(); goSpaceFor(kind, p); } };
  showCard(`<h3>${esc(p.title)}</h3><div class="sub">${esc(p.summary)}</div><div class="pc"><b class="good">좋은 점</b><ul>${li(p.pros)}</ul><b class="bad">아쉬운 점</b><ul>${li(p.cons)}</ul><b>치수</b><ul>${li(p.dims)}</ul></div>` +
    (state.space && state.space.id === sp && state.mode === 'walk' ? '' : `<div class="acts"><button data-a="go">${kind === 'study' ? '서재' : sp === 'study' ? '서재' : '침실'}에서 보기</button></div>`), acts);
}
function goSpaceFor(kind, p) {
  if (kind === 'study') { goWalk(new V3(6.22, 1.55, 1.3), new V3(8.6, 0.95, 0.85), photoFov(84)); state.space = spaceById('study'); state.viewId = 'study'; }
  else { const b = bboxOf(p.item.poly), cx = (b[0] + b[1]) / 2, cy = (b[2] + b[3]) / 2, S = p.item.face === 'S'; const e = S ? [cx + 60, cy + 150] : [cx + 190, cy + 70]; const f = GRID.nearestFree(e[0], e[1]) || e; goWalk(new V3(CM(f[0]), 1.5, CM(f[1])), new V3(CM(cx), 0.8, CM(cy)), photoFov(74)); state.space = spaceAt(f[0], f[1]); state.viewId = state.space && state.space.shortcut ? state.space.id : null; }
  markRooms();
}
function setProposal(kind, id, quiet) {
  proposals[kind].cur = id; applyProposals(); GRID.setDyn(activeProps());
  document.querySelectorAll(`[data-prop="${kind}"] button`).forEach(b => b.classList.toggle('on', b.dataset.id === id));
  shadowDirty(); propNote(kind);
}
document.querySelectorAll('[data-prop]').forEach(box => {
  const kind = box.dataset.prop;
  PROP[kind].list.forEach(p => { const b = document.createElement('button'); b.dataset.id = p.id; b.textContent = box.dataset.short ? p.id : p.name; b.classList.toggle('on', p.id === proposals[kind].cur); box.appendChild(b); });
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setProposal(kind, b.dataset.id); });
});
function propNote(kind) { const p = PROP[kind].list.find(q => q.id === proposals[kind].cur); document.querySelectorAll(`[data-propnote="${kind}"]`).forEach(n => (n.textContent = p.title + ' — ' + p.summary)); }
propNote('study'); propNote('vanity');
document.querySelectorAll('[data-propinfo]').forEach(b => b.addEventListener('click', () => { closeSheets(); propCard(b.dataset.propinfo); }));
function propBarUpdate() {
  const id = state.mode === 'walk' && state.space ? state.space.id : null;
  $('propStudy').style.display = id === 'study' ? '' : 'none'; $('propVanity').style.display = id === 'bed' ? '' : 'none';
}
$('tMap').addEventListener('click', () => { if (MAP.big) { MAP.big = false; mapAuto(); } else mapSet(true, true); });
$('tMeas').addEventListener('click', () => setMeasuring(!state.measuring));
$('measClear').addEventListener('click', measClear); $('measDone').addEventListener('click', () => setMeasuring(false));
segInit('lightMode', 'l', v => { light.night = v === 'night'; applyRig(); });
// 다운라이트 밝기 · 색온도 (저녁 조명에서 보이므로 조절하면 저녁으로 바꿈)
(function dlUI() {
  const bEl = $('dlBright'), kEl = $('dlTemp'), name = k => (k <= 3200 ? '전구색' : k <= 4500 ? '주백색' : '주광색');
  const show = () => { $('dlBrightV').textContent = Math.round(dl.b * 100) + '%'; $('dlTempV').textContent = dl.k + 'K · ' + name(dl.k); };
  bEl.value = Math.round(dl.b * 100); kEl.value = dl.k; show();
  const on = () => {
    dl.b = clamp(+bEl.value / 100, 0, 1); dl.k = clamp(+kEl.value, 2700, 6500); show();
    try { localStorage.setItem('house3d.dl', JSON.stringify(dl)); } catch (e) { /* 무시 */ }
    if (!light.night) { light.night = true; segSet('lightMode', 'l', 'night'); toast('다운라이트가 보이도록 저녁 조명으로 바꿨어요', 2200); }
    applyRig();
  };
  bEl.addEventListener('input', on); kEl.addEventListener('input', on);
  document.querySelectorAll('[data-dlk]').forEach(b => b.addEventListener('click', () => { kEl.value = b.dataset.dlk; on(); }));
})();
segInit('curtainMode', 'c', v => { curtainSet(v); invalidate(); toast(v === 'open' ? '전동 커튼을 열어요' : v === 'sheer' ? '거실 속커튼만 닫아요' : '커튼을 모두 닫아요', 1800); });
function qualNote() { $('qualNote').textContent = (qualPref === 'auto' ? '자동 → 지금은 ' : '지금은 ') + tier.name + (post.active ? ' (부드러운 그림자 + 음영 + 계단 현상 제거)' : ' (기본 그림자)') + (qualPref === 'auto' ? '. 느리면 알아서 낮춰요.' : ''); }
segInit('qualMode', 'q', v => {
  qualPref = v; try { localStorage.setItem('house3d.q', v); } catch (e) { /* 무시 */ }
  setTier(v === 'auto' ? (IS_TOUCH ? 'mid' : 'high') : v); perf.reset();
});
qualityHooks.push(fromAuto => { applyRig(); qualNote(); if (fromAuto) toast('부드럽게 움직이도록 화질을 한 단계 낮췄어요', 2600); });
segSet('qualMode', 'q', qualPref);
