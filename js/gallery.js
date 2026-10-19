// Unity's photo wall: her own black-and-white childhood photos, taped straight onto the wallpaper above the bed on the
// left wall, like real prints in a real bedroom. Ten pictures: the six kids on the sofa, the carnival prince at her
// hospital crib, the ping pong table and seven shots of the old street (some from the city archive, the family ones
// digitised from her dad's pictures). They are her real photos, never generated, recoloured or cropped:
// tools/make_gallery_atlas.py only packs them into one texture (assets/img/gallery_atlas.jpg) and each keeps its shape.
// History: a scattered wall of framed photos ("a bit too chaos, the frames overlap") -> one big cork board (in the Quest:
// "it's massive, the board takes away from the images") -> now: no board, no frames. Real-life print sizes (about
// 13 x 18 cm, the family ones a little bigger), white borders, a strip or two of masking / washi tape each, three loose
// rows, a little tilted, nothing overlapping, no tape on any picture (only on the white borders).
// Depth order (no z-fighting): wallpaper < print shadow +2 mm < print paper +4 mm < photo +6 mm < tape +8 mm.
// Four draw calls (print paper + shadows, photos, tape), no interaction: it's a wall of memories, it just hangs there.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene) return;
const scene = RV.scene, RX = RV.room.RX;

// left wall (x = -RX). Local frame: +x runs along the wall towards the window (world -z), +y up, +z into the room.
// Free stretch above the bed: headboard top y 1.05; picture rail y 2.46; FIND ME ON poster from world z -1.29 (window
// side); cartridge shelf (top y 0.9) at world z 0.84..1.76 on the door side. The bed spans world z -0.35..0.75, so the
// photos are centred over it (world z 0.2 -> local u -0.2).
const root = new THREE.Group(); root.name = 'photoWall';
root.position.set(-RX, 0, 0); root.rotation.y = Math.PI / 2; scene.add(root);

// atlas rects from tools/make_gallery_atlas.py: [u0, v0, u1, v1, pixel w, pixel h]
const UV = {"kids": [0.07324, 0.78223, 0.25928, 0.96826, 381, 381], "hospital": [0.40381, 0.77734, 0.59473, 0.97266, 391, 400], "street_a": [0.69531, 0.77734, 0.96973, 0.97266, 562, 400], "street_b": [0.0332, 0.52734, 0.29932, 0.72266, 545, 400], "street_c": [0.36084, 0.52734, 0.6377, 0.72266, 567, 400], "street_d": [0.69482, 0.52734, 0.96973, 0.72266, 563, 400], "street_e": [0.02539, 0.27734, 0.30762, 0.47266, 578, 400], "street_f": [0.36182, 0.27734, 0.63721, 0.47266, 564, 400], "street_g": [0.69141, 0.27734, 0.97314, 0.47266, 577, 400], "pingpong": [0.02197, 0.02734, 0.31104, 0.22266, 592, 400]};

// the patch of wall the photos live on (local u = -world z): over the bed, between the headboard and the picture rail
const AREA = { u: -0.2, W: 1.30, y0: 1.22, y1: 2.02 };
const SHADOW = 0.002, PAPER = 0.004, PHOTO = 0.006, TAPE = 0.008;
const BORDER = 0.012;    // white print border round each photo: the tape sits on it, never on the picture
const TW = 0.05, TH = 0.02;   // a torn-off strip of tape: 5 x 2 cm, half of it (1 cm) on the print's border

// three loose rows; h = photo height (m), dx / dy = nudge, rot = tilt (deg), hold = how it's taped up
const ROWS = [
  { y: 1.84, items: [
    { id: 'street_a', h: 0.142, dx: 0.01,  dy: 0.008,  rot: -1.8, hold: 'tape',  tape: 0xe8dcb4 },
    { id: 'street_d', h: 0.142, dx: -0.01, dy: -0.01,  rot: 1.4,  hold: 'tape2', tape: 0xf2a7b8 },
    { id: 'street_g', h: 0.142, dx: 0.0,   dy: 0.004,  rot: -0.9, hold: 'tape',  tape: 0x9fd8c2 },
  ] },
  { y: 1.60, items: [
    { id: 'street_b', h: 0.142, dx: 0.02,  dy: -0.006, rot: 1.6,  hold: 'tape',  tape: 0xf5d36a },
    { id: 'kids',     h: 0.175, dx: 0.0,   dy: 0.006,  rot: -0.7, hold: 'tape4', tape: 0xe8dcb4 },
    { id: 'hospital', h: 0.175, dx: 0.0,   dy: -0.004, rot: 1.1,  hold: 'tape2', tape: 0xe8dcb4 },
    { id: 'street_c', h: 0.142, dx: -0.02, dy: 0.008,  rot: -1.4, hold: 'tape',  tape: 0xf2a7b8 },
  ] },
  { y: 1.37, items: [
    { id: 'street_e', h: 0.142, dx: 0.03,  dy: 0.004,  rot: 0.9,  hold: 'tape2', tape: 0x9fd8c2 },
    { id: 'pingpong', h: 0.15,  dx: 0.0,   dy: -0.008, rot: -1.5, hold: 'tape',  tape: 0xe8dcb4 },
    { id: 'street_f', h: 0.142, dx: -0.03, dy: 0.002,  rot: 1.7,  hold: 'tape',  tape: 0xf5d36a },
  ] },
];

// --- geometry helpers: bake every piece into one non-indexed buffer per draw call
function Buf() { return { p: [], n: [], uv: [], c: [] }; }
const col = new THREE.Color();
function put(buf, g, m, color, uvRect) {
  g = g.index ? g.toNonIndexed() : g; g.applyMatrix4(m);
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
  if (color != null) col.set(color);
  for (let i = 0; i < P.count; i++) {
    buf.p.push(P.getX(i), P.getY(i), P.getZ(i)); buf.n.push(N.getX(i), N.getY(i), N.getZ(i));
    let u = U.getX(i), v = U.getY(i); if (uvRect) { u = uvRect[0] + u * (uvRect[2] - uvRect[0]); v = uvRect[1] + v * (uvRect[3] - uvRect[1]); }
    buf.uv.push(u, v); if (color != null) buf.c.push(col.r, col.g, col.b);
  }
}
function mesh(buf, mat, name) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(buf.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(buf.n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2)); if (buf.c.length) g.setAttribute('color', new THREE.Float32BufferAttribute(buf.c, 3));
  const o = new THREE.Mesh(g, mat); o.name = name; root.add(o); return o;
}

const prints = Buf(), shadows = Buf(), photos = Buf(), tape = Buf(), placed = [];
const M4 = new THREE.Matrix4(), T = new THREE.Matrix4(), Q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), S1 = new THREE.Vector3(1, 1, 1);
const inner = { u0: AREA.u - AREA.W / 2, u1: AREA.u + AREA.W / 2, y0: AREA.y0, y1: AREA.y1 };

for (const row of ROWS) {
  const dims = row.items.map(it => { const r = UV[it.id]; const h = it.h, w = h * r[4] / r[5]; return { w, h, PW: w + 2 * BORDER, PH: h + 2 * BORDER }; });
  const total = dims.reduce((s, d) => s + d.PW, 0), gap = (AREA.W - total) / (row.items.length + 1);
  let u = inner.u0 + gap;
  row.items.forEach((it, k) => {
    const d = dims[k], r = UV[it.id], cu = u + d.PW / 2 + (it.dx || 0), cy = row.y + it.dy; u += d.PW + gap;
    Q.setFromAxisAngle(Z, it.rot * Math.PI / 180);
    const base = new THREE.Matrix4().compose(new THREE.Vector3(cu, cy, 0), Q, S1);
    const at = (x, y, z) => M4.copy(base).multiply(T.makeTranslation(x, y, z));
    put(prints, new THREE.PlaneGeometry(d.PW, d.PH), at(0, 0, PAPER), 0xf1ece0);                    // white print border
    put(shadows, new THREE.PlaneGeometry(d.PW * 1.2, d.PH * 1.2), at(0.004, -0.006, SHADOW), null);              // its soft shadow on the wallpaper
    put(photos, new THREE.PlaneGeometry(d.w, d.h), at(0, 0, PHOTO), null, r);
    const holds = [], V = new THREE.Vector3();
    const mark = (x, y, w, h, a) => { V.set(x, y, 0).applyMatrix4(base); holds.push({ u: +V.x.toFixed(4), y: +V.y.toFixed(4), w, h, rot: it.rot + a }); };
    // tape strip: across the print's edge, half on the white border (1 cm of a 1.2 cm border), half on the wallpaper
    const strip = (x, y, a, c) => (mark(x, y, TW, TH, a), put(tape, new THREE.PlaneGeometry(TW, TH), at(x, y, TAPE).multiply(T.makeRotationZ(a * Math.PI / 180)), c));
    if (it.hold === 'tape') strip(0, d.PH / 2, 0, it.tape);
    else if (it.hold === 'tape2') { const ex = d.PW / 2 - 0.035; strip(-ex, d.PH / 2, 0, it.tape); strip(ex, d.PH / 2, 0, it.tape); }
    else if (it.hold === 'tape4') { const ex = d.PW / 2 - 0.035; strip(-ex, d.PH / 2, 0, it.tape); strip(ex, d.PH / 2, 0, it.tape); strip(-ex, -d.PH / 2, 0, it.tape); strip(ex, -d.PH / 2, 0, it.tape); }
    placed.push({ id: it.id, u: +cu.toFixed(4), y: +cy.toFixed(4), worldZ: -cu, w: d.w, h: d.h, W: d.PW, H: d.PH, rot: it.rot, hold: it.hold, holds,
      front: PHOTO, aspect: +(d.w / d.h).toFixed(4), srcAspect: +(r[4] / r[5]).toFixed(4) });
  });
}

// soft shadow texture: a blurred dark rectangle (transparent, never writes depth)
const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sx = sc.getContext('2d');
sx.filter = 'blur(4px)'; sx.fillStyle = 'rgba(8,2,16,0.55)'; sx.fillRect(6, 6, 52, 52);
const shadowTex = new THREE.CanvasTexture(sc);

// a little grey self-light so the old prints stay readable from across the room (the light switch dims it at night)
const printMat = new THREE.MeshPhongMaterial({ vertexColors: true, emissive: 0x262626, shininess: 20, specular: 0x1a1a1a });
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
const atlas = new THREE.TextureLoader().load('assets/img/gallery_atlas.jpg', () => { api.ready = true; });
atlas.encoding = THREE.sRGBEncoding;
atlas.anisotropy = (RV.renderer && RV.renderer.capabilities.getMaxAnisotropy()) || 4;
const photoMat = new THREE.MeshPhongMaterial({ map: atlas, emissiveMap: atlas, emissive: 0x4a4a4a, shininess: 25, specular: 0x1c1c1c });
const tapeMat = new THREE.MeshPhongMaterial({ vertexColors: true, emissive: 0x202020, transparent: true, opacity: 0.88, shininess: 10, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const mShadows = mesh(shadows, shadowMat, 'photoWallShadows'); mShadows.renderOrder = 1;
const mPrints = mesh(prints, printMat, 'photoWallPrints');
const mPhotos = mesh(photos, photoMat, 'photoWallPhotos');
const mTape = mesh(tape, tapeMat, 'photoWallTape'); mTape.renderOrder = 2;

const api = RV.gallery = { root, board: null, frames: mPrints, prints: mPrints, shadows: mShadows, photos: mPhotos, tape: mTape,
  items: placed, inner, border: BORDER, ready: false, count: placed.length };
})();
