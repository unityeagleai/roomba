// Unity's photo board: her own black-and-white childhood photos, pinned and taped to one big cork board above the bed
// on the left wall. Ten pictures: the six kids on the sofa, the carnival prince at her hospital crib, the ping pong table
// and seven shots of the old street (some from the city archive, the family ones digitised from her dad's pictures).
// They are her real photos, never generated, recoloured or cropped: tools/make_gallery_atlas.py only packs them into one
// texture (assets/img/gallery_atlas.jpg) and each picture keeps its own shape.
// Her feedback on the first version (a scattered wall of framed photos): "a bit too chaos, the frames overlap". So: no
// frames, no overlaps. One cork board in a chunky oak frame, the photos as old white-bordered prints in three loose rows,
// a little tilted, held by coloured thumbtacks or strips of masking / washi tape. Nothing overlaps another photo.
// Depth order (no z-fighting): wall < board backing < cork 1.6 cm < print shadow +2.5 mm < print paper +5 mm < photo +7.5 mm < tape +10 mm < pins.
// Five draw calls (board, prints, photos, tape, pins), no interaction: it's a wall of memories, it just hangs there.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene) return;
const scene = RV.scene, RX = RV.room.RX;

// left wall (x = -RX). Local frame: +x runs along the wall towards the window (world -z), +y up, +z into the room.
// Free stretch above the bed: headboard top y 1.05; picture rail y 2.46; FIND ME ON poster from world z -1.29 (window
// side); cartridge shelf (top y 0.9) at world z 0.84..1.76 on the door side. The bed spans world z -0.35..0.75.
const root = new THREE.Group(); root.name = 'photoWall';
root.position.set(-RX, 0, 0); root.rotation.y = Math.PI / 2; scene.add(root);

// atlas rects from tools/make_gallery_atlas.py: [u0, v0, u1, v1, pixel w, pixel h]
const UV = {"kids": [0.07324, 0.78223, 0.25928, 0.96826, 381, 381], "hospital": [0.40381, 0.77734, 0.59473, 0.97266, 391, 400], "street_a": [0.69531, 0.77734, 0.96973, 0.97266, 562, 400], "street_b": [0.0332, 0.52734, 0.29932, 0.72266, 545, 400], "street_c": [0.36084, 0.52734, 0.6377, 0.72266, 567, 400], "street_d": [0.69482, 0.52734, 0.96973, 0.72266, 563, 400], "street_e": [0.02539, 0.27734, 0.30762, 0.47266, 578, 400], "street_f": [0.36182, 0.27734, 0.63721, 0.47266, 564, 400], "street_g": [0.69141, 0.27734, 0.97314, 0.47266, 577, 400], "pingpong": [0.02197, 0.02734, 0.31104, 0.22266, 592, 400]};

// the board: u (along the wall) -1.30 .. 1.12, y 1.12 .. 2.40
const BOARD = { u: -0.09, y: 1.76, W: 2.42, H: 1.28, frame: 0.045, depth: 0.016 };
const CORK_Z = BOARD.depth, PAPER = 0.005, PHOTO = 0.0075, TAPE = 0.010;
const BORDER = 0.022;    // white print border round each photo: pins and tape sit on it, never on the picture

// three loose rows; h = photo height (m), dy = nudge up/down, rot = tilt (deg), hold = how it's stuck up
const ROWS = [
  { y: 2.165, items: [
    { id: 'street_a', h: 0.29, dy: 0.006,  rot: -1.6, hold: 'pin',   pin: 0xd23a32 },
    { id: 'street_d', h: 0.29, dy: -0.008, rot: 1.2,  hold: 'tape',  tape: 0xe8dcb4 },
    { id: 'street_g', h: 0.29, dy: 0.004,  rot: -0.8, hold: 'pins2', pin: 0xf0c02a },
  ] },
  { y: 1.775, items: [
    { id: 'street_b', h: 0.29, dy: -0.004, rot: 1.5,  hold: 'tape',  tape: 0xf2a7b8 },
    { id: 'kids',     h: 0.31, dy: 0.004,  rot: -0.6, hold: 'tape4', tape: 0xe8dcb4 },
    { id: 'hospital', h: 0.30, dy: -0.002, rot: 1.0,  hold: 'pin',   pin: 0x2f7ad6 },
    { id: 'street_c', h: 0.29, dy: 0.006,  rot: -1.3, hold: 'tape',  tape: 0x9fd8c2 },
  ] },
  { y: 1.385, items: [
    { id: 'street_e', h: 0.29, dy: 0.004,  rot: 0.9,  hold: 'pins2', pin: 0x3fae5a },
    { id: 'pingpong', h: 0.29, dy: -0.006, rot: -1.4, hold: 'tape',  tape: 0xf5d36a },
    { id: 'street_f', h: 0.29, dy: 0.002,  rot: 1.7,  hold: 'pin',   pin: 0xd23a32 },
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

// cork texture: warm tan with darker and lighter granules (seeded, so it's the same every load)
const cc = document.createElement('canvas'); cc.width = cc.height = 512; const cx = cc.getContext('2d');
cx.fillStyle = '#b07a46'; cx.fillRect(0, 0, 512, 512);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 9000; i++) {
  const s = rnd(); cx.fillStyle = s < 0.45 ? `rgba(120,74,38,${0.25 + rnd() * 0.4})` : s < 0.8 ? `rgba(200,150,95,${0.25 + rnd() * 0.4})` : `rgba(80,48,24,${0.3 + rnd() * 0.4})`;
  const r = 0.6 + rnd() * 2.2; cx.beginPath(); cx.arc(rnd() * 512, rnd() * 512, r, 0, 6.283); cx.fill();
}
const corkTex = new THREE.CanvasTexture(cc); corkTex.wrapS = corkTex.wrapT = THREE.RepeatWrapping; corkTex.encoding = THREE.sRGBEncoding;

const board = Buf(), cork = Buf(), prints = Buf(), photos = Buf(), tape = Buf(), pins = Buf(), placed = [];
const M4 = new THREE.Matrix4(), T = new THREE.Matrix4(), Q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), S1 = new THREE.Vector3(1, 1, 1);
const X90 = new THREE.Matrix4().makeRotationX(Math.PI / 2);   // cylinders point out of the board

// board: dark backing, cork face, oak frame round it
const B = BOARD, oak = 0x9a6a3a, F = B.frame;
const bAt = (x, y, z) => new THREE.Matrix4().makeTranslation(B.u + x, B.y + y, z);
put(board, new THREE.BoxGeometry(B.W - 0.02, B.H - 0.02, CORK_Z - 0.005), bAt(0, 0, 0.001 + (CORK_Z - 0.005) / 2), 0x3a2618);
put(board, new THREE.BoxGeometry(B.W, F, CORK_Z + 0.012), bAt(0, (B.H - F) / 2, (CORK_Z + 0.012) / 2 + 0.0005), oak);
put(board, new THREE.BoxGeometry(B.W, F, CORK_Z + 0.012), bAt(0, -(B.H - F) / 2, (CORK_Z + 0.012) / 2 + 0.0005), oak);
put(board, new THREE.BoxGeometry(F, B.H - 2 * F, CORK_Z + 0.012), bAt(-(B.W - F) / 2, 0, (CORK_Z + 0.012) / 2 + 0.0005), oak);
put(board, new THREE.BoxGeometry(F, B.H - 2 * F, CORK_Z + 0.012), bAt((B.W - F) / 2, 0, (CORK_Z + 0.012) / 2 + 0.0005), oak);
const cw = B.W - 2 * F, ch = B.H - 2 * F, cg = new THREE.PlaneGeometry(cw, ch);
const cuv = cg.attributes.uv; for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * cw / 0.6, cuv.getY(i) * ch / 0.6);
put(cork, cg, bAt(0, 0, CORK_Z), null);
const inner = { u0: B.u - cw / 2, u1: B.u + cw / 2, y0: B.y - ch / 2, y1: B.y + ch / 2 };

for (const row of ROWS) {
  const dims = row.items.map(it => { const r = UV[it.id]; const h = it.h, w = h * r[4] / r[5]; return { w, h, PW: w + 2 * BORDER, PH: h + 2 * BORDER }; });
  const total = dims.reduce((s, d) => s + d.PW, 0), gap = (cw - total) / (row.items.length + 1);
  let u = inner.u0 + gap;
  row.items.forEach((it, k) => {
    const d = dims[k], r = UV[it.id], cu = u + d.PW / 2, cy = row.y + it.dy; u += d.PW + gap;
    Q.setFromAxisAngle(Z, it.rot * Math.PI / 180);
    const base = new THREE.Matrix4().compose(new THREE.Vector3(cu, cy, 0), Q, S1);
    const at = (x, y, z) => M4.copy(base).multiply(T.makeTranslation(x, y, z));
    put(prints, new THREE.PlaneGeometry(d.PW, d.PH), at(0, 0, CORK_Z + PAPER), 0xf1ece0);              // white print border
    put(prints, new THREE.PlaneGeometry(d.PW, d.PH), at(0.004, -0.006, CORK_Z + 0.0025), 0x4a2e18);   // its shadow on the cork
    put(photos, new THREE.PlaneGeometry(d.w, d.h), at(0, 0, CORK_Z + PHOTO), null, r);
    const top = d.PH / 2 - BORDER / 2;   // middle of the top border
    const holds = [], V = new THREE.Vector3();
    const mark = (x, y, w, h, a) => { V.set(x, y, 0).applyMatrix4(base); holds.push({ u: +V.x.toFixed(4), y: +V.y.toFixed(4), w, h, rot: it.rot + a }); };
    const pin = (x, y, c) => { mark(x, y, 0.017, 0.017, 0);
      put(pins, new THREE.CylinderGeometry(0.0085, 0.0085, 0.006, 16), at(x, y, CORK_Z + TAPE + 0.003).multiply(X90), c);
      put(pins, new THREE.CylinderGeometry(0.005, 0.0075, 0.007, 16), at(x, y, CORK_Z + TAPE + 0.0095).multiply(X90), new THREE.Color(c).multiplyScalar(0.8).getHex());
    };
    // tape strip: 4.2 cm tall, sits across the print's edge with at most 1.9 cm on the print, so it stays on the white border
    const strip = (x, y, a, c) => (mark(x, y, 0.075, 0.038, a), put(tape, new THREE.PlaneGeometry(0.075, 0.038), at(x, y, CORK_Z + TAPE).multiply(T.makeRotationZ(a * Math.PI / 180)), c));
    if (it.hold === 'pin') pin(0, top, it.pin);
    else if (it.hold === 'pins2') { pin(-d.PW / 2 + 0.03, top, it.pin); pin(d.PW / 2 - 0.03, top, it.pin); }
    else if (it.hold === 'tape') strip(0, d.PH / 2, 0, it.tape);
    else if (it.hold === 'tape4') { const ex = d.PW / 2 - 0.035; strip(-ex, d.PH / 2, 0, it.tape); strip(ex, d.PH / 2, 0, it.tape); strip(-ex, -d.PH / 2, 0, it.tape); strip(ex, -d.PH / 2, 0, it.tape); }
    placed.push({ id: it.id, u: +cu.toFixed(4), y: +cy.toFixed(4), worldZ: -cu, w: d.w, h: d.h, W: d.PW, H: d.PH, rot: it.rot, hold: it.hold, holds,
      front: CORK_Z + PHOTO, aspect: +(d.w / d.h).toFixed(4), srcAspect: +(r[4] / r[5]).toFixed(4) });
  });
}

const boardMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, specular: 0x2a2018 });
const corkMat = new THREE.MeshPhongMaterial({ map: corkTex, emissiveMap: corkTex, emissive: 0x2a2a2a, shininess: 4, specular: 0x0a0806 });
const printMat = new THREE.MeshPhongMaterial({ vertexColors: true, emissive: 0x262626, shininess: 20, specular: 0x1a1a1a });
const atlas = new THREE.TextureLoader().load('assets/img/gallery_atlas.jpg', () => { api.ready = true; });
atlas.encoding = THREE.sRGBEncoding;
atlas.anisotropy = (RV.renderer && RV.renderer.capabilities.getMaxAnisotropy()) || 4;
// a little self-light so the old prints stay readable in the lava-lamp dark, like the other posters
const photoMat = new THREE.MeshPhongMaterial({ map: atlas, emissiveMap: atlas, emissive: 0x4a4a4a, shininess: 25, specular: 0x1c1c1c });
const tapeMat = new THREE.MeshPhongMaterial({ vertexColors: true, emissive: 0x202020, transparent: true, opacity: 0.88, shininess: 10, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const pinMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: 0x666666, emissive: 0x181818 });
const mBoard = mesh(board, boardMat, 'photoBoardFrame');
const mCork = mesh(cork, corkMat, 'photoBoardCork');
const mPrints = mesh(prints, printMat, 'photoBoardPrints');
const mPhotos = mesh(photos, photoMat, 'photoWallPhotos');
const mTape = mesh(tape, tapeMat, 'photoBoardTape'); mTape.renderOrder = 2;
const mPins = mesh(pins, pinMat, 'photoBoardPins');

const api = RV.gallery = { root, board: mBoard, cork: mCork, frames: mBoard, prints: mPrints, photos: mPhotos, tape: mTape, pins: mPins,
  items: placed, inner, border: BORDER, ready: false, count: placed.length };
})();
