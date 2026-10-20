// The letter from the future: Unity's 'Letter from the future' (her picture of the letter, straightened, on a sheet of
// paper about 10 x 13 cm) in the top desk drawer under the CHARLIE 64, next to the phone and the floppies. The drawer
// only opens while the keycard is in the computer (drawers.js).
// Unity: 'place this letter in the drawer to. And when i pick it up your hear my voice reading the letter out loud'.
//
// - Picking it up: VR = squeeze the grip with your hand next to it or pointing at it, or point at it and hold the trigger.
//   Screen = click it: it's held up in front of you. In your hand it's a bit bigger (like holding it closer) so you can
//   read it.
// - Unity reading it ('future me', 2:29, assets/audio/unity_letter_from_the_future.mp3) plays as you pick it up, from the
//   letter itself (it follows the letter around). Picking it up again while it plays stops it; picking it up once it's
//   quiet plays it again from the start. While you hold it: VR = pull the trigger on that hand, screen = click the letter
//   in your hand, to stop / replay without letting go. The paper glows softly while she reads.
// - Starting it pauses an episode on the TV, lifts the record needle, stops the keycard poster video, pauses the origin
//   frame, the voice note screen and the phone's message; any of those starting afterwards stops the letter.
// - Putting it down: VR = let go. Over the open drawer it goes back in its spot; anywhere else it floats down onto
//   whatever is under it (desk, bed, floor...), as long as you can still get at it there; somewhere you couldn't (deep
//   under the desk, outside the room) or if it never lands, it goes back in its drawer. Screen = with it in your hand,
//   click the open drawer (back in), the desk or the floor; clicking the shut drawer tries to open it; clicking anything
//   else puts it back in the drawer.
// - Not remembered: every visit it starts in the locked drawer again.
// Loaded after phone.js and before drawers.js: drawers.js hands it the drawer (RV.letter._attach); it lies over the
// left-hand column (floppy slots 0 + 3), the phone over the right-hand one.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE;
if (!RV || !RV.scene || !RV.media) return;
const scene = RV.scene, camera = RV.camera, renderer = RV.renderer, Md = RV.media;
const V3 = THREE.Vector3, Q = THREE.Quaternion;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = k => k * k * (3 - 2 * k);

// ------------------------------------------------------------ the prop
const LW = 0.100, LH = LW * 1300 / 1000, TH = 0.0008;     // 10 x 13 cm sheet (the straightened picture is 1000 x 1300 px)
const HELD_S = 1.35;                                       // in your hand: a bit bigger, as if you hold it close to read
const g = new THREE.Group(); g.name = 'futureLetter';     // lying frame: writing up (+y), top of the letter towards -z
const body = new THREE.Group(); body.rotation.x = -Math.PI / 2; g.add(body);   // body frame: writing +z, top +y
const tex = new THREE.TextureLoader().load('assets/img/letter_from_the_future.jpg', () => { api.ready = true; }, undefined, e => console.warn('letter jpg', e && e.type));
tex.encoding = THREE.sRGBEncoding; tex.anisotropy = (renderer && renderer.capabilities.getMaxAnisotropy()) || 4;
const EMI_REST = 0x3a3a3a, EMI_LIVE = 0x6e675a;
const paperM = new THREE.MeshLambertMaterial({ color: 0xcbb596 });                        // the back and the edges: old paper
const frontM = new THREE.MeshPhongMaterial({ map: tex, emissiveMap: tex, emissive: EMI_REST, shininess: 6, specular: 0x111111 });
// box faces: +x, -x, +y, -y, +z (the letter), -z (the back)
const sheet = new THREE.Mesh(new THREE.BoxGeometry(LW, LH, TH), [paperM, paperM, paperM, paperM, frontM, paperM]); sheet.name = 'future letter sheet'; body.add(sheet);
// a generous invisible box to point at
const hit = new THREE.Mesh(new THREE.BoxGeometry(LW + 0.026, 0.035, LH + 0.026), new THREE.MeshBasicMaterial({ visible: false })); hit.name = 'future letter hit'; g.add(hit);
scene.add(g);

// ------------------------------------------------------------ where it lives: the drawer (left-hand column, over slots 0 + 3)
let D = null;                                              // RV.drawers, handed over by drawers.js
const HOME = { x: -0.1, z: -0.097, ry: -0.02 };
const BLOCK = i => (i === 0 || i === 3) && inDrawerish();
let state = 'none', by = null, via = null, anim = null, vy = 0, landY = 0, ry = 0, grabs = 0, homeRuns = 0, fallT = 0, sway = 0;
const flat = r => new Q().setFromAxisAngle(new V3(0, 1, 0), r);
function yawOf(q) { const v = new V3(0, 0, -1).applyQuaternion(q); v.y = 0; return v.lengthSq() > 1e-6 ? Math.atan2(-v.x, -v.z) : 0; }
function homePos() { return new V3(HOME.x, (D ? D.FLOOR_Y : 0.5) + TH / 2 + 0.0004, HOME.z); }
function inDrawerish() { return state === 'drawer' || (state === 'fly' && anim && anim.to === 'drawer'); }
function block() { if (D) D.setBlocked(BLOCK, 'letter'); }
function placeHome() {
  anim = null; by = null; via = null; g.scale.setScalar(1);
  if (!D) { scene.add(g); g.position.set(-2.3, 0.76, -1.6); g.quaternion.copy(flat(0.2)); state = 'rest'; return; }
  D.drawer.add(g); g.position.copy(homePos()); g.quaternion.copy(flat(HOME.ry)); state = 'drawer'; block();
}
function fly(parent, to, p1, q1, dur, arc, done) {
  parent.attach(g); anim = { to, t: 0, dur, arc, p0: g.position.clone(), q0: g.quaternion.clone(), p1, q1, done, s0: g.scale.x }; state = 'fly';
}
function toDrawer() {
  if (!D) { placeHome(); return true; }
  by = null; via = null; homeRuns++;
  const d = g.getWorldPosition(new V3()).distanceTo(D.drawer.localToWorld(homePos()));
  fly(D.drawer, 'drawer', homePos(), flat(HOME.ry), clamp(0.25 + d * 0.3, 0.25, 0.9), clamp(d * 0.2, 0.03, 0.3), () => { state = 'drawer'; rustle(g.getWorldPosition(new V3()), 0.18); });
  block();                                                 // any floppy lying where the letter goes moves over
  return true;
}
// float down onto whatever is under (x, z), from about height y (the zombie's surface finder)
function dropAt(x, y, z, r) {
  by = null; via = null; anim = null; g.scale.setScalar(1);
  let L = { x, y: 0, z };
  if (RV.zombie && RV.zombie.landAt) { const v = g.visible; g.visible = false; try { L = RV.zombie.landAt(x, y, z); } catch (e) { } g.visible = v; }
  if (D && D.amount() > 0.3 && Math.abs(L.y - D.FLOOR_Y) < 0.025) {   // landed on the bottom of the open drawer: it's in the drawer
    const lp = D.drawer.worldToLocal(new V3(L.x, L.y, L.z)); if (Math.abs(lp.x) < D.TRAY.w / 2 + 0.02 && lp.z < 0.02 && lp.z > -D.TRAY.d) return toDrawer();
  }
  if (!reachable(L.x, L.y, L.z)) return toDrawer();       // somewhere you couldn't see or point at it (deep under the desk...): back in its drawer
  scene.attach(g); ry = r; landY = L.y + TH / 2 + 0.0006; g.position.x = L.x; g.position.z = L.z; if (g.position.y < landY) g.position.y = landY + 0.002;
  vy = 0; state = 'fall'; fallT = 0; sway = Math.random() * 6; block(); return true;
}
// Can you get at it where it lands? Yes if there's a clear line from just above that spot to where your hand or eyes could
// be, standing somewhere free in the room (a grid of spots, at hand and eye height), and pointing from there picks the
// letter, not a seat or a button around it. Inside the walls only. (Same check as the phone.)
const RM = RV.room || { RX: 2.6, RZ: 2.2, RH: 2.6 }, seeRay = new THREE.Raycaster();
let lastReach = null;
function solids() {
  const skip = new Set(); g.traverse(o => skip.add(o)); if (RV.rig) RV.rig.traverse(o => skip.add(o));
  const out = [];
  scene.traverse(o => {
    if (!o.isMesh || skip.has(o)) return;
    for (let q = o; q; q = q.parent) if (!q.visible) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (!m || m.visible === false || (m.transparent && (m.opacity < 0.5 || m.depthWrite === false))) return;
    out.push(o);
  });
  return out;
}
function pointable(o, d) {
  const t = rayT(o, d); if (t == null) return false;
  let all = null, zt = null; try { all = Md.hoverT(o, d); } catch (e) { } try { zt = RV.zombie ? RV.zombie.hoverT(o, d) : null; } catch (e) { }
  return (all == null || all >= t - 1e-6) && (zt == null || zt >= t - 1e-6);
}
function reachable(x, y, z) {
  if (!(Math.abs(x) < RM.RX - 0.03 && Math.abs(z) < RM.RZ - 0.03 && y > -0.05 && y < RM.RH - 0.1)) { lastReach = { why: 'outside', x, y, z }; return false; }
  const ms = solids(), sides = new Map();
  for (const m of ms) for (const mt of (Array.isArray(m.material) ? m.material : [m.material])) { if (!sides.has(mt)) sides.set(mt, mt.side); mt.side = THREE.DoubleSide; }
  const p = new V3(x, y + 0.03, z), e = new V3(), dir = new V3(); let seen = 0, tried = 0;
  const was = { parent: g.parent, pos: g.position.clone(), q: g.quaternion.clone(), s: g.scale.x, state };
  scene.attach(g); g.scale.setScalar(1); g.position.set(x, y + TH / 2 + 0.0006, z); g.quaternion.copy(flat(0)); state = 'rest'; g.updateMatrixWorld(true);
  try {
    for (let ex = -RM.RX + 0.35; ex < RM.RX - 0.3 && !seen; ex += 0.3) for (let ez = -RM.RZ + 0.35; ez < RM.RZ - 0.3 && !seen; ez += 0.3) {
      if (RV.blocked && RV.blocked(ex, ez, 0.18, 'player')) continue;
      for (const ey of [1.0, 1.5]) {
        e.set(ex, ey, ez); dir.subVectors(e, p); const len = dir.length(); if (len > 4.5 || len < 0.05) continue; dir.divideScalar(len); tried++;
        seeRay.set(p, dir); seeRay.far = len; seeRay.near = 0.005;
        if (seeRay.intersectObjects(ms, false).length) continue;
        if (pointable(e, dir.clone().negate())) { seen++; break; }
      }
    }
  } finally {
    for (const [mt, sd] of sides) mt.side = sd;
    state = was.state; (was.parent || scene).add(g); g.position.copy(was.pos); g.quaternion.copy(was.q); g.scale.setScalar(was.s); g.updateMatrixWorld(true);
  }
  lastReach = { why: seen ? 'ok' : 'hidden', tried, x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3) };
  return seen > 0;
}

// ------------------------------------------------------------ holding
const Q_HAND = new Q().setFromAxisAngle(new V3(1, 0, 0), 1.2);     // VR: upright above your hand, writing towards you, tipped back a bit
const Q_SCREEN = new Q().setFromAxisAngle(new V3(1, 0, 0), 1.5);  // screen: held up in front of you to read, a little right of centre
const _p = new V3(), _q = new Q(), _s = new V3();
function holdPose(h, outP, outQ) {
  if (h === 'desk') { camera.updateMatrixWorld(); camera.matrixWorld.decompose(_p, _q, _s); outP.set(0.06, -0.02, -0.23).applyQuaternion(_q).add(_p); outQ.copy(_q).multiply(Q_SCREEN); }
  else { h.updateMatrixWorld(); h.matrixWorld.decompose(_p, _q, _s); outP.set(0, 0.085, -0.08).applyQuaternion(_q).add(_p); outQ.copy(_q).multiply(Q_HAND); }
}
function heldBy(h) { return state === 'held' && by === h; }
function grab(h, how) {
  const handOver = state === 'held' && by && by !== h;
  scene.attach(g); state = 'held'; by = h; via = how || 'select'; anim = { grab: true, t: 0, dur: 0.18, p0: g.position.clone(), q0: g.quaternion.clone(), s0: g.scale.x };
  block();
  grabs++; buzz(0.25, 30); rustle(g.getWorldPosition(new V3()), 0.16);
  if (!handOver) toggle('grab');                           // picking it up reads it out (or stops it if she's already reading)
  return true;
}
function releaseVR(c) {
  if (!heldBy(c)) return false;
  const p = g.getWorldPosition(new V3()), r = yawOf(g.quaternion);
  if (D && D.inDrawerZone(p)) return toDrawer();
  return dropAt(p.x, p.y, p.z, r);
}

// ------------------------------------------------------------ sound: Unity reading it, from the letter; paper rustles
function actx() { return RV.roomba && RV.roomba.audio && RV.roomba.audio.ctx; }
const audio = new Audio(); audio.src = 'assets/audio/unity_letter_from_the_future.mp3'; audio.preload = 'none'; audio.crossOrigin = 'anonymous'; audio.loop = false;
let src = null, pan = null, live = false, starting = false, startedAt = 0, plays = 0, stops = 0, lastStop = null;
function wire() {
  const A = actx(); if (!A || src) return;
  try {
    src = A.createMediaElementSource(audio);
    const gn = A.createGain(); gn.gain.value = 1.3;
    pan = A.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 0.8; pan.rolloffFactor = 0.7; pan.maxDistance = 15;
    src.connect(gn); gn.connect(pan); pan.connect(A.destination);
  } catch (e) { console.warn('letter audio routing', e); src = null; pan = null; }
}
const _w = new V3();
function placePan() { if (!pan) return; g.getWorldPosition(_w); if (pan.positionX) { pan.positionX.value = _w.x; pan.positionY.value = _w.y; pan.positionZ.value = _w.z; } else pan.setPosition(_w.x, _w.y, _w.z); }
function phonePlaying() { try { return !!(RV.phone && RV.phone.playing && RV.phone.playing()); } catch (e) { return false; } }
function quietOthers() {
  const d = Md._debug;
  if (d) {
    try { if (d.playing && d.playing.ep && d.video && !d.video.paused) d.video.pause(); } catch (e) { }
    try { if (d.rp && d.rp.on && d.stopRecord) d.stopRecord('letter'); } catch (e) { }
  }
  try { const v = RV.vposter && RV.vposter._debug; if (v) { const s = v.state(); if (s.live || s.starting) v.stop('letter'); } } catch (e) { }
  try { const o = RV.originFrame && RV.originFrame._debug; if (o) { const s = o.state(); if (s.live || s.starting) o.pause('letter'); } } catch (e) { }
  try { const n = RV.voiceNote && RV.voiceNote._debug; if (n) { const s = n.state(); if (s.live || s.starting) n.pause('letter'); } } catch (e) { }
  try { if (phonePlaying()) RV.phone.stop('letter'); } catch (e) { }
}
function othersPlaying() {
  const d = Md._debug, v = RV.vposter && RV.vposter._debug && RV.vposter._debug.state(), o = RV.originFrame && RV.originFrame._debug && RV.originFrame._debug.state(),
    n = RV.voiceNote && RV.voiceNote._debug && RV.voiceNote._debug.state();
  return !!((d && ((d.playing && d.playing.ep && d.video && !d.video.paused) || (d.rp && d.rp.on))) || (v && (v.live || v.starting)) || (o && (o.live || o.starting)) || (n && (n.live || n.starting)) || phonePlaying());
}
function play() {
  if (RV.ensureAudio) try { RV.ensureAudio(); } catch (e) { }
  wire(); const A = actx(); if (A && A.state === 'suspended') A.resume();
  quietOthers(); placePan();
  starting = true; live = false; startedAt = performance.now() / 1000; plays++;
  if (audio.preload !== 'auto') audio.preload = 'auto';
  try { audio.currentTime = 0; } catch (e) { }
  const pr = audio.play(); if (pr && pr.catch) pr.catch(err => { console.warn('letter play', err && err.name); starting = false; live = false; });
  return true;
}
function stop(why) {
  if (!live && !starting && audio.paused) return false;
  starting = false; live = false; stops++; lastStop = why || 'user'; frontM.emissive.setHex(EMI_REST);
  if (!audio.paused) audio.pause();
  try { audio.currentTime = 0; } catch (e) { }
  return true;
}
function toggle(why) { if (live || starting) { stop(why || 'user'); return true; } return play(); }
audio.addEventListener('playing', () => { if (!starting && !live) { audio.pause(); return; } starting = false; live = true; });
audio.addEventListener('ended', () => { live = false; starting = false; lastStop = 'ended'; });
audio.addEventListener('error', () => { console.warn('letter audio error', audio.error && audio.error.code); live = false; starting = false; lastStop = 'error'; });

let noiseBuf = null;
function rustle(p, vol) {                                  // paper: a short soft rustle
  const A = actx(); if (!A) return; try {
    if (!noiseBuf) { const n = A.sampleRate >> 2; noiseBuf = A.createBuffer(1, n, A.sampleRate); const dd = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) dd[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(i / 300) ** 2); }
    const t = A.currentTime, pn = A.createPanner(); pn.panningModel = 'HRTF'; pn.refDistance = 0.7;
    if (pn.positionX) { pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; } else pn.setPosition(p.x, p.y, p.z);
    const s = A.createBufferSource(); s.buffer = noiseBuf; const f = A.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2400 + Math.random() * 800;
    const gn = A.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.03); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    s.connect(f); f.connect(gn); gn.connect(pn); pn.connect(A.destination); s.start(t, Math.random() * 0.03, 0.22);
    const R = RV.roomba; if (R && R.audio) R.audio.quietUntil = Math.max(R.audio.quietUntil || 0, A.currentTime + 0.4);
  } catch (e) { }
}
function buzz(k, ms) { if (RV.haptic) try { RV.haptic(k, ms); } catch (e) { } }

// ------------------------------------------------------------ picking
const ray = new THREE.Raycaster(); ray.far = 8;
function pickable() { return state === 'rest' || (state === 'drawer' && D && D.amount() > 0.85); }
function rayT(o, d) { ray.set(o, d); g.updateMatrixWorld(true); const h = ray.intersectObject(hit, false)[0]; return h ? h.distance : null; }
function pickT(o, d) { return pickable() || heldBy('desk') ? rayT(o, d) : null; }   // held up on the screen it stays in front of whatever is behind it (the keyboard...)
function inDrawerT(o, d) { return state === 'drawer' && D && D.amount() > 0.85 ? rayT(o, d) : null; }
const orig = { click: Md.click, selectStart: Md.selectStart, selectEnd: Md.selectEnd, hoverT: Md.hoverT, tick: Md.tick, playing: Md.playing };
function mine(o, d) { const t = pickT(o, d); if (t == null) return null; const m = orig.hoverT(o, d); return m == null || t < m ? t : null; }
function phoneHeld(h) { return !!(RV.phone && RV.phone.heldBy && RV.phone.heldBy(h)); }

// screen: click picks it up (and reads it out); with it in your hand, click it again to stop / replay, or click where it goes
function placeByClick(o, d) {
  const r = yawOf(g.quaternion);
  const p = D ? D.pick(o, d, true) : null;
  const intoDrawer = p && (p.kind === 'in' || p.kind === 'front' || (p.kind === 'floppy' && p.f.state === 'drawer'));
  if (intoDrawer && D.amount() > 0.5) return toDrawer();
  if (p && p.kind === 'front') { D.open(); return true; }                 // the shut drawer: try to open it (rattles while it's locked), keep holding
  const m = orig.hoverT(o, d);
  if (p && (p.kind === 'desk' || p.kind === 'floppy') && (m == null || p.t < m)) return dropAt(p.point.x, p.point.y + 0.03, p.point.z, r);
  if (d.y < -0.02) { const t = -o.y / d.y; if (t < 7 && (m == null || t < m)) return dropAt(o.x + d.x * t, 0.03, o.z + d.z * t, r); }
  return toDrawer();                                                         // anything else: back in its drawer
}
Md.click = function (o, d) {
  if (heldBy('desk')) { if (rayT(o, d) != null) return toggle('user'); return placeByClick(o, d); }
  if (phoneHeld('desk')) return orig.click(o, d);                           // the phone in your hand decides where it goes
  if (mine(o, d) != null) return grab('desk', 'click');
  return orig.click(o, d);
};
// VR trigger: point at it and hold the trigger to carry it; the trigger on the hand that holds it = stop / replay
Md.selectStart = function (c, o, d) {
  if (heldBy(c)) { if (via !== 'select') toggle('user'); return true; }
  if (phoneHeld(c)) return orig.selectStart(c, o, d);
  const t = mine(o, d); if (t != null && t < 6) return grab(c, 'select');
  return orig.selectStart(c, o, d);
};
Md.selectEnd = function (c, o, d) {
  if (heldBy(c)) { if (via === 'select') releaseVR(c); return true; }
  return orig.selectEnd(c, o, d);
};
Md.hoverT = function (o, d) { const a = orig.hoverT(o, d), b = pickT(o, d); return b != null && (a == null || b < a) ? b : a; };
Md.playing = function () { return (orig.playing ? orig.playing() : false) || live || starting; };

// VR grip: squeeze with your hand next to it, or pointing at it (when it's the nearest thing on the ray)
const NEAR = 0.12;
function squeezeStart(c) {
  if (heldBy(c) || phoneHeld(c)) return false;
  c.updateWorldMatrix(true, false); const hp = c.getWorldPosition(new V3());
  const near = g.getWorldPosition(new V3()).distanceTo(hp);
  if ((pickable() || (state === 'held' && by !== c && by !== 'desk')) && near < NEAR) return grab(c, 'squeeze');
  const q = c.getWorldQuaternion(new Q()), d = new V3(0, 0, -1).applyQuaternion(q);
  const t = pickT(hp, d); if (t == null || t > 6) return false;
  const all = Md.hoverT(hp, d); if (all != null && all < t - 1e-6) return false;
  return grab(c, 'squeeze');
}
function squeezeEnd(c) { if (heldBy(c) && via === 'squeeze') return releaseVR(c); return false; }
if (renderer && renderer.xr) {
  for (const i of [0, 1]) {
    const c = renderer.xr.getController(i);
    c.addEventListener('squeezestart', () => { try { squeezeStart(c); } catch (e) { console.warn('letter grip', e); } });
    c.addEventListener('squeezeend', () => { try { squeezeEnd(c); } catch (e) { console.warn('letter grip', e); } });
  }
  renderer.xr.addEventListener('sessionstart', () => { if (state === 'held' && by === 'desk') toDrawer(); });
  renderer.xr.addEventListener('sessionend', () => { if (state === 'held' && by !== 'desk') toDrawer(); });
}

// ------------------------------------------------------------ frame
const _hp = new V3(), _hq = new Q();
Md.tick = function (dt, T) {
  orig.tick(dt, T);
  dt = Math.min(dt || 0.016, 0.1);
  if (state === 'held') {
    holdPose(by, _hp, _hq);
    if (anim && anim.grab) { anim.t += dt; const k = ease(clamp(anim.t / anim.dur, 0, 1)); g.position.lerpVectors(anim.p0, _hp, k); g.quaternion.slerpQuaternions(anim.q0, _hq, k); g.scale.setScalar(anim.s0 + (HELD_S - anim.s0) * k); if (k >= 1) anim = null; }
    else { g.position.copy(_hp); g.quaternion.copy(_hq); g.scale.setScalar(HELD_S); }
  } else if (state === 'fly' && anim) {
    anim.t += dt; const k = ease(clamp(anim.t / anim.dur, 0, 1));
    g.position.lerpVectors(anim.p0, anim.p1, k); g.position.y += Math.sin(k * Math.PI) * anim.arc; g.quaternion.slerpQuaternions(anim.q0, anim.q1, k); g.scale.setScalar(anim.s0 + (1 - anim.s0) * k);
    if (k >= 1) { const a = anim; g.position.copy(a.p1); g.quaternion.copy(a.q1); g.scale.setScalar(1); anim = null; if (a.done) a.done(); }
  } else if (state === 'fall') {                                                                  // paper: floats down, swaying a little
    vy = Math.max(vy - 9.8 * dt, -1.3); g.position.y += vy * dt; fallT += dt; sway += dt * 7;
    const wob = new Q().setFromAxisAngle(new V3(1, 0, 0), Math.sin(sway) * 0.18 * clamp((g.position.y - landY) / 0.15, 0, 1));
    g.quaternion.copy(flat(ry + Math.sin(sway * 0.5) * 0.15 * clamp((g.position.y - landY) / 0.15, 0, 1))).multiply(wob);
    if (g.position.y <= landY) { g.position.y = landY; g.quaternion.copy(flat(ry)); state = 'rest'; rustle(g.position, 0.14); }
    else if (fallT > 4) toDrawer();                                                            // never landed: back in its drawer
  } else if (state === 'rest' && g.parent === scene) {                                          // got out of the room somehow: back in its drawer
    const pp = g.position; if (!(Math.abs(pp.x) < RM.RX && Math.abs(pp.z) < RM.RZ && pp.y > -0.1 && pp.y < RM.RH)) toDrawer();
  }
  // her voice: follows the letter; something else starting stops it
  if (live || starting) {
    placePan();
    if (performance.now() / 1000 - startedAt > 0.4 && othersPlaying()) stop('other media');
    if (starting && performance.now() / 1000 - startedAt > 15) starting = false;             // never got going (blocked / offline)
  }
  // the paper: a soft warm glow while she reads
  if (live) frontM.emissive.setHex(EMI_LIVE);
  else if (frontM.emissive.getHex() !== EMI_REST) frontM.emissive.setHex(EMI_REST);
};

const api = RV.letter = {
  g, sheet, hit, audio, LW, LH, TH, HOME, HELD_S, ready: false,
  play, stop, toggle, grab, heldBy, releaseVR, toDrawer, dropAt, placeByClick, squeezeStart, squeezeEnd, pickT, inDrawerT, rayT,
  playing: () => live || starting, state: () => state, pickable, reachable, lastReach: () => lastReach,
  _attach: drawers => { D = drawers; placeHome(); },
  _debug: () => { const p = g.getWorldPosition(new V3()); return { state, by: by === 'desk' ? 'desk' : by ? 'controller' : null, via, live, starting, plays, stops, grabs, homeRuns, lastStop,
    t: +audio.currentTime.toFixed(2), dur: audio.duration, paused: audio.paused, wired: !!src, parent: g.parent && g.parent.name, x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4),
    scale: +g.scale.x.toFixed(3), emissive: frontM.emissive.getHex(), texReady: !!(tex.image && tex.image.width), texW: tex.image && tex.image.width, texH: tex.image && tex.image.height }; },
};
placeHome();   // (no drawer yet: on the desk; drawers.js moves it into the drawer straight away)
})();
