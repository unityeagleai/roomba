// Unity Eagle's origin story: a digital photo frame standing on the dresser, right of the CRT, next to the bookshelf with
// her 8-bit Unity Eagle figurine and the VHS tapes. At rest it shows a still from the film. Click it (or point + trigger
// in VR) and her 3.5 min origin video plays in the frame (720p, her song), sound coming from the frame. Click again to
// pause, again to carry on; when it ends it settles back to the still. Never autoplays; preload is metadata only, so the
// 48 MB film only streams once she asks for it. Starting it pauses an episode, lifts the record needle and stops the
// keycard poster; any of those starting afterwards pauses the frame.
// Hooks itself into RV.media (click / selectStart / hoverT / tick / playing) like videoposter.js, so app.js needs no changes.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene || !RV.media) return;
const scene = RV.scene;

// dresser top (room.js: x 0..1.5, z -2.2..-1.72, top y 0.72); the CRT ends at x 1.05, the bookshelf starts at x 1.7
const TOP = 0.72;
const AT = { x: 1.285, z: -1.93 };
const YAW = -0.22;                // turned a little toward the middle of the room
const TILT = -0.1;                // leaning back on its stand, like a real photo frame
const IMG_W = 0.34, IMG_H = IMG_W * 9 / 16;       // 16:9, same as the 1280x720 film
const FB = 0.022, FD = 0.018, FOOT = 0.012;       // bezel, frame depth, little feet
const OW = IMG_W + 2 * FB, OH = IMG_H + 2 * FB;

const root = new THREE.Group(); root.name = 'originFrame';
root.position.set(AT.x, TOP, AT.z); root.rotation.y = YAW; scene.add(root);
const tilt = new THREE.Group(); tilt.position.set(0, FOOT, 0); tilt.rotation.x = TILT; root.add(tilt);   // pivots at the bottom front edge

// black glossy bezel (the frame body), standing on two small feet, with a kickstand behind
const bezelM = new THREE.MeshPhongMaterial({ color: 0x141218, shininess: 90, specular: 0x555566, emissive: 0x050408 });
const body = new THREE.Mesh(new THREE.BoxGeometry(OW, OH, FD), bezelM); body.position.set(0, OH / 2, -FD / 2); body.name = 'origin frame bezel'; tilt.add(body);
const footM = new THREE.MeshPhongMaterial({ color: 0x0c0b0e, shininess: 30 });
for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.05, FOOT, 0.03), footM); f.position.set(s * (OW / 2 - 0.05), FOOT / 2 + 0.0005, -0.012); root.add(f); }
// kickstand: from the back of the frame (0.17 m up) down to the dresser top 13 cm behind the feet
(function () {
  const a = new THREE.Vector3(0, 0.17, -FD).applyAxisAngle(new THREE.Vector3(1, 0, 0), TILT).add(new THREE.Vector3(0, FOOT, 0)), b = new THREE.Vector3(0, 0.002, -0.13);
  const len = a.distanceTo(b), st = new THREE.Mesh(new THREE.BoxGeometry(0.045, len, 0.008), footM);
  st.position.copy(a).add(b).multiplyScalar(0.5); st.position.z -= 0.005; st.rotation.x = Math.atan2(a.z - b.z, a.y - b.y); root.add(st);
})();
// a thin brass lip along the bottom bezel (matches the console trims)
const lip = new THREE.Mesh(new THREE.BoxGeometry(OW * 0.4, 0.004, 0.003), new THREE.MeshPhongMaterial({ color: 0xb8913f, shininess: 70, specular: 0x8a6a2a }));
lip.position.set(0, FB * 0.45, 0.0015); tilt.add(lip);
// a tiny power LED: dim amber at rest, green while it plays
const ledM = new THREE.MeshBasicMaterial({ color: 0x5a3a10 });
const led = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.004, 0.002), ledM); led.position.set(OW / 2 - 0.03, FB * 0.45, 0.001); tilt.add(led);

// the screen: still at rest, the video while it plays (unlit, so it reads like a lit display)
const imgM = new THREE.MeshBasicMaterial({ color: 0x14101c, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });   // 3 mm proud of the bezel + offset: no flicker
const img = new THREE.Mesh(new THREE.PlaneGeometry(IMG_W, IMG_H), imgM); img.position.set(0, OH / 2, 0.003); img.name = 'unity eagle origin frame'; tilt.add(img);
let stillTex = null;
new THREE.TextureLoader().load('assets/img/unity_eagle_origin_still.jpg', t => {
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; stillTex = t;
  if (!live && !paused) { imgM.map = t; imgM.color.setHex(0xffffff); imgM.needsUpdate = true; }
  api.ready = true;
}, undefined, e => console.warn('origin frame still', e && e.type));

// soft halo behind the frame, only while it plays (additive, never writes depth)
const gc = document.createElement('canvas'); gc.width = 128; gc.height = 80;
(function () { const g = gc.getContext('2d'), gr = g.createRadialGradient(64, 40, 4, 64, 40, 62); gr.addColorStop(0, 'rgba(150,190,255,0.9)'); gr.addColorStop(1, 'rgba(150,190,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 80); })();
const glowTex = new THREE.CanvasTexture(gc); glowTex.encoding = THREE.sRGBEncoding;
const glowM = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false });
const glow = new THREE.Mesh(new THREE.PlaneGeometry(OW + 0.08, OH + 0.08), glowM); glow.position.set(0, OH / 2 + 0.04, -FD - 0.006); glow.renderOrder = 3; glow.visible = false; tilt.add(glow);   // a halo behind the frame, never over the picture

// the video (never autoplays; only metadata until the first click)
const video = document.createElement('video');
video.src = 'assets/video/unity_eagle_origin.mp4';
video.crossOrigin = 'anonymous'; video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
video.preload = 'metadata'; video.autoplay = false; video.loop = false; video.style.display = 'none'; document.body.appendChild(video);
const vtex = new THREE.VideoTexture(video); vtex.encoding = THREE.sRGBEncoding; vtex.minFilter = THREE.LinearFilter; vtex.magFilter = THREE.LinearFilter; vtex.generateMipmaps = false;

// sound from the frame itself
let src = null, pan = null;
const PAN_POS = new THREE.Vector3(); root.updateWorldMatrix(true, true); img.getWorldPosition(PAN_POS);
function wireAudio() {
  const A = RV.roomba && RV.roomba.audio && RV.roomba.audio.ctx; if (!A || src) return;
  try {
    src = A.createMediaElementSource(video); const gain = A.createGain(); gain.gain.value = 1.0;
    pan = A.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 1.0; pan.rolloffFactor = 0.7; pan.maxDistance = 15;
    if (pan.positionX) { pan.positionX.value = PAN_POS.x; pan.positionY.value = PAN_POS.y; pan.positionZ.value = PAN_POS.z; } else pan.setPosition(PAN_POS.x, PAN_POS.y, PAN_POS.z);
    src.connect(gain); gain.connect(pan); pan.connect(A.destination);
  } catch (e) { console.warn('origin frame audio routing', e); }
}

// rest (still) -> starting -> live (video) <-> paused (video frame held) ; ended -> rest
let live = false, starting = false, paused = false, plays = 0;
function showStill() { imgM.map = stillTex; imgM.color.setHex(stillTex ? 0xffffff : 0x14101c); imgM.needsUpdate = true; }
function showVideo() { imgM.map = vtex; imgM.color.setHex(0xffffff); imgM.needsUpdate = true; }
video.addEventListener('playing', () => { if (!starting && !live) return; starting = false; live = true; paused = false; showVideo(); });
video.addEventListener('ended', () => rest('ended'));
video.addEventListener('error', () => { console.warn('origin frame video error', video.error && video.error.code); rest('error'); });

function quietOthers() {
  const d = RV.media._debug;
  if (d) {
    try { if (d.playing && d.playing.ep && d.video && !d.video.paused) d.video.pause(); } catch (e) { }
    try { if (d.rp && d.rp.on && d.stopRecord) d.stopRecord('origin frame'); } catch (e) { }
  }
  try { const v = RV.vposter && RV.vposter._debug; if (v) { const s = v.state(); if (s.live || s.starting) v.stop('origin frame'); } } catch (e) { }
}
function play() {
  wireAudio(); const A = RV.roomba && RV.roomba.audio && RV.roomba.audio.ctx; if (A && A.state === 'suspended') A.resume();
  quietOthers();
  starting = true; plays++;
  if (!paused) { try { video.currentTime = 0; } catch (e) { } }
  if (video.preload !== 'auto') video.preload = 'auto';
  const p = video.play(); if (p && p.catch) p.catch(err => { console.warn('origin frame play', err && err.name); starting = false; live = false; if (!paused) showStill(); });
  if (RV.haptic) RV.haptic(0.3, 35);
}
function pause(why) {
  starting = false; live = false; paused = true; api.lastStop = why || 'user';
  if (!video.paused) video.pause();
}
function rest(why) {
  starting = false; live = false; paused = false; api.lastStop = why || 'user';
  if (!video.paused) video.pause();
  try { video.currentTime = 0; } catch (e) { }
  showStill();
}
function toggle() { if (live || starting) pause('user'); else play(); return true; }

// picking: the whole frame face (bezel + screen) is the target
const ray = new THREE.Raycaster(); ray.far = 12;
function pick(o, d) { ray.set(o, d); const h = ray.intersectObjects([img, body], false)[0]; return h ? h.distance : null; }

const M = RV.media, orig = { click: M.click, selectStart: M.selectStart, hoverT: M.hoverT, tick: M.tick, playing: M.playing };
function mine(o, d) { const t = pick(o, d); if (t == null) return false; const m = orig.hoverT(o, d); return m == null || t < m; }
M.click = function (o, d) { if (mine(o, d)) return toggle(); return orig.click(o, d); };
M.selectStart = function (c, o, d) { if (mine(o, d)) return toggle(); return orig.selectStart(c, o, d); };
M.hoverT = function (o, d) { const a = orig.hoverT(o, d), b = pick(o, d); return b != null && (a == null || b < a) ? b : a; };
M.playing = function () { return orig.playing() || live || starting; };
let level = 0;
M.tick = function (dt, T) {
  orig.tick(dt, T);
  if (live || starting) {
    // an episode, the record or the keycard poster started after the frame did: the frame pauses
    const d = M._debug, v = RV.vposter && RV.vposter._debug && RV.vposter._debug.state();
    if ((d && ((d.playing && d.playing.ep && d.video && !d.video.paused) || (d.rp && d.rp.on))) || (v && (v.live || v.starting))) pause('other media');
  }
  const on = live ? 1 : 0; level += (on - level) * Math.min(1, dt * (on ? 3 : 1.2));
  glow.visible = level > 0.01; glowM.opacity = level * 0.22;
  ledM.color.setHex(live ? 0x3cff78 : 0x5a3a10);
};

const api = RV.originFrame = { root, img, body, glow, video, ready: false, lastStop: null, AT, TOP, IMG_W, IMG_H, OW, OH, PAN_POS,
  _debug: { pick, toggle, play, pause, rest, state: () => ({ live, starting, paused, plays, t: video.currentTime, dur: video.duration, videoPaused: video.paused, ended: video.ended,
    preload: video.preload, autoplay: video.autoplay, map: imgM.map === vtex ? 'video' : imgM.map === stillTex ? 'still' : 'none', audioWired: !!src, lastStop: api.lastStop, w: video.videoWidth, h: video.videoHeight }) } };
})();
