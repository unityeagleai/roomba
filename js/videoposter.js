// PARALLEL UNIVERSE ACCESS: Unity's holographic security badge (ID 7X-9A3, SECURITY LEVEL: ALPHA, CLEARANCE: GAMMA) as a poster
// on the right wall beside the beanbag, past the memory mirror. It looks like an ordinary poster: no play button, no icon.
// Click it (or point + trigger in VR) and the badge comes alive: her 10 s video plays right there in the frame, sound coming
// from the poster. When it ends it settles back to the still. Click while it plays to stop it early; click again to replay.
// Starting it pauses a playing episode / lifts the record needle; starting an episode or the record stops it.
// It hooks itself into RV.media (click / selectStart / hoverT / tick / playing), so app.js needs no changes.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene || !RV.media) return;
const scene = RV.scene, camera = RV.camera, RX = RV.room.RX;

// right wall (x = RX), between the memory mirror (frame ends z 1.09, glow ~1.35) and the front corner (z 2.2); beside the beanbag
const AT = { x: RX, y: 1.5, z: 1.78 };
const VW = 784, VH = 1168;                              // the video's own shape; her still (1033x1536) has the same shape to 0.2 %
const IMG_W = 0.5, IMG_H = IMG_W * VH / VW;            // 0.50 x 0.745 m
const HOLO = [0x7ae8ff, 0xff7ad6, 0xb18cff];           // badge-hologram cyan / pink / violet

const root = new THREE.Group(); root.name = 'parallelAccessPoster';
root.position.set(AT.x, AT.y, AT.z); root.rotation.y = -Math.PI / 2;   // local +z into the room, local +x along +z world
scene.add(root);

// slim dark frame standing 1.6 cm off the wall
const FB = 0.022, FD = 0.016;
const frameM = new THREE.MeshPhongMaterial({ color: 0x15121c, shininess: 80, specular: 0x667788, emissive: 0x05040a });
const frame = new THREE.Mesh(new THREE.BoxGeometry(IMG_W + 2 * FB, IMG_H + 2 * FB, FD), frameM);
frame.position.z = 0.002 + FD / 2; root.add(frame);

// a thin holographic edge just inside the frame lip (outside the picture, so it covers none of it)
const edgeC = document.createElement('canvas'); edgeC.width = 8; edgeC.height = 256;
(function () { const g = edgeC.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#7ae8ff'); gr.addColorStop(0.33, '#ff7ad6'); gr.addColorStop(0.66, '#b18cff'); gr.addColorStop(1, '#7ae8ff'); g.fillStyle = gr; g.fillRect(0, 0, 8, 256); })();
const edgeTex = new THREE.CanvasTexture(edgeC); edgeTex.encoding = THREE.sRGBEncoding; edgeTex.wrapT = THREE.RepeatWrapping;
const edgeM = new THREE.MeshBasicMaterial({ map: edgeTex, toneMapped: false, transparent: true, opacity: 0.55 });
const EW = 0.006, FZ = 0.002 + FD + 0.0015;
const edges = new THREE.Group(); root.add(edges);
for (const [w, h, x, y] of [[IMG_W + 2 * EW, EW, 0, IMG_H / 2 + EW / 2], [IMG_W + 2 * EW, EW, 0, -IMG_H / 2 - EW / 2], [EW, IMG_H, IMG_W / 2 + EW / 2, 0], [EW, IMG_H, -IMG_W / 2 - EW / 2, 0]]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), edgeM); m.position.set(x, y, FZ); edges.add(m);
}

// soft holo glow on the wallpaper around it, brighter while the badge is alive (additive, never writes depth)
const GW = IMG_W + 0.3, GH = IMG_H + 0.3;
const gc = document.createElement('canvas'); gc.width = 192; gc.height = Math.round(192 * GH / GW);
(function () {
  const g = gc.getContext('2d'), w = gc.width, h = gc.height, sx = w / GW, sy = h / GH;
  g.translate(w / 2, h / 2); const fw = (IMG_W + 0.05) * sx, fh = (IMG_H + 0.05) * sy;
  for (const [blur, lw, a, col] of [[30, 14, 0.35, 'rgba(122,232,255,1)'], [16, 8, 0.5, 'rgba(255,122,214,1)']]) {
    g.globalAlpha = a; g.shadowColor = col; g.strokeStyle = col; g.shadowBlur = blur; g.lineWidth = lw; g.strokeRect(-fw / 2, -fh / 2, fw, fh);
  }
})();
const glowTex = new THREE.CanvasTexture(gc); glowTex.encoding = THREE.sRGBEncoding;
const glowM = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.18, toneMapped: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const glow = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH), glowM); glow.position.z = 0.007; glow.renderOrder = 3; root.add(glow);

// the picture: her still at rest, the video while it plays (unlit, so it reads like a lit hologram badge)
const imgM = new THREE.MeshBasicMaterial({ color: 0x1a1426, toneMapped: false });
const img = new THREE.Mesh(new THREE.PlaneGeometry(IMG_W, IMG_H), imgM); img.position.z = 0.002 + FD + 0.002; img.name = 'parallel access poster'; root.add(img);
let stillTex = null;
new THREE.TextureLoader().load('assets/img/parallel_access_still.jpg', t => {
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; stillTex = t;
  if (!live) { imgM.map = t; imgM.color.setHex(0xffffff); imgM.needsUpdate = true; }
  api.ready = true;
}, undefined, e => console.warn('parallel access still', e && e.type));

// the video
const video = document.createElement('video');
video.src = 'assets/video/parallel_access.mp4';
video.crossOrigin = 'anonymous'; video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
video.preload = 'auto'; video.loop = false; video.style.display = 'none'; document.body.appendChild(video);
const vtex = new THREE.VideoTexture(video); vtex.encoding = THREE.sRGBEncoding; vtex.minFilter = THREE.LinearFilter; vtex.magFilter = THREE.LinearFilter; vtex.generateMipmaps = false;

// sound from the poster itself
let src = null, gain = null, pan = null;
const PAN_POS = new THREE.Vector3(); img.updateWorldMatrix(true, false); img.getWorldPosition(PAN_POS);
function wireAudio() {
  const A = RV.roomba && RV.roomba.audio && RV.roomba.audio.ctx; if (!A || src) return;
  try {
    src = A.createMediaElementSource(video); gain = A.createGain(); gain.gain.value = 1.0;
    pan = A.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 1.0; pan.rolloffFactor = 0.8; pan.maxDistance = 15;
    if (pan.positionX) { pan.positionX.value = PAN_POS.x; pan.positionY.value = PAN_POS.y; pan.positionZ.value = PAN_POS.z; } else pan.setPosition(PAN_POS.x, PAN_POS.y, PAN_POS.z);
    src.connect(gain); gain.connect(pan); pan.connect(A.destination);
  } catch (e) { console.warn('parallel access audio routing', e); }
}

// state: rest -> starting (play() asked, still showing) -> live (video on the poster) -> rest
let live = false, starting = false, plays = 0, lastStartT = 0;
function showStill() { imgM.map = stillTex; imgM.color.setHex(stillTex ? 0xffffff : 0x1a1426); imgM.needsUpdate = true; }
function showVideo() { imgM.map = vtex; imgM.color.setHex(0xffffff); imgM.needsUpdate = true; }
video.addEventListener('playing', () => { if (!starting && !live) return; starting = false; live = true; showVideo(); });
video.addEventListener('ended', () => stop('ended'));
video.addEventListener('error', () => { console.warn('parallel access video error', video.error && video.error.code); stop('error'); });

function quietOthers() {
  const d = RV.media._debug; if (!d) return;
  try { if (d.playing && d.playing.ep && d.video && !d.video.paused) d.video.pause(); } catch (e) { }
  try { if (d.rp && d.rp.on && d.stopRecord) d.stopRecord('poster'); } catch (e) { }
}
function start() {
  wireAudio(); const A = RV.roomba && RV.roomba.audio && RV.roomba.audio.ctx; if (A && A.state === 'suspended') A.resume();
  quietOthers();
  starting = true; plays++; lastStartT = performance.now();
  try { video.currentTime = 0; } catch (e) { }
  const p = video.play(); if (p && p.catch) p.catch(err => { console.warn('parallel access play', err && err.name); starting = false; live = false; showStill(); });
  if (RV.haptic) RV.haptic(0.35, 40);
}
function stop(why) {
  starting = false; live = false; api.lastStop = why || 'user';
  if (!video.paused) video.pause();
  try { video.currentTime = 0; } catch (e) { }
  showStill();
}
function toggle() { if (live || starting) stop('user'); else start(); return true; }

// picking
const ray = new THREE.Raycaster(); ray.far = 12;
function pick(o, d) { ray.set(o, d); const h = ray.intersectObject(img, false)[0]; return h ? h.distance : null; }

// hook into RV.media: whichever is nearer along the ray wins
const M = RV.media, orig = { click: M.click, selectStart: M.selectStart, hoverT: M.hoverT, tick: M.tick, playing: M.playing };
function mine(o, d) { const t = pick(o, d); if (t == null) return false; const m = orig.hoverT(o, d); return m == null || t < m; }
M.click = function (o, d) { if (mine(o, d)) return toggle(); return orig.click(o, d); };
M.selectStart = function (c, o, d) { if (mine(o, d)) return toggle(); return orig.selectStart(c, o, d); };
M.hoverT = function (o, d) { const a = orig.hoverT(o, d), b = pick(o, d); return b != null && (a == null || b < a) ? b : a; };
M.playing = function () { return orig.playing() || live || starting; };
const base = { a: 0.18, e: 0.55 };
let level = 0;
M.tick = function (dt, T) {
  orig.tick(dt, T);
  if (live || starting) {
    // an episode or the record started after the badge did: the badge steps aside
    const d = M._debug; if (d && ((d.playing && d.playing.ep && d.video && !d.video.paused) || (d.rp && d.rp.on))) stop('other media');
  }
  const on = live ? 1 : 0; level += (on - level) * Math.min(1, dt * (on ? 3 : 1.2));
  glowM.opacity = base.a + level * (0.4 + 0.12 * Math.sin(T * 5.3));
  edgeM.opacity = base.e + level * 0.45; edgeTex.offset.y = (T * (0.05 + level * 0.4)) % 1;
};

const api = RV.vposter = { root, img, video, ready: false, lastStop: null, AT, IMG_W, IMG_H, PAN_POS,
  _debug: { pick, toggle, start, stop, state: () => ({ live, starting, plays, t: video.currentTime, paused: video.paused, ended: video.ended,
    map: imgM.map === vtex ? 'video' : imgM.map === stillTex ? 'still' : 'none', glow: glowM.opacity, audioWired: !!src, lastStop: api.lastStop, w: video.videoWidth, h: video.videoHeight }) } };
})();
