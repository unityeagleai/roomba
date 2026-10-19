// Two of Unity's stickers stuck on the inside of the bedroom door, like a kid would: the 'lol' sticker and the
// 'Wt...feathers' sticker. They are her own transparent PNG cutouts, used exactly as she sent them (byte-identical
// files, never cropped, recoloured or redrawn): assets/img/sticker_lol.png and assets/img/sticker_feathers.png.
// The quads only skip the empty transparent margin round each sticker (UVs cover every pixel with any alpha).
// Door (room.js): slab x -1.83..-0.97, inside face z = RZ - 0.04; raised panels 0.6 x 0.6 at y 0.55 and 1.45, their
// front face at z = RZ - 0.051; ROOMBA XING sign on the upper panel centre (y 1.5); knob at x -1.1, y 1.0.
// lol: lower-left of the upper panel (as you face the door), clear of the sign. feathers: top of the lower panel, near
// the latch side, below the knob height. A little tilted, never overlapping each other or the sign.
// No z-fighting: each sticker floats 2.5 mm off its panel, never writes depth and has a polygon offset.
// Clean edges: the PNGs have black RGB under alpha 0, so the texture is premultiplied on upload and blended as
// premultiplied (no dark fringe). Grey self-light like the photo prints, so the light switch dims them at night.
// Static: no interaction, and the zombie never lands on them (transparent, no depth write).
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene) return;
const scene = RV.scene, RZ = RV.room.RZ;
const PANEL_Z = RZ - 0.051, Z = PANEL_Z - 0.0025;

// per sticker (pixel coordinates in the 1111 x 1379 PNG): vis = box of the sticker itself (alpha >= 64), all = every
// pixel with any alpha (+2 px), h = height of the sticker on the door (m), x / y = where its centre sits, rot = tilt
const STICKERS = [
  { id: 'lol', src: 'assets/img/sticker_lol.png', W: 1111, H: 1379, vis: [340, 403, 819, 1003], all: [337, 399, 988, 1188],
    h: 0.16, x: -1.60, y: 1.25, rot: 7 },
  { id: 'feathers', src: 'assets/img/sticker_feathers.png', W: 1111, H: 1379, vis: [371, 462, 794, 1005], all: [368, 459, 797, 1008],
    h: 0.15, x: -1.27, y: 0.72, rot: -5 },
];

const root = new THREE.Group(); root.name = 'doorStickers'; scene.add(root);
const loader = new THREE.TextureLoader();
const api = RV.stickers = { root, items: [], ready: 0, Z, PANEL_Z };

for (const s of STICKERS) {
  const k = s.h / (s.vis[3] - s.vis[1]);                     // metres per pixel
  const cx = (s.vis[0] + s.vis[2]) / 2, cy = (s.vis[1] + s.vis[3]) / 2;
  const [ax0, ay0, ax1, ay1] = s.all;
  // quad over the 'all' box, local origin at the sticker's visual centre; +x right, +y up as seen on the door
  const g = new THREE.BufferGeometry();
  const xl = (ax0 - cx) * k, xr = (ax1 - cx) * k, yt = (cy - ay0) * k, yb = (cy - ay1) * k;
  g.setAttribute('position', new THREE.Float32BufferAttribute([xl, yb, 0, xr, yb, 0, xr, yt, 0, xl, yt, 0], 3));
  const u0 = ax0 / s.W, u1 = ax1 / s.W, v0 = 1 - ay1 / s.H, v1 = 1 - ay0 / s.H;
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v1], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const t = loader.load(s.src, () => { api.ready++; });
  t.encoding = THREE.sRGBEncoding; t.premultiplyAlpha = true;
  t.anisotropy = (RV.renderer && RV.renderer.capabilities.getMaxAnisotropy()) || 4;
  const m = new THREE.MeshPhongMaterial({ map: t, emissiveMap: t, emissive: 0x404040, shininess: 30, specular: 0x0a0a0a,
    transparent: true, depthWrite: false, alphaTest: 0.01,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, m); mesh.name = 'sticker_' + s.id; mesh.renderOrder = 3;
  // the door's inside faces the room (-Z): turn the quad round so its front looks into the room, not mirrored
  mesh.position.set(s.x, s.y, Z); mesh.rotation.set(0, Math.PI, THREE.MathUtils.degToRad(-s.rot));
  root.add(mesh);
  api.items.push({ id: s.id, mesh, h: s.h, w: (s.vis[2] - s.vis[0]) * k, x: s.x, y: s.y, rot: s.rot });
}
})();
