// The zombie plush on the bed has a secret. Point at it and pull the trigger (or click it on screen) and... nothing.
// It just sits there. A few seconds later, when you've written it off, it leaps off the bed and lands right in front of
// your face: twice its size, arms up, red eyes, mouth open, a growl from where it lands and a jolt in the controllers.
// Then it hops back onto the bed and pretends it never moved.
// Comfort: it never touches the camera (no shake, no forced movement), it always stops well clear of your face, and one
// scare runs at a time: triggers during the wait, the scare and a short cooldown are swallowed, so they never stack.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene || !RV.zombiePlush) return;
const Z = RV.zombiePlush, g = Z.group, camera = RV.camera, RX = RV.room.RX, RZ = RV.room.RZ;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
const easeOut = k => 1 - Math.pow(1 - k, 3), easeInOut = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

const T_WAIT = [2.6, 4.2];   // the 'it does nothing' beat (random each time)
const T_POUNCE = 0.3, T_HOLD = 1.5, T_BACK = 0.75, T_COOL = 3.0;
const NEAR = 0.8, MIN_NEAR = 0.5;   // metres from your eyes to its centre (front face ~0.12 m closer, arms ~0.3 m closer)
const BIG = 2.4;                    // 28 cm plush -> ~67 cm zombie

const RH = RV.room.RH || 2.6, R = RV.roomba, rig = RV.rig;
// home pose: wherever it sits now. Default: on the floor just left of the door frame, facing into the room (off the bed,
// out of the view from the pillow). A spot Unity picked is remembered and wins.
const KEY = 'roombaVR.zombieSpot.v1', DEFAULT = { x: -1.95, y: 0, z: 1.85, ry: Math.atan2(0.3 + 1.95, 0.6 - 1.85) };
const EDGE = 0.1;   // keep its middle this far from the walls
function loadSpot() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && [s.x, s.y, s.z, s.ry].every(Number.isFinite) && Math.abs(s.x) <= RX - EDGE + 1e-3 && Math.abs(s.z) <= RZ - EDGE + 1e-3 && s.y >= 0 && s.y < RH) return s;
  } catch (e) { }
  return null;
}
const saved = loadSpot(), spot0 = saved || DEFAULT;
g.position.set(spot0.x, spot0.y, spot0.z); g.rotation.set(0, spot0.ry, 0); g.scale.setScalar(1);
const home = { pos: g.position.clone(), rotY: g.rotation.y, scale: 1, saved: !!saved };
const armHome = Z.arms.map(a => ({ pos: a.position.clone(), rot: a.rotation.clone() }));
const eyeMat0 = Z.eyes[0].material, mouthMat0 = Z.mouth.material;
const eyeRed = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false });
const mouthRed = new THREE.MeshBasicMaterial({ color: 0x3a0008 });
const center = new THREE.Vector3(home.pos.x, home.pos.y + 0.14, home.pos.z), HIT_R = 0.2;   // generous: it's small and across the room

let state = 'idle', t = 0, wait = 3, from = null, to = null, rotFrom = 0, S = BIG, triggers = 0, scares = 0, lastTarget = null;
const head = new THREE.Vector3(), fwd = new THREE.Vector3();

// ------------------------------------------------------------ pointing at it
function rayT(o, d) {
  if (state !== 'idle' && state !== 'armed' && state !== 'cool') return null;   // only while it sits in its spot
  const lx = center.x - o.x, ly = center.y - o.y, lz = center.z - o.z, tc = lx * d.x + ly * d.y + lz * d.z; if (tc < 0 || tc > 8) return null;
  const d2 = lx * lx + ly * ly + lz * lz - tc * tc; if (d2 > HIT_R * HIT_R) return null;
  return tc - Math.sqrt(HIT_R * HIT_R - d2);
}
function hoverT(o, d) { return rayT(o, d); }
// returns true when the ray was the zombie's (so app.js doesn't also toss a crumb behind it)
function select(o, d) { if (rayT(o, d) == null) return false; trigger(); return true; }
// is it the closest thing on this ray? (otherT: the nearest of everything else clickable, from RV.media.hoverT)
function first(o, d, otherT) { const t = rayT(o, d); return t != null && (otherT == null || t <= otherT + 1e-6) ? t : null; }
function trigger(opts) {
  triggers++;
  if (state !== 'idle') return false;                 // already armed, mid-scare or cooling down: swallowed, never stacks
  if (RV.ensureAudio) try { RV.ensureAudio(); } catch (e) { }
  state = 'armed'; t = 0; wait = opts && opts.delay != null ? opts.delay : lerp(T_WAIT[0], T_WAIT[1], Math.random());
  return true;                                         // deliberately no sound, no wobble, no haptic: it does 'nothing'
}

// ------------------------------------------------------------ where it lands: in front of wherever you're looking now
function pickTarget() {
  camera.getWorldPosition(head); camera.getWorldDirection(fwd); fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
  // straight ahead first; nose to a wall or furniture, it swerves to the nearest free spot a little to the side (still in
  // view), never closer than MIN_NEAR to your eyes
  let best = null;
  const inRoom = (x, z) => Math.abs(x) <= RX - 0.16 && Math.abs(z) <= RZ - 0.16;
  const free = (x, z) => inRoom(x, z) && !(RV.blocked && RV.blocked(x, z, 0.12, 'both'));
  search: for (const a of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4]) {
    const c = Math.cos(a), sn = Math.sin(a), fx = fwd.x * c - fwd.z * sn, fz = fwd.x * sn + fwd.z * c;
    for (let d = NEAR; d >= MIN_NEAR - 1e-6; d -= 0.05) { const x = head.x + fx * d, z = head.z + fz * d; if (free(x, z)) { best = { x, z }; break search; } }
  }
  if (!best) {   // boxed in: any spot MIN_NEAR away that is still inside the room
    for (let k = 0; k < 24 && !best; k++) { const a = k / 24 * Math.PI * 2, x = head.x + Math.cos(a) * MIN_NEAR, z = head.z + Math.sin(a) * MIN_NEAR; if (inRoom(x, z)) best = { x, z }; }
    if (!best) best = { x: clamp(head.x + fwd.x * MIN_NEAR, -RX + 0.16, RX - 0.16), z: clamp(head.z + fwd.z * MIN_NEAR, -RZ + 0.16, RZ - 0.16) };
  }
  const realDist = Math.hypot(best.x - head.x, best.z - head.z);
  S = BIG * clamp(realDist / NEAR, 0.6, 1);           // up against a wall it comes in smaller, so it never fills your face
  const y = Math.max(0.1, head.y - 0.04 - 0.21 * S);  // its head at your eye level
  return new THREE.Vector3(best.x, y, best.z);
}
function faceY(px, pz) { camera.getWorldPosition(head); return Math.atan2(head.x - px, head.z - pz); }
function angLerp(a, b, k) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; }

// ------------------------------------------------------------ the scary look
function setScary(k) {   // 0 = plush, 1 = full zombie
  const on = k > 0.01;
  for (const e of Z.eyes) { e.material = on ? eyeRed : eyeMat0; e.scale.set(0.02 * (1 + 0.5 * k), 0.02 * (1 + 0.5 * k), 0.01); }
  Z.mouth.material = on ? mouthRed : mouthMat0; Z.mouth.scale.set(0.05, 0.01 + 0.03 * k, 0.01); Z.mouth.position.y = 0.185 - 0.012 * k;
  Z.arms.forEach((a, i) => {
    const s = i ? -1 : 1, h = armHome[i];
    a.rotation.set(lerp(h.rot.x, Math.PI / 2, k), 0, lerp(h.rot.z, s * 0.15, k));   // swing up and reach towards you
    a.position.set(lerp(h.pos.x, s * -0.085, k), lerp(h.pos.y, 0.16, k), lerp(h.pos.z, 0.075, k));
  });
}

// ------------------------------------------------------------ sound + haptics
function growl(at) {
  const R = RV.roomba, A = R && R.audio && R.audio.ctx; if (!A) return;
  try {
    const now = A.currentTime;
    const panner = A.createPanner(); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 0.6; panner.rolloffFactor = 1;
    if (panner.positionX) { panner.positionX.value = at.x; panner.positionY.value = at.y + 0.5; panner.positionZ.value = at.z; } else panner.setPosition(at.x, at.y + 0.5, at.z);
    const out = A.createGain(); out.gain.value = 0.9; out.connect(panner); panner.connect(A.destination);
    if (R.audio.noise) {   // whoosh / hiss burst
      const n = A.createBufferSource(), bp = A.createBiquadFilter(), ng = A.createGain(); n.buffer = R.audio.noise; bp.type = 'bandpass'; bp.frequency.setValueAtTime(2400, now); bp.frequency.exponentialRampToValueAtTime(500, now + 0.35); bp.Q.value = 0.8;
      ng.gain.setValueAtTime(0.0001, now); ng.gain.exponentialRampToValueAtTime(0.55, now + 0.03); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      n.connect(bp); bp.connect(ng); ng.connect(out); n.start(now, 0.1, 0.5);
    }
    // the growl: two detuned saws falling, roughened by a fast tremolo
    const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1400, now); lp.frequency.exponentialRampToValueAtTime(380, now + 1.2);
    const gg = A.createGain(); gg.gain.setValueAtTime(0.0001, now); gg.gain.exponentialRampToValueAtTime(0.5, now + 0.05); gg.gain.setValueAtTime(0.5, now + 0.7); gg.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
    const trem = A.createGain(); trem.gain.value = 0.6; const lfo = A.createOscillator(), lg = A.createGain(); lfo.frequency.value = 31; lg.gain.value = 0.4; lfo.connect(lg); lg.connect(trem.gain);
    for (const det of [0, 9]) { const o = A.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(150 + det, now); o.frequency.exponentialRampToValueAtTime(58 + det * 0.4, now + 1.2); o.connect(trem); o.start(now); o.stop(now + 1.4); }
    trem.connect(lp); lp.connect(gg); gg.connect(out); lfo.start(now); lfo.stop(now + 1.4);
    // an 8-bit shriek on top, like the arcade episodes
    const sq = A.createOscillator(), sg = A.createGain(); sq.type = 'square'; sq.frequency.setValueAtTime(700, now); sq.frequency.exponentialRampToValueAtTime(1900, now + 0.09); sq.frequency.exponentialRampToValueAtTime(400, now + 0.28);
    sg.gain.setValueAtTime(0.0001, now); sg.gain.exponentialRampToValueAtTime(0.13, now + 0.02); sg.gain.exponentialRampToValueAtTime(0.001, now + 0.3); sq.connect(sg); sg.connect(out); sq.start(now); sq.stop(now + 0.32);
    if (R.audio) R.audio.quietUntil = Math.max(R.audio.quietUntil || 0, now + 1.6);   // so the Roomba's ears ignore the growl
  } catch (e) { console.warn('zombie growl', e); }
}
function buzz(k, ms) { if (RV.haptic) try { RV.haptic(k, ms); } catch (e) { } }

// ------------------------------------------------------------ where things can rest: a ray down onto the room's surfaces
const rc = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();
let landList = null, landAt0 = -1, clock = 0;
const skipSet = new Set();
function landables() {
  if (landList && clock - landAt0 < 3) return landList;   // rebuilt every few seconds (scripts after this one add things)
  skipSet.clear(); g.traverse(o => skipSet.add(o)); if (RV.rig) RV.rig.traverse(o => skipSet.add(o)); skipSet.add(marker);
  if (R && R.items) for (const it of R.items) if (it && it.mesh) it.mesh.traverse(o => skipSet.add(o));   // socks, crumbs: they get eaten
  landList = []; landAt0 = clock;
  RV.scene.traverse(o => {
    if (!o.isMesh || skipSet.has(o)) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (!m || m.visible === false || m.depthTest === false || (m.transparent && m.depthWrite === false) || (m.transparent && m.opacity < 0.5)) return;
    landList.push(o);
  });
  return landList;
}
function shown(o) { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; }
// every hit along a ray, both faces counted, with the face's world normal. Faces count from both sides only for this
// one synchronous query: the sides are put back before anything renders.
function hitsAlong(o, d, far) {
  const ms = landables().filter(shown), sides = new Map();
  for (const m of ms) for (const mt of (Array.isArray(m.material) ? m.material : [m.material])) { if (!sides.has(mt)) sides.set(mt, mt.side); mt.side = THREE.DoubleSide; }
  rc.set(o, d); rc.far = far; let hs = [];
  try { hs = rc.intersectObjects(ms, false); } catch (e) { hs = []; } finally { for (const [mt, s] of sides) mt.side = s; }
  const out = [];
  for (const h of hs) {
    if (!h.face) continue;
    if (R && R.b && h.point.y < 0.16 && Math.hypot(h.point.x - R.b.x, h.point.z - R.b.z) < 0.25) continue;   // the Roomba drives off: never land on it
    _n.copy(h.face.normal).applyNormalMatrix(_m3.getNormalMatrix(h.object.matrixWorld)).normalize();
    out.push({ y: h.point.y, p: h.point.clone(), n: _n.clone(), t: h.distance, obj: h.object });
  }
  return out;
}
// the surface it rests on at (x, z), dropped from height yRef: the highest upward face at or below yRef with open air
// and room for a plush above it (not the inside of a mattress or a dresser). Always inside the walls.
const CLEAR = 0.18;
function landAt(x, yRef, z, quick) {
  x = clamp(x, -RX + EDGE, RX - EDGE); z = clamp(z, -RZ + EDGE, RZ - EDGE);
  const hs = hitsAlong(new THREE.Vector3(x, RH - 0.02, z), DOWN, RH + 0.1);
  const tops = []; for (const h of hs) if (h.n.y > 0.7 && !tops.some(q => Math.abs(q.y - h.y) < 0.004)) tops.push({ y: h.y, ny: h.n.y });
  if (!tops.some(q => q.y < 0.01)) tops.push({ y: 0, ny: 1 });
  tops.sort((a, b) => b.y - a.y);
  const free = q => { const up = hitsAlong(new THREE.Vector3(x, q.y + 0.02, z), UP, RH)[0]; return !up || (up.n.y < -0.3 && up.t >= CLEAR - 0.02); };
  let pick;
  if (quick) pick = tops.find(q => q.y <= yRef + 0.06) || tops[tops.length - 1];   // the marker while carrying: one ray
  else {
    const ok = tops.filter(free);
    pick = ok.find(q => q.y <= yRef + 0.06) || ok[ok.length - 1] || tops[0];       // nothing free under the hand (it's inside something): on top of it
  }
  return { x, y: Math.max(0, pick.y), z, ny: pick.ny };
}

// ------------------------------------------------------------ picking it up, carrying it, putting it down
const marker = (function () {   // where it will land: a soft dark spot on the surface under it
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 3; m.visible = false; m.name = 'zombie landing spot'; RV.scene.add(m); return m;
})();
const HOLD_T = 0.35, GRAB_T = 0.18, NEAR_HAND = 0.25;
const HAND_OFS = new THREE.Vector3(0, -0.14, -0.05);   // in the hand: its middle at your fist, facing you
let holder = null, press = null, grab = null, drop = null, markT = 0, moves = 0, settleT = 0, dragGoal = null;
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3();
function near(c) { if (!c || !c.getWorldPosition) return false; c.updateWorldMatrix(true, false); c.getWorldPosition(_p); return _p.distanceTo(center) < NEAR_HAND; }
function grabbable() { return state === 'idle' || state === 'armed' || state === 'cool' || state === 'drop'; }
function startHold(who) {
  if (state === 'held') return holder === who;
  if (!grabbable()) return false;
  drop = null; state = 'held'; t = 0; holder = who; press = null;   // grabbing it during the 'nothing happens' beat calls the scare off
  grab = { t: 0, p: g.position.clone(), q: g.quaternion.clone(), by: 'grip' };
  g.scale.setScalar(1); setScary(0); Z.head.rotation.set(0, 0, 0);
  Z.arms.forEach((a, i) => { a.position.copy(armHome[i].pos); a.rotation.copy(armHome[i].rot); });
  if (typeof who === 'object') buzz(0.45, 70);
  marker.visible = true; markT = 0;
  return true;
}
function onRay(o, d) { if (!o || !d) return null; const lx = center.x - o.x, ly = center.y - o.y, lz = center.z - o.z, tc = lx * d.x + ly * d.y + lz * d.z; if (tc < 0 || tc > 8) return null; return lx * lx + ly * ly + lz * lz - tc * tc <= HIT_R * HIT_R ? tc : null; }
// VR grip (squeeze): grabs when the ray points at it or your hand is right next to it. The other hand can take it over.
function grabWith(c, o, d, otherT) {
  if (state === 'held') {
    if (holder === c || holder === 'mouse') return holder === c;
    if (!near(c) && onRay(o, d) == null) return false;
    holder = c; grab = { t: 0, p: g.position.clone(), q: g.quaternion.clone(), by: 'grip' }; buzz(0.35, 50); return true;
  }
  if (!grabbable()) return false;
  if ((o && d && (state === 'drop' ? onRay(o, d) != null : first(o, d, otherT) != null)) || near(c)) return startHold(c);
  return false;
}
// VR trigger / pinch: a tap is the scare (on release), holding it a moment picks it up
function selectStart(c, o, d, otherT) {
  if (state === 'held') return holder === c;                         // trigger while carrying it: swallowed
  const handNear = c && c.userData && c.userData.src && c.userData.src.hand && near(c);
  if (first(o, d, otherT) == null && !handNear) return false;
  press = { c, t: 0 };
  return true;
}
function selectEnd(c) {
  if (state === 'held' && holder === c && grab && grab.by === 'select') { release(c); return true; }
  if (press && press.c === c) { press = null; trigger(); return true; }
  return false;
}
function release(who) {
  if (state !== 'held' || (who !== undefined && who !== holder)) return false;
  holder = null; grab = null; dragGoal = null;
  // straight down from where it is, upright, still facing the way it faced
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion); f.y = 0; const ry = f.lengthSq() > 1e-6 ? Math.atan2(f.x, f.z) : home.rotY;
  const L = landAt(g.position.x, g.position.y, g.position.z);
  drop = { t: 0, p: g.position.clone(), q: g.quaternion.clone(), to: L, ry, v: 0, y: g.position.y, bounced: false };
  state = 'drop'; t = 0; marker.visible = true; marker.position.set(L.x, L.y + 0.004, L.z);
  return true;
}
function releaseAll() { press = null; if (state === 'held') release(holder); }
// screen: click and drag. app.js calls dragStart once the mouse really moves on it, then dragTo while it moves.
function dragStart() { return startHold('mouse'); }
function dragTo(o, d) {
  if (state !== 'held' || holder !== 'mouse') return false;
  const h = hitsAlong(o, d, 12)[0];
  if (!h) return false;
  let L;
  if (h.n.y > 0.7) L = landAt(h.p.x, h.p.y + 0.01, h.p.z, true);
  else L = landAt(h.p.x + h.n.x * 0.14, h.p.y, h.p.z + h.n.z * 0.14, true);   // a wall or the side of something: just in front of it, onto what's below
  dragGoal = { x: L.x, y: L.y + 0.05, z: L.z };
  return true;
}
const obst = { t: 'circ', x: 99, z: 99, r: 0.1, who: 'roomba', name: 'zombie' }; if (RV.obstacles) RV.obstacles.push(obst);
function setHome(x, y, z, ry, save) {
  home.pos.set(x, y, z); home.rotY = ry; center.set(x, y + 0.14, z);
  obst.x = y < 0.03 ? x : 99; obst.z = y < 0.03 ? z : 99;            // on the floor the Roomba bumps into it (and has opinions)
  if (save) { try { localStorage.setItem(KEY, JSON.stringify({ x: +x.toFixed(4), y: +y.toFixed(4), z: +z.toFixed(4), ry: +ry.toFixed(4) })); home.saved = true; } catch (e) { } }
}
setHome(home.pos.x, home.pos.y, home.pos.z, home.rotY, false);
function resetSpot() {   // back to the default floor spot, forget the saved one
  try { localStorage.removeItem(KEY); } catch (e) { }
  holder = null; grab = null; drop = null; press = null; dragGoal = null; state = 'idle'; t = 0; marker.visible = false;
  setHome(DEFAULT.x, DEFAULT.y, DEFAULT.z, DEFAULT.ry, false); home.saved = false; reset();
}
function holdTick(dt) {
  if (holder === 'mouse') {
    if (!dragGoal) return;
    _p.set(dragGoal.x, dragGoal.y, dragGoal.z);
    camera.getWorldPosition(head); _q2.setFromEuler(new THREE.Euler(0, Math.atan2(head.x - _p.x, head.z - _p.z), 0));
    const k = 1 - Math.exp(-dt * 18); g.position.lerp(_p, k); g.quaternion.slerp(_q2, k);
  } else if (holder && holder.matrixWorld) {
    holder.updateWorldMatrix(true, false); holder.matrixWorld.decompose(_p, _q, _s);
    const tp = HAND_OFS.clone().applyQuaternion(_q).add(_p);
    if (grab && grab.t < GRAB_T) { grab.t += dt; const e = easeOut(clamp(grab.t / GRAB_T, 0, 1)); g.position.lerpVectors(grab.p, tp, e); g.quaternion.slerpQuaternions(grab.q, _q, e); }
    else { g.position.copy(tp); g.quaternion.copy(_q); }
  }
  // stays inside the room even if your hand goes through a wall
  g.position.x = clamp(g.position.x, -RX + 0.05, RX - 0.05); g.position.z = clamp(g.position.z, -RZ + 0.05, RZ - 0.05); g.position.y = clamp(g.position.y, 0, RH - 0.3);
  center.set(g.position.x, g.position.y + 0.14, g.position.z);
  markT -= dt; if (markT <= 0) { markT = 0.15; const L = landAt(g.position.x, g.position.y, g.position.z, true); marker.position.set(L.x, L.y + 0.004, L.z); marker.visible = true; }
}
function dropTick(dt) {
  const D = drop, L = D.to; D.t += dt;
  if (!D.bounced) {   // gravity straight down, upright on the way
    D.v += 9.8 * dt; D.y -= D.v * dt;
    const k = clamp(D.t / 0.25, 0, 1);
    g.position.set(lerp(D.p.x, L.x, k), Math.max(L.y, D.y), lerp(D.p.z, L.z, k));
    _q2.setFromEuler(new THREE.Euler(0, D.ry, 0)); g.quaternion.slerpQuaternions(D.q, _q2, easeOut(k));
    if (D.y <= L.y) { D.y = L.y; if (k >= 1) { D.bounced = true; D.bt = 0; D.vy = Math.min(1.2, D.v * 0.22); buzz(Math.min(0.6, 0.15 + D.v * 0.1), 40); } }
    return;
  }
  D.bt += dt; const hop = Math.max(0, D.vy * D.bt - 4.9 * D.bt * D.bt);   // a little squash and bounce
  g.position.set(L.x, L.y + hop, L.z); g.rotation.set(0, D.ry, 0);
  const sq = D.bt < 0.12 ? 1 - 0.18 * Math.sin(Math.PI * D.bt / 0.12) : 1; g.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  if (D.bt > 0.12 && hop <= 0) {
    g.position.set(L.x, L.y, L.z); g.scale.setScalar(1); g.rotation.set(0, D.ry, 0);
    drop = null; marker.visible = false; moves++;
    setHome(L.x, L.y, L.z, D.ry, true); state = 'idle'; t = 0;
  }
}
// every couple of seconds: if what it sits on went away (a cartridge, a sock), it drops onto what's under it now
function settleTick(dt) {
  settleT -= dt; if (settleT > 0) return; settleT = 2;
  const L = landAt(home.pos.x, home.pos.y + 0.03, home.pos.z, true);
  if (Math.abs(L.y - home.pos.y) <= 0.015) return;
  const L2 = landAt(home.pos.x, home.pos.y + 0.03, home.pos.z);
  if (Math.abs(L2.y - home.pos.y) > 0.015) { setHome(L2.x, L2.y, L2.z, home.rotY, home.saved); g.position.copy(home.pos); }
}

// ------------------------------------------------------------ frame tick
function tick(dt) {
  clock += dt;
  if (press) { press.t += dt; if (press.t >= HOLD_T) { const c = press.c; press = null; if (startHold(c)) grab.by = 'select'; } }
  if (state === 'held') { t += dt; holdTick(dt); return; }
  if (state === 'drop') { t += dt; dropTick(dt); return; }
  if (state === 'idle') { settleTick(dt); return; }
  t += dt;
  if (state === 'armed') {
    if (t >= wait) { state = 'pounce'; t = 0; scares++; from = g.position.clone(); to = pickTarget(); lastTarget = to.clone(); rotFrom = g.rotation.y; growl(to); buzz(0.6, 120); if (RV.roomba && RV.roomba.hear) try { RV.roomba.hear('loud'); } catch (e) { } }   // the Roomba jumps too
    return;
  }
  if (state === 'pounce') {
    const k = clamp(t / T_POUNCE, 0, 1), e = easeOut(k);
    g.position.set(lerp(from.x, to.x, e), lerp(from.y, to.y, e) + Math.sin(Math.PI * k) * 0.3, lerp(from.z, to.z, e));
    g.scale.setScalar(lerp(1, S, e)); g.rotation.y = angLerp(rotFrom, faceY(g.position.x, g.position.z), Math.min(1, k * 2)); setScary(Math.min(1, k * 1.6));
    if (k >= 1) { state = 'hold'; t = 0; buzz(1.0, 300); }
    return;
  }
  if (state === 'hold') {
    // it stays put (no lunging closer), snarls with a jitter of its own, keeps staring at you
    const j = t < 0.6 ? 0.012 : 0.005;
    g.position.set(to.x + (Math.random() - 0.5) * j, to.y + Math.sin(t * 9) * 0.015, to.z + (Math.random() - 0.5) * j);
    g.rotation.y = faceY(to.x, to.z) + Math.sin(t * 13) * 0.04; Z.head.rotation.z = Math.sin(t * 7) * 0.12;
    if (t > 0.45 && t - dt <= 0.45) buzz(0.5, 160);
    if (t >= T_HOLD) { state = 'back'; t = 0; from = g.position.clone(); rotFrom = g.rotation.y; Z.head.rotation.z = 0; }
    return;
  }
  if (state === 'back') {
    const k = clamp(t / T_BACK, 0, 1), e = easeInOut(k);
    g.position.set(lerp(from.x, home.pos.x, e), lerp(from.y, home.pos.y, e) + Math.sin(Math.PI * k) * 0.35, lerp(from.z, home.pos.z, e));
    g.scale.setScalar(lerp(S, 1, e)); g.rotation.y = angLerp(rotFrom, home.rotY, e); setScary(1 - Math.min(1, k * 1.4));
    if (k >= 1) { reset(); state = 'cool'; t = 0; }
    return;
  }
  if (state === 'cool' && t >= T_COOL) { state = 'idle'; t = 0; }
}
function reset() {
  g.position.copy(home.pos); g.rotation.set(0, home.rotY, 0); g.scale.setScalar(1); Z.head.rotation.set(0, 0, 0); setScary(0);
  Z.arms.forEach((a, i) => { a.position.copy(armHome[i].pos); a.rotation.copy(armHome[i].rot); });
}

RV.zombie = { select, click: select, hoverT, first, trigger, tick, reset, state: () => state,
  selectStart, selectEnd, grab: grabWith, release, releaseAll, dragStart, dragTo, landAt, resetSpot,
  _debug: { get state() { return state; }, get t() { return t; }, get wait() { return wait; }, get triggers() { return triggers; }, get scares() { return scares; }, get scale() { return S; },
    get target() { return lastTarget && lastTarget.toArray(); }, home, group: g, center, marker, obst, KEY, DEFAULT, get moves() { return moves; },
    get holder() { return holder === 'mouse' ? 'mouse' : holder ? 'controller' : null; }, get pressing() { return !!press; } } };
})();
