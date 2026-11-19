// ===== 02 builders: 도형을 재질별로 모아 한 덩어리로 (그리기 횟수 줄이기) =====
// 텍스처가 실제 크기(m)로 붙도록 UV를 좌표에서 계산
function worldUV(geo, swap) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    if (swap) { const t = u; u = v; v = t; }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
function mergeGeos(list) {
  let total = 0;
  const flat = list.map(g => { const q = g.index ? g.toNonIndexed() : g; total += q.attributes.position.count; return q; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  flat.forEach(g => {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingBox(); out.computeBoundingSphere();
  list.forEach(g => g.dispose()); flat.forEach(g => g.dispose());
  return out;
}
class Batch {
  constructor(matrix) { this.parts = new Map(); this.matrix = matrix || null; }
  add(mat, geo, o) {
    o = o || {};
    if (!geo.attributes.uv || o.uv !== false) worldUV(geo, o.swap);
    if (this.matrix) geo.applyMatrix4(this.matrix);
    const key = mat.uuid + (o.cast === false ? ':0' : ':1');
    let e = this.parts.get(key);
    if (!e) this.parts.set(key, e = { mat, cast: o.cast !== false, geos: [] });
    e.geos.push(geo);
    return this;
  }
  // 단위 m. o: { r: 모서리 둥글기(m), cast, swap, seg }
  box(mat, x0, x1, y0, y1, z0, z1, o) {
    o = o || {};
    const W = Math.abs(x1 - x0), Hh = Math.abs(y1 - y0), D = Math.abs(z1 - z0);
    if (W < 1e-5 || Hh < 1e-5 || D < 1e-5) return this;
    let geo;
    const r = o.r ? Math.min(o.r, W / 2 - 1e-4, Hh / 2 - 1e-4, D / 2 - 1e-4) : 0;
    if (r > 0.0015) geo = new THREE.RoundedBoxGeometry(W, Hh, D, o.seg || 2, r);
    else geo = new THREE.BoxGeometry(W, Hh, D);
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(mat, geo, o);
  }
  // 단위 cm, 평면좌표 (x, 높이 h, y)
  boxC(mat, x0, x1, h0, h1, y0, y1, o) {
    if (o && o.r) o = Object.assign({}, o, { r: o.r / 100 });
    return this.box(mat, x0 / 100, x1 / 100, h0 / 100, h1 / 100, y0 / 100, y1 / 100, o);
  }
  // 원기둥: 중심 (x,y,z) m, axis 'x'|'y'|'z'
  cyl(mat, r0, r1, len, x, y, z, axis, o) {
    o = o || {};
    const geo = new THREE.CylinderGeometry(r0, r1, len, o.seg || 20, 1, !!o.open);
    if (axis === 'x') geo.rotateZ(Math.PI / 2); else if (axis === 'z') geo.rotateX(Math.PI / 2);
    geo.translate(x, y, z);
    return this.add(mat, geo, o);
  }
  geo(mat, geo, o) { return this.add(mat, geo, o); }
  build(parent, pick) {
    const g = new THREE.Group();
    this.parts.forEach(e => {
      const m = new THREE.Mesh(mergeGeos(e.geos), e.mat);
      m.castShadow = e.cast && !e.mat.transparent; m.receiveShadow = true; m.customDepthMaterial = RISE_DEPTH;
      g.add(m);
    });
    this.parts.clear();
    if (pick) g.userData.pick = pick;
    if (parent) parent.add(g);
    return g;
  }
}
const bboxOf = poly => { const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; };
function disposeGroup(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); if (g.parent) g.parent.remove(g); }
