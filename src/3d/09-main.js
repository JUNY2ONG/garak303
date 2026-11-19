// ===== 09 main: 그리기 루프 · 자동 화질 · 시작 =====
const perf = {
  n: 0, sum: 0, lastT: 0,
  reset() { this.n = 0; this.sum = 0; this.lastT = 0; },
  sample(now, continuous) {
    if (!continuous || !this.lastT) { this.lastT = continuous ? now : 0; return; }
    const d = now - this.lastT; this.lastT = now;
    if (d > 400) return;
    this.sum += d; this.n++;
    if (this.n >= 26) {
      const avg = this.sum / this.n; this.n = 0; this.sum = 0;
      if (qualPref === 'auto' && avg > 50 && tierName !== 'low') setTier(tierName === 'high' ? 'mid' : 'low', true);
    }
  },
};
let lastNow = performance.now(), firstFrame = true;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
  const moving = film.on ? filmStep(now) : stepNav(now, dt);
  let doorMoving = false;
  if (!film.on) doorObjs.forEach(d => {
    const tg = state.doorOpen ? d.a1 : d.a0;
    if (d.cur === tg) return;
    d.cur = Math.abs(tg - d.cur) < 0.004 ? tg : d.cur + (tg - d.cur) * Math.min(1, dt * 7);
    d.pivot.rotation.y = d.cur; doorMoving = true;
  });
  if (doorMoving) shadowDirty();
  updateCutaway();
  if (needRender <= 0) { perf.lastT = 0; return; }
  needRender--;
  if (meas.g.children.length) updateMeasScale();
  const aoAmt = light.inside ? 1.0 : 0.85;
  post.render(scene, camera, aoAmt);
  updateOcclusion(now); updateLabels(); mapDraw();
  perf.sample(now, moving || doorMoving || ptrs.size > 0);
  if (firstFrame) { firstFrame = false; $('loading').classList.add('off'); window.__ready = true; }
}

window.addEventListener('resize', () => { resize(); viewOffDirty = true; invalidate(4); if (mapWrap.classList.contains('on')) mapBuild(); });
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); toast('그래픽이 잠시 끊겼어요. 화면을 다시 열어 주세요.', 6000); });

// ---------- 시작 ----------
resize();
buildStructure(0); state.lowNow = false;
collectMats();
applyWalls(); applyRig();
const startView = QS.get('v');
if (startView && spaceById(startView)) goSpace(startView, true); else goOrbit(startView === 'plan' ? 'plan' : 'all', true);
if (QS.get('night')) { light.night = true; segSet('lightMode', 'l', 'night'); applyRig(); }
markRooms(); qualNote();
setTimeout(() => toast('방 이름을 누르면 안으로 들어가요<br><b>가구·가전·창을 탭</b>하면 정보가 떠요', 4800), 700);
requestAnimationFrame(frame);
if (QS.get('film')) setTimeout(filmStart, 300);

// 검증용 훅
window.__house = { look: (px, py, ph, lx, ly, lh, fov) => goWalk(new V3(CM(px), CM(ph), CM(py)), new V3(CM(lx), CM(lh), CM(ly)), fov || photoFov(74), { instant: true }), setProposal, hemi, sun, fills, lamps, MAT, getMats: () => allMats, shadowDirty, state, goSpace, goOrbit, enterAt, walkTo, setTier, invalidate, camera, light, applyRig, renderer, GRID, pickAt, tierName: () => tierName, post, mapSet, setMeasuring, measAdd, cardFurn, cardWin, walk, applyWalkCam, fx, film: { start: filmStart, stop: filmStop, seek: filmSeek, go: filmGo, pause: filmPause, state: film, scenes: SCENES } };
