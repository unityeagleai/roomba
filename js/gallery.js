// Unity's photo wall: her own black-and-white childhood photos, hung above the bed on the left wall like a gallery wall
// that grew over the years. Ten pictures (she sent ten, two of them the same file, then the ping pong table): the six
// kids on the sofa, the carnival prince at her hospital crib, the ping pong table and seven shots of the old street
// (some from the city archive, the family ones digitised from her dad's pictures). They are her real photos, never generated, recoloured or cropped: tools/make_gallery_atlas.py
// only packs them into one texture (assets/img/gallery_atlas.jpg) and each picture keeps its own shape.
// Scattered, not a grid: every photo in its own frame (walnut, black, gold, white, some with a cream mat), different
// sizes and heights, a little crooked, a couple overlapping the one next to them (those hang on deeper frames, so
// nothing shares a plane), with a soft shadow on the wallpaper behind each one.
// Three draw calls (frames, photos, shadows), no lights, no interaction: it's a wall of memories, it just hangs there.
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

const FR = { walnut: 0x5a3a22, black: 0x17141a, gold: 0xc9a043, white: 0xece6da, oak: 0x8a6034 };
const MAT = { cream: 0xe9e0cc, white: 0xf2eee6 };
// u: along the wall (world z = -u), y: centre height, w: photo width (m), rot: tilt (deg), b: frame border, m: mat width,
// layer: 0 on the wall, 1 hangs over a neighbour on a deeper frame
const ITEMS = [
  { id: 'kids',     u: -0.20, y: 1.62, w: 0.40, rot: 0.0,  frame: 'walnut', b: 0.035, m: 0.05,  mat: 'cream', layer: 0 },
  { id: 'hospital', u: 0.27,  y: 1.86, w: 0.28, rot: 1.8,  frame: 'gold',   b: 0.022, m: 0.035, mat: 'cream', layer: 1 },
  { id: 'street_a', u: -0.78, y: 1.98, w: 0.40, rot: -1.2, frame: 'black',  b: 0.03,  m: 0,     layer: 0 },
  { id: 'street_b', u: 0.63,  y: 1.42, w: 0.32, rot: 0.8,  frame: 'white',  b: 0.025, m: 0.03,  mat: 'white', layer: 0 },
  { id: 'street_c', u: -0.64, y: 1.47, w: 0.30, rot: -2.0, frame: 'oak',    b: 0.03,  m: 0,     layer: 1 },
  { id: 'street_d', u: 0.12,  y: 2.21, w: 0.26, rot: 1.2,  frame: 'black',  b: 0.018, m: 0.025, mat: 'cream', layer: 0 },
  { id: 'street_e', u: -0.33, y: 2.10, w: 0.34, rot: -0.7, frame: 'gold',   b: 0.022, m: 0,     layer: 0 },
  { id: 'street_f', u: -1.20, y: 1.66, w: 0.24, rot: 2.2,  frame: 'walnut', b: 0.028, m: 0,     layer: 0 },
  { id: 'pingpong', u: 0.25,  y: 1.37, w: 0.29, rot: -1.6, frame: 'black',  b: 0.024, m: 0.03,  mat: 'cream', layer: 1 },
  { id: 'street_g', u: 0.86,  y: 1.92, w: 0.36, rot: -1.0, frame: 'black',  b: 0.028, m: 0.04,  mat: 'cream', layer: 0 },
];
const FD = 0.02, LAYER = 0.022, WALL = 0.004;   // frame depth; each layer hangs 2.2 cm further out; layer 0 is 4 mm off the wall

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

// soft shadow texture: a blurred dark rectangle
const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sx = sc.getContext('2d');
sx.filter = 'blur(9px)'; sx.fillStyle = '#000'; sx.fillRect(22, 22, 84, 84);
const shadowTex = new THREE.CanvasTexture(sc);

const frames = Buf(), photos = Buf(), shadows = Buf(), placed = [];
const M4 = new THREE.Matrix4(), T = new THREE.Matrix4(), Q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), S1 = new THREE.Vector3(1, 1, 1);
for (const it of ITEMS) {
  const r = UV[it.id], w = it.w, h = w * r[5] / r[4], L = 0.006;
  const mw = it.m || L;                                  // no mat: the inner lip sits just outside the print, never over it
  const iw = w + 2 * mw, ih = h + 2 * mw, W = iw + 2 * it.b, H = ih + 2 * it.b;
  const d = WALL + it.layer * LAYER;                     // back of this frame, off the wall
  Q.setFromAxisAngle(Z, it.rot * Math.PI / 180);
  const base = new THREE.Matrix4().compose(new THREE.Vector3(it.u, it.y, 0), Q, S1);
  const at = (x, y, z) => M4.copy(base).multiply(T.makeTranslation(x, y, z));
  const fc = FR[it.frame];
  // frame: top + bottom run the full width, the sides butt in between them
  put(frames, new THREE.BoxGeometry(W, it.b, FD), at(0, (H - it.b) / 2, d + FD / 2), fc);
  put(frames, new THREE.BoxGeometry(W, it.b, FD), at(0, -(H - it.b) / 2, d + FD / 2), fc);
  put(frames, new THREE.BoxGeometry(it.b, H - 2 * it.b, FD), at(-(W - it.b) / 2, 0, d + FD / 2), fc);
  put(frames, new THREE.BoxGeometry(it.b, H - 2 * it.b, FD), at((W - it.b) / 2, 0, d + FD / 2), fc);
  // a slim inner lip in a darker shade, so the frame reads as moulded, not flat
  const lip = new THREE.Color(fc).multiplyScalar(0.55).getHex();
  put(frames, new THREE.BoxGeometry(iw, L, FD * 0.5), at(0, ih / 2 - L / 2, d + FD * 0.25 + FD * 0.25), lip);
  put(frames, new THREE.BoxGeometry(iw, L, FD * 0.5), at(0, -ih / 2 + L / 2, d + FD * 0.25 + FD * 0.25), lip);
  put(frames, new THREE.BoxGeometry(L, ih - 2 * L, FD * 0.5), at(-iw / 2 + L / 2, 0, d + FD * 0.5), lip);
  put(frames, new THREE.BoxGeometry(L, ih - 2 * L, FD * 0.5), at(iw / 2 - L / 2, 0, d + FD * 0.5), lip);
  // backing / mat, recessed into the frame; the photo sits 5 mm in front of it (the bevel line 2.5 mm)
  const back = d + FD * 0.35;
  put(frames, new THREE.PlaneGeometry(iw, ih), at(0, 0, back), it.m ? MAT[it.mat] : 0x0c0a0c);
  if (it.m) put(frames, new THREE.PlaneGeometry(w + 0.006, h + 0.006), at(0, 0, back + 0.0025), 0x8a8070);   // bevel line round the photo
  put(photos, new THREE.PlaneGeometry(w, h), at(0, 0, back + 0.005), null, r);
  // deeper frames get a dark spacer block behind them, inset 5 cm, so they don't float off the wall
  if (d > WALL + 0.001) put(frames, new THREE.BoxGeometry(W - 0.1, H - 0.1, d - 0.002), at(0, 0, 0.001 + (d - 0.002) / 2), 0x1a1210);
  // soft shadow on the wallpaper, a little below, deeper frames throw a wider one
  const sp = 0.07 + it.layer * 0.05;
  put(shadows, new THREE.PlaneGeometry((W + sp) * 1.5, (H + sp) * 1.5), at(0.004, -0.018 - it.layer * 0.012, 0.0025));
  placed.push({ id: it.id, u: it.u, y: it.y, worldZ: -it.u, w, h, W, H, rot: it.rot, layer: it.layer, front: d + FD, aspect: +(w / h).toFixed(4), srcAspect: +(r[4] / r[5]).toFixed(4) });
}

const frameMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 40, specular: 0x2a2620 });
const atlas = new THREE.TextureLoader().load('assets/img/gallery_atlas.jpg', () => { api.ready = true; });
atlas.encoding = THREE.sRGBEncoding;
atlas.anisotropy = (RV.renderer && RV.renderer.capabilities.getMaxAnisotropy()) || 4;
// a little self-light so the old prints stay readable in the lava-lamp dark, like the other posters
const photoMat = new THREE.MeshPhongMaterial({ map: atlas, emissiveMap: atlas, emissive: 0x4a4a4a, shininess: 25, specular: 0x1c1c1c });
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.5, depthWrite: false });
const mShadow = mesh(shadows, shadowMat, 'photoWallShadows'); mShadow.renderOrder = -1;
const mFrames = mesh(frames, frameMat, 'photoWallFrames');
const mPhotos = mesh(photos, photoMat, 'photoWallPhotos');

const api = RV.gallery = { root, frames: mFrames, photos: mPhotos, shadows: mShadow, items: placed, ready: false, count: placed.length };
})();
