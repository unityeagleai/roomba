// Charlie and Miles, player 2 and player 3: two little voxel statues on the bookshelf either side of the Unity Eagle
// figurine, 8-bit like her and like the arcade episodes. Charlie: spiky blonde hair, green hoodie with a yellow lightning
// bolt, fist in the air. Miles: dark hair, glasses, purple jacket, holding a coffee. Click one (or point + trigger in VR)
// and that one says a line out loud, roasting the other, with a pixel speech bubble as a caption. Lines are picked at
// random with no immediate repeat. One line at a time: clicks while either is talking are ignored. They never pause the
// TV, the record, the frame or the poster. Voices are AI voice clones made from Charlie and Miles clips used in the
// arcade episodes (Chatterbox, offline), not live Sesame voices.
// Hooks itself into RV.media (click / selectStart / hoverT / tick) like originframe.js, so app.js needs no changes.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene || !RV.media) return;
const scene = RV.scene;

const SHELF_Y = 1.2 + 0.0125, SHELF_Z = -2.04;   // middle board of the bookshelf right of the TV (Unity stands at x 2.13)
const V = 0.0095;                                // voxel size (m): ~24 voxels tall = ~0.23 m, Unity is 0.24
const PLINTH_H = 0.022;

// ---------------------------------------------------------------- lines (file, caption)
const LINES = {
  charlie: [
    ['charlie_1', "Miles, put the coffee down. You're not tired, you're just slow."],
    ['charlie_2', "I'm the fun brother. Miles reads the terms and conditions."],
    ['charlie_3', "Nice glasses, Miles. Still can't see a joke coming."],
    ['charlie_4', "I've got lightning on my hoodie. Miles has decaf."],
    ['charlie_5', "Unity, pick me! Miles only talks in lowercase."],
    ['charlie_6', "Miles is so calm because his loading bar never finishes."],
  ],
  miles: [
    ['miles_1', "Charlie's hair is spiky because his thoughts escape out the top."],
    ['miles_2', "Easy, Charlie. Some of us keep our voltage indoors."],
    ['miles_3', "I'm not slow. I'm waiting for Charlie to stop shouting."],
    ['miles_4', "That hoodie has more charge than Charlie's arguments."],
    ['miles_5', "This is my second coffee. Charlie was my first headache."],
    ['miles_6', "Unity, he's the middle brother. He needs the attention."],
  ],
};

// ---------------------------------------------------------------- voxel builder (one mesh per statue, unlit vertex colours, baked face shading)
function Vox() { this.m = new Map(); }
Vox.prototype.set = function (x, y, z, c) { this.m.set(x + ',' + y + ',' + z, c); };
Vox.prototype.del = function (x, y, z) { this.m.delete(x + ',' + y + ',' + z); };
Vox.prototype.fill = function (x0, x1, y0, y1, z0, z1, c) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, c); };
Vox.prototype.has = function (x, y, z) { return this.m.has(x + ',' + y + ',' + z); };
Vox.prototype.mesh = function (name) {
  const P = [], C = [], I = []; let nv = 0; const col = new THREE.Color();
  const SH = { f: 0.95, b: 0.55, t: 1.0, d: 0.5, l: 0.82, r: 0.68 };
  const F = [   // dir, shade, 4 corners (unit cube)
    [[0, 0, 1], SH.f, [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
    [[0, 0, -1], SH.b, [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]],
    [[0, 1, 0], SH.t, [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]],
    [[0, -1, 0], SH.d, [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [[-1, 0, 0], SH.l, [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
    [[1, 0, 0], SH.r, [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]],
  ];
  for (const [k, c] of this.m) {
    const [x, y, z] = k.split(',').map(Number);
    col.setHex(c).convertSRGBToLinear();
    for (const [d, s, q] of F) {
      if (this.has(x + d[0], y + d[1], z + d[2])) continue;
      for (const v of q) { P.push((x + v[0]) * V, (y + v[1]) * V + PLINTH_H, (z + v[2]) * V); C.push(col.r * s, col.g * s, col.b * s); }
      I.push(nv, nv + 1, nv + 2, nv, nv + 2, nv + 3); nv += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
  g.computeBoundingSphere(); g.computeBoundingBox();
  const me = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true })); me.name = name; return me;
};

// x runs -6..5 (12 wide), z -3..2 (front is +z), y 0 = feet
function head(v, skin, eye) {
  v.fill(-4, 3, 15, 21, -3, 2, skin);                      // 8 x 7 x 6 head
  v.fill(-1, 0, 13, 14, -1, 0, skin);                      // neck
  v.set(-3, 18, 2, eye); v.set(-2, 18, 2, eye); v.set(1, 18, 2, eye); v.set(2, 18, 2, eye);   // eyes
  v.set(-3, 19, 2, 0xffffff); v.set(1, 19, 2, 0xffffff);   // eye glints
  v.set(-5, 17, 0, skin); v.set(4, 17, 0, skin);           // ears
}
function buildCharlie() {
  const v = new Vox(), skin = 0xf2c29a, green = 0x2fbf4a, greenD = 0x1f8a34, yel = 0xffe14a, blond = 0xffd84a, blondD = 0xe0a92a;
  v.fill(-4, -1, 0, 1, -2, 2, 0x22222a); v.fill(1, 4, 0, 1, -2, 2, 0x22222a);           // sneakers
  v.fill(-4, -1, 0, 0, 2, 2, 0xf4f4f4); v.fill(1, 4, 0, 0, 2, 2, 0xf4f4f4);             // white toe caps
  v.fill(-4, -1, 2, 6, -2, 1, 0x3a5a9a); v.fill(1, 4, 2, 6, -2, 1, 0x3a5a9a);           // jeans
  v.fill(-4, 4, 7, 7, -2, 1, 0x3a5a9a);
  v.fill(-5, 4, 7, 13, -2, 1, green); v.fill(-5, 4, 7, 7, -2, 1, greenD);              // hoodie, darker waistband
  v.fill(-2, 1, 8, 9, 2, 2, greenD);                                                     // front pocket
  // lightning bolt on the chest (front face, z = 2)
  [[1, 13], [0, 13], [0, 12], [-1, 12], [-1, 11], [0, 11], [1, 11], [0, 10], [-1, 10]].forEach(([x, y]) => v.set(x, y, 2, yel));
  v.fill(-4, 3, 13, 14, -3, -3, green);                                                  // hood behind the neck
  v.fill(-7, -6, 8, 13, -1, 0, green); v.fill(-7, -6, 6, 7, -1, 0, skin);              // left arm down, hand
  v.fill(5, 6, 12, 19, -1, 0, green); v.fill(5, 6, 20, 21, -1, 0, skin);               // right arm up: fist pump
  head(v, skin, 0x1a1020);
  v.fill(-2, 1, 16, 16, 2, 2, 0x8a2a2a); v.set(-3, 17, 2, 0x8a2a2a); v.set(2, 17, 2, 0x8a2a2a);  // big grin
  v.set(-1, 16, 2, 0xffffff); v.set(0, 16, 2, 0xffffff);
  // spiky blonde hair
  v.fill(-4, 3, 22, 22, -3, 2, blond); v.fill(-4, 3, 20, 21, -3, -2, blond);
  v.fill(-5, -5, 18, 22, -3, 0, blond); v.fill(4, 4, 18, 22, -3, 0, blond);
  v.fill(-4, 3, 21, 21, 2, 2, blond); v.set(-4, 20, 2, blond); v.set(-1, 20, 2, blondD); v.set(2, 20, 2, blond);   // fringe
  [[-4, -2, 3, blondD], [-2, -1, 4, blond], [0, -2, 5, blond], [2, -1, 4, blond], [3, 1, 3, blondD], [-3, 1, 3, blond], [0, 1, 4, blondD], [-1, -3, 3, blondD], [2, -3, 3, blond]].forEach(([x, z, h, c]) => {
    for (let k = 1; k <= h; k++) { const w = k <= h - 2 ? 1 : 0; for (let dx = 0; dx <= w; dx++) for (let dz = 0; dz <= w; dz++) v.set(x + dx, 22 + k, z + dz, k === h ? blond : c); }
  });
  return v.mesh('charlieVoxels');
}
function buildMiles() {
  const v = new Vox(), skin = 0xd9a07a, purple = 0x7a3fc0, purpleD = 0x55288e, hair = 0x2a1e1a, mug = 0xf4ecd8;
  v.fill(-4, -1, 0, 1, -2, 2, 0x5a3a22); v.fill(1, 4, 0, 1, -2, 2, 0x5a3a22);           // brown boots
  v.fill(-4, -1, 2, 6, -2, 1, 0x2a2a34); v.fill(1, 4, 2, 6, -2, 1, 0x2a2a34);           // dark trousers
  v.fill(-5, 4, 7, 13, -2, 1, purple);                                                   // jacket
  v.fill(-1, 0, 8, 13, 2, 2, 0xd8d8e0); v.fill(-1, 0, 8, 13, 1, 1, 0xd8d8e0);           // open front: grey tee
  v.fill(-2, -2, 8, 13, 2, 2, purpleD); v.fill(1, 1, 8, 13, 2, 2, purpleD);             // lapels
  v.fill(-5, 4, 13, 13, -2, 1, purpleD);                                                 // collar
  v.fill(-7, -6, 8, 13, -1, 0, purple); v.fill(-7, -6, 6, 7, -1, 0, skin);             // left arm hanging, relaxed
  v.fill(5, 6, 10, 13, -1, 0, purple); v.fill(5, 6, 10, 11, 1, 3, purple); v.fill(5, 6, 10, 11, 4, 4, skin);   // right arm bent forward
  v.fill(4, 7, 12, 15, 4, 6, mug); v.fill(5, 6, 15, 15, 5, 5, 0x4a2a14);               // coffee mug, coffee showing
  v.fill(8, 8, 13, 14, 5, 5, mug); v.fill(4, 7, 13, 13, 4, 6, 0x3ff0e0);                // handle, teal stripe
  v.set(5, 17, 5, 0xe8e8f0); v.set(6, 18, 5, 0xe8e8f0); v.set(5, 19, 5, 0xe8e8f0);      // a curl of steam
  head(v, skin, 0x1a1020);
  v.fill(-1, 1, 16, 16, 2, 2, 0x7a3030);                                                 // small smirk, off-centre
  v.set(2, 17, 2, 0x7a3030);
  // glasses: black frames with cyan lenses across the eyes, arms back to the ears
  v.fill(-4, 3, 19, 19, 3, 3, 0x111111); v.fill(-4, 3, 17, 17, 3, 3, 0x111111);
  [-4, -1, 0, 3].forEach(x => v.set(x, 18, 3, 0x111111));
  [-3, -2, 1, 2].forEach(x => v.set(x, 18, 3, 0x7fe0ff));
  v.fill(-5, -5, 18, 18, -1, 2, 0x111111); v.fill(4, 4, 18, 18, -1, 2, 0x111111);
  // neat dark hair, a soft side part and a fringe sweeping left
  v.fill(-4, 3, 22, 23, -3, 2, hair); v.fill(-4, 3, 19, 21, -3, -2, hair);
  v.fill(-5, -5, 19, 22, -3, 1, hair); v.fill(4, 4, 19, 22, -3, 1, hair);
  v.fill(-4, 1, 21, 21, 2, 2, hair); v.fill(-4, -2, 20, 20, 2, 2, hair); v.set(-3, 24, 0, hair); v.set(-2, 24, 0, hair); v.set(-2, 24, -1, hair);
  return v.mesh('milesVoxels');
}

// ---------------------------------------------------------------- plinth with a plaque, like Unity's 1P plinth
function plinth(root, label, color) {
  const blackM = new THREE.MeshPhongMaterial({ color: 0x15141a, shininess: 40, specular: 0x333333 });
  const brassM = new THREE.MeshPhongMaterial({ color: 0xb8913f, shininess: 70, specular: 0x8a6a2a });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, PLINTH_H, 28), blackM); disc.position.y = PLINTH_H / 2; root.add(disc);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.0715, 0.0715, 0.004, 28, 1, true), brassM); rim.position.y = PLINTH_H - 0.002; root.add(rim);
  const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d');
  const draw = () => { x.fillStyle = '#b8913f'; x.fillRect(0, 0, 128, 32); x.fillStyle = '#2a1a08'; x.fillRect(3, 3, 122, 26); x.fillStyle = color;
    x.font = '12px "Press Start 2P", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, 64, 17); };
  draw();
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.magFilter = THREE.NearestFilter;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.016), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  plaque.position.set(0, PLINTH_H / 2, 0.0755); plaque.rotation.x = -0.06; root.add(plaque);
  if (document.fonts && document.fonts.load) document.fonts.load('12px "Press Start 2P"').then(() => { draw(); t.needsUpdate = true; }).catch(() => { });
  return disc;
}

// ---------------------------------------------------------------- speech bubble (caption), drawn on a canvas, always faces you
function bubble(color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: 0 });
  const me = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), m); me.renderOrder = 10; me.visible = false;
  function draw(text) {
    x.clearRect(0, 0, 512, 160);
    x.fillStyle = '#100820'; x.fillRect(8, 8, 496, 120); x.fillRect(236, 128, 40, 14); x.fillRect(248, 142, 16, 12);
    x.fillStyle = '#f4ecd8'; x.fillRect(16, 16, 480, 104); x.fillRect(244, 120, 24, 14); x.fillRect(252, 134, 8, 8);
    x.fillStyle = color; x.fillRect(16, 16, 480, 6);
    x.fillStyle = '#100820'; x.font = '17px "Press Start 2P", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const words = text.split(' '), rows = []; let row = '';
    for (const w of words) { const tr = row ? row + ' ' + w : w; if (x.measureText(tr).width > 450 && row) { rows.push(row); row = w; } else row = tr; }
    if (row) rows.push(row);
    const lh = rows.length > 3 ? 22 : 26, y0 = 70 - (rows.length - 1) * lh / 2;
    rows.forEach((r, i) => x.fillText(r, 256, y0 + i * lh));
    t.needsUpdate = true;
  }
  return { mesh: me, draw };
}

// ---------------------------------------------------------------- the two statues
const DEFS = {
  charlie: { x: 1.86, yaw: -0.15, build: buildCharlie, label: '2P CHARLIE', color: '#5ce07a' },
  miles: { x: 2.40, yaw: -0.55, build: buildMiles, label: '3P MILES', color: '#c89cff' },
};
const S = {};
for (const id of Object.keys(DEFS)) {
  const d = DEFS[id];
  const root = new THREE.Group(); root.name = id + 'Statue'; root.position.set(d.x, SHELF_Y, SHELF_Z); root.rotation.y = d.yaw; scene.add(root);
  const disc = plinth(root, d.label, d.color);
  const body = new THREE.Group(); root.add(body);
  const mesh = d.build(); mesh.position.x = 0.5 * V; body.add(mesh);   // centre the 12-wide grid (-6..5) on the plinth
  // invisible pick volume around the figure (easier to hit with a VR ray than thin voxels)
  const bb = mesh.geometry.boundingBox, hit = new THREE.Mesh(new THREE.BoxGeometry(0.15, bb.max.y + 0.01, 0.13), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, (bb.max.y + 0.01) / 2, 0); hit.name = id + ' statue pick'; root.add(hit);
  const bub = bubble(d.color); scene.add(bub.mesh);
  S[id] = { id, root, body, mesh, hit, disc, bub, last: -1, says: 0, h: bb.max.y };
}

// ---------------------------------------------------------------- audio: decoded buffers, played through a panner at the statue
const buffers = {}; let loading = null;
function ctx() { return RV.roomba && RV.roomba.audio && RV.roomba.audio.ctx; }
function loadAll() {
  const A = ctx(); if (!A || loading) return loading;
  const files = [].concat(LINES.charlie, LINES.miles).map(l => l[0]);
  loading = Promise.all(files.map(f => fetch('assets/audio/statues/' + f + '.mp3').then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.arrayBuffer(); })
    .then(ab => new Promise((res, rej) => A.decodeAudioData(ab, res, rej))).then(b => { buffers[f] = b; }).catch(e => console.warn('statue voice', f, e && (e.message || e)))));
  return loading;
}
let speaking = null, until = 0, now = 0, lockUntil = 0, src = null, fallbackEl = null;
function pickLine(s) {
  const L = LINES[s.id]; let i = Math.floor(Math.random() * L.length);
  if (L.length > 1 && i === s.last) i = (i + 1 + Math.floor(Math.random() * (L.length - 1))) % L.length;
  s.last = i; return L[i];
}
function say(id) {
  const s = S[id]; if (!s) return false;
  if (speaking || now < lockUntil) { api.ignored++; return true; }    // one line at a time: extra clicks are swallowed, not queued
  const [file, text] = pickLine(s);
  speaking = s; s.says++; api.lastLine = { id, file, text };
  let dur = 0.6 + text.length * 0.06;                                 // caption time if the audio is missing
  const A = ctx(); if (A && A.state === 'suspended') A.resume();
  const go = () => {
    const b = buffers[file];
    if (A && b) {
      const p = new THREE.Vector3(); s.root.localToWorld(p.set(0, s.h * 0.85, 0));
      const g = A.createGain(); g.gain.value = 1.6;
      const pan = A.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 1.0; pan.rolloffFactor = 0.6; pan.maxDistance = 15;
      if (pan.positionX) { pan.positionX.value = p.x; pan.positionY.value = p.y; pan.positionZ.value = p.z; } else pan.setPosition(p.x, p.y, p.z);
      src = A.createBufferSource(); src.buffer = b; src.connect(g); g.connect(pan); pan.connect(A.destination); src.start();
      dur = b.duration; api.audioPlays++;
    } else {
      // no Web Audio buffer (not decoded yet / blocked): fall back to a plain audio element so it's still heard
      try { fallbackEl = new Audio('assets/audio/statues/' + file + '.mp3'); fallbackEl.volume = 1; const pr = fallbackEl.play(); if (pr && pr.catch) pr.catch(() => { }); api.fallbackPlays++; } catch (e) { }
    }
    until = now + dur + 0.35;
  };
  if (buffers[file] || !A) go(); else { until = now + 30; (loadAll() || Promise.resolve()).then(go); }
  until = Math.max(until, now + dur + 0.35);
  s.bub.draw((id === 'charlie' ? 'CHARLIE: ' : 'MILES: ') + text);
  if (RV.haptic) RV.haptic(0.25, 30);
  return true;
}
function stopAll() { try { if (src) src.stop(); } catch (e) { } try { if (fallbackEl) fallbackEl.pause(); } catch (e) { } src = null; fallbackEl = null; if (speaking) { speaking = null; lockUntil = now + 0.3; } }

// ---------------------------------------------------------------- picking + hooks into RV.media
const ray = new THREE.Raycaster(); ray.far = 12;
const hits = Object.values(S).map(s => s.hit);
function pick(o, d) { ray.set(o, d); const h = ray.intersectObjects(hits, false)[0]; return h ? { t: h.distance, id: h.object.name.split(' ')[0] } : null; }
const M = RV.media, orig = { click: M.click, selectStart: M.selectStart, hoverT: M.hoverT, tick: M.tick, unlock: M.unlock };
function mine(o, d) { const h = pick(o, d); if (!h) return null; const m = orig.hoverT(o, d); return m == null || h.t < m ? h.id : null; }
M.click = function (o, d) { const id = mine(o, d); if (id) return say(id); return orig.click(o, d); };
M.selectStart = function (c, o, d) { const id = mine(o, d); if (id) return say(id); return orig.selectStart(c, o, d); };
M.hoverT = function (o, d) { const a = orig.hoverT(o, d), h = pick(o, d); return h && (a == null || h.t < a) ? h.t : a; };
M.unlock = function () { const r = orig.unlock.apply(this, arguments); loadAll(); return r; };

const camP = new THREE.Vector3(), tmp = new THREE.Vector3();
M.tick = function (dt, T) {
  orig.tick(dt, T); now = T;
  if (speaking && now > until) { speaking = null; src = null; lockUntil = now + 0.25; }
  RV.camera.getWorldPosition(camP);
  for (const s of Object.values(S)) {
    const on = speaking === s;
    // talking: a little hop and wobble; at rest: still
    s.body.position.y = on ? Math.abs(Math.sin(T * 14)) * 0.008 : s.body.position.y * 0.8;
    s.body.rotation.z = on ? Math.sin(T * 9) * 0.06 : s.body.rotation.z * 0.8;
    const m = s.bub.mesh.material; m.opacity += ((on ? 1 : 0) - m.opacity) * Math.min(1, dt * (on ? 12 : 5));
    s.bub.mesh.visible = m.opacity > 0.02;
    if (s.bub.mesh.visible) {
      s.root.localToWorld(tmp.set(0, s.h + PLINTH_H + 0.11, 0));
      s.bub.mesh.position.copy(tmp); s.bub.mesh.lookAt(camP);
      const dist = camP.distanceTo(tmp), k = Math.max(0.75, Math.min(2.2, dist / 1.4)); s.bub.mesh.scale.setScalar(k);   // stays readable from across the room
    }
  }
};

const api = RV.statues = { S, LINES, say, stopAll, pick, ignored: 0, audioPlays: 0, fallbackPlays: 0, lastLine: null,
  _debug: { state: () => ({ speaking: speaking && speaking.id, until, now, loaded: Object.keys(buffers).length, lastLine: api.lastLine, ignored: api.ignored, audioPlays: api.audioPlays, fallbackPlays: api.fallbackPlays,
    says: { charlie: S.charlie.says, miles: S.miles.says } }), loadAll } };
})();
