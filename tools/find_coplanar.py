"""Finds surfaces that would z-fight: triangles of two different meshes that lie in the same plane (within EPS metres),
face the same way and overlap. Runs inside the page after load (all of room.js, media.js, figurine.js built).
Usage: python3 tools/find_coplanar.py URL [EPS]"""
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; EPS = float(sys.argv[2]) if len(sys.argv) > 2 else 0.002
JS = r'''(EPS) => {
  const out = [], planes = [];
  RV.scene.updateMatrixWorld(true);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const label = m => { let s = m.name || ''; let p = m; const chain = []; while (p && p !== RV.scene) { if (p.name) chain.push(p.name); p = p.parent; }
    const g = m.geometry, t = g.type.replace('Geometry', ''), mat = Array.isArray(m.material) ? m.material[0] : m.material;
    const mn = Object.keys(RV.mat || {}).find(k => RV.mat[k] === mat); const col = (mn ? 'M.' + mn + ' ' : '') + (mat && mat.color ? '#' + mat.color.getHexString() : ''), map = mat && mat.map ? (mat.map.image && mat.map.image.src ? mat.map.image.src.split('/').pop() : 'canvas') : '';
    const wp = new THREE.Vector3(); m.getWorldPosition(wp);
    return `${t}${chain.length ? ' [' + chain.join('<') + ']' : ''} ${col}${map ? ' map:' + map : ''} @(${wp.x.toFixed(3)},${wp.y.toFixed(3)},${wp.z.toFixed(3)}) s(${m.scale.x.toFixed(3)},${m.scale.y.toFixed(3)},${m.scale.z.toFixed(3)})`; };
  let id = 0;
  RV.scene.traverse(m => {
    if (!m.isMesh || m.isInstancedMesh || !m.geometry || !m.geometry.attributes.position) return;
    if (!m.visible) { let p = m; } 
    let vis = true; for (let p = m; p; p = p.parent) if (!p.visible) vis = false;
    const g = m.geometry, pos = g.attributes.position, idx = g.index; const tri = idx ? idx.count / 3 : pos.count / 3;
    if (tri > 6000) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (mat && (mat.depthTest === false || mat.visible === false)) return;
    const mid = id++, mw = m.matrixWorld, L = label(m) + (vis ? '' : ' (hidden now)');
    for (let t = 0; t < tri; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(mw); b.fromBufferAttribute(pos, i1).applyMatrix4(mw); c.fromBufferAttribute(pos, i2).applyMatrix4(mw);
      e1.subVectors(b, a); e2.subVectors(c, a); n.crossVectors(e1, e2); const area = n.length() / 2; if (area < 1e-7) continue; n.normalize();
      const R = RV.room, ax0 = [n.x, n.y, n.z], dd = n.dot(a); let intoWall = false;
      if (Math.abs(n.x) > 0.99 && Math.abs(dd - R.RX) < 0.002) intoWall = true; if (Math.abs(n.z) > 0.99 && Math.abs(dd - R.RZ) < 0.002) intoWall = true; if (n.y < -0.99 && Math.abs(dd) < 0.002) intoWall = true;
      if (intoWall) continue;
      planes.push({ mat, flat: !(mat && mat.map), mid, L, double: mat && mat.side === THREE.DoubleSide, n: n.toArray(), d: n.dot(a), v: [a.toArray(), b.toArray(), c.toArray()] });
    }
  });
  // bucket by quantised normal
  const key = p => p.n.map(x => Math.round(x * 50)).join(',');
  const buckets = {}; for (const p of planes) (buckets[key(p)] = buckets[key(p)] || []).push(p);
  const pairs = {};
  function proj(p, ax) { return p.v.map(v => [v[ax[0]], v[ax[1]]]); }
  function triOverlap(A, B) { // separating axis on 2D triangles, with a small shrink so shared edges don't count
    const polys = [A, B];
    for (const P of polys) for (let i = 0; i < 3; i++) {
      const p0 = P[i], p1 = P[(i + 1) % 3], nx = p1[1] - p0[1], ny = p0[0] - p1[0];
      let amin = 1e9, amax = -1e9, bmin = 1e9, bmax = -1e9;
      for (const q of A) { const s = q[0] * nx + q[1] * ny; amin = Math.min(amin, s); amax = Math.max(amax, s); }
      for (const q of B) { const s = q[0] * nx + q[1] * ny; bmin = Math.min(bmin, s); bmax = Math.max(bmax, s); }
      const tol = 1e-4 * Math.hypot(nx, ny);
      if (amax <= bmin + tol || bmax <= amin + tol) return false;
    }
    return true;
  }
  for (const k in buckets) {
    const arr = buckets[k];
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const p = arr[i], q = arr[j]; if (p.mid === q.mid) continue;
      const dot = p.n[0] * q.n[0] + p.n[1] * q.n[1] + p.n[2] * q.n[2]; if (dot < 0.9995) continue;
      if (Math.abs(p.d - q.d) > EPS) continue;
      if (p.mat === q.mat && p.flat) continue;   // same flat colour: a flush joint, nothing to see
      const an = p.n.map(Math.abs), drop = an.indexOf(Math.max(...an)), ax = [0, 1, 2].filter(x => x !== drop);
      if (!triOverlap(proj(p, ax), proj(q, ax))) continue;
      const kk = p.mid < q.mid ? p.mid + '|' + q.mid : q.mid + '|' + p.mid;
      if (!pairs[kk]) pairs[kk] = { a: p.mid < q.mid ? p.L : q.L, b: p.mid < q.mid ? q.L : p.L, n: p.n.map(x => +x.toFixed(2)), gap: Math.abs(p.d - q.d), count: 0 };
      pairs[kk].count++; pairs[kk].gap = Math.min(pairs[kk].gap, Math.abs(p.d - q.d));
    }
  }
  return { meshes: id, tris: planes.length, pairs: Object.values(pairs) };
}'''
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(3500)
    r = pg.evaluate(JS, EPS)
    print('meshes', r['meshes'], 'tris', r['tris'], 'errors', errs)
    for x in sorted(r['pairs'], key=lambda x: -x['count']):
        print(f"{x['count']:4d} tris  gap {x['gap']*1000:.2f}mm  n{x['n']}\n   A: {x['a']}\n   B: {x['b']}")
    b.close()
