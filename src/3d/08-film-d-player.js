// ===== 08 film (d) player: 재생 — 시작 · 매 프레임 · 일시정지 · 건너뛰기 · 끝내고 되돌리기 =====
(function filmInit() {            // 장면 시작 시각 · 전환 가림막 · 진행 막대
  let t = 0;
  SCENES.forEach((s, i) => {
    s.t0 = t; t += s.dur; s.cues = s.cues || [];
    if (s.ch) s.wipe = chWipe(s.ch);
    if (i > 0) { s.cues.push([0.45, () => wipe.reveal()]); if (s.cut !== false) SCENES[i - 1].cues.push([SCENES[i - 1].dur - 0.75, () => wipe.cover(s.wipe)]); }
  });
  SCENES.forEach(s => s.cues.sort((a, b) => a[0] - b[0]));
  film.total = t;
  $('fProg').innerHTML = SCENES.map(s => `<i style="flex:${s.dur}"><b></b></i>`).join('');
  film.bars = [...$('fProg').querySelectorAll('b')];
})();

const F_ICON = { pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>', play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>' };
function filmEnter(i) {
  const cur = SCENES[film.idx];
  if (cur) { if (cur.exit) cur.exit(); filmClear(); }
  film.idx = i; film.cue = 0; film.fresh = true;
  const s = SCENES[i];
  $('fChap').textContent = s.ch ? s.ch.no + ' ' + s.ch.name : s.label;
}
function filmSetup() {            // 가림막이 화면을 다 덮은 뒤 한 번
  film.ready = true;
  state.wallPref = 'full'; furn.visible = true; dimG.visible = false;
  curtainSet('open', true);                                             // 영상에서는 커튼을 열어 둠
  if (proposals.study.cur !== 'A') setProposal('study', 'A');          // 영상에서 서재는 A안만 (끝나면 보던 안으로 되돌림)
  camera.clearViewOffset(); viewOffY = 0; film.offKey = '';
}
function filmStep(now) {
  const dtm = Math.min(400, now - film.last); film.last = now;
  if (!film.paused && !film.closing) film.t += dtm / 1000;
  invalidate();
  if (film.t < 0 || film.closing) return true;                        // 가림막이 덮이는 동안은 그대로 둠
  if (!film.ready) filmSetup();
  if (film.idx < 0) filmEnter(0);
  while (!SCENES[film.idx].last && film.t >= SCENES[film.idx].t0 + SCENES[film.idx].dur) filmEnter(film.idx + 1);
  const s = SCENES[film.idx], tl = film.t - s.t0;
  if (film.fresh) {
    film.fresh = false; film.ff = tl; film.ct = 0;
    filmEl.classList.toggle('lt', s.theme === 'lt'); filmEl.classList.toggle('shade', s.theme !== 'lt');
    filmEnv(s.inside, s.night); fxSet(FXP[s.fx]); s.enter(s);
  }
  while (film.cue < s.cues.length && s.cues[film.cue][0] <= tl) { const c = s.cues[film.cue++]; film.ct = c[0]; film.ff = tl - c[0]; c[1](s); }
  film.ff = 0;
  if (film.laters.length) film.laters = film.laters.filter(l => (l.t <= film.t ? (l.fn(), false) : true));
  s.update(tl);
  fW = view.clientWidth; fH = view.clientHeight;
  const port = fPortrait(), ox = s.offX && !port ? Math.round(s.offX * fW) : 0, oy = s.offYp && port ? Math.round(s.offYp * fH) : 0, key = ox + ':' + oy + ':' + fW + ':' + fH;       // 화면 중심 옮기기
  if (key !== film.offKey) { film.offKey = key; if (ox || oy) camera.setViewOffset(fW, fH, ox, oy, fW, fH); else camera.clearViewOffset(); }
  if (film.shadow) { film.shadow = false; shadowDirty(); }
  filmOverlay(tl);
  film.bars.forEach((b, j) => { const k = j < film.idx ? 1 : j > film.idx ? 0 : fSat(tl / s.dur); if (b._k !== k) { b._k = k; b.style.transform = `scaleX(${k.toFixed(4)})`; } });
  return true;
}
function filmPause(p, quiet) {
  film.paused = p; filmEl.classList.toggle('paused', p);
  $('fPause').innerHTML = p ? F_ICON.play : F_ICON.pause;
  const f = $('fFlash'); f.innerHTML = p ? F_ICON.pause : F_ICON.play; f.className = 'f-flash';
  if (!quiet) { void f.offsetWidth; f.className = p ? 'f-flash stay' : 'f-flash go'; }
}
function filmStart() {
  if (film.on) return;
  hideCard(); closeSheets(); lightPanelSet(false); if (state.measuring) setMeasuring(false);
  MAP.big = false; mapSet(false, false);
  tween = null; walk.path = null; walk.vy = walk.vp = 0; controls.enabled = false;
  film.saved = { night: light.night, wallPref: state.wallPref, study: proposals.study.cur, curtain: curtainMode };
  document.body.classList.add('film'); filmEl.classList.add('on'); filmEl.classList.remove('lt', 'shade');
  film.on = true; film.ready = false; film.closing = false; film.idx = -1; film.t = -0.72; film.last = performance.now();
  filmPause(false, true); film.bars.forEach(b => { b._k = 0; b.style.transform = 'scaleX(0)'; });
  $('fChap').textContent = '';
  wipe.cover(''); invalidate();
}
function filmRestore() {          // 영상이 바꾼 것을 모두 원래대로
  const cur = SCENES[film.idx];
  if (cur && cur.exit) cur.exit();
  filmClear(); film.idx = -1;
  filmUnitsAt(null); filmRise(null); fxSet(null);
  if (film.ready) {
    state.wallPref = film.saved.wallPref; light.night = film.saved.night;
    if (proposals.study.cur !== film.saved.study) setProposal('study', film.saved.study);
    curtainSet(film.saved.curtain, true);
    furn.visible = state.showFurn; dimG.visible = state.showDims;
  }
  film.on = false; film.ready = false; film.closing = false;
  fLoc.on = false; fLoc.el.classList.remove('on');
  document.body.classList.remove('film'); filmEl.classList.remove('lt', 'shade', 'paused');
  goOrbit('all', true); applyWalls(); applyRig(); viewOffDirty = true; markRooms();
}
function filmStop() {
  if (!film.on || film.closing) return;
  film.closing = true; filmEl.classList.remove('paused');
  if (!/cover|hold/.test(wipe.el.className)) wipe.cover('');
  setTimeout(() => { filmRestore(); wipe.reveal(); setTimeout(() => { if (!film.on) { filmEl.classList.remove('on'); wipe.clear(); } }, 820); }, 700);
}
function filmGo(i) {              // 장면 처음으로 (가림막을 덮은 채 시작해서 걷어 냄)
  if (!film.on || film.closing || film.t < 0) return;
  i = clamp(i, 0, SCENES.length - 1);
  filmEnter(i); film.t = SCENES[i].t0; film.ff = 0;
  wipe.hold(SCENES[i].wipe || '');
  if (film.paused) filmPause(false, true);
}
function filmSeek(t, pause) {     // 검증용: 아무 시각으로나
  if (!film.on) filmStart();
  let i = 0; while (!SCENES[i].last && t >= SCENES[i].t0 + SCENES[i].dur) i++;
  filmEnter(i); film.t = t; wipe.clear();
  if (i === 0 && t < 3.3) wipe.hold('');
  filmPause(!!pause, true);
}
$('bFilm').addEventListener('click', filmStart);
$('fClose').addEventListener('click', filmStop);
$('fPause').addEventListener('click', () => filmPause(!film.paused));
$('fZones').addEventListener('click', e => {
  const z = e.target.dataset.z; if (!z || !film.on || film.t < 0) return;
  const s = SCENES[film.idx] || SCENES[0];
  if (z === 'toggle') { if (!s.last) filmPause(!film.paused); }
  else if (z === 'next') { if (!s.last) filmGo(film.idx + 1); }
  else filmGo(film.t - s.t0 > 2.5 || film.idx === 0 ? film.idx : film.idx - 1);
});
fStage.addEventListener('click', e => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  if (b.dataset.f === 'replay') filmGo(0); else filmStop();
});
window.addEventListener('keydown', e => {
  if (!film.on) return;
  if (e.key === 'Escape') filmStop();
  else if (e.key === ' ') { e.preventDefault(); filmPause(!film.paused); }
  else if (e.key === 'ArrowRight') filmGo(film.idx + 1);
  else if (e.key === 'ArrowLeft') filmGo(film.idx - 1);
});
