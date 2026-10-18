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

// home pose (exactly as room.js built it)
const home = { pos: g.position.clone(), rotY: g.rotation.y, scale: 1 };
const armHome = Z.arms.map(a => ({ pos: a.position.clone(), rot: a.rotation.clone() }));
const eyeMat0 = Z.eyes[0].material, mouthMat0 = Z.mouth.material;
const eyeRed = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false });
const mouthRed = new THREE.MeshBasicMaterial({ color: 0x3a0008 });
const center = new THREE.Vector3(home.pos.x, home.pos.y + 0.14, home.pos.z), HIT_R = 0.2;   // generous: it's small and across the room

let state = 'idle', t = 0, wait = 3, from = null, to = null, rotFrom = 0, S = BIG, triggers = 0, scares = 0, lastTarget = null;
const head = new THREE.Vector3(), fwd = new THREE.Vector3();

// ------------------------------------------------------------ pointing at it
function rayT(o, d) {
  if (state !== 'idle' && state !== 'armed' && state !== 'cool') return null;   // only while it sits on the bed
  const lx = center.x - o.x, ly = center.y - o.y, lz = center.z - o.z, tc = lx * d.x + ly * d.y + lz * d.z; if (tc < 0 || tc > 8) return null;
  const d2 = lx * lx + ly * ly + lz * lz - tc * tc; if (d2 > HIT_R * HIT_R) return null;
  return tc - Math.sqrt(HIT_R * HIT_R - d2);
}
function hoverT(o, d) { return rayT(o, d); }
// returns true when the ray was the zombie's (so app.js doesn't also toss a crumb behind it)
function select(o, d) { if (rayT(o, d) == null) return false; trigger(); return true; }
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

// ------------------------------------------------------------ frame tick
function tick(dt) {
  if (state === 'idle') return;
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

RV.zombie = { select, click: select, hoverT, trigger, tick, reset, state: () => state,
  _debug: { get state() { return state; }, get t() { return t; }, get wait() { return wait; }, get triggers() { return triggers; }, get scares() { return scares; }, get scale() { return S; },
    get target() { return lastTarget && lastTarget.toArray(); }, home, group: g } };
})();
