// Input, voice, the VR session and the frame loop. Same controls as Between Signals:
// left stick walks, right stick snap-turns. Trigger: point at the floor to toss a crumb, point at the Roomba to boop it.
// A/X calls it over, B/Y claps. Or just talk to it: it hears you through the mic.
(function () {
const RV = window.RV, R = RV.roomba, { renderer, scene, camera, rig } = RV;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const P = { x: 0.35, z: 1.45, yaw: 0, pitch: -0.32 };
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
    ensureAudio(); if (RV.media) { RV.media.unlock(); const r = rayFrom(c); if (RV.media.selectStart(c, r.o, r.d)) return; }   // cartridges, TV buttons, record player first
    pointAction(c);
  });
  c.addEventListener('selectend', () => { if (RV.media) { const r = rayFrom(c); RV.media.selectEnd(c, r.o, r.d); } });
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
  const s = renderer.xr.getSession(); if (!s) return [0, 0];
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
renderer.domElement.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }; });
addEventListener('pointermove', e => { if (!drag) return; P.yaw -= (e.clientX - drag.x) * 0.005; P.pitch = clamp(P.pitch - (e.clientY - drag.y) * 0.004, -1.3, 1.0); drag.x = e.clientX; drag.y = e.clientY; });
addEventListener('pointerup', e => {
  if (!drag) return; const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy); drag = null;
  if (moved < 6 && started && !renderer.xr.isPresenting) { ensureAudio(); const ray = new THREE.Raycaster(); ray.setFromCamera({ x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }, camera); if (RV.media) { RV.media.unlock(); if (RV.media.click(ray.ray.origin.clone(), ray.ray.direction.clone())) return; } act(resolveRay(ray.ray.origin, ray.ray.direction)); }
});

// ---------------------------------------------------------- movement + collision (Unity's feet vs furniture and the Roomba)
const head = new THREE.Vector3();
let lastFeet = null;
function move(dt) {
  let mx = 0, my = 0;
  if (renderer.xr.isPresenting) [mx, my] = readXR();
  else {
    if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1; if (keys.KeyA) mx -= 1; if (keys.KeyD) mx += 1;
    if (keys.ArrowLeft || keys.KeyQ) P.yaw += dt * 1.8; if (keys.ArrowRight || keys.KeyE) P.yaw -= dt * 1.8;
  }
  camera.getWorldPosition(head); const hx = head.x, hz = head.z;
  if (mx || my) {
    const yaw = renderer.xr.isPresenting ? Math.atan2(-camera.matrixWorld.elements[8], -camera.matrixWorld.elements[10]) + Math.PI : P.yaw;
    const sp = 1.3 * dt, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let dx = (fx * -my + rx * mx) * sp, dz = (fz * -my + rz * mx) * sp;
    if (RV.blocked(hx + dx, hz, PR, 'player')) dx = 0; if (RV.blocked(hx + dx, hz + dz, PR, 'player')) dz = 0;
    P.x += dx; P.z += dz;
  }
  rig.position.set(P.x, 0, P.z); rig.rotation.y = P.yaw;
  if (!renderer.xr.isPresenting) camera.rotation.set(P.pitch, 0, 0, 'YXZ');
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
  for (const c of ctrls) { if (!c.userData.src || c.userData.src.handedness !== 'right') continue; const r = rayFrom(c), hit = resolveRay(r.o, r.d), mt = RV.media ? RV.media.hoverT(r.o, r.d) : null; if (mt != null && (!hit || mt < hit.t)) { c.userData.line.scale.z = mt; continue; } if (hit) { reticle.position.set(hit.x, 0.01, hit.z); reticle.material.color.set(hit.roomba ? 0xff7ad6 : 0xffe14a); c.userData.line.scale.z = hit.t; shown = true; } else c.userData.line.scale.z = 3; }
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
  RV.lava.uniforms.uT.value = T; RV.tvTick(dt, T); if (RV.media) RV.media.tick(dt, T); reticleTick(); listenerTick();
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
    await renderer.xr.setSession(session); begin(); $('hud').classList.add('gone');
    try { renderer.xr.setFoveation(1); } catch (e) { }
    camera.position.set(0, 0, 0);
    session.addEventListener('end', () => { camera.position.set(0, 1.6, 0); $('intro').classList.remove('gone'); started = true; });
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
  media: () => RV.media && RV.media._debug, media2: () => RV.media,
  projectPt: (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, inFront: v.z < 1 }; },
  faceAt: (x, y, z) => { camera.getWorldPosition(head); const dx = x - head.x, dz = z - head.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(y - head.y, Math.hypot(dx, dz)); },
  faceIt: () => { const dx = R.b.x - P.x, dz = R.b.z - P.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = -Math.atan2(1.5, Math.hypot(dx, dz)); }, info: () => renderer.info.render
};
})();
