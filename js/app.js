// Input, voice, the VR session and the frame loop. Same controls as Between Signals:
// left stick walks, right stick snap-turns. Trigger: point at the floor to toss a crumb, point at the Roomba to boop it.
// A/X calls it over, B/Y claps. Or just talk to it: it hears you through the mic.
(function () {
const RV = window.RV, R = RV.roomba, { renderer, scene, camera, rig } = RV;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const P = { x: 0.35, z: 1.45, yaw: 0, pitch: -0.32, y: 0, eye: 1.6 };
const PR = 0.2;
let audio = null, mic = null, started = false;
const errors = []; addEventListener('error', e => errors.push(String(e.message || e)));

rig.position.set(P.x, 0, P.z); camera.position.set(0, 1.6, 0);

// ---------------------------------------------------------- audio + mic
function ensureAudio() {
  if (!audio) { audio = new (window.AudioContext || window.webkitAudioContext)(); R.initAudio(audio); }
  if (audio.state === 'suspended') audio.resume();
}
RV.ensureAudio = ensureAudio;
async function startMic() {
  ensureAudio();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    const src = audio.createMediaStreamSource(stream), an = audio.createAnalyser(); an.fftSize = 1024; src.connect(an);
    mic = { an, buf: new Float32Array(an.fftSize), floor: -58, talkT: 0, quietT: 0, talking: false, start: 0 };
    $('micState').textContent = 'Mic on. Talk to it.'; $('bMic').classList.add('on');
    return true;
  } catch (e) { $('micState').textContent = 'No mic. Use A/X to call it, B/Y to clap.'; return false; }
}
const fakeVoice = { until: 0, db: -90, loudAt: 0 };
let dbNow = -90;
function voiceTick(dt, t) {
  let db = -90;
  if (mic && mic.an) { mic.an.getFloatTimeDomainData(mic.buf); let s = 0; for (let i = 0; i < mic.buf.length; i++) s += mic.buf[i] * mic.buf[i]; db = 10 * Math.log10(s / mic.buf.length + 1e-10); }
  if (t < fakeVoice.until) db = Math.max(db, fakeVoice.db);
  dbNow = db;
  const m = mic || (mic = { floor: -58, talkT: 0, quietT: 0, talking: false, fake: true });
  m.floor = Math.min(db, m.floor + dt * 1.5); m.floor = clamp(m.floor, -75, -30);
  const selfNoise = (audio && audio.currentTime < R.audio.quietUntil ? 14 : 0) + (RV.media && RV.media.playing() ? 12 : 0);     // ignore the Roomba's own beeps (and the TV / the record)
  const talkThr = Math.max(m.floor + 12, -50) + selfNoise, loudThr = Math.max(m.floor + 32, -17) + selfNoise * 0.5;
  R.voice.level = clamp((db - m.floor - 6) / 34, 0, 1);
  if (db > loudThr) R.hear('loud');
  if (db > talkThr) { m.talkT += dt; m.quietT = 0; if (!m.talking && m.talkT > 0.35) { m.talking = true; R.voice.talking = true; R.hear('talk'); } }
  else { m.quietT += dt; if (m.quietT > 0.5) { m.talkT = 0; if (m.talking) { m.talking = false; R.voice.talking = false; } } }
  if (R.state && R.state() === 'converse') { /* listening face reads the level */ }
  RV.roomba && (RV.roomba._listen = R.voice.level);
}

// ---------------------------------------------------------- haptics
RV.haptic = function (k, ms) {
  const s = renderer.xr.getSession(); if (!s) return;
  for (const src of s.inputSources) { const h = src.gamepad && src.gamepad.hapticActuators && src.gamepad.hapticActuators[0]; if (h && h.pulse) try { h.pulse(k, ms); } catch (e) { } }
};

// ---------------------------------------------------------- controllers: rays, reticle, trigger
const ctrls = [0, 1].map(i => {
  const c = renderer.xr.getController(i); rig.add(c);
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.55 })); line.scale.z = 3; c.add(line);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe14a })); c.add(tip);
  c.userData = { line };
  c.addEventListener('connected', e => { c.userData.src = e.data; });
  c.addEventListener('disconnected', () => { c.userData.src = null; });
  c.addEventListener('selectstart', () => {
    ensureAudio(); const r = rayFrom(c); if (RV.media) RV.media.unlock();
    // the zombie plush, when it's the nearest thing on the ray: a tap is the scare, holding the trigger / a pinch picks it up
    if (RV.zombie && RV.zombie.selectStart(c, r.o, r.d, RV.media ? RV.media.hoverT(r.o, r.d) : null)) { c.userData.zsel = true; return; }
    if (RV.media && RV.media.selectStart(c, r.o, r.d)) return;   // cartridges, TV buttons, record player
    pointAction(c);
  });
  c.addEventListener('selectend', () => {
    if (c.userData.zsel) { c.userData.zsel = false; if (RV.zombie) RV.zombie.selectEnd(c); return; }
    if (RV.media) { const r = rayFrom(c); RV.media.selectEnd(c, r.o, r.d); }
  });
  // grip: grab the zombie (pointing at it, or with your hand next to it); let go to drop it where you are
  c.addEventListener('squeezestart', () => { if (!RV.zombie) return; ensureAudio(); const r = rayFrom(c); RV.zombie.grab(c, r.o, r.d, RV.media ? RV.media.hoverT(r.o, r.d) : null); });
  c.addEventListener('squeezeend', () => { if (RV.zombie) RV.zombie.release(c); });
  return c;
});
const reticle = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.05, 20), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.8, depthWrite: false }));
reticle.rotation.x = -Math.PI / 2; reticle.visible = false; scene.add(reticle);
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
function rayFrom(obj) { obj.getWorldPosition(_o); obj.getWorldQuaternion(_q); _d.set(0, 0, -1).applyQuaternion(_q); return { o: _o.clone(), d: _d.clone() }; }
function resolveRay(o, d) {
  // the Roomba (a sphere around its lid) first, then the floor
  const bx = R.b.x, by = 0.06, bz = R.b.z; const t0 = (bx - o.x) * d.x + (by - o.y) * d.y + (bz - o.z) * d.z;
  if (t0 > 0 && t0 < 8) { const cx = o.x + d.x * t0 - bx, cy = o.y + d.y * t0 - by, cz = o.z + d.z * t0 - bz; if (cx * cx + cy * cy + cz * cz < 0.22 * 0.22) return { roomba: true, x: bx, z: bz, t: t0 }; }
  if (d.y < -0.02) { const t = -o.y / d.y; if (t < 7) return { floor: true, x: o.x + d.x * t, z: o.z + d.z * t, t }; }
  return null;
}
function act(hit) {
  if (!hit) return;
  if (hit.roomba) { R.pet(); R.snd('boop'); }
  else if (hit.floor) R.toss(hit.x, hit.z);
}
function pointAction(c) { ensureAudio(); const r = rayFrom(c); act(resolveRay(r.o, r.d)); }

// ---------------------------------------------------------- XR stick reading (from Between Signals)
let snapReady = true; const btnPrev = {};
function readXR() {
  const s = fakeSession || renderer.xr.getSession(); if (!s) return [0, 0];
  let mx = 0, my = 0;
  for (const src of s.inputSources) {
    const gp = src.gamepad; if (!gp) continue; const ax = gp.axes || [];
    const x = ax.length >= 4 ? ax[2] : (ax[0] || 0), y = ax.length >= 4 ? ax[3] : (ax[1] || 0);
    if (src.handedness === 'left' || (src.handedness !== 'right' && s.inputSources.length === 1)) { if (Math.abs(x) > 0.15) mx = x; if (Math.abs(y) > 0.15) my = y; }
    if (src.handedness === 'right') {
      if (Math.abs(x) > 0.7 && snapReady) { snapReady = false; P.yaw -= Math.sign(x) * Math.PI / 6; }
      if (Math.abs(x) < 0.3) snapReady = true;
      if (Math.abs(y) > 0.6 && !mx && !my) my = y * 0.8;
    }
    // A/X (button 4) calls it, B/Y (button 5) claps
    const b = gp.buttons || [], key = src.handedness;
    const a = !!(b[4] && b[4].pressed), bb = !!(b[5] && b[5].pressed);
    if (a && !btnPrev[key + 'a']) { ensureAudio(); R.hear('call'); }
    if (bb && !btnPrev[key + 'b']) { ensureAudio(); R.hear('loud'); clap(); }
    btnPrev[key + 'a'] = a; btnPrev[key + 'b'] = bb;
  }
  return [mx, my];
}
function clap() { if (!audio) return; const t = audio.currentTime, s = audio.createBufferSource(), g = audio.createGain(); s.buffer = R.audio.noise; g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); s.connect(g); g.connect(audio.destination); s.start(t, 0.3, 0.15); }

// ---------------------------------------------------------- flat (desktop) controls
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (!started) return; if (e.code === 'KeyC') { ensureAudio(); R.hear('call'); } if (e.code === 'KeyV') { ensureAudio(); R.hear('loud'); clap(); } });
addEventListener('keyup', e => { keys[e.code] = false; });
let drag = null;
function mouseRay(e) { const ray = new THREE.Raycaster(); ray.setFromCamera({ x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }, camera); return { o: ray.ray.origin.clone(), d: ray.ray.direction.clone() }; }
renderer.domElement.addEventListener('pointerdown', e => {
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
  // mouse down on the zombie plush: dragging moves it instead of looking around (a plain click is still the scare)
  if (started && !renderer.xr.isPresenting && RV.zombie) { const r = mouseRay(e); if (RV.zombie.first(r.o, r.d, RV.media ? RV.media.hoverT(r.o, r.d) : null) != null) drag.z = 'maybe'; }
});
addEventListener('pointermove', e => {
  if (drag && drag.z) {
    if (drag.z === 'maybe' && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) >= 6) drag.z = RV.zombie.dragStart() ? 'on' : null;
    if (drag.z === 'on') { const r = mouseRay(e); RV.zombie.dragTo(r.o, r.d); }
    if (drag.z) return;
  }
  if (!drag) return; P.yaw -= (e.clientX - drag.x) * 0.005; P.pitch = clamp(P.pitch - (e.clientY - drag.y) * 0.004, -1.3, pose && pose.S.lie ? 1.55 : 1.0); drag.x = e.clientX; drag.y = e.clientY; });
addEventListener('pointercancel', () => { if (drag && drag.z === 'on') RV.zombie.release('mouse'); drag = null; });
addEventListener('pointerup', e => {
  if (!drag) return; const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy), zd = drag.z; drag = null;
  if (zd === 'on') { RV.zombie.release('mouse'); return; }   // put it down where you dragged it
  if (moved < 6 && started && !renderer.xr.isPresenting) { ensureAudio(); const ray = new THREE.Raycaster(); ray.setFromCamera({ x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }, camera); if (RV.media) RV.media.unlock(); if (zd === 'maybe' && RV.zombie.click(ray.ray.origin.clone(), ray.ray.direction.clone())) return; if (RV.media && RV.media.click(ray.ray.origin.clone(), ray.ray.direction.clone())) return; if (RV.zombie && RV.zombie.click(ray.ray.origin.clone(), ray.ray.direction.clone())) return; act(resolveRay(ray.ray.origin, ray.ray.direction)); }
});

// ---------------------------------------------------------- movement + collision (Unity's feet vs furniture and the Roomba)
const head = new THREE.Vector3();
let lastFeet = null;
// how deep (metres) a PR-radius body at (x, z) sits inside the walls or Unity-blocking furniture; 0 = free
function pen(x, z) {
  const { RX, RZ } = RV.room; let d = Math.max(0, x - (RX - PR), (-RX + PR) - x, z - (RZ - PR), (-RZ + PR) - z);
  for (const o of RV.obstacles) {
    if (o.who !== 'both' && o.who !== 'player') continue;
    if (o.t === 'box') {
      const cx = clamp(x, o.x0, o.x1), cz = clamp(z, o.z0, o.z1), out = Math.hypot(x - cx, z - cz);
      d = Math.max(d, out > 0 ? PR - out : PR + Math.min(x - o.x0, o.x1 - x, z - o.z0, o.z1 - z));
    } else d = Math.max(d, PR + o.r - Math.hypot(x - o.x, z - o.z));
  }
  return d;
}
function okStep(p0, x, z) { if (!RV.blocked(x, z, PR, 'player')) return true; return p0 > 0 && pen(x, z) <= p0 + 1e-4; }
let fakeSession = null;   // test hook: stand-in XR session with fake thumbsticks

// ---------------------------------------------------------- poses: sit on the beanbag, lie down on the bed
// Click the beanbag (or point + trigger) and your view drops onto it, seated. Click the bed and you lie on your back with
// your head on the pillow, looking straight up at the ceiling. In VR your headset keeps full tracking: only the rig moves
// (never your view direction), and for the first few seconds it keeps re-fitting the height so you can sit or lie down in
// real life and land in the right spot. Push the stick (or WASD), click the same thing again, or stand up for real to get up.
const POSES = {
  beanbag: { seat: { x: 1.95, z: 1.45 }, eye: 0.98, minEye: 0.62, settle: 4, exit: { x: 1.2, z: 0.95 }, yaw: Math.atan2(1.95, 1.45), pitch: -0.12, label: 'beanbag' },
  bed: { seat: { x: -2.28, z: 0.2 }, eye: 0.76, minEye: 0.66, settle: 7, exit: { x: -0.25, z: 0.2 }, yaw: -Math.PI / 2, pitch: 1.5, lie: true, label: 'bed' },
};
if (RV.desk && RV.desk.pose) POSES.desk = RV.desk.pose;   // the stool at the desk (js/desk.js): sit at the CHARLIE 64
let pose = null, lastStand = null;
const poseHint = (function () {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64; const x = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.0625), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: 0 }));
  m.position.set(0, -0.16, -0.9); m.renderOrder = 20; m.visible = false; camera.add(m);
  return { m, show(txt) { x.clearRect(0, 0, 512, 64); x.fillStyle = 'rgba(16,8,32,0.85)'; x.fillRect(0, 0, 512, 64); x.fillStyle = '#ffe14a'; x.font = '18px "Press Start 2P", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 256, 33); t.needsUpdate = true; m.userData.t = 4.5; } };
})();
function xrHeadLocal() { const c = camera.position, cs = Math.cos(P.yaw), sn = Math.sin(P.yaw); return { x: c.x * cs + c.z * sn, z: -c.x * sn + c.z * cs, y: c.y }; }   // camera offset in world axes (rig yaw applied)
function fitTo(px, pz, eye, k) {
  const xr = renderer.xr.isPresenting;
  if (xr) { const h = xrHeadLocal(); P.x += (px - h.x - P.x) * k; P.z += (pz - h.z - P.z) * k; if (eye != null) P.y += (eye - h.y - P.y) * k; }
  else { P.x = px; P.z = pz; if (eye != null) P.eye = eye; }
}
function sitOn(name) {
  const S = POSES[name]; if (!S) return false;
  if (pose && pose.name === name) { standUp('again'); return true; }
  pose = { name, S, t: 0, lastYaw: P.yaw, high: 0 };
  if (!renderer.xr.isPresenting) { P.yaw = S.yaw; P.pitch = S.pitch; }     // on a screen you get the view; in VR your head decides
  fitTo(S.seat.x, S.seat.z, S.eye, 1); pose.lastYaw = P.yaw;
  poseHint.show(renderer.xr.isPresenting ? 'MOVE THE STICK TO STAND UP' : 'WASD OR CLICK AGAIN TO STAND UP');
  if (RV.haptic) RV.haptic(0.35, 60); try { R.snd && R.snd('boop'); } catch (e) { }
  return true;
}
function standUp(why) {
  if (!pose) return; const S = pose.S; pose = null; lastStand = why || 'user';
  P.y = 0; P.eye = 1.6;
  if (renderer.xr.isPresenting) { const h = xrHeadLocal(); P.x = S.exit.x - h.x; P.z = S.exit.z - h.z; } else { P.x = S.exit.x; P.z = S.exit.z; P.pitch = -0.2; }
  poseHint.m.userData.t = 0;
}
function poseTick(dt) {
  const S = pose.S; pose.t += dt;
  // snap turn while seated: turn on the spot (around your head), not around the rig origin
  if (renderer.xr.isPresenting && P.yaw !== pose.lastYaw) {
    const c = camera.position, a = pose.lastYaw, ox = c.x * Math.cos(a) + c.z * Math.sin(a), oz = -c.x * Math.sin(a) + c.z * Math.cos(a), n = xrHeadLocal();
    P.x += ox - n.x; P.z += oz - n.z;
  }
  pose.lastYaw = P.yaw;
  if (!renderer.xr.isPresenting) return;
  const h = xrHeadLocal();
  if (pose.t < S.settle) fitTo(S.seat.x, S.seat.z, S.eye, Math.min(1, dt * 6));   // settling in: follow you while you sit / lie down for real
  else {
    if (P.y + h.y < S.minEye) P.y = S.minEye - h.y;                                // never sink through the beanbag / mattress
    pose.high = P.y + h.y > S.eye + 0.6 ? pose.high + dt : 0;                       // you stood up in real life: get up
    if (pose.high > 1.2) standUp('stood up');
  }
}
// picking the beanbag and the bed (invisible volumes); the Roomba, the zombie, posters and media keep priority when closer
const poseHits = [];
(function () {
  const inv = new THREE.MeshBasicMaterial({ visible: false });
  const bb = new THREE.Mesh(new THREE.SphereGeometry(0.47, 16, 10), inv); bb.scale.set(1, 0.62, 1); bb.position.set(1.85, 0.26, 1.35); bb.name = 'beanbag'; scene.add(bb); poseHits.push(bb);
  const bd = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.36, 1.08), inv); bd.position.set(-1.59, 0.55, 0.2); bd.name = 'bed'; scene.add(bd); poseHits.push(bd);
  if (RV.desk && RV.desk.stoolHit) poseHits.push(RV.desk.stoolHit);   // named 'desk'
})();
const poseRay = new THREE.Raycaster(); poseRay.far = 10;
function posePick(o, d) { poseRay.set(o, d); const h = poseRay.intersectObjects(poseHits, false)[0]; return h ? { t: h.distance, name: h.object.name } : null; }
// Something you can pick up (the phone, the zombie) lying ON the stool / bed / beanbag sits inside that seat's invisible
// sit-down volume, so the ray enters the volume before it reaches the thing. Pointing at it means you want the thing,
// not to sit down: it wins when its hit is in front of the volume or inside it (a little margin around it).
const _pb = new THREE.Box3(), _pp = new THREE.Vector3();
function propInPose(o, d, h) {
  const m = poseHits.find(q => q.name === h.name); if (!m) return false;
  m.updateMatrixWorld(true); _pb.setFromObject(m).expandByScalar(0.06);
  for (const t of [RV.phone && RV.phone.pickT ? RV.phone.pickT(o, d) : null, RV.zombie ? RV.zombie.hoverT(o, d) : null]) {
    if (t == null) continue;
    if (t < h.t || _pb.containsPoint(_pp.copy(d).multiplyScalar(t).add(o))) return true;
  }
  return false;
}
function poseMine(o, d, otherT) {
  const h = posePick(o, d); if (!h) return null;
  if (otherT != null && otherT < h.t) return null;
  if (propInPose(o, d, h)) return null;
  const z = RV.zombie && RV.zombie.hoverT(o, d); if (z != null && z < h.t) return null;
  const r = resolveRay(o, d); if (r && r.roomba && r.t < h.t) return null;
  return h.name;
}
if (RV.media) {
  const M = RV.media, orig = { click: M.click, selectStart: M.selectStart, hoverT: M.hoverT };
  M.click = function (o, d) { const n = poseMine(o, d, orig.hoverT(o, d)); if (n) return sitOn(n); return orig.click(o, d); };
  M.selectStart = function (c, o, d) { const n = poseMine(o, d, orig.hoverT(o, d)); if (n) return sitOn(n); return orig.selectStart(c, o, d); };
  M.hoverT = function (o, d) { const a = orig.hoverT(o, d), h = posePick(o, d); return h && (a == null || h.t < a) && !propInPose(o, d, h) ? h.t : a; };
}

function move(dt) {
  let mx = 0, my = 0;
  const xrMove = renderer.xr.isPresenting || !!fakeSession;
  if (xrMove) [mx, my] = readXR();
  else {
    if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1; if (keys.KeyA) mx -= 1; if (keys.KeyD) mx += 1;
    if (keys.ArrowLeft || keys.KeyQ) P.yaw += dt * 1.8; if (keys.ArrowRight || keys.KeyE) P.yaw -= dt * 1.8;
  }
  if (pose) { if (mx || my) { standUp('move'); mx = my = 0; } else poseTick(dt); }
  if (poseHint.m.userData.t > 0) { poseHint.m.userData.t -= dt; poseHint.m.visible = true; poseHint.m.material.opacity = Math.min(1, poseHint.m.userData.t); } else poseHint.m.visible = false;
  camera.getWorldPosition(head); const hx = head.x, hz = head.z;
  if (mx || my) {
    const yaw = xrMove ? Math.atan2(-camera.matrixWorld.elements[8], -camera.matrixWorld.elements[10]) + Math.PI : P.yaw;
    const sp = 1.3 * dt, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let dx = (fx * -my + rx * mx) * sp, dz = (fz * -my + rz * mx) * sp;
    // a step is fine if it lands somewhere free, or (when your real head is already inside a wall/furniture zone, e.g. you
    // flinched back from the zombie in real life) if it doesn't take you any deeper: sliding along or out always works
    const p0 = pen(hx, hz);
    if (!okStep(p0, hx + dx, hz)) dx = 0; if (!okStep(p0, hx + dx, hz + dz)) dz = 0;
    P.x += dx; P.z += dz;
  }
  rig.position.set(P.x, P.y, P.z); rig.rotation.y = P.yaw;
  if (!renderer.xr.isPresenting) { camera.rotation.set(P.pitch, 0, 0, 'YXZ'); camera.position.y = P.eye; }
  rig.updateMatrixWorld(true); camera.getWorldPosition(head);
  // feet + speed for the Roomba
  const pl = R.player; const fxp = head.x, fzp = head.z;
  if (lastFeet) { const vx = (fxp - lastFeet.x) / dt, vz = (fzp - lastFeet.z) / dt; pl.vx = pl.vx * 0.8 + vx * 0.2; pl.vz = pl.vz * 0.8 + vz * 0.2; }
  lastFeet = { x: fxp, z: fzp }; pl.x = fxp; pl.z = fzp; pl.ok = true; pl.speed = Math.hypot(pl.vx, pl.vz);
  pl.still = pl.speed < 0.12 ? pl.still + dt : 0;
  // walking into the Roomba pushes it (and it has feelings about that)
  const dx = R.b.x - fxp, dz = R.b.z - fzp, d = Math.hypot(dx, dz), min = 0.17 + 0.15;
  if (d < min && d > 1e-3) { const k = (min - d); R.pushedBy(dx / d * k, dz / d * k, pl.speed); }
  // hands
  pl.hands = [];
  if (renderer.xr.isPresenting) for (const c of ctrls) if (c.userData.src) { const p = new THREE.Vector3(); c.getWorldPosition(p); pl.hands.push({ x: p.x, y: p.y, z: p.z }); }
}
function reticleTick() {
  if (!renderer.xr.isPresenting) { reticle.visible = false; return; }
  let shown = false;
  for (const c of ctrls) { if (!c.userData.src || c.userData.src.handedness !== 'right') continue; const r = rayFrom(c), hit = resolveRay(r.o, r.d), mt0 = RV.media ? RV.media.hoverT(r.o, r.d) : null, zt = RV.zombie ? RV.zombie.hoverT(r.o, r.d) : null, mt = zt != null && (mt0 == null || zt < mt0) ? zt : mt0; if (mt != null && (!hit || mt < hit.t)) { c.userData.line.scale.z = mt; continue; } if (hit) { reticle.position.set(hit.x, 0.01, hit.z); reticle.material.color.set(hit.roomba ? 0xff7ad6 : 0xffe14a); c.userData.line.scale.z = hit.t; shown = true; } else c.userData.line.scale.z = 3; }
  reticle.visible = shown;
}

// ---------------------------------------------------------- listener follows your head
const _f = new THREE.Vector3(), _u = new THREE.Vector3();
function listenerTick() {
  if (!audio) return; const L = audio.listener, ct = audio.currentTime; camera.getWorldPosition(head);
  _f.set(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(_q)); _u.set(0, 1, 0).applyQuaternion(_q);
  if (L.positionX) { L.positionX.setTargetAtTime(head.x, ct, 0.02); L.positionY.setTargetAtTime(head.y, ct, 0.02); L.positionZ.setTargetAtTime(head.z, ct, 0.02); L.forwardX.setTargetAtTime(_f.x, ct, 0.02); L.forwardY.setTargetAtTime(_f.y, ct, 0.02); L.forwardZ.setTargetAtTime(_f.z, ct, 0.02); L.upX.setTargetAtTime(_u.x, ct, 0.02); L.upY.setTargetAtTime(_u.y, ct, 0.02); L.upZ.setTargetAtTime(_u.z, ct, 0.02); }
  else { L.setPosition(head.x, head.y, head.z); L.setOrientation(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z); }
}

// ---------------------------------------------------------- frame loop
const DTMAX = +(RV.QS.get('dtmax')) || 0.05;
const clock = new THREE.Clock(); let T = 0, fpsAcc = 0, fpsN = 0, fps = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), DTMAX); T += dt;
  move(dt); if (started) voiceTick(dt, T);
  R.update(dt, T);
  RV.lava.uniforms.uT.value = T; RV.tvTick(dt, T); if (RV.media) RV.media.tick(dt, T); if (RV.zombie) RV.zombie.tick(dt, T); reticleTick(); listenerTick();
  RV.lavaLight.intensity = 1.05 + Math.sin(T * 0.7) * 0.12;
  RV.dockLed.material.color.setHex(R.state() === 'dock' ? (Math.sin(T * 2) > 0 ? 0x5ce07a : 0x1a4a26) : 0x3a3a3a);
  renderer.render(scene, camera);
  fpsAcc += dt; fpsN++; if (fpsAcc > 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
}
renderer.setAnimationLoop(frame);

// ---------------------------------------------------------- start screen
function begin() { started = true; ensureAudio(); if (RV.media) RV.media.unlock(); $('intro').classList.add('gone'); $('hud').classList.remove('gone'); }
$('bMic').addEventListener('click', () => { startMic(); });
$('bFlat').addEventListener('click', () => { begin(); });
async function enterVR() {
  ensureAudio();
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    await renderer.xr.setSession(session); if (pose) standUp('vr'); begin(); $('hud').classList.add('gone');
    try { renderer.xr.setFoveation(1); } catch (e) { }
    camera.position.set(0, 0, 0);
    session.addEventListener('end', () => { if (RV.zombie) RV.zombie.releaseAll(); if (pose) standUp('vr end'); camera.position.set(0, 1.6, 0); $('intro').classList.remove('gone'); started = true; });
  } catch (e) { $('vrState').textContent = 'Could not start VR: ' + (e.message || e); }
}
$('bVR').addEventListener('click', enterVR);
if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(ok => { if (ok) { $('bVR').disabled = false; $('vrState').textContent = RV.isHeadset ? '' : 'VR headset found.'; } else $('vrState').textContent = 'No VR here. You can still walk in on screen.'; }).catch(() => { });
else $('vrState').textContent = 'No VR here. You can still walk in on screen.';
document.fonts && document.fonts.load('24px "Press Start 2P"');

// ---------------------------------------------------------- test hooks (used by the automated browser test)
window.__rv = {
  debug: () => Object.assign(R.debug(), { fps: +fps.toFixed(1), errors: errors.slice(), db: +dbNow.toFixed(1), player: { x: +R.player.x.toFixed(2), z: +R.player.z.toFixed(2) } }),
  log: () => R.log.slice(), setPlayer: (x, z, yaw) => { P.x = x; P.z = z; if (yaw != null) P.yaw = yaw; },
  talk: (sec, db) => { fakeVoice.until = T + sec; fakeVoice.db = db == null ? -30 : db; },
  loud: () => { fakeVoice.until = T + 0.25; fakeVoice.db = -6; },
  call: () => R.hear('call'), toss: (x, z) => !!R.toss(x, z), pet: () => R.pet(), go: (s, d) => R.go(s, d), mood: m => Object.assign(R.mood, m),
  begin, time: () => T, pitch: v => { P.pitch = v; },
  project: () => { const v = new THREE.Vector3(R.b.x, 0.08, R.b.z).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, inFront: v.z < 1 }; },
  media: () => RV.media && RV.media._debug, zombie: () => RV.zombie && RV.zombie._debug, media2: () => RV.media,
  projectPt: (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, inFront: v.z < 1 }; },
  faceAt: (x, y, z) => { camera.getWorldPosition(head); const dx = x - head.x, dz = z - head.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(y - head.y, Math.hypot(dx, dz)); },
  fakeXR: sess => { fakeSession = sess || null; }, pen: () => { camera.getWorldPosition(head); return pen(head.x, head.z); }, P: () => ({ x: P.x, z: P.z, yaw: P.yaw }),
  sit: n => sitOn(n), stand: w => standUp(w || 'test'), pose: () => ({ pose: pose && pose.name, t: pose && +pose.t.toFixed(2), lastStand, P: { x: +P.x.toFixed(3), y: +P.y.toFixed(3), z: +P.z.toFixed(3), eye: P.eye, yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(3) }, hint: poseHint.m.visible }), posePick: (o, d) => posePick(new THREE.Vector3(...o), new THREE.Vector3(...d).normalize()),
  faceIt: () => { const dx = R.b.x - P.x, dz = R.b.z - P.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = -Math.atan2(1.5, Math.hypot(dx, dz)); }, info: () => renderer.info.render
};
})();
