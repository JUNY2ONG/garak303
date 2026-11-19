// ===== 08 film (c) scenes: 장면 표 — 카메라 동선 · 자막 · 사건 =====
// 장면 = { id, dur(초), theme('lt' = 밝은 배경에 어두운 글자), inside, night, fx(FXP 이름), enter(), exit(), update(tl), cues: [[초, 함수]] }
// ch가 있으면 방 장면: 전환 가림막에 번호·이름이 뜨고 위치 지도에 그 방이 표시된다. cut: false면 앞 장면에서 끊지 않고 이어짐.
// offX / offYp: 화면 중심을 옮김 (가로 화면 / 세로 화면) — 글자 판과 집이 겹치지 않게.
const CH = {
  entry: { id: 'entry', no: '01', name: '현관', en: 'ENTRANCE', desc: '유리 중문과 천장까지 닿는 신발장' },
  living: { id: 'living', no: '02', name: '거실', en: 'LIVING ROOM', kind: 'real', desc: '확장 발코니까지 이어지는 전면창, 리클라이너 소파와 77인치 TV' },
  kitchen: { id: 'kitchen', no: '03', name: '주방', en: 'KITCHEN · DINING', kind: 'calc', desc: '냉장고 깊이에 맞춘 상·하부장과 맞은편 키큰장' },
  study: { id: 'study', no: '04', name: '서재', en: 'STUDY', kind: 'real', desc: '둘이 나란히 앉는 우드 스튜디오 (A안)' },
  closet: { id: 'closet', no: '05', name: '옷방', en: 'DRESSING ROOM', kind: 'real', desc: 'ㄱ자 시스템장과 스타일러 자리' },
  bed: { id: 'bed', no: '06', name: '침실', en: 'BEDROOM', kind: 'real', desc: '모션베드와 화장대, 저녁의 침실' },
};
const chWipe = ch => `<div class="w-ch">${ch.no ? `<b>${ch.no}</b>` : ''}<span><em>${ch.en}</em><strong>${ch.name}</strong></span></div>`;
const TITLE_HTML = `<div class="w-title"><div class="kick an a-fade" style="--d:.15s">OUR HOME · 3D TOUR</div>` +
  `<h1><span class="ln">${fChars('우리집을', 0.3, 0.06)}</span><span class="ln">${fChars('소개합니다', 0.55, 0.06)}</span></h1>` +
  `<div class="rule an a-line" style="--d:1.0s;transform-origin:50% 50%"></div><div class="sub an a-rise" style="--d:1.2s">실측 치수로 지은 3D 도면 · 1분 20초 투어</div></div>`;

// 현관 → 거실은 끊지 않고 한 번에 걸어 들어간다 (현관 장면 7.5초 + 거실 장면)
const ENTRY_DUR = 7.5;
const camEL = fTrack([
  [0.0, 498, -240, 150, 487, -20, 116, 1],
  [3.1, 494, -176, 150, 486, 30, 116, 1],
  [4.5, 486, -20, 150, 498, 160, 117, 1],
  [5.7, 483, 70, 150, 484, 250, 114, 1],
  [7.0, 474, 138, 150, 330, 230, 112, 1],
  [8.6, 452, 166, 150, 150, 170, 122, 1],
  [11.0, 416, 196, 148, 40, 178, 122, 1],
  [13.0, 378, 226, 146, 262, 60, 76, 1],
  [14.3, 362, 208, 146, 262, 205, 60, 1],
  [15.8, 356, 196, 146, 272, 354, 122, 1],
], false, false);
const camKitchen = fTrack([
  [0.0, 455, 372, 150, 690, 262, 96, 1],
  [3.4, 490, 362, 150, 702, 265, 96, 1],
  [5.8, 575, 348, 148, 830, 300, 108, 1],
  [8.5, 628, 346, 148, 850, 395, 118, 1],
], true, true);
const camStudy = fTrack([
  [0.0, 546, 181, 154, 700, 140, 122, 1],
  [2.6, 616, 160, 154, 840, 82, 98, 1.06],
  [5.6, 630, 142, 152, 868, 92, 94, 1.06],
  [8.5, 646, 128, 152, 905, 104, 96, 1.06],
], true, true);
const camCloset = fTrack([
  [0.0, 646, 440, 152, 720, 600, 120, 1],
  [2.6, 640, 505, 150, 800, 625, 115, 1.06],
  [5.2, 648, 540, 150, 870, 600, 105, 1.06],
  [7.5, 664, 556, 150, 880, 572, 98, 1.06],
], true, true);
const camBed = fTrack([
  [0.0, 500, 398, 148, 300, 470, 112, 1],
  [2.4, 442, 408, 148, 250, 524, 90, 1],
  [4.8, 408, 432, 148, 240, 604, 70, 1],
  [7.2, 404, 490, 148, 210, 392, 104, 1],
  [9.0, 402, 500, 148, 200, 390, 104, 1],
], true, true);

const SCENES = [
  // ---- 오프닝: 제목 → 도면(벽 · 실측 치수선) → 벽이 현관에서부터 물결처럼 올라옴 → 가구가 방 순서대로 등장 ----
  { id: 'open', label: '도면에서 집으로', dur: 14, theme: 'lt', inside: false, night: false, fx: 'open', offYp: 0.07,
    enter() {
      wipe.set(TITLE_HTML);
      filmDoors(F_OPEN);
      film.units = filmUnits(); filmUnitsAt(-1, 0); filmRise(0);
      const ds = H.dims.filter(d => /^\d+$/.test(d.t) && +d.t >= 100 && d.kind !== 'est');
      ds.forEach((d, i) => dimLine(d, 4.3 + i * 0.22, 7.7));
      H.rooms.filter(r => !r.small && r.kind !== 'est').forEach((r, i) => roomTag(r, 9.5 + i * 0.16, 13.3));
      planDraw(3.3, 7.7);
    },
    exit() { filmUnitsAt(null); filmRise(null); },
    cues: [
      [3.3, () => wipe.reveal()],
      [3.6, s => (s.cap = stepCap('STEP 01', '실측 치수에서 시작해서', '<div class="lg an a-fade" style="--d:.5s"><span><i class="dot d-real"></i>실측</span><span><i class="dot d-est"></i>계산</span><span>단위 cm</span></div>'))],
      [6.5, s => { fOut(s.cap); s.cap = stepCap('STEP 02', '벽을 세우고'); }],
      [8.6, s => { fOut(s.cap); s.cap = stepCap('STEP 03', '가구와 가전을 채우면'); }],
      [11.2, s => { fOut(s.cap); s.cap = stepCap('OUR HOME', '미리 살아 보는 우리집'); }],
    ],
    update(tl) {
      filmRise(tl < 6.5 ? 0 : tl > 9.4 ? null : fSeg(tl, 6.5, 9.3) * RISE_END);
      filmUnitsAt(tl, 8.7);
      const kt = ease(fSeg(tl, 6.3, 10.6)), fov = lerp(16, 30, kt), pol = lerp(0.012, 0.712, kt), F = filmFrame(fov, 0.712, fPortrait() ? 1.5 : 1.75, 1.5);
      const dist = lerp(F.plan, F.iso, kt) * lerp(1.08, 1, eOutCubic(fSeg(tl, 3.2, 8)));
      fCamOrbit(lerp(0, 0.6, kt), F.base - F.sway * (0.8 * kt + 0.2 * fSeg(tl, 10.6, 14)), pol, dist, fov);
    } },
  // ---- 01 현관: 현관문 · 중문이 열리며 걸어 들어감 ----
  { id: 'entry', ch: CH.entry, dur: ENTRY_DUR, inside: true, night: false, fx: 'day',
    enter() {
      filmDoors({ _: 1, 'd-ac': 0, 'd-front': 0, 'd-mid': 0 });
      coProd('lock', [521, -27, 105], 1.15, 2.5, { side: 'l', rise: 60 });
      callout([483, 105, 207], 3.2, 4.6, '유리 중문', '흰 프레임 · 간유리 여닫이', { rise: 30 });
      coProd('shoe', [533, 88, 150], 3.9, 5.2, { sub: '천장까지 · 현관 왼쪽 칸', rise: 10 });
    },
    cues: [[0.5, s => (s.lt = lowerThird(CH.entry))], [6.6, s => fOut(s.lt)]],
    update(tl) {
      filmDoors({ _: 1, 'd-ac': 0, 'd-front': ease(fSeg(tl, 1.9, 3.2)), 'd-mid': ease(fSeg(tl, 3.9, 5.1)) });
      fCamWalk(camEL(tl));
    } },
  // ---- 02 거실 (현관에서 이어짐) ----
  { id: 'living', ch: CH.living, dur: 9.5, cut: false, inside: true, night: false, fx: 'day',
    enter() {
      filmDoors(F_OPEN);
      const lw = H.windows.find(q => q.id === 'w-living');
      callout([2, 190, 150], 2.4, 4.8, '거실 전면창', `폭 약 ${Math.round(lw.y1 - lw.y0)} · 창턱 ${lw.sill} cm · 전동 커튼`, { rise: 20 });
      coProd('sofa', [280, 62, 98], 5.1, 7.2, { rise: 46 });
      coProd('ltable', [280, 197, 61], 6.5, 7.8, { title: '소파 앞 테이블', sub: '무인양품 호두나무 130 × 65', up: false, rise: 30 });
      coProd('tv', [280, 353, 172], 7.9, 9.4, { rise: 30 });
    },
    cues: [[0.25, s => (s.lt = lowerThird(CH.living))]],
    update(tl) { fCamWalk(camEL(tl + ENTRY_DUR)); } },
  // ---- 03 주방 ----
  { id: 'kitchen', ch: CH.kitchen, dur: 8.5, inside: true, night: false, fx: 'day',
    enter() {
      filmDoors(F_OPEN);
      const bb = id => bboxOf(H.furniture.find(q => q.id === id).poly), mid = (b, y, h) => [(b[0] + b[1]) / 2, y, h];
      const ro = bb('robot'), ind = bb('induction'), dw = bb('dw'), fr = bb('fridge'), tc = bb('tallcab'), fa = H.furniture.find(q => q.id === 'faucet').at;
      coProd('robot', mid(ro, ro[3], 9), 0.9, 2.7, { sub: '걸레받이 안에 쏙', up: false, rise: 18 });
      coProd('induction', mid(ind, (ind[2] + ind[3]) / 2, 88), 1.4, 3.5, { rise: 64 });
      coProd('dw', mid(dw, dw[3], 50), 2.6, 4.5, { up: false, rise: 26 });
      coProd('fridge', mid(fr, fr[3], 150), 3.0, 4.8, { rise: 40 });
      coProd('purifier', [fa[0], fa[1] + 2, 100], 4.9, 6.5, { rise: 50 });
      coProd('tallcab', mid(tc, tc[2], 112), 6.6, 8.2, { title: '키큰장', sub: '바닥~천장 · 가운데 오픈 칸', rise: 50 });
    },
    cues: [[0.6, s => (s.lt = lowerThird(CH.kitchen))]],
    update(tl) { fCamWalk(camKitchen(tl)); } },
  // ---- 04 서재: A안만 보여 줌 (사용자 결정. 영상 내내 A안으로 고정 — filmSetup) ----
  { id: 'study', ch: CH.study, dur: 8.5, inside: true, night: false, fx: 'day',
    enter() {
      filmDoors(F_OPEN);
      const it = id => H.studyPlans[0].items.find(q => q.id === id), box = id => bboxOf(it(id).poly);
      const d = box('sA-d'), w = box('sA-w'), sb = box('sA-s');
      callout([(d[0] + d[1]) / 2, d[3], it('sA-d').h + 2], 2.3, 4.7, '원목 책상 + 32인치 모니터 2대', `상판 ${d[1] - d[0]} × ${d[3] - d[2]} · 1인당 ${(d[1] - d[0]) / 2}`, { up: false, rise: 44 });
      callout([w[1] - 34, w[3], it('sA-w').h0 + 4], 3.8, 6.0, '벽 선반 + 간접조명', '책상 위 · 바닥에서 150', { rise: 34 });
      callout([sb[0], (sb[2] + sb[3]) / 2, it('sA-s').h + 2], 5.9, 8.0, '창 아래 장', `폭 ${sb[3] - sb[2]} × 깊이 ${sb[1] - sb[0]} × 높이 ${it('sA-s').h}`, { rise: 40 });
    },
    cues: [[0.6, s => (s.lt = lowerThird(CH.study))]],
    update(tl) { fCamWalk(camStudy(tl)); } },
  // ---- 05 옷방 ----
  { id: 'closet', ch: CH.closet, dur: 7.5, inside: true, night: false, fx: 'day',
    enter() {
      filmDoors(F_OPEN);
      coProd('styler', [700, 638, 150], 1.2, 3.2, { rise: 30 });
      coProd('closetL', [800, 640, 190], 3.2, 5.6, { title: 'ㄱ자 시스템장', sub: '2750 + 1280 꺾임 · 깊이 600', rise: 16 });
      coProd('drawer', [848, 590, 88], 5.2, 6.9, { rise: 50 });
    },
    cues: [[0.6, s => (s.lt = lowerThird(CH.closet))]],
    update(tl) { fCamWalk(camCloset(tl)); } },
  // ---- 마감재: 실제 재질 무늬 견본 판 ----
  { id: 'finish', label: '마감재', wipe: chWipe({ en: 'MATERIALS', name: '마감재' }), dur: 8, theme: 'lt', inside: false, night: false, fx: 'open', offX: -0.25, offYp: 0.2,
    enter() { filmDoors(F_OPEN); },
    cues: [[0.75, () => finishBoard()]],
    update(tl) {
      const fov = 30, pol = 0.74, F = filmFrame(fov, pol, 1.5, fPortrait() ? 1.75 : 1.5);
      fCamOrbit(0.6, F.base + F.sway * (0.9 - 0.2 * tl), pol, F.iso * (fPortrait() ? 1.42 : 1.14) * lerp(1.06, 1, eOutCubic(fSeg(tl, 0, 6))), fov);
    } },
  // ---- 06 침실 (저녁 조명) ----
  { id: 'bed', ch: CH.bed, dur: 9, inside: true, night: true, fx: 'night',
    enter() {
      filmDoors(F_OPEN);
      coProd('bed', [276, 560, 66], 2.6, 5.0, { rise: 70 });
      const vs = H.vanitySpots.find(p => p.id === proposals.vanity.cur), b = bboxOf(vs.item.poly);
      if (b[2] > 300) coProd('vanity', [(b[0] + b[1]) / 2, b[3], 122], 6.4, 8.4, { side: 'l', rise: 46 });
      callout([vs.tv.at[0], vs.tv.at[1] + 6, 140], 6.0, 8.2, 'TV 50" 이동식 스탠드', '화면이 침대 쪽을 봐요', { side: 'l', rise: 70 });
    },
    cues: [[0.6, s => (s.lt = lowerThird(CH.bed))]],
    update(tl) { fCamWalk(camBed(tl)); } },
  // ---- 엔딩: 저녁 전경 + 다시 보기 / 직접 둘러보기 ----
  { id: 'end', label: '엔딩', dur: 8, last: true, inside: false, night: true, fx: 'end', offX: -0.17, offYp: -0.06,
    enter() { filmDoors(F_OPEN); },
    cues: [[1.3, () => fAdd(`<div><div class="kick an a-fade">OUR HOME</div><h2>${fChars('우리집 3D', 0.12, 0.06)}</h2><p class="an a-rise" style="--d:.7s">실측 치수 · 가전 · 마감재까지<br>이 파일 하나에 담았어요</p></div>` +
      `<div class="acts an a-rise" style="--d:1.1s"><button class="sec" data-f="replay"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>다시 보기</button>` +
      `<button class="pri" data-f="explore">직접 둘러보기<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>`, 'f-end')]],
    update(tl) {
      const fov = 30, pol = 0.76, F = filmFrame(fov, pol, 1.5, fPortrait() ? 1.55 : 1.4);
      fCamOrbit(0.6, F.base + F.sway * Math.sin((tl - 3) * 0.2), pol, F.iso * (fPortrait() ? 1.45 : 1) * lerp(1.1, 1, eOutCubic(fSeg(tl, 0, 6))), fov);
    } },
];
