// Unity Eagle, player 1, as a little voxel figurine on the bookshelf next to the TV.
// Built at load time from her real 8-bit sprite (assets/img/unity_eagle_sprite.png, the 108x144 sprite from the
// charlie-season arcade site): every sprite pixel becomes a voxel column, the body is deep and rounded, the spread
// wings are thin, so she reads as a solid figure from the side and not a flat card. One mesh, one draw call, unlit
// vertex colours with baked face shading so the sprite colours stay true in the dim room.
(function () {
const RV = window.RV; if (!RV || !RV.scene) return;
const scene = RV.scene;

// where she stands: middle shelf board of the bookshelf right of the TV (room.js: x 1.7..RX-0.04, z -RZ..-1.86, boards at y 1.2 and 1.585)
const SHELF = { x: 2.13, y: 1.2 + 0.0125, z: -2.04 };
const FIG_H = 0.24;            // figure height (m) without the plinth
const PLINTH_H = 0.022;
const YAW = -0.38;             // turned a little toward the middle of the room

const root = new THREE.Group(); root.name = 'unityFigurine';
root.position.set(SHELF.x, SHELF.y, SHELF.z); root.rotation.y = YAW; scene.add(root);
RV.figurine = { root, ready: false };

// plinth: black plastic disc with a brass rim and a little 1P plaque, like the console under the TV
(function () {
  const blackM = new THREE.MeshPhongMaterial({ color: 0x15141a, shininess: 40, specular: 0x333333 });
  const brassM = new THREE.MeshPhongMaterial({ color: 0xb8913f, shininess: 70, specular: 0x8a6a2a });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, PLINTH_H, 28), blackM); disc.position.y = PLINTH_H / 2; root.add(disc);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.0765, 0.0765, 0.004, 28), brassM); rim.position.y = PLINTH_H - 0.002; root.add(rim);
  const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d');
  x.fillStyle = '#b8913f'; x.fillRect(0, 0, 128, 32); x.fillStyle = '#2a1a08'; x.fillRect(3, 3, 122, 26); x.fillStyle = '#ffe14a';
  x.font = '14px "Press Start 2P", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('1P UNITY', 64, 17);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.magFilter = THREE.NearestFilter;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.016), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  plaque.position.set(0, PLINTH_H / 2, 0.0805); plaque.rotation.x = -0.06; root.add(plaque);
  RV.figurine.plaqueTex = t;
  if (document.fonts && document.fonts.load) document.fonts.load('14px "Press Start 2P"').then(() => {
    x.fillStyle = '#2a1a08'; x.fillRect(3, 3, 122, 26); x.fillStyle = '#ffe14a'; x.fillText('1P UNITY', 64, 17); t.needsUpdate = true;
  }).catch(() => { });
})();

function build(img) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0); const D = cx.getImageData(0, 0, W, H).data;
  const on = new Uint8Array(W * H); let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (D[(y * W + x) * 4 + 3] > 128) { on[y * W + x] = 1; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  // distance to the outline (chamfer 3-4), so the depth rounds off toward the silhouette
  const INF = 1e9, dist = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) dist[i] = on[i] ? INF : 0;
  const g = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : dist[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!on[i]) continue; dist[i] = Math.min(dist[i], g(x - 1, y) + 3, g(x, y - 1) + 3, g(x - 1, y - 1) + 4, g(x + 1, y - 1) + 4); }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!on[i]) continue; dist[i] = Math.min(dist[i], g(x + 1, y) + 3, g(x, y + 1) + 3, g(x + 1, y + 1) + 4, g(x - 1, y + 1) + 4); }
  // half-depth in voxels: deep, rounded torso, head and legs near the centre line; thin spread wings out to the sides
  const mid = (minX + maxX + 1) / 2, bodyHalfW = (maxX - minX + 1) * 0.2;
  const hd = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!on[i]) continue;
    const d = dist[i] / 3, off = Math.abs(x + 0.5 - mid);
    const cap = off < bodyHalfW ? 13 : off < bodyHalfW + 8 ? 13 - (off - bodyHalfW) * 1.25 : 3;   // body 13, blend, wings 3
    hd[i] = Math.max(1, Math.min(Math.round(cap), Math.round(1 + Math.sqrt(d) * 3.2)));
  }
  const vox = FIG_H / (maxY - minY + 1);
  const col = new Float32Array(W * H * 3), tmp = new THREE.Color();
  for (let i = 0; i < W * H; i++) if (on[i]) { tmp.setRGB(D[i * 4] / 255, D[i * 4 + 1] / 255, D[i * 4 + 2] / 255).convertSRGBToLinear(); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b; }
  const P = [], C = [], I = []; let nv = 0;
  // baked light per face direction (unlit material): a soft key from the upper left front
  const SH = { f: 0.95, b: 0.55, t: 1.0, d: 0.5, l: 0.82, r: 0.68 };
  const X = x => (x - mid) * vox, Y = y => (maxY + 1 - y) * vox + PLINTH_H, Z = k => k * vox;
  function quad(a, b, c2, d, ci, s) {
    P.push(...a, ...b, ...c2, ...d); const r = col[ci * 3] * s, gg = col[ci * 3 + 1] * s, bb = col[ci * 3 + 2] * s;
    for (let k = 0; k < 4; k++) C.push(r, gg, bb);
    I.push(nv, nv + 1, nv + 2, nv, nv + 2, nv + 3); nv += 4;
  }
  const hAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : hd[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!on[i]) continue; const h = hd[i];
    const x0 = X(x), x1 = X(x + 1), y0 = Y(y + 1), y1 = Y(y), zf = Z(h), zb = -Z(h);
    quad([x0, y0, zf], [x1, y0, zf], [x1, y1, zf], [x0, y1, zf], i, SH.f);          // front (+z)
    quad([x1, y0, zb], [x0, y0, zb], [x0, y1, zb], [x1, y1, zb], i, SH.b);          // back (-z)
    // side walls where the neighbour is shallower (both halves, front and back)
    const nL = hAt(x - 1, y), nR = hAt(x + 1, y), nU = hAt(x, y - 1), nD = hAt(x, y + 1);
    for (const sgn of [1, -1]) {
      if (nL < h) { const za = sgn * Z(nL), zz = sgn * Z(h); if (sgn > 0) quad([x0, y0, za], [x0, y0, zz], [x0, y1, zz], [x0, y1, za], i, SH.l); else quad([x0, y0, zz], [x0, y0, za], [x0, y1, za], [x0, y1, zz], i, SH.l); }
      if (nR < h) { const za = sgn * Z(nR), zz = sgn * Z(h); if (sgn > 0) quad([x1, y0, zz], [x1, y0, za], [x1, y1, za], [x1, y1, zz], i, SH.r); else quad([x1, y0, za], [x1, y0, zz], [x1, y1, zz], [x1, y1, za], i, SH.r); }
      if (nU < h) { const za = sgn * Z(nU), zz = sgn * Z(h); if (sgn > 0) quad([x0, y1, zz], [x1, y1, zz], [x1, y1, za], [x0, y1, za], i, SH.t); else quad([x0, y1, za], [x1, y1, za], [x1, y1, zz], [x0, y1, zz], i, SH.t); }
      if (nD < h) { const za = sgn * Z(nD), zz = sgn * Z(h); if (sgn > 0) quad([x0, y0, za], [x1, y0, za], [x1, y0, zz], [x0, y0, zz], i, SH.d); else quad([x0, y0, zz], [x1, y0, zz], [x1, y0, za], [x0, y0, za], i, SH.d); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  mesh.name = 'unityEagleVoxels'; root.add(mesh);
  Object.assign(RV.figurine, { mesh, ready: true, voxels: on.reduce((a, b) => a + b, 0), verts: nv, tris: I.length / 3, size: { w: (maxX - minX + 1) * vox, h: FIG_H, d: 2 * 13 * vox }, vox });
}

const img = new Image();
img.onload = () => { try { build(img); } catch (e) { console.error('figurine', e); RV.figurine.error = String(e); } };
img.onerror = () => { RV.figurine.error = 'sprite failed to load'; };
img.src = 'assets/img/unity_eagle_sprite.png';
})();
