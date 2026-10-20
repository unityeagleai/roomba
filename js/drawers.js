// The top drawer of Unity's desk opens, and the floppy discs are things you can pick up and put away.
// Unity in the Quest: 'actually opening a drawer, and I can grab the discs and put them in a drawer'.
//
// - The drawer: the top one of the three in the desk's pedestal (desk.js builds the other two). Point at it and pull the
//   trigger (or squeeze the grip at its brass pull, or click it on a screen) and it slides out 19 cm; again and it slides
//   shut. It stops short of the red stool. Whatever is inside rides along and disappears into the desk when it closes.
// - The floppies: the two on the desk (GAMES 2 and roomba.bas, where desk.js had them) plus two that start in the
//   drawer (DIARY, keep out!! and zombie.exe). VR: point at one and hold the trigger (or squeeze the grip, pointing at it
//   or with your hand next to it) and it's in your hand; let go over the open drawer and it drops into a free spot in it.
//   Let go over the desk and it lies down there (on top of another floppy if there is one); anywhere else it drops to the
//   floor and hops back to its spot on the desk after a minute. Screen: click a floppy to pick it up, then click the open
//   drawer (or the desk, or the floor). Clicking the closed drawer while holding one opens it.
// - Where the floppies are (drawer / desk) is remembered on this device (localStorage), like the zombie's spot.
// - Locked: the drawer only opens while the PARALLEL UNIVERSE keycard is in the CHARLIE 64. Without it, trying to open it
//   rattles it (it jiggles a few mm, wood knocks + a little latch click) and the CRT flashes >> INSERT ACCESS CARD <<. A
//   tiny card-reader LED next to the pull is red while it's locked, green while the card is in. Shutting always works;
//   taking the card out doesn't slam it shut, but once it's shut it stays locked. (Unity: the phone from the future lives
//   in here, js/phone.js; it takes two slots of the right-hand column while it's inside.)
// Hooks into RV.media (click / selectStart / selectEnd / hoverT / tick) like the light switch and the desk card; the grip is
// a listener on the two XR controllers. Whatever is nearer along the ray wins.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE;
if (!RV || !RV.scene || !RV.media || !RV.desk || !RV.desk.DESK) return;
const scene = RV.scene, camera = RV.camera, renderer = RV.renderer, R = RV.roomba, Md = RV.media;
const { RX, RZ } = RV.room;
const D = RV.desk.DESK, MON = RV.desk.MON, KB = RV.desk.KB, CR = RV.desk.CARD_REST, top = D.top;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = k => k * k * (3 - 2 * k);
const V3 = THREE.Vector3, Q = THREE.Quaternion;

// ------------------------------------------------------------ layout (the pedestal and the top drawer front exactly as desk.js had them)
const PED = { x0: D.x0 + 0.02, x1: D.x0 + 0.40, z0: D.z0 + 0.02, z1: D.z1 - 0.02 };
const FR = { w: PED.x1 - PED.x0 - 0.03, h: 0.19, y0: 0.06 + 2 * 0.215, d: 0.014 };
const DX = (PED.x0 + PED.x1) / 2;
const PULL = 0.19;                                          // slides out 19 cm: the corner stays clear of the stool's seat
const TRAY = { w: FR.w - 0.04, d: 0.40, h: 0.105, y0: FR.y0 + 0.012, th: 0.01, side: 0.012 };
const FLOOR_Y = TRAY.y0 + TRAY.th;                          // inside bottom of the drawer
const T = 0.0034, FW = 0.09, FD = 0.094;                    // a 3.5" floppy: 9 x 9.4 cm, 3.4 mm
const SLOTS = [];                                           // 3 across, 2 deep, all in the part you see when it's open
for (const z of [-0.05, -0.143]) for (const x of [-0.1, 0, 0.1]) SLOTS.push({ x, z, ry: (SLOTS.length % 2 ? 0.06 : -0.05) });

const phong = o => new THREE.MeshPhongMaterial(o);
const M = RV.mat || {};
const wood = M.wood || phong({ color: 0x8a5a34, shininess: 22 });
const brass = phong({ color: 0xb08a4a, shininess: 70, specular: 0x806030 });
const inner = phong({ color: 0x9c7450, shininess: 10 });   // plain unfinished wood inside the drawer
const box = new THREE.BoxGeometry(1, 1, 1);
function blk(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(box, mat); m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m; }
const invis = new THREE.MeshBasicMaterial({ visible: false });

// ------------------------------------------------------------ the drawer (front + brass pull + a tray that slides out of the pedestal)
const drawer = new THREE.Group(); drawer.name = 'deskDrawer'; drawer.position.set(DX, 0, PED.z1); scene.add(drawer);
const front = blk(FR.w, FR.h, FR.d, wood, 0, FR.y0 + FR.h / 2, FR.d / 2, drawer); front.name = 'deskDrawerFront';
const pull = blk(0.09, 0.014, 0.012, brass, 0, FR.y0 + FR.h * 0.62, FR.d + 0.006, drawer); pull.name = 'deskDrawerPull';
// the lock: a little brass card-reader plate right of the pull with an LED (red = locked, green = keycard is in)
const ledRed = new THREE.MeshBasicMaterial({ color: 0xff2a1a }), ledGreen = new THREE.MeshBasicMaterial({ color: 0x3cff6a });
const lockPlate = blk(0.024, 0.016, 0.003, brass, FR.w / 2 - 0.045, FR.y0 + FR.h * 0.62, FR.d + 0.0015, drawer); lockPlate.name = 'deskDrawerLock';
const lockLed = blk(0.006, 0.006, 0.003, ledRed, FR.w / 2 - 0.045, FR.y0 + FR.h * 0.62, FR.d + 0.004, drawer); lockLed.name = 'deskDrawerLockLed';
let ledLocked = true;
{
  const W = TRAY.w, S = TRAY.side;
  blk(W + 2 * S, TRAY.th, TRAY.d, inner, 0, TRAY.y0 + TRAY.th / 2, -TRAY.d / 2, drawer);                                   // bottom
  for (const sx of [-1, 1]) blk(S, TRAY.th + TRAY.h, TRAY.d, inner, sx * (W / 2 + S / 2), TRAY.y0 + (TRAY.th + TRAY.h) / 2, -TRAY.d / 2, drawer);   // sides
  blk(W, TRAY.h, S, inner, 0, FLOOR_Y + TRAY.h / 2, -TRAY.d + S / 2, drawer);                                               // back
}
// the dark hole in the pedestal you see above and around the tray when it's out (hidden inside the front when it's shut)
const cavity = new THREE.Mesh(new THREE.PlaneGeometry(FR.w - 0.016, FR.h - 0.016), phong({ color: 0x0c0806, shininess: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
cavity.position.set(DX, FR.y0 + FR.h / 2, PED.z1 + 0.0015); cavity.name = 'deskDrawerHole'; scene.add(cavity);
// pick volumes: the front (+ pull), the inside (only while you hold a floppy) and the desk top (only while you hold one)
const frontHit = blk(FR.w + 0.02, FR.h + 0.01, 0.042, invis, 0, FR.y0 + FR.h / 2, 0.019, drawer); frontHit.userData.kind = 'front';
const inHit = blk(TRAY.w, 0.16, PULL, invis, 0, FLOOR_Y + 0.08, -PULL / 2, drawer); inHit.userData.kind = 'in';
const deskHit = blk(D.x1 - D.x0, 0.012, D.z1 - D.z0, invis, (D.x0 + D.x1) / 2, top + 0.006, (D.z0 + D.z1) / 2, scene); deskHit.userData.kind = 'desk';
// you bump into it while it's open (the Roomba drives underneath)
const obst = { t: 'box', x0: PED.x0 + 0.015, x1: PED.x1 - 0.015, z0: PED.z1, z1: PED.z1 + FR.d, who: 'player', name: 'desk drawer' };
if (RV.obstacles) RV.obstacles.push(obst);
let openU = 0, openTarget = 0, openE = 0, toggles = 0;      // openU 0..1 linear, openE eased (what you see)

// ------------------------------------------------------------ the floppies
function labelTex(text, ink, stripe) {
  const c = document.createElement('canvas'); c.width = 192; c.height = 136; const x = c.getContext('2d');
  x.fillStyle = '#f2ead6'; x.fillRect(0, 0, 192, 136);
  x.fillStyle = stripe; x.fillRect(0, 0, 192, 14);
  x.strokeStyle = 'rgba(60,70,140,.28)'; x.lineWidth = 2; for (let y = 52; y < 136; y += 26) { x.beginPath(); x.moveTo(8, y); x.lineTo(184, y); x.stroke(); }
  x.fillStyle = ink; x.font = 'italic bold 30px "Comic Sans MS", "Comic Neue", cursive'; x.textBaseline = 'alphabetic';
  const words = text.split(' '), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > 172 && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line); lines.slice(0, 3).forEach((l, i) => x.fillText(l, 10, 48 + i * 30));
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
const shutterM = phong({ color: 0xb8bcc6, shininess: 90, specular: 0xffffff });
const DEFS = [
  { id: 'games', color: 0x1c1c22, label: 'GAMES 2', ink: '#c03030', stripe: '#c03030', desk: { x: -2.33, z: -1.62, ry: 0.25 }, start: 'desk' },
  { id: 'roomba', color: 0x1a2a4a, label: 'roomba.bas', ink: '#2a3c9a', stripe: '#c03030', desk: { x: -2.318, z: -1.63, ry: -0.1 }, start: 'desk' },
  { id: 'diary', color: 0xa8262e, label: 'DIARY keep out!!', ink: '#b0206a', stripe: '#ff7ad6', desk: { x: -2.2, z: -1.56, ry: 0.4 }, start: 0 },
  { id: 'zombie', color: 0xd9cfb0, label: 'zombie.exe', ink: '#2c7a3a', stripe: '#3ac24a', desk: { x: -2.4, z: -1.52, ry: -0.3 }, start: 4 },
];
const floppies = DEFS.map(def => {
  const g = new THREE.Group(); g.name = 'floppy:' + def.id;
  const body = new THREE.Mesh(box, phong({ color: def.color, shininess: 45, specular: 0x333333 })); body.scale.set(FW, T, FD); g.add(body);
  const sh = new THREE.Mesh(box, shutterM); sh.scale.set(0.052, T + 0.0006, 0.032); sh.position.set(-0.006, 0, -FD / 2 + 0.0158); g.add(sh);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.05), phong({ map: labelTex(def.label, def.ink, def.stripe), shininess: 15, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  lab.rotation.x = -Math.PI / 2; lab.position.set(0, T / 2 + 0.0003, 0.015); g.add(lab);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.115), invis); g.add(hit);
  const f = { id: def.id, def, g, hit, state: 'desk', slot: -1, by: null, via: null, anim: null, x: 0, y: 0, z: 0, ry: 0, back: 0 };
  hit.userData.kind = 'floppy'; hit.userData.f = f;
  scene.add(g); return f;
});

// ------------------------------------------------------------ sounds (from the drawer, Web Audio)
let noiseBuf = null;
function actx() { return R && R.audio && R.audio.ctx; }
function outAt(A, p) {
  const pan = A.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 0.7; pan.rolloffFactor = 1;
  if (pan.positionX) { pan.positionX.value = p.x; pan.positionY.value = p.y; pan.positionZ.value = p.z; } else pan.setPosition(p.x, p.y, p.z);
  pan.connect(A.destination); return pan;
}
function quiet(A, dur) { if (R && R.audio) R.audio.quietUntil = Math.max(R.audio.quietUntil || 0, A.currentTime + dur + 0.3); }   // the Roomba's ears ignore it
function noise(A) {
  if (noiseBuf) return noiseBuf; const n = A.sampleRate; noiseBuf = A.createBuffer(1, n, A.sampleRate); const d = noiseBuf.getChannelData(0);
  let b = 0; for (let i = 0; i < n; i++) { b = b * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = b; } return noiseBuf;
}
const SND_AT = new V3(DX, FR.y0 + FR.h / 2, PED.z1 + 0.1);
function slide(opening) {   // wood on wood: a short rumble, then a soft knock at the end of the travel
  const A = actx(); if (!A) return; try {
    const t = A.currentTime, o = outAt(A, SND_AT), s = A.createBufferSource(); s.buffer = noise(A); s.playbackRate.value = 0.7;
    const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(opening ? 380 : 520, t); f.frequency.linearRampToValueAtTime(opening ? 520 : 340, t + 0.35); f.Q.value = 1.4;
    const g = A.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.04); g.gain.setValueAtTime(0.32, t + 0.28); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    s.connect(f); f.connect(g); g.connect(o); s.start(t, Math.random() * 0.4, 0.45);
    knock(t + 0.37, opening ? 0.12 : 0.22, opening ? 140 : 95);
    quiet(A, 0.6);
  } catch (e) { }
}
function knock(when, vol, f0) {
  const A = actx(); if (!A) return; try {
    const o = outAt(A, SND_AT), osc = A.createOscillator(), g = A.createGain(); osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, when); osc.frequency.exponentialRampToValueAtTime(f0 * 0.55, when + 0.09);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
    osc.connect(g); g.connect(o); osc.start(when); osc.stop(when + 0.14);
  } catch (e) { }
}
function tap(p, vol) {      // a floppy landing: a small plastic clack
  const A = actx(); if (!A) return; try {
    const t = A.currentTime, o = outAt(A, p), s = A.createBufferSource(); s.buffer = noise(A);
    const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600 + Math.random() * 600; f.Q.value = 2;
    const g = A.createGain(); g.gain.setValueAtTime(vol || 0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    s.connect(f); f.connect(g); g.connect(o); s.start(t, Math.random() * 0.5, 0.06); quiet(A, 0.1);
  } catch (e) { }
}
function pickSnd() { const A = actx(); if (!A) return; tap(SND_AT, 0.12); }
function buzz(k, ms) { if (RV.haptic) try { RV.haptic(k, ms); } catch (e) { } }

// ------------------------------------------------------------ where floppies go
const flat = ry => new Q().setFromAxisAngle(new V3(0, 1, 0), ry);
function yawOf(q) { const v = new V3(0, 0, 1).applyQuaternion(q); v.y = 0; return v.lengthSq() > 1e-6 ? Math.atan2(v.x, v.z) : 0; }
function slotPos(i) { const s = SLOTS[i % SLOTS.length], layer = Math.floor(i / SLOTS.length); return new V3(s.x, FLOOR_Y + T / 2 + 0.0002 + layer * T, s.z); }
let blocked = null;                                          // slots something else lies on (the phone): i % SLOTS.length -> true
function slotTaken(i, except) { if (blocked && blocked(i % SLOTS.length)) return true; return floppies.some(o => o !== except && o.slot === i && (o.state === 'drawer' || (o.state === 'fly' && o.anim && o.anim.to === 'drawer'))); }
function freeSlot(f, prefer) {
  if (prefer != null && prefer >= 0 && !slotTaken(prefer, f)) return prefer;
  for (let i = 0; i < 24; i++) if (!slotTaken(i, f)) return i;
  return 0;
}
// a spot on the desk where a floppy can lie (not under the monitor, the keyboard, the card or the mug)
function deskFree(x, z) {
  if (x < D.x0 + 0.05 || x > D.x1 - 0.05 || z < D.z0 + 0.06 || z > D.z1 - 0.045) return false;
  if (x > MON.x - 0.2 && x < MON.x + 0.2 && z < MON.front + 0.06) return false;                                   // monitor + plinth
  if (Math.abs(x - KB.x) < KB.w / 2 + 0.055 && Math.abs(z - KB.z) < KB.d / 2 + 0.055) return false;                // keyboard computer
  if (Math.hypot(x - CR.x, z - CR.z) < 0.1) return false;                                                         // the keycard
  if (Math.hypot(x - (-1.49), z - (-1.90)) < 0.095) return false;                                                 // mug of pens
  return true;
}
// height on the desk: on top of any floppy already lying there
function deskY(f, x, z) {
  let base = top;
  const others = floppies.filter(o => o !== f && (o.state === 'desk' || (o.state === 'fly' && o.anim && o.anim.to === 'desk'))).sort((a, b) => a.y - b.y);
  for (const o of others) if (Math.hypot(o.x - x, o.z - z) < 0.085) base = Math.max(base, o.y + T / 2);
  return base + T / 2 + 0.0002;
}
function resettleDesk() {   // something was taken off a pile: the ones above it drop down
  const list = floppies.filter(o => o.state === 'desk').sort((a, b) => a.y - b.y);
  const done = [];
  for (const o of list) { let base = top; for (const p of done) if (Math.hypot(p.x - o.x, p.z - o.z) < 0.085) base = Math.max(base, p.y + T / 2); o.y = base + T / 2 + 0.0002; o.g.position.y = o.y; done.push(o); }
}
function inDrawerZone(p) {
  if (openE < 0.5) return false;
  const zf = PED.z1 + openE * PULL;
  return Math.abs(p.x - DX) < TRAY.w / 2 + 0.05 && p.z > PED.z1 - 0.03 && p.z < zf + 0.06 && p.y > FLOOR_Y - 0.06 && p.y < FLOOR_Y + 0.35;
}
function overDesk(p) { return p.x > D.x0 - 0.02 && p.x < D.x1 + 0.02 && p.z > D.z0 && p.z < D.z1 + 0.03 && p.y > top - 0.04 && p.y < top + 0.6; }

function fly(f, parent, to, p1, q1, dur, arc, done) {
  parent.attach(f.g);
  f.anim = { to, t: 0, dur, arc, p0: f.g.position.clone(), q0: f.g.quaternion.clone(), p1, q1, done };
  f.state = 'fly';
}
function toDrawer(f, prefer) {
  const i = freeSlot(f, prefer); f.slot = i; f.by = null; f.via = null;
  const p = slotPos(i), q = flat(SLOTS[i % SLOTS.length].ry);
  fly(f, drawer, 'drawer', p, q, 0.28, 0.05, () => { f.state = 'drawer'; tap(f.g.getWorldPosition(new V3()), 0.22); save(); });
  api.stored++;
  return true;
}
function nearFree(x, z) {     // the closest free spot within 15 cm (let go right on the keycard: it lies down next to it)
  for (let r = 0.03; r <= 0.151; r += 0.03) for (let a = 0; a < 12; a++) { const xx = x + Math.cos(a * Math.PI / 6) * r, zz = z + Math.sin(a * Math.PI / 6) * r; if (deskFree(xx, zz)) return [xx, zz]; }
  return null;
}
function toDesk(f, x, z, ry) {
  if (!deskFree(x, z)) { const n = nearFree(x, z); if (!n) return toHome(f); x = n[0]; z = n[1]; }
  f.slot = -1; f.by = null; f.via = null;
  const y = deskY(f, x, z); f.x = x; f.y = y; f.z = z; f.ry = ry;
  fly(f, scene, 'desk', new V3(x, y, z), flat(ry), 0.22, 0.04, () => { f.state = 'desk'; f.g.position.set(f.x, f.y, f.z); tap(f.g.position, 0.25); save(); });
  return true;
}
function toHome(f) { const h = f.def.desk; f.slot = -1; f.by = null; f.via = null; const y = deskY(f, h.x, h.z); f.x = h.x; f.y = y; f.z = h.z; f.ry = h.ry;
  const d = f.g.getWorldPosition(new V3()).distanceTo(new V3(h.x, y, h.z));
  fly(f, scene, 'desk', new V3(h.x, y, h.z), flat(h.ry), clamp(0.25 + d * 0.25, 0.25, 0.9), clamp(d * 0.25, 0.04, 0.4), () => { f.state = 'desk'; f.g.position.set(f.x, f.y, f.z); tap(f.g.position, 0.2); save(); });
  return true;
}
function toFloor(f, x, z) {
  f.slot = -1; f.by = null; f.via = null;
  if (Math.abs(x) > RX - 0.08 || Math.abs(z) > RZ - 0.08 || (RV.blocked && RV.blocked(x, z, 0.05, 'player'))) return toHome(f);   // over the bed, a shelf, a wall: back to the desk
  scene.attach(f.g); f.state = 'fall'; f.vy = 0; f.x = x; f.z = z; f.ry = yawOf(f.g.quaternion); f.anim = null; f.g.position.x = x; f.g.position.z = z;
  return true;
}

// ------------------------------------------------------------ holding
const Q_HAND = new Q().setFromAxisAngle(new V3(1, 0, 0), -0.25);   // flat in your hand, tipped up a little so you see the label
const Q_SCREEN = new Q().setFromAxisAngle(new V3(1, 0, 0), 1.15);  // on a screen: held up in front of you, label towards you
const _p = new V3(), _q = new Q(), _s = new V3(), _m = new THREE.Matrix4();
function heldBy(by) { return floppies.find(f => f.state === 'held' && f.by === by) || null; }
function holdPose(by, outP, outQ) {
  if (by === 'desk') {
    camera.updateMatrixWorld(); camera.matrixWorld.decompose(_p, _q, _s);
    outP.set(0.13, -0.12, -0.34).applyQuaternion(_q).add(_p); outQ.copy(_q).multiply(Q_SCREEN);
  } else {
    by.updateMatrixWorld(); by.matrixWorld.decompose(_p, _q, _s);
    outP.set(0, -0.012, -0.075).applyQuaternion(_q).add(_p); outQ.copy(_q).multiply(Q_HAND);
  }
}
function grab(f, by, via) {
  const prev = heldBy(by); if (prev && prev !== f) toHome(prev);
  const wasDesk = f.state === 'desk';
  scene.attach(f.g);
  f.state = 'held'; f.by = by; f.via = via || 'select'; f.slot = -1; f.anim = { grab: true, t: 0, dur: 0.16, p0: f.g.position.clone(), q0: f.g.quaternion.clone() };
  if (wasDesk) resettleDesk();
  pickSnd(); buzz(0.3, 30); api.grabs++;
  return true;
}
// let go. VR: where your hand is decides (the ray only helps when it points into the open drawer close by).
// Screen: what you clicked decides.
function release(by, h) {
  const f = heldBy(by); if (!f) return false;
  const p = f.g.getWorldPosition(new V3()), ry = yawOf(f.g.quaternion);
  if (by !== 'desk') {
    if (inDrawerZone(p)) return toDrawer(f);
    if (overDesk(p)) return toDesk(f, p.x, p.z, ry);
    if (h && (h.kind === 'in' || h.kind === 'front' || (h.kind === 'floppy' && h.f.state === 'drawer')) && openE > 0.5 && h.t < 1.2) return toDrawer(f);
    return toFloor(f, p.x, p.z);
  }
  if (!h) return toHome(f);
  if ((h.kind === 'in' || h.kind === 'front' || (h.kind === 'floppy' && h.f.state === 'drawer')) && openE > 0.5) return toDrawer(f);
  if (h.kind === 'desk' || (h.kind === 'floppy' && h.f.state === 'desk')) return toDesk(f, h.point.x, h.point.z, ry);
  if (h.kind === 'floor') return toFloor(f, h.point.x, h.point.z);
  return toHome(f);
}

// ------------------------------------------------------------ the drawer itself
// the lock: the keycard has to be in the CHARLIE 64
function locked() { const dk = RV.desk; return !!(dk && dk.cardIn && !dk.cardIn()); }
let jig = 0, rattles = 0;
function rattle() {
  jig = 0.32; rattles++; buzz(0.45, 60);
  const A = actx(); if (A) try {
    const t = A.currentTime;
    knock(t, 0.16, 120); knock(t + 0.085, 0.13, 105); knock(t + 0.17, 0.1, 115);
    const o = outAt(A, SND_AT), s = A.createBufferSource(); s.buffer = noise(A);           // the latch: a short metal tick
    const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 6;
    const g = A.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(o); s.start(t, 0.1, 0.07);
    quiet(A, 0.4);
  } catch (e) { }
  try { if (RV.desk && RV.desk.askForCard) RV.desk.askForCard(); } catch (e) { }
}
function setOpen(want) {
  want = want ? 1 : 0; if (want === openTarget) return true;
  if (want && locked()) { rattle(); return true; }
  openTarget = want; toggles++; slide(!!want); buzz(0.25, 40); return true;
}
function toggle() { return setOpen(!openTarget); }

// ------------------------------------------------------------ picking
const ray = new THREE.Raycaster(); ray.far = 8;
function pickable(f) { return f.state === 'desk' || f.state === 'floor' || (f.state === 'drawer' && openE > 0.85); }
function pick(o, d, holding) {
  ray.set(o, d);
  const list = [frontHit]; if (holding) { if (openE > 0.5) list.push(inHit); list.push(deskHit); }
  for (const f of floppies) if (pickable(f)) list.push(f.hit);
  scene.updateMatrixWorld();
  const hs = ray.intersectObjects(list, false); if (!hs.length) return null;
  let h = hs[0];
  if (!holding && h.object.userData.kind === 'front' && RV.phone && RV.phone.inDrawerT) {   // the phone lying in the open drawer, just behind the front edge: you mean the phone
    const pt = RV.phone.inDrawerT(o, d);
    if (pt != null && pt - h.distance < 0.3 && !hs.some(x => x.object.userData.kind === 'floppy' && x.distance < pt)) return null;
  }
  if (h.object.userData.kind === 'front' && openE > 0.85) {   // looking down into the open drawer over its front: you mean the floppy in it
    const fh = hs.find(x => x.object.userData.kind === 'floppy' && x.distance - h.distance < 0.3);
    if (fh) h = fh;
  }
  return { t: h.distance, point: h.point, kind: h.object.userData.kind, f: h.object.userData.f || null };
}
const orig = { click: Md.click, selectStart: Md.selectStart, selectEnd: Md.selectEnd, hoverT: Md.hoverT, tick: Md.tick };
function mine(o, d, holding) { const p = pick(o, d, holding); if (!p) return null; const m = orig.hoverT(o, d); return m == null || p.t < m ? p : null; }
function floorOf(o, d) { if (d.y < -0.02) { const t = -o.y / d.y; if (t < 7) return { kind: 'floor', t, point: new V3(o.x + d.x * t, 0, o.z + d.z * t) }; } return null; }

// screen: one click picks a floppy up, the next one puts it somewhere
function kbLetGo() {          // a click on the drawer is a click away from the CHARLIE 64 keyboard: it stops typing (same as Esc)
  try { const k = RV.desk._debug && RV.desk._debug(); if (k && k.focus) dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (e) { }
}
Md.click = function (o, d) { return click2(o, d); };
function click2(o, d) {
  const held = heldBy('desk');
  if (!held && RV.phone && RV.phone.heldBy && RV.phone.heldBy('desk')) return orig.click(o, d);   // the phone in your hand decides where it goes
  if (held) {
    const p = mine(o, d, true);
    if (p && p.kind === 'front' && openTarget === 0) return toggle();          // the shut drawer: open it, keep holding
    if (p) return release('desk', p);
    const fl = floorOf(o, d), m = orig.hoverT(o, d);
    if (fl && (m == null || fl.t < m)) return release('desk', fl);
    toHome(held); return orig.click(o, d);                                       // clicked something else: the floppy goes back to the desk
  }
  const p = mine(o, d, false);
  if (p) { kbLetGo(); if (p.kind === 'front') return toggle(); if (p.kind === 'floppy') return grab(p.f, 'desk', 'click'); }
  return orig.click(o, d);
}
// VR trigger: on the drawer = open/shut, on a floppy = hold it while the trigger is down
Md.selectStart = function (c, o, d) {
  if (heldBy(c)) return true;
  if (RV.phone && RV.phone.heldBy && RV.phone.heldBy(c)) return orig.selectStart(c, o, d);       // trigger on the hand holding the phone: the phone's
  const p = mine(o, d, false);
  if (p && p.t < 6) { if (p.kind === 'front') return toggle(); if (p.kind === 'floppy') return grab(p.f, c, 'select'); }
  return orig.selectStart(c, o, d);
};
Md.selectEnd = function (c, o, d) {
  const f = heldBy(c);
  if (f && f.via === 'select') return release(c, pick(o, d, true));
  if (f) return true;
  return orig.selectEnd(c, o, d);
};
Md.hoverT = function (o, d) { const a = orig.hoverT(o, d), b = pick(o, d, false); return b && (a == null || b.t < a) ? b.t : a; };

// VR grip: squeeze pointing at a floppy, or with your hand next to it, to hold it; squeeze at the drawer's pull to open/shut it
const NEAR = 0.11;
function nearestTo(c) {
  c.updateWorldMatrix(true, false); const hp = c.getWorldPosition(new V3()); let best = null, bd = NEAR;
  for (const f of floppies) if (pickable(f)) { const dd = f.g.getWorldPosition(new V3()).distanceTo(hp); if (dd < bd) { bd = dd; best = f; } }
  const pd = pull.getWorldPosition(new V3()).distanceTo(hp);
  if (pd < 0.09 && (!best || pd < bd)) return 'pull';
  return best;
}
function squeezeStart(c) {
  if (heldBy(c)) return false;
  if (RV.phone && RV.phone.heldBy && RV.phone.heldBy(c)) return false;     // that hand just took the phone (phone.js listens first)
  const n = nearestTo(c);
  if (n === 'pull') return toggle();
  if (n) return grab(n, c, 'squeeze');
  c.getWorldPosition(_p); c.getWorldQuaternion(_q); const d = new V3(0, 0, -1).applyQuaternion(_q);
  const p = mine(_p.clone(), d, false);
  if (p && p.t < 6) { if (p.kind === 'floppy') return grab(p.f, c, 'squeeze'); if (p.kind === 'front') return toggle(); }
  return false;
}
function squeezeEnd(c) {
  const f = heldBy(c); if (!f || f.via !== 'squeeze') return false;
  c.getWorldPosition(_p); c.getWorldQuaternion(_q); const d = new V3(0, 0, -1).applyQuaternion(_q);
  return release(c, pick(_p.clone(), d, true));
}
// the VR session ended with one in your hand: it goes back to the desk
if (renderer && renderer.xr) renderer.xr.addEventListener('sessionend', () => { for (const f of floppies) if (f.state === 'held' && f.by !== 'desk') toHome(f); });
if (renderer && renderer.xr) for (const i of [0, 1]) {
  const c = renderer.xr.getController(i);
  c.addEventListener('squeezestart', () => { try { squeezeStart(c); } catch (e) { console.warn('drawer grip', e); } });
  c.addEventListener('squeezeend', () => { try { squeezeEnd(c); } catch (e) { console.warn('drawer grip', e); } });
}

// ------------------------------------------------------------ frame
const _hp = new V3(), _hq = new Q();
Md.tick = function (dt, Tm) {
  orig.tick(dt, Tm);
  dt = Math.min(dt || 0.016, 0.1);
  // the drawer slides (0.4 s), and you bump into it while it's out
  if (openU !== openTarget) { openU = openTarget ? Math.min(1, openU + dt / 0.4) : Math.max(0, openU - dt / 0.4); }
  openE = ease(openU); drawer.position.z = PED.z1 + openE * PULL; obst.z1 = PED.z1 + FR.d + openE * PULL;
  if (jig > 0) { jig = Math.max(0, jig - dt); drawer.position.z += Math.sin(jig * 60) * 0.003 * (jig / 0.32); drawer.position.x = DX + Math.sin(jig * 47) * 0.0012 * (jig / 0.32); }
  else if (drawer.position.x !== DX) drawer.position.x = DX;
  const lk = locked(); if (lk !== ledLocked) { ledLocked = lk; lockLed.material = lk ? ledRed : ledGreen; }
  const now = performance.now() / 1000;
  for (const f of floppies) {
    const g = f.g;
    if (f.state === 'held') {
      holdPose(f.by, _hp, _hq);
      if (f.anim && f.anim.grab) { const a = f.anim; a.t += dt; const k = ease(clamp(a.t / a.dur, 0, 1)); g.position.lerpVectors(a.p0, _hp, k); g.quaternion.slerpQuaternions(a.q0, _hq, k); if (k >= 1) f.anim = null; }
      else { g.position.copy(_hp); g.quaternion.copy(_hq); }
      continue;
    }
    if (f.state === 'fly' && f.anim) {
      const a = f.anim; a.t += dt; const k = ease(clamp(a.t / a.dur, 0, 1));
      g.position.lerpVectors(a.p0, a.p1, k); g.position.y += Math.sin(k * Math.PI) * a.arc; g.quaternion.slerpQuaternions(a.q0, a.q1, k);
      if (k >= 1) { g.position.copy(a.p1); g.quaternion.copy(a.q1); f.anim = null; a.done && a.done(); }
      continue;
    }
    if (f.state === 'fall') {
      f.vy -= 9.8 * dt; g.position.y += f.vy * dt; g.quaternion.slerp(flat(f.ry), clamp(dt * 10, 0, 1));
      if (g.position.y <= T / 2 + 0.001) { g.position.set(f.x, T / 2 + 0.001, f.z); g.quaternion.copy(flat(f.ry)); f.y = g.position.y; f.state = 'floor'; f.back = now + 60; tap(g.position, 0.3); }
      continue;
    }
    if (f.state === 'floor' && now > f.back) toHome(f);                       // tidy: it hops back onto the desk after a minute
  }
};

// ------------------------------------------------------------ start positions, remembered on this device
const KEY = 'rv.floppies.v1';
function save() {
  try {
    const s = {}; for (const f of floppies) {
      if (f.state === 'drawer') s[f.id] = { s: 'drawer', slot: f.slot };
      else if (f.state === 'desk') s[f.id] = { s: 'desk', x: +f.x.toFixed(4), z: +f.z.toFixed(4), ry: +f.ry.toFixed(3) };
    }
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) { }
}
function placeNow(f, where) {
  f.anim = null; f.by = null; f.via = null;
  if (where && where.s === 'drawer') { const i = freeSlot(f, where.slot); f.slot = i; drawer.add(f.g); f.g.position.copy(slotPos(i)); f.g.quaternion.copy(flat(SLOTS[i % SLOTS.length].ry)); f.state = 'drawer'; return; }
  const w = where && where.s === 'desk' && deskFree(where.x, where.z) ? where : f.def.desk;
  scene.add(f.g); f.slot = -1; f.state = 'fly';                               // (not on the desk yet: deskY stacks it on the ones before)
  f.x = w.x; f.z = w.z; f.ry = w.ry || 0; f.y = deskY(f, f.x, f.z); f.g.position.set(f.x, f.y, f.z); f.g.quaternion.copy(flat(f.ry)); f.state = 'desk';
}
function loadAll(saved) {
  for (const f of floppies) { f.state = 'none'; f.slot = -1; f.y = 0; }
  for (const f of floppies) { const s = saved && saved[f.id]; placeNow(f, s || (f.def.start === 'desk' ? null : { s: 'drawer', slot: f.def.start })); }
}
let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
loadAll(saved);
function reset() { try { localStorage.removeItem(KEY); } catch (e) { } openTarget = 0; openU = 0; loadAll(null); }

const api = RV.drawers = {
  drawer, front, pull, cavity, frontHit, inHit, deskHit, floppies, obst, PED, FR, PULL, TRAY, FLOOR_Y, SLOTS,
  open: () => setOpen(true), close: () => setOpen(false), toggle, isOpen: () => openTarget === 1, amount: () => openE,
  pick, grab, release, heldBy, toDrawer, toDesk, toHome, squeezeStart, squeezeEnd, reset, deskFree,
  grabs: 0, stored: 0, toggles: () => toggles,
  locked, rattles: () => rattles, lockLed, inDrawerZone, overDesk,
  setBlocked: fn => { blocked = fn || null; for (const f of floppies) if (f.state === 'drawer' && slotTaken(f.slot, f)) toDrawer(f); },
  _debug: () => ({ open: +openE.toFixed(3), target: openTarget, locked: locked(), rattles, led: ledLocked ? 'red' : 'green', floppies: floppies.map(f => { const p = f.g.getWorldPosition(new V3()); return { id: f.id, state: f.state, slot: f.slot, parent: f.g.parent && f.g.parent.name, x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4) }; }) }),
};
if (RV.phone && RV.phone._attach) try { RV.phone._attach(api); } catch (e) { console.warn('phone in the drawer', e); }
})();
