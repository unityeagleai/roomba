// The silver boombox on top of the cartridge shelf, and the first mixtape: 'The Roomba Ran Away'.
// Unity: 'we need to change the radio. And can you give it more texture, like it actually looks silver metallic?' and
// 'we could actually put mixtapes in them' (first test: just the Roomba song on one cassette).
//
// - The boombox: brushed silver body with rounded ends, chrome speaker rings, chrome handle and antenna, a cassette deck
//   with a smoked window door in the middle, three keys (PLAY, PAUSE, EJECT), a little VU meter, a tuner dial and an
//   EAGLE badge. The silver reflects a soft fake room (a small cube map), so it reads as metal on the Quest without any
//   expensive lighting.
// - The cassette: 'The Roomba Ran Away', hand-lettered label, stands next to the boombox on the shelf.
//   VR: squeeze the grip with your hand next to it or pointing at it (or point and hold the trigger) to hold it. Let go
//   at the boombox (or pointing at it), or push it into the deck, and it slides in, the door shuts and the song plays.
//   Screen: click the cassette (it's held up in front of you), then click the boombox. Clicking anything else puts it back.
// - Playing: PLAY / PAUSE / EJECT keys; clicking (trigger) the boombox body = pause / play. Grabbing (clicking) the
//   cassette in the deck takes it out (it stops). EJECT pops the door open with the cassette in it; take it, or press
//   PLAY / click the boombox to push it back in. The tape remembers where it was (like a real tape) and rewinds at the end.
// - Starting it pauses an episode on the TV, lifts the record needle and stops the other voices/videos (poster, frame,
//   voice note, phone, letter, the Roomba's punishment song); any of those starting afterwards pauses the tape.
// - Second mixtape (Unity: 'And then turn it into a cassette tape.'): 'Signal & Static ep.1', Charlie & Miles' birthday
//   podcast with a Roomba King cameo, stands on the other side of the boombox, at the right end of the same shelf. It works exactly like the first one. Only
//   one cassette fits the deck: putting one in (or picking one up) while the other is in the deck sends that one back to
//   its own spot on the shelf. Each cassette remembers where its tape was.
// - Not remembered: every visit the cassettes start on the shelf.
// Loaded after drawers.js, so its click / trigger handling sees clicks first; it lets them through whenever a hand holds
// something else (a floppy, the phone, the letter, a cartridge).
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE;
if (!RV || !RV.scene || !RV.media) return;
const scene = RV.scene, camera = RV.camera, renderer = RV.renderer, Md = RV.media;
const V3 = THREE.Vector3, Q = THREE.Quaternion;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = k => k * k * (3 - 2 * k);
const SRGB = THREE.sRGBEncoding;

// ------------------------------------------------------------ textures
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function ctex(c, rep) { const t = new THREE.CanvasTexture(c); t.encoding = SRGB; t.anisotropy = (renderer && renderer.capabilities.getMaxAnisotropy()) || 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

// brushed metal: fine horizontal streaks over a soft top-to-bottom sheen
function brushed(base, seed) {
  const W = 512, H = 256, c = cv(W, H), x = c.getContext('2d'), r = rng(seed || 7);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, base[0]); g.addColorStop(0.5, base[1]); g.addColorStop(1, base[2]); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) {
    const y = r() * H, len = 40 + r() * 400, x0 = r() * W, a = 0.02 + r() * 0.07;
    x.fillStyle = r() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 0.8})`; x.fillRect(x0, y, len, 1); if (x0 + len > W) x.fillRect(x0 - W, y, len, 1);
  }
  return ctex(c, true);
}
// a small fake room for the metal to reflect: warm ceiling light, darker walls with a couple of bright patches, brown floor
function envCube() {
  const S = 128, faces = [];
  for (let f = 0; f < 6; f++) {
    const c = cv(S, S), x = c.getContext('2d'), r = rng(31 + f);
    if (f === 2) {                                            // +y: the ceiling with a bright lamp
      x.fillStyle = '#8c8790'; x.fillRect(0, 0, S, S);
      const g = x.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.55); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.35, '#e8e0d4'); g.addColorStop(1, 'rgba(140,135,144,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    } else if (f === 3) {                                     // -y: the floor
      x.fillStyle = '#3a2a24'; x.fillRect(0, 0, S, S);
      for (let i = 0; i < 12; i++) { x.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.15})`; x.fillRect(0, i * 11, S, 2); }
    } else {                                                  // the walls: light above, dark band, warm low
      const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#d9d4d8'); g.addColorStop(0.42, '#9a95a2'); g.addColorStop(0.5, '#3c3844'); g.addColorStop(0.62, '#5a4a48'); g.addColorStop(1, '#2a201e'); x.fillStyle = g; x.fillRect(0, 0, S, S);
      x.fillStyle = 'rgba(255,250,235,0.85)'; x.fillRect(10 + r() * 60, 14 + r() * 10, 18 + r() * 22, 22 + r() * 12);   // a bright window / poster
      x.fillStyle = 'rgba(20,16,30,0.6)'; x.fillRect(r() * S, 0, 6 + r() * 10, S * 0.45);
      x.fillStyle = 'rgba(255,120,200,0.25)'; x.fillRect(r() * S, 30 + r() * 20, 20, 14);
    }
    faces.push(c);
  }
  const t = new THREE.CubeTexture(faces); t.encoding = SRGB; t.needsUpdate = true; return t;
}
const ENV = envCube();
const MIX = THREE.MixOperation;

const silverTex = brushed(['#e4e6ea', '#b4b8c0', '#d0d3d9'], 11);
const gunTex = brushed(['#6c7078', '#4c5058', '#5e626a'], 23);
const M = {
  silver: new THREE.MeshPhongMaterial({ color: 0xffffff, map: silverTex, specular: 0xb0b6c0, shininess: 80, envMap: ENV, combine: MIX, reflectivity: 0.32 }),
  gun: new THREE.MeshPhongMaterial({ color: 0xffffff, map: gunTex, specular: 0x9098a4, shininess: 70, envMap: ENV, combine: MIX, reflectivity: 0.22 }),
  chrome: new THREE.MeshPhongMaterial({ color: 0xf2f4f8, specular: 0xffffff, shininess: 140, envMap: ENV, combine: MIX, reflectivity: 0.8 }),
  black: new THREE.MeshPhongMaterial({ color: 0x141418, specular: 0x333338, shininess: 30 }),
  well: new THREE.MeshLambertMaterial({ color: 0x0c0c10 }),
  rubber: new THREE.MeshLambertMaterial({ color: 0x18181a }),
};
// speaker grille: perforated dark metal
const grilleTex = (function () {
  const S = 256, c = cv(S, S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2); g.addColorStop(0, '#6a6e76'); g.addColorStop(1, '#3e4148'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.fillStyle = '#060608'; for (let yy = 4; yy < S; yy += 8) for (let xx = (yy / 8 % 2) * 4 + 4; xx < S; xx += 8) { x.beginPath(); x.arc(xx, yy, 2.3, 0, 6.3); x.fill(); }
  return ctex(c);
})();
M.grille = new THREE.MeshPhongMaterial({ color: 0xffffff, map: grilleTex, specular: 0x666a72, shininess: 50, envMap: ENV, combine: MIX, reflectivity: 0.12 });

// little printed panels
function panel(w, h, draw) { const c = cv(w, h), x = c.getContext('2d'); draw(x, w, h); return ctex(c); }
const tunerTex = panel(512, 64, (x, w, h) => {
  x.fillStyle = '#16120e'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2d9a0'; x.font = 'bold 15px Arial, Helvetica, sans-serif'; x.textBaseline = 'middle';
  const nums = [88, 92, 96, 100, 104, 108]; nums.forEach((n, i) => { const xx = 50 + i * 82; x.fillText(String(n), xx - x.measureText(String(n)).width / 2, 20); });
  for (let i = 0; i <= 50; i++) { const xx = 50 + i * 8.2; x.fillRect(xx, i % 5 ? 40 : 34, 1.5, i % 5 ? 8 : 14); }
  x.fillText('FM', 8, 20); x.fillText('MHz', w - 44, 20);
  x.fillStyle = '#ff3b2a'; x.fillRect(250, 6, 3, h - 12);                       // the red needle
});
const badgeTex = panel(512, 64, (x, w, h) => {
  x.fillStyle = '#121216'; x.fillRect(0, 0, w, h); x.textBaseline = 'middle';
  const g = x.createLinearGradient(0, 8, 0, 56); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#a8acb4'); g.addColorStop(1, '#f0f0f4'); x.fillStyle = g;
  x.font = 'italic bold 34px Arial, Helvetica, sans-serif'; x.fillText('EAGLE', 14, 33);
  x.fillStyle = '#c8ccd4'; x.font = 'bold 13px Arial, Helvetica, sans-serif'; x.fillText('STEREO RADIO CASSETTE', 150, 24); x.fillStyle = '#ff5fa8'; x.fillText('SR-1971  ·  2 BAND  ·  4 SPEAKER', 150, 44);
});
const keyTex = ['play', 'pause', 'eject'].map(k => panel(64, 40, (x, w, h) => {
  x.fillStyle = '#1b1b20'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0, 0, w, 3);
  x.fillStyle = k === 'play' ? '#3cff8a' : '#f2f2f2'; x.beginPath();
  if (k === 'play') { x.moveTo(25, 10); x.lineTo(42, 20); x.lineTo(25, 30); x.fill(); }
  else if (k === 'pause') { x.fillRect(23, 10, 6, 20); x.fillRect(35, 10, 6, 20); }
  else { x.moveTo(32, 9); x.lineTo(44, 23); x.lineTo(20, 23); x.fill(); x.fillRect(20, 26, 24, 5); }
}));

// ------------------------------------------------------------ the boombox
const BX = 2.13, BY = 1.6, BZ = -2.0;          // bottom centre, on the top board of the cartridge shelf
const W = 0.48, H = 0.19, D = 0.12, Y0 = 0.006, YC = Y0 + H / 2;
const bb = new THREE.Group(); bb.name = 'silver boombox'; bb.position.set(BX, BY, BZ); scene.add(bb);
const stat = [];                                 // the parts that never move get merged into a few meshes
function add(geo, mat, x, y, z, parent, keep) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || bb).add(m); if (!keep) stat.push(m); return m; }
function blk(x0, x1, y0, y1, z0, z1, mat) { return add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); }
const DX = 0.068, DY0 = 0.018, DY1 = 0.116, DZ = 0.032;     // the cassette well in the middle of the front
// body: left and right halves, above / below the well, and the back of the well
blk(-W / 2, -DX, Y0, Y0 + H, -D / 2, D / 2, M.silver); blk(DX, W / 2, Y0, Y0 + H, -D / 2, D / 2, M.silver);
blk(-DX, DX, DY1, Y0 + H, -D / 2, D / 2, M.silver); blk(-DX, DX, Y0, DY0, -D / 2, D / 2, M.silver); blk(-DX, DX, DY0, DY1, -D / 2, DZ, M.silver);
// the well lined in black
{ const p = new THREE.PlaneGeometry(2 * DX, DY1 - DY0); add(p, M.well, 0, (DY0 + DY1) / 2, DZ + 0.0004); }
for (const s of [-1, 1]) { const p = add(new THREE.PlaneGeometry(D / 2 - DZ, DY1 - DY0), M.well, s * (DX - 0.0004), (DY0 + DY1) / 2, (DZ + D / 2) / 2); p.rotation.y = -s * Math.PI / 2; }
{ const p = add(new THREE.PlaneGeometry(2 * DX, D / 2 - DZ), M.well, 0, DY1 - 0.0004, (DZ + D / 2) / 2); p.rotation.x = Math.PI / 2; const q = add(new THREE.PlaneGeometry(2 * DX, D / 2 - DZ), M.well, 0, DY0 + 0.0004, (DZ + D / 2) / 2); q.rotation.x = -Math.PI / 2; }
// rounded ends
for (const s of [-1, 1]) {
  const g = new THREE.CylinderGeometry(H / 2, H / 2, D, 24, 1, false, s > 0 ? 0 : Math.PI, Math.PI);
  const m = add(g, M.silver, s * W / 2, YC, 0); m.rotation.x = Math.PI / 2; m.scale.set(0.27, 1, 1);
}
// chrome trim along the front, top and bottom
blk(-W / 2, W / 2, Y0 + H - 0.006, Y0 + H - 0.002, D / 2, D / 2 + 0.003, M.chrome);
blk(-W / 2, W / 2, Y0 + 0.002, Y0 + 0.006, D / 2, D / 2 + 0.003, M.chrome);
// speakers: grille, chrome ring, chrome dust cap
const SPX = 0.15, SPY = 0.092, SPR = 0.066;
for (const s of [-1, 1]) {
  add(new THREE.CircleGeometry(SPR, 40), M.grille, s * SPX, SPY, D / 2 + 0.001);
  add(new THREE.TorusGeometry(SPR + 0.004, 0.0045, 8, 48), M.chrome, s * SPX, SPY, D / 2 + 0.002);
  add(new THREE.TorusGeometry(0.03, 0.002, 6, 32), M.chrome, s * SPX, SPY, D / 2 + 0.0015);
  const cap = add(new THREE.SphereGeometry(0.014, 16, 10), M.chrome, s * SPX, SPY, D / 2 + 0.001); cap.scale.z = 0.45;
}
// tuner dial (left) and badge (right), above the speakers
const tunerM = new THREE.MeshPhongMaterial({ map: tunerTex, emissiveMap: tunerTex, emissive: 0x000000, shininess: 60, specular: 0x444444 });
add(new THREE.PlaneGeometry(0.14, 0.0175), tunerM, -0.155, 0.181, D / 2 + 0.001);
add(new THREE.PlaneGeometry(0.14, 0.0175), new THREE.MeshPhongMaterial({ map: badgeTex, shininess: 60, specular: 0x555555 }), 0.155, 0.181, D / 2 + 0.001);
for (const s of [-1, 1]) blk(s * 0.155 - 0.072, s * 0.155 + 0.072, 0.1715, 0.1725, D / 2, D / 2 + 0.0025, M.chrome);
// VU meter above the keys (a small canvas redrawn while it plays)
const vuC = cv(128, 32), vuX = vuC.getContext('2d'), vuT = ctex(vuC);
const vuM = new THREE.MeshBasicMaterial({ map: vuT });
add(new THREE.PlaneGeometry(0.11, 0.0275), vuM, 0, 0.176, D / 2 + 0.001);
let vuL = 0, vuR = 0, vuDirty = true, vuAcc = 0;
function drawVU() {
  vuX.fillStyle = '#08080a'; vuX.fillRect(0, 0, 128, 32);
  for (let row = 0; row < 2; row++) { const lv = row ? vuR : vuL; for (let i = 0; i < 10; i++) { const on = lv * 10 > i + 0.3; const col = i < 6 ? [60, 255, 120] : i < 8 ? [255, 210, 60] : [255, 60, 60]; const k = on ? 1 : 0.16; vuX.fillStyle = `rgb(${col[0] * k | 0},${col[1] * k | 0},${col[2] * k | 0})`; vuX.fillRect(8 + i * 11.6, 5 + row * 13, 9, 9); } }
  vuT.needsUpdate = true;
}
drawVU();
// a power light
const ledM = new THREE.MeshBasicMaterial({ color: 0x401010 });
add(new THREE.CircleGeometry(0.003, 12), ledM, 0.062, 0.176, D / 2 + 0.0012);
// handle
for (const s of [-1, 1]) { const p = add(new THREE.CylinderGeometry(0.0055, 0.0065, 0.03, 12), M.chrome, s * 0.17, Y0 + H + 0.013, -0.012); p.rotation.x = -0.35; }
{ const bar = add(new THREE.CylinderGeometry(0.007, 0.007, 0.35, 14), M.chrome, 0, Y0 + H + 0.027, -0.022); bar.rotation.z = Math.PI / 2;
  const grip = add(new THREE.CylinderGeometry(0.0105, 0.0105, 0.15, 14), M.rubber, 0, Y0 + H + 0.027, -0.022); grip.rotation.z = Math.PI / 2; }
// telescopic antenna, leaning to the right
{ const ant = new THREE.Group(); ant.position.set(0.205, Y0 + H, -0.045); ant.rotation.z = -0.7; bb.add(ant);
  add(new THREE.CylinderGeometry(0.009, 0.011, 0.012, 12), M.chrome, 0, 0.006, 0, ant);
  const seg = [[0.0042, 0.1], [0.0034, 0.1], [0.0026, 0.1]]; let yy = 0.012; for (const [r, l] of seg) { add(new THREE.CylinderGeometry(r, r, l, 8), M.chrome, 0, yy + l / 2, 0, ant); yy += l - 0.004; }
  add(new THREE.SphereGeometry(0.0055, 10, 8), M.chrome, 0, yy + 0.003, 0, ant);
}
// feet
for (const sx of [-1, 1]) for (const sz of [-1, 1]) blk(sx * 0.2 - 0.015, sx * 0.2 + 0.015, 0, Y0, sz * 0.04 - 0.012, sz * 0.04 + 0.012, M.rubber);

// moving parts: the deck door (hinged at the bottom) and the keys
const door = new THREE.Group(); door.name = 'cassette door'; door.position.set(0, DY0 + 0.001, D / 2 + 0.0005); bb.add(door);
const DW = 2 * DX - 0.004, DH = DY1 - DY0 - 0.003, FB = 0.0065;
function dpart(geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); door.add(m); return m; }
dpart(new THREE.BoxGeometry(DW, FB, 0.005), M.chrome, 0, FB / 2, 0.0025); dpart(new THREE.BoxGeometry(DW, FB * 1.6, 0.005), M.chrome, 0, DH - FB * 0.8, 0.0025);
for (const s of [-1, 1]) dpart(new THREE.BoxGeometry(FB, DH - FB * 2.6, 0.005), M.chrome, s * (DW / 2 - FB / 2), FB + (DH - FB * 2.6) / 2, 0.0025);
const glassM = new THREE.MeshPhongMaterial({ color: 0x2a3038, transparent: true, opacity: 0.38, depthWrite: false, specular: 0xffffff, shininess: 120, envMap: ENV, combine: MIX, reflectivity: 0.18 });
const glass = dpart(new THREE.PlaneGeometry(DW - FB * 2, DH - FB * 2.6), glassM, 0, FB + (DH - FB * 2.6) / 2, 0.003); glass.renderOrder = 3;
const KEYS = ['play', 'pause', 'eject'], keys = {};
KEYS.forEach((k, i) => {
  const mats = [M.black, M.black, M.chrome, M.black, new THREE.MeshPhongMaterial({ map: keyTex[i], shininess: 50, specular: 0x444444 }), M.black];
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.021, 0.012), mats); m.position.set(-0.042 + i * 0.042, 0.137, D / 2 + 0.003); m.name = 'tape key ' + k; bb.add(m);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.026, 0.02), new THREE.MeshBasicMaterial({ visible: false })); hit.position.copy(m.position); hit.position.z += 0.004; hit.userData = { kind: 'key', key: k }; bb.add(hit);
  keys[k] = { m, hit, z0: m.position.z, t: 0 };
});
// the invisible box you point at
const bbHit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, H + 0.045, D + 0.012), new THREE.MeshBasicMaterial({ visible: false })); bbHit.position.set(0, Y0 + H / 2 + 0.012, 0.004); bbHit.userData = { kind: 'box' }; bb.add(bbHit);

// merge the static parts by material (Quest likes few draw calls)
(function merge() {
  bb.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(bb.matrixWorld).invert(); const groups = new Map();
  for (const m of stat) { const k = m.material.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const pos = [], nor = [], uv = [];
    for (const m of list) { const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); pos.push(g.attributes.position.array); nor.push(g.attributes.normal.array); uv.push(g.attributes.uv ? g.attributes.uv.array : new Float32Array(g.attributes.position.count * 2)); m.parent.remove(m); }
    const cat = a => { const n = a.reduce((s, b) => s + b.length, 0), o = new Float32Array(n); let i = 0; for (const b of a) { o.set(b, i); i += b.length; } return o; };
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(cat(pos), 3)); g.setAttribute('normal', new THREE.BufferAttribute(cat(nor), 3)); g.setAttribute('uv', new THREE.BufferAttribute(cat(uv), 2));
    const mm = new THREE.Mesh(g, list[0].material); mm.name = 'boombox merged'; bb.add(mm);
  }
})();

// ------------------------------------------------------------ the cassette
const CW = 0.1, CH = 0.064, CT = 0.012;
const HUB_X = 0.0215, HUB_Y = -0.0015, PX = 512 / CW;
function labelCanvas(L, side) {
  const A = side === 'A', w = 512, h = 328, c = cv(w, h), x = c.getContext('2d'), r = rng(A ? L.seed : L.seed + 4);
  x.fillStyle = '#232328'; x.fillRect(0, 0, w, h);                                                   // smoky black shell
  x.fillStyle = '#34343a'; for (const [sx, sy] of [[16, 16], [w - 16, 16], [16, h - 16], [w - 16, h - 16], [w / 2, h - 18]]) { x.beginPath(); x.arc(sx, sy, 7, 0, 6.3); x.fill(); x.fillStyle = '#121214'; x.fillRect(sx - 5, sy - 1, 10, 2); x.fillStyle = '#34343a'; }
  // the paper label
  x.fillStyle = '#efe6cf'; x.fillRect(30, 26, w - 60, 222);
  const g = x.createLinearGradient(30, 0, w - 30, 0); const gc = A ? L.gradA : L.gradB; g.addColorStop(0, gc[0]); g.addColorStop(1, gc[1]);
  x.fillStyle = g; x.fillRect(30, 128, w - 60, 86);
  x.strokeStyle = 'rgba(80,90,140,0.35)'; x.lineWidth = 1.5; for (const yy of [64, 96, 232]) { x.beginPath(); x.moveTo(44, yy + 0.5); x.lineTo(w - 44, yy + 0.5); x.stroke(); }
  x.fillStyle = '#1a1a1e'; x.font = 'bold 34px Arial, Helvetica, sans-serif'; x.fillText(side, 46, 60);
  // hand lettering: marker, each letter a little wobbly
  const title = A ? L.titleA : L.titleB, sz = A ? L.szA : L.szB;
  x.font = `italic bold ${sz}px "Marker Felt", "Comic Sans MS", "Segoe Print", cursive, sans-serif`; x.fillStyle = A ? L.inkA : L.inkB;
  let tw = 0; for (const ch of title) tw += x.measureText(ch).width; let xx = Math.max(84, (w - tw) / 2 + 20);
  for (const ch of title) { x.save(); x.translate(xx, 104 + (r() - 0.5) * 4); x.rotate((r() - 0.5) * 0.12 - 0.03); x.fillText(ch, 0, 0); x.restore(); xx += x.measureText(ch).width; }
  // the window with the tape spools
  const wx = w / 2, wy = h / 2 - HUB_Y * PX, ww = 0.066 * PX, wh = 0.021 * PX;
  x.fillStyle = '#efe6cf'; x.fillRect(wx - ww / 2 - 10, wy - wh / 2 - 8, ww + 20, wh + 16);
  x.save(); x.beginPath(); x.rect(wx - ww / 2, wy - wh / 2, ww, wh); x.clip();
  x.fillStyle = '#4a4a52'; x.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);
  x.fillStyle = '#3a2416'; for (const [s, rr] of [[-1, 78], [1, 56]]) { x.beginPath(); x.arc(wx + s * HUB_X * PX, wy, rr, 0, 6.3); x.fill(); }
  x.restore();
  x.strokeStyle = '#1a1a1e'; x.lineWidth = 3; x.strokeRect(wx - ww / 2, wy - wh / 2, ww, wh);
  for (const s of [-1, 1]) { x.fillStyle = '#ddd'; x.beginPath(); x.arc(wx + s * HUB_X * PX, wy, 0.0072 * PX, 0, 6.3); x.fill(); x.fillStyle = '#232328'; x.beginPath(); x.arc(wx + s * HUB_X * PX, wy, 0.0058 * PX, 0, 6.3); x.fill(); }
  // a doodle: the Roomba King with his crown, a bite mark, or two microphones
  x.strokeStyle = L.inkA; x.lineWidth = 3;
  const dd = A ? L.doodleA : L.doodleB;
  if (dd === 'mics') { for (const [mx, col] of [[w - 104, '#3db8ff'], [w - 66, '#ff3d8b']]) { x.fillStyle = col; x.beginPath(); x.ellipse(mx, 46, 9, 12, 0, 0, 6.3); x.fill(); x.stroke(); x.beginPath(); x.moveTo(mx, 58); x.lineTo(mx, 80); x.moveTo(mx - 8, 80); x.lineTo(mx + 8, 80); x.stroke(); }
    x.fillStyle = '#e8b82a'; x.beginPath(); x.moveTo(w - 96, 30); x.lineTo(w - 93, 20); x.lineTo(w - 88, 27); x.lineTo(w - 85, 18); x.lineTo(w - 82, 27); x.lineTo(w - 77, 20); x.lineTo(w - 74, 30); x.closePath(); x.fill(); x.stroke(); }
  else if (dd === 'king') { x.beginPath(); x.ellipse(w - 86, 64, 22, 9, 0, 0, 6.3); x.stroke(); x.beginPath(); x.moveTo(w - 100, 52); x.lineTo(w - 96, 38); x.lineTo(w - 88, 48); x.lineTo(w - 80, 36); x.lineTo(w - 74, 50); x.closePath(); x.fillStyle = '#e8b82a'; x.fill(); x.stroke(); }
  else { x.fillStyle = '#232328'; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(w - 30, 60 + i * 26, 16, 0, 6.3); x.fill(); } }
  x.fillStyle = '#3a3a44'; x.font = 'italic 17px Arial, Helvetica, sans-serif'; x.fillText(A ? L.footA : L.footB, 48, 240);
  // the bottom: tape guides
  x.fillStyle = '#18181c'; x.beginPath(); x.moveTo(110, h); x.lineTo(130, 262); x.lineTo(w - 130, 262); x.lineTo(w - 110, h); x.fill();
  x.fillStyle = '#0a0a0c'; for (const hx of [160, 205, w - 205, w - 160]) x.fillRect(hx - 8, 280, 16, 16);
  x.fillStyle = '#8a8a90'; x.font = 'bold 15px Arial, Helvetica, sans-serif'; x.fillText('CrO2  C-60', w / 2 - 44, 300);
  return c;
}
const shellM = new THREE.MeshPhongMaterial({ color: 0x26262c, shininess: 70, specular: 0x555560 });
const hubTex = panel(64, 64, (x) => { x.clearRect(0, 0, 64, 64); x.fillStyle = '#f4f4f4'; x.beginPath(); x.arc(32, 32, 30, 0, 6.3); x.arc(32, 32, 19, 0, 6.3, true); x.fill(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; x.save(); x.translate(32, 32); x.rotate(a); x.fillRect(-3, -22, 6, 8); x.restore(); } });
const hubM = new THREE.MeshBasicMaterial({ map: hubTex, transparent: true, alphaTest: 0.4 });
// where they live: standing on the shelf either side of the boombox, leaning back a little, turned towards the room
const LEAN = -0.15, HOME_YAW = -0.42;
const TAPES = [
  { id: 'roomba', name: 'roomba cassette', src: 'assets/audio/the_roomba_ran_away.mp3', homeX: 1.785,
    label: { seed: 5, gradA: ['#ff3d8b', '#ff9a2e'], gradB: ['#3db8ff', '#a95cff'], titleA: 'The Roomba Ran Away', titleB: 'the Roomba ate side B', szA: 40, szB: 34,
      inkA: '#1d1a52', inkB: '#5a1a1a', doodleA: 'king', doodleB: 'bite', footA: 'Charlie & Unity  ·  mixtape #1', footB: 'nothing left here. it was crunchy.' } },
  { id: 'podcast', name: 'signal and static cassette', src: 'assets/audio/signal_and_static_ep1.mp3', homeX: 2.47,
    label: { seed: 22, gradA: ['#29e0c8', '#7a4dff'], gradB: ['#ffd23d', '#ff5c5c'], titleA: 'Signal & Static ep.1', titleB: 'property of the King', szA: 38, szB: 34,
      inkA: '#2a1048', inkB: '#5a1a1a', doodleA: 'mics', doodleB: 'king', footA: 'Charlie & Miles  ·  birthday podcast  ·  22.11', footB: 'side B is reserved. all hail.' } },
];
for (const T of TAPES) {
  T.cs = new THREE.Group(); T.cs.name = T.name; scene.add(T.cs);
  const labA = new THREE.MeshPhongMaterial({ map: ctex(labelCanvas(T.label, 'A')), shininess: 40, specular: 0x333333 });
  const labB = new THREE.MeshPhongMaterial({ map: ctex(labelCanvas(T.label, 'B')), shininess: 40, specular: 0x333333 });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, CT), [shellM, shellM, shellM, shellM, labA, labB]); shell.name = 'cassette shell'; T.cs.add(shell);
  T.hubs = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.0072, 20), hubM); m.position.set(s * HUB_X, HUB_Y, CT / 2 + 0.0004); T.cs.add(m); return m; });
  T.hit = new THREE.Mesh(new THREE.BoxGeometry(CW + 0.024, CH + 0.024, CT + 0.03), new THREE.MeshBasicMaterial({ visible: false })); T.hit.userData = { kind: 'tape', tape: T }; T.cs.add(T.hit);
  T.HOME_P = new V3(T.homeX, BY + CH / 2 * Math.cos(LEAN) + CT / 2 * Math.sin(-LEAN) + 0.001, BZ + 0.02);
  T.HOME_Q = new Q().setFromEuler(new THREE.Euler(LEAN, HOME_YAW, 0, 'YXZ'));
  T.cs.position.copy(T.HOME_P); T.cs.quaternion.copy(T.HOME_Q);
  T.pos = 0;                                    // where its tape was when it left the deck
}
// the cassette in play (held, flying, in the deck, or the one last used); the others always sit on the shelf or fly home
let cur = TAPES[0], cs = cur.cs, csHit = cur.hit, hubs = cur.hubs, HOME_P = cur.HOME_P, HOME_Q = cur.HOME_Q;
// in the deck: label out, tape edge down
const DECK_L = new V3(0, (DY0 + DY1) / 2 - 0.001, DZ + CT / 2 + 0.003), PRE_L = new V3(0, (DY0 + DY1) / 2 + 0.004, D / 2 + 0.07), EJECT_L = new V3(0, (DY0 + DY1) / 2 + 0.006, D / 2 + 0.006);
const MOUTH_L = new V3(0, (DY0 + DY1) / 2, D / 2 + 0.02);
const W2 = l => bb.localToWorld(l.clone());
const DECK_Q = new Q(), EJECT_Q = new Q().setFromAxisAngle(new V3(1, 0, 0), 0.32);

// ------------------------------------------------------------ sound
function actx() { return RV.roomba && RV.roomba.audio && RV.roomba.audio.ctx; }
const audio = new Audio(); audio.src = cur.src; audio.preload = 'none'; audio.crossOrigin = 'anonymous'; audio.loop = false;
let src = null, pan = null, an = null, anBuf = null, live = false, starting = false, startedAt = 0, plays = 0, pauses = 0, lastStop = null;
function wire() {
  const A = actx(); if (!A || src) return;
  try {
    src = A.createMediaElementSource(audio);
    const gn = A.createGain(); gn.gain.value = 0.9;
    an = A.createAnalyser(); an.fftSize = 256; anBuf = new Uint8Array(an.frequencyBinCount);
    pan = A.createPanner(); pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = 1.0; pan.rolloffFactor = 0.6; pan.maxDistance = 15;
    const p = W2(new V3(0, YC, 0)); if (pan.positionX) { pan.positionX.value = p.x; pan.positionY.value = p.y; pan.positionZ.value = p.z; } else pan.setPosition(p.x, p.y, p.z);
    src.connect(gn); gn.connect(an); an.connect(pan); pan.connect(A.destination);
  } catch (e) { console.warn('tape audio routing', e); src = null; pan = null; an = null; }
}
function phonePlaying() { try { return !!(RV.phone && RV.phone.playing && RV.phone.playing()); } catch (e) { return false; } }
function letterPlaying() { try { return !!(RV.letter && RV.letter.playing && RV.letter.playing()); } catch (e) { return false; } }
function quietOthers() {
  const d = Md._debug;
  if (d) {
    try { if (d.playing && d.playing.ep && d.video && !d.video.paused) d.video.pause(); } catch (e) { }
    try { if (d.rp && d.rp.on && d.stopRecord) d.stopRecord('tape'); } catch (e) { }
  }
  try { const v = RV.vposter && RV.vposter._debug; if (v) { const s = v.state(); if (s.live || s.starting) v.stop('tape'); } } catch (e) { }
  try { const o = RV.originFrame && RV.originFrame._debug; if (o) { const s = o.state(); if (s.live || s.starting) o.pause('tape'); } } catch (e) { }
  try { const n = RV.voiceNote && RV.voiceNote._debug; if (n) { const s = n.state(); if (s.live || s.starting) n.pause('tape'); } } catch (e) { }
  try { if (phonePlaying()) RV.phone.stop('tape'); } catch (e) { }
  try { if (letterPlaying()) RV.letter.stop('tape'); } catch (e) { }
  try { const s = RV.roomba && RV.roomba.song; if (s && s.playing()) s.stop(); } catch (e) { }
}
function othersPlaying() {
  const d = Md._debug, v = RV.vposter && RV.vposter._debug && RV.vposter._debug.state(), o = RV.originFrame && RV.originFrame._debug && RV.originFrame._debug.state(),
    n = RV.voiceNote && RV.voiceNote._debug && RV.voiceNote._debug.state();
  return !!((d && ((d.playing && d.playing.ep && d.video && !d.video.paused) || (d.rp && d.rp.on))) || (v && (v.live || v.starting)) || (o && (o.live || o.starting)) || (n && (n.live || n.starting)) || phonePlaying() || letterPlaying());
}
function play() {
  if (deck !== 'in') return false;
  if (live || starting) return true;
  if (RV.ensureAudio) try { RV.ensureAudio(); } catch (e) { }
  wire(); const A = actx(); if (A && A.state === 'suspended') A.resume();
  quietOthers();
  starting = true; live = false; startedAt = performance.now() / 1000; plays++;
  if (audio.preload !== 'auto') audio.preload = 'auto';
  const pr = audio.play(); if (pr && pr.catch) pr.catch(err => { console.warn('tape play', err && err.name); starting = false; live = false; });
  return true;
}
function pause(why) {
  if (!live && !starting && audio.paused) return false;
  starting = false; live = false; pauses++; lastStop = why || 'user';
  if (!audio.paused) audio.pause();
  return true;
}
audio.addEventListener('playing', () => { if (!starting && !live) { audio.pause(); return; } starting = false; live = true; });
audio.addEventListener('ended', () => { live = false; starting = false; lastStop = 'ended'; try { audio.currentTime = 0; } catch (e) { } clunk(0.5); });   // end of the tape: it stops and rewinds
audio.addEventListener('error', () => { console.warn('tape audio error', audio.error && audio.error.code); live = false; starting = false; lastStop = 'error'; });

// mechanical sounds: a clunk (deck / door / keys)
let noiseBuf = null;
function clunk(vol, hi) {
  const A = actx(); if (!A) return; try {
    if (!noiseBuf) { const n = A.sampleRate >> 3; noiseBuf = A.createBuffer(1, n, A.sampleRate); const dd = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) dd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.12)); }
    const t = A.currentTime, p = W2(MOUTH_L), pn = A.createPanner(); pn.panningModel = 'equalpower'; pn.refDistance = 0.8;
    if (pn.positionX) { pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; } else pn.setPosition(p.x, p.y, p.z);
    const s = A.createBufferSource(); s.buffer = noiseBuf; const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hi ? 2600 : 900; f.Q.value = 1.2;
    const gn = A.createGain(); gn.gain.value = (vol || 0.4) * 1.4; s.connect(f); f.connect(gn); gn.connect(pn);
    const o = A.createOscillator(), og = A.createGain(); o.frequency.setValueAtTime(hi ? 420 : 140, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.08); og.gain.setValueAtTime((vol || 0.4) * 0.5, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); o.connect(og); og.connect(pn);
    pn.connect(A.destination); s.start(t); o.start(t); o.stop(t + 0.1);
    const R = RV.roomba; if (R && R.audio) R.audio.quietUntil = Math.max(R.audio.quietUntil || 0, A.currentTime + 0.3);
  } catch (e) { }
}
function buzz(k, ms) { if (RV.haptic) try { RV.haptic(k, ms); } catch (e) { } }

// ------------------------------------------------------------ state
// cassette: 'home' (on the shelf), 'held' (by 'desk' or a controller), 'fly' (moving), 'deck' (in the boombox)
// deck: 'empty' | 'in' (cassette in, door shut) | 'ejected' (door open, cassette sticking out)
let state = 'home', by = null, via = null, anim = null, deck = 'empty', doorT = 0, doorE = 0, grabs = 0, inserts = 0, ejects = 0, homeRuns = 0;
function heldBy(h) { return state === 'held' && by === h; }
const homers = [];                                   // other cassettes flying back to the shelf
let switches = 0;
function select(T) {                                 // make T the cassette in play; the old one goes back to its spot
  if (T === cur) return;
  const old = cur;
  if (state !== 'home') {
    if (deck !== 'empty' || live || starting) { pause('swapped'); clunk(0.35); }
    deck = 'empty'; doorT = 0; anim = null;
    homers.push({ T: old, t: 0, dur: 0.45, p0: old.cs.position.clone(), q0: old.cs.quaternion.clone() });
  }
  try { old.pos = audio.currentTime || 0; } catch (e) { old.pos = 0; }
  if (!audio.paused) audio.pause();
  live = false; starting = false;
  cur = T; cs = T.cs; csHit = T.hit; hubs = T.hubs; HOME_P = T.HOME_P; HOME_Q = T.HOME_Q;
  audio.src = T.src; audio.preload = 'none'; resumeAt = T.pos;
  state = 'home'; by = null; via = null; switches++;
}
let resumeAt = 0;
audio.addEventListener('loadedmetadata', () => { if (resumeAt > 0) { try { audio.currentTime = Math.min(resumeAt, (audio.duration || 1e9) - 0.5); } catch (e) { } resumeAt = 0; } });
function busy(h) {                                   // that hand (or the screen pointer) already holds something else
  try {
    if (RV.drawers && RV.drawers.heldBy && RV.drawers.heldBy(h)) return true;
    if (RV.letter && RV.letter.heldBy && RV.letter.heldBy(h)) return true;
    if (RV.phone && RV.phone.heldBy && RV.phone.heldBy(h)) return true;
    const d = Md._debug; if (d && d.holds && d.holds.get && d.holds.get(h)) return true;
  } catch (e) { }
  return false;
}
const Q_DESK = new Q().setFromEuler(new THREE.Euler(-0.12, -0.22, 0.04));
const Q_HAND = new Q().setFromAxisAngle(new V3(1, 0, 0), -0.9);
const _p = new V3(), _q = new Q(), _s = new V3();
function holdPose(h, outP, outQ) {
  if (h === 'desk') { camera.updateMatrixWorld(); camera.matrixWorld.decompose(_p, _q, _s); outP.set(0.11, -0.1, -0.32).applyQuaternion(_q).add(_p); outQ.copy(_q).multiply(Q_DESK); }
  else { h.updateMatrixWorld(); h.matrixWorld.decompose(_p, _q, _s); outP.set(0, 0.02, -0.075).applyQuaternion(_q).add(_p); outQ.copy(_q).multiply(Q_HAND); }
}
function fly(p1, q1, dur, arc, done) { state = 'fly'; by = null; via = null; anim = { t: 0, dur, p0: cs.position.clone(), q0: cs.quaternion.clone(), p1: p1.clone(), q1: q1.clone(), arc: arc || 0, done }; }
function grab(h, how, T) {
  if (T && T !== cur) select(T);
  if (deck !== 'empty') { pause('taken out'); deck = 'empty'; doorT = 0; clunk(0.35); }
  state = 'held'; by = h; via = how || 'select'; anim = { grab: true, t: 0, dur: 0.18, p0: cs.position.clone(), q0: cs.quaternion.clone() };
  grabs++; buzz(0.3, 30); return true;
}
function toHome() {
  const d = cs.position.distanceTo(HOME_P); homeRuns++;
  fly(HOME_P, HOME_Q, clamp(0.25 + d * 0.25, 0.25, 0.7), Math.min(0.12, d * 0.1), () => { state = 'home'; clunk(0.15, true); });
  return true;
}
function insert() {
  if (deck === 'in') return true;
  const pre = W2(PRE_L), d = cs.position.distanceTo(pre); inserts++;
  doorT = 1;
  const slide = () => fly(W2(DECK_L), DECK_Q, 0.16, 0, () => { state = 'deck'; deck = 'in'; doorT = 0; clunk(0.55); buzz(0.5, 50); setTimeout(() => { if (deck === 'in' && state === 'deck') play(); }, 280); });
  if (deck === 'ejected') { deck = 'empty'; slide(); return true; }
  fly(pre, DECK_Q, clamp(0.18 + d * 0.3, 0.18, 0.6), Math.min(0.08, d * 0.08), slide);
  return true;
}
function eject() {
  if (deck !== 'in') return false;
  pause('eject'); ejects++; deck = 'ejected'; doorT = 1; clunk(0.5);
  fly(W2(EJECT_L), EJECT_Q, 0.14, 0, () => { state = 'deck'; });
  return true;
}
function press(k) {
  const K = keys[k]; if (K) K.t = 0.16; clunk(0.3, true); buzz(0.25, 25);
  if (k === 'play') { if (deck === 'ejected') return insert(); if (deck === 'in') return play(); return true; }
  if (k === 'pause') { if (live || starting) pause('user'); else if (deck === 'in' && audio.currentTime > 0) play(); return true; }
  if (k === 'eject') { if (deck === 'in') return eject(); if (deck === 'ejected') return insert(); doorT = doorT ? 0 : 1; return true; }
  return true;
}
function boxClick() {                                // the boombox itself: play / pause, or push an ejected cassette back in
  if (deck === 'ejected') return insert();
  if (deck === 'in') { if (live || starting) pause('user'); else play(); return true; }
  doorT = 1; setTimeout(() => { if (deck === 'empty') doorT = 0; }, 450); clunk(0.2, true); return true;
}

// ------------------------------------------------------------ picking
const ray = new THREE.Raycaster(); ray.far = 8;
const keyHits = KEYS.map(k => keys[k].hit);
function tapePickable() { return state === 'home' || (state === 'deck'); }
function tapeHits() { const l = []; for (const T of TAPES) { if (homers.some(h => h.T === T)) continue; if (T === cur) { if (tapePickable()) l.push(T.hit); } else l.push(T.hit); } return l; }
function pick(o, d, holding) {
  ray.set(o, d); bb.updateMatrixWorld(true); cs.updateMatrixWorld(true);
  const list = [bbHit, ...keyHits]; if (!holding) list.push(...tapeHits());
  const hs = ray.intersectObjects(list, false); if (!hs.length) return null;
  let h = hs[0];
  const key = hs.find(x => x.object.userData.kind === 'key' && x.distance - h.distance < 0.03); if (key && !holding) h = key;
  const tp = hs.find(x => x.object.userData.kind === 'tape' && x.distance - h.distance < 0.06); if (tp) h = tp;
  let kind = h.object.userData.kind;
  if (kind === 'box' && deck !== 'empty') { const l = bb.worldToLocal(h.point.clone()); if (Math.abs(l.x) < DX + 0.005 && l.y > DY0 - 0.005 && l.y < DY1 + 0.005 && l.z > D / 2 - 0.01) kind = 'door'; }
  return { t: h.distance, point: h.point, kind, key: h.object.userData.key, tape: h.object.userData.tape };
}
function heldT(o, d) { if (state !== 'held' || by !== 'desk') return null; ray.set(o, d); cs.updateMatrixWorld(true); const h = ray.intersectObject(csHit, false)[0]; return h ? h.distance : null; }
const orig = { click: Md.click, selectStart: Md.selectStart, selectEnd: Md.selectEnd, hoverT: Md.hoverT, tick: Md.tick, playing: Md.playing };
function mine(o, d, holding) { const p = pick(o, d, holding); if (!p) return null; const m = orig.hoverT(o, d); return m == null || p.t < m ? p : null; }
function act(p, h, how) {                            // a click / trigger on something of ours, hand empty
  if (p.kind === 'tape') return grab(h, how, p.tape);
  if (p.kind === 'door' && deck !== 'empty') return grab(h, how, cur);   // take the cassette out of the deck
  if (p.kind === 'key') return press(p.key);
  return boxClick();
}

// screen: click the cassette (held up in front of you), then the boombox
Md.click = function (o, d) {
  if (heldBy('desk')) {
    if (heldT(o, d) != null) return toHome();                                         // clicked the cassette in your hand: back on the shelf
    const p = mine(o, d, true); if (p) return insert();
    toHome(); return orig.click(o, d);                                                // clicked something else: it goes back, the click goes on
  }
  if (busy('desk')) return orig.click(o, d);
  const p = mine(o, d, false); if (p) return act(p, 'desk', 'click');
  return orig.click(o, d);
};
// VR trigger: on the cassette = hold it while the trigger is down; keys / boombox = press
Md.selectStart = function (c, o, d) {
  if (heldBy(c)) return true;
  if (busy(c)) return orig.selectStart(c, o, d);
  const p = mine(o, d, false);
  if (p && p.t < 6) return act(p, c, 'select');
  return orig.selectStart(c, o, d);
};
Md.selectEnd = function (c, o, d) {
  if (heldBy(c)) { if (via === 'select') releaseVR(c, o, d); return true; }
  return orig.selectEnd(c, o, d);
};
Md.hoverT = function (o, d) { const a = orig.hoverT(o, d), h = heldT(o, d), b = pick(o, d, state === 'held'); let t = b ? b.t : null; if (h != null && (t == null || h < t)) t = h; return t != null && (a == null || t < a) ? t : a; };
Md.playing = function () { return (orig.playing ? orig.playing() : false) || live || starting; };
function releaseVR(c, o, d) {
  if (!heldBy(c)) return false;
  if (cs.position.distanceTo(W2(MOUTH_L)) < 0.22) return insert();
  if (o && d) { ray.set(o, d); bb.updateMatrixWorld(true); const h = ray.intersectObject(bbHit, false)[0]; if (h && h.distance < 4) return insert(); }
  return toHome();
}
// VR grip: squeeze with your hand next to the cassette, or pointing at it
const NEAR = 0.12;
function ctrlRay(c) { c.updateMatrixWorld(true); c.getWorldPosition(_p); c.getWorldQuaternion(_q); return { o: _p.clone(), d: new V3(0, 0, -1).applyQuaternion(_q) }; }
function squeezeStart(c) {
  if (heldBy(c) || busy(c)) return false;
  const r = ctrlRay(c);
  let near = null, nd = NEAR; for (const hm of tapeHits()) { const T = hm.userData.tape, dd = T.cs.getWorldPosition(new V3()).distanceTo(r.o); if (dd < nd) { nd = dd; near = T; } }
  if (near) return grab(c, 'squeeze', near);
  const p = mine(r.o, r.d, false);
  if (p && p.t < 6 && (p.kind === 'tape' || (p.kind === 'door' && deck !== 'empty'))) return grab(c, 'squeeze', p.tape || cur);
  return false;
}
function squeezeEnd(c) { if (!heldBy(c) || via !== 'squeeze') return false; const r = ctrlRay(c); return releaseVR(c, r.o, r.d); }
if (renderer && renderer.xr) {
  for (const i of [0, 1]) {
    const c = renderer.xr.getController(i);
    c.addEventListener('squeezestart', () => { try { squeezeStart(c); } catch (e) { console.warn('tape grip', e); } });
    c.addEventListener('squeezeend', () => { try { squeezeEnd(c); } catch (e) { console.warn('tape grip', e); } });
  }
  renderer.xr.addEventListener('sessionstart', () => { if (state === 'held' && by === 'desk') toHome(); });
  renderer.xr.addEventListener('sessionend', () => { if (state === 'held' && by !== 'desk') toHome(); });
}

// ------------------------------------------------------------ frame
const _hp = new V3(), _hq = new Q();
Md.tick = function (dt, T) {
  orig.tick(dt, T);
  dt = Math.min(dt || 0.016, 0.1);
  if (state === 'held') {
    holdPose(by, _hp, _hq);
    if (anim && anim.grab) { anim.t += dt; const k = ease(clamp(anim.t / anim.dur, 0, 1)); cs.position.lerpVectors(anim.p0, _hp, k); cs.quaternion.slerpQuaternions(anim.q0, _hq, k); if (k >= 1) anim = null; }
    else { cs.position.copy(_hp); cs.quaternion.copy(_hq); }
    if (by !== 'desk' && cs.position.distanceTo(W2(MOUTH_L)) < 0.06) insert();        // pushed it into the deck
  } else if (state === 'fly' && anim) {
    anim.t += dt; const k = ease(clamp(anim.t / anim.dur, 0, 1));
    cs.position.lerpVectors(anim.p0, anim.p1, k); cs.position.y += Math.sin(k * Math.PI) * anim.arc; cs.quaternion.slerpQuaternions(anim.q0, anim.q1, k);
    if (k >= 1) { const a = anim; cs.position.copy(a.p1); cs.quaternion.copy(a.q1); anim = null; if (a.done) a.done(); }
  }
  for (let i = homers.length - 1; i >= 0; i--) {
    const hm = homers[i]; hm.t += dt; const k = ease(clamp(hm.t / hm.dur, 0, 1));
    hm.T.cs.position.lerpVectors(hm.p0, hm.T.HOME_P, k); hm.T.cs.position.y += Math.sin(k * Math.PI) * 0.06; hm.T.cs.quaternion.slerpQuaternions(hm.q0, hm.T.HOME_Q, k);
    if (k >= 1) { hm.T.cs.position.copy(hm.T.HOME_P); hm.T.cs.quaternion.copy(hm.T.HOME_Q); homers.splice(i, 1); }
  }
  // door
  doorE += clamp(doorT - doorE, -dt * 7, dt * 7); door.rotation.x = doorE * 0.42;
  // keys
  for (const k of KEYS) { const K = keys[k]; if (K.t > 0) K.t = Math.max(0, K.t - dt); const down = (K.t > 0 ? 1 : 0) || (k === 'play' && (live || starting) ? 0.6 : 0) || (k === 'pause' && !live && !starting && deck === 'in' && audio.currentTime > 0 ? 0.6 : 0); K.m.position.z = K.z0 - down * 0.006; }
  // tape running: reels spin, VU meter, power light, tuner glow; something else starting pauses it
  if (live) { for (const h of hubs) h.rotation.z += dt * 4.5; }
  if (live || starting) {
    if (performance.now() / 1000 - startedAt > 0.4 && othersPlaying()) pause('other media');
    if (starting && performance.now() / 1000 - startedAt > 15) starting = false;
  }
  vuAcc += dt;
  if (vuAcc > 1 / 20) {
    vuAcc = 0; let tl = 0, tr = 0;
    if (live && an) { an.getByteFrequencyData(anBuf); let a = 0, b = 0; for (let i = 1; i < 16; i++) a += anBuf[i]; for (let i = 16; i < 64; i++) b += anBuf[i]; tl = clamp(a / 15 / 210, 0, 1); tr = clamp(b / 48 / 150, 0, 1); }
    const nl = tl > vuL ? tl : vuL * 0.8, nr = tr > vuR ? tr : vuR * 0.8;
    if (Math.abs(nl - vuL) > 0.01 || Math.abs(nr - vuR) > 0.01 || vuDirty) { vuL = nl < 0.02 ? 0 : nl; vuR = nr < 0.02 ? 0 : nr; vuDirty = false; drawVU(); }
  }
  const on = live || starting;
  ledM.color.setHex(on ? 0xff3030 : 0x401010);
  tunerM.emissive.setHex(on ? 0x8a6a30 : 0x000000);
};

RV.tape = {
  bb, door, keys, audio, TAPES, select,
  get cs() { return cs; }, get HOME_P() { return HOME_P; }, current: () => cur.id,
  play, pause, insert, eject, press, grab, toHome, heldBy, releaseVR, squeezeStart, squeezeEnd, pick,
  playing: () => live || starting, state: () => state, deck: () => deck,
  _debug: () => { const p = cs.position; return { tape: cur.id, switches, homing: homers.length, state, deck, by: by === 'desk' ? 'desk' : by ? 'controller' : null, via, live, starting, plays, pauses, grabs, inserts, ejects, homeRuns, lastStop,
    t: +audio.currentTime.toFixed(2), dur: audio.duration, paused: audio.paused, wired: !!src, door: +doorE.toFixed(2), x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4), vu: [+vuL.toFixed(2), +vuR.toFixed(2)] }; },
};
})();
