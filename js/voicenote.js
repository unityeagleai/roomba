// Unity's voice note to self ('when a memory became a place', 2:50): her own Vocial recording, a screen capture of the
// post with her voice telling what this bedroom is. It hangs on the left wall above the cartridge shelf, near the door
// corner, in a chunky beige 80s screen with a little label plate. At rest it shows a still of the post with a play button.
// Click it (or point + trigger in VR) and it plays right there, sound coming from the screen. Click again to pause, again
// to carry on; at the end it settles back to the still. Never autoplays; preload is metadata only.
// Starting it pauses an episode, lifts the record needle, stops the keycard poster and pauses the origin frame; any of
// those starting afterwards pauses it.
// Under it, taped to the wall: an index card 'WANNA HEAR ME? TALK TO ME ON VOCIAL vocial.app/@unityeagle'. Click the
// card and her Vocial page opens in a new tab. In VR the headset leaves VR first (a web page can't open inside VR) and a
// card on the screen keeps the link, in case the browser blocked the new tab.
// The screen bezel, label and card have grey self-light, so the light switch dims them like the photos; the picture
// itself is a lit screen (like the origin frame) and stays readable in the dark.
// Hooks itself into RV.media (click / selectStart / hoverT / tick / playing) like originframe.js, so app.js needs no changes.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene || !RV.media) return;
const scene = RV.scene, renderer = RV.renderer, RX = RV.room.RX, PIX = (RV.util && RV.util.PIX) || '"Press Start 2P", monospace';
const LINK = 'https://vocial.app/@unityeagle', LINK_TXT = 'vocial.app/@unityeagle';

// left wall (x = -RX), above the cartridge shelf (z 0.84..1.76, cartridges up to y 1.04), past the photo wall (ends z 0.76)
// and before the door corner (z 2.2). Nothing else hangs on this stretch.
const AT = { z: 1.42, y: 1.70 };                 // centre of the picture
const IMG_W = 0.44, IMG_H = IMG_W * 3 / 4;       // 4:3, same as the 960x720 video
const FB = 0.026, FBB = 0.05, FD = 0.034;        // side/top bezel, bottom bezel (label plate), depth
const OW = IMG_W + 2 * FB, OH = IMG_H + FB + FBB;
const CARD = { w: 0.30, h: 0.19, y: 1.32, z: AT.z + 0.01, rot: -0.025 };

const root = new THREE.Group(); root.name = 'voiceNote';
root.position.set(-RX, 0, 0); root.rotation.y = Math.PI / 2;    // local +z into the room, local +x = world -z (reads left to right)
scene.add(root);
const lz = z => -z;                                                // world z -> local x

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function ctex(c) { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = (renderer && renderer.capabilities.getMaxAnisotropy()) || 4; return t; }

// ---- the screen: beige 80s plastic bezel, a little speaker grille and a label plate on the bottom bezel
const scr = new THREE.Group(); scr.name = 'voiceNoteScreen'; scr.position.set(lz(AT.z), AT.y, 0); root.add(scr);
const bezelM = new THREE.MeshPhongMaterial({ color: 0xd8cdb2, emissive: 0x161616, shininess: 25, specular: 0x222222 });
const body = new THREE.Mesh(new THREE.BoxGeometry(OW, OH, FD), bezelM);
body.position.set(0, (FBB - FB) / -2, 0.002 + FD / 2); body.name = 'voice note bezel'; scr.add(body);
// dark inner lip round the picture
const lipM = new THREE.MeshPhongMaterial({ color: 0x2a2620, emissive: 0x080808, shininess: 10 });
const lip = new THREE.Mesh(new THREE.BoxGeometry(IMG_W + 0.012, IMG_H + 0.012, 0.004), lipM); lip.position.set(0, 0, 0.002 + FD + 0.001); scr.add(lip);
// label plate on the bottom bezel: 'VOICE NOTE TO SELF', and a power LED
const lc = canvas(512, 64);
function drawLabel() {
  const x = lc.getContext('2d'); x.fillStyle = '#2a2232'; x.fillRect(0, 0, 512, 64); x.strokeStyle = '#b8913f'; x.lineWidth = 4; x.strokeRect(2, 2, 508, 60);
  x.fillStyle = '#ffe14a'; x.font = '20px ' + PIX; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('VOICE NOTE TO SELF', 256, 34); labelT.needsUpdate = true;
}
const labelT = ctex(lc);
const labelM = new THREE.MeshPhongMaterial({ map: labelT, emissiveMap: labelT, emissive: 0x3a3a3a, shininess: 30, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
const label = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.03), labelM);
label.position.set(-0.03, -IMG_H / 2 - FBB / 2 - 0.002, 0.002 + FD + 0.0008); label.name = 'voice note label'; scr.add(label);
const grilleM = new THREE.MeshPhongMaterial({ color: 0x6d6450, emissive: 0x0c0c0c, shininess: 5 });
for (let i = 0; i < 5; i++) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.022, 0.002), grilleM); g.position.set(OW / 2 - 0.075 + i * 0.008, label.position.y, 0.002 + FD + 0.0008); scr.add(g); }
const ledM = new THREE.MeshBasicMaterial({ color: 0x5a3a10 });
const led = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.005, 0.002), ledM); led.position.set(OW / 2 - 0.02, label.position.y, 0.002 + FD + 0.0008); scr.add(led);

// the picture: the still at rest, the video while it plays (unlit, so it reads like a lit display)
const imgM = new THREE.MeshBasicMaterial({ color: 0x14101c, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
const img = new THREE.Mesh(new THREE.PlaneGeometry(IMG_W, IMG_H), imgM); img.position.set(0, 0, 0.002 + FD + 0.0035); img.name = 'unity voice note screen'; scr.add(img);
// play button over the still (hidden while it plays)
const pc = canvas(128, 128);
(function () { const x = pc.getContext('2d'); x.fillStyle = 'rgba(16,8,32,0.72)'; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#ffe14a'; x.lineWidth = 6; x.stroke();
  x.fillStyle = '#ffe14a'; x.beginPath(); x.moveTo(50, 38); x.lineTo(50, 90); x.lineTo(94, 64); x.closePath(); x.fill(); })();
const playM = new THREE.MeshBasicMaterial({ map: ctex(pc), transparent: true, depthWrite: false, toneMapped: false });
const playIcon = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.085), playM); playIcon.position.set(0, 0, img.position.z + 0.002); playIcon.renderOrder = 3; playIcon.name = 'voice note play'; scr.add(playIcon);
let stillTex = null;
new THREE.TextureLoader().load('assets/img/unity_voice_note_still.jpg', t => {
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; stillTex = t;
  if (!live && !paused) { imgM.map = t; imgM.color.setHex(0xffffff); imgM.needsUpdate = true; }
  api.ready = true;
}, undefined, e => console.warn('voice note still', e && e.type));

// ---- the index card under it, taped to the wall, with the Vocial link
const cc = canvas(960, 608);
function drawCard() {
  const x = cc.getContext('2d'), W = cc.width, H = cc.height;
  x.fillStyle = '#fbf7ea'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(80,120,200,0.35)'; x.lineWidth = 2; for (let y = 150; y < H; y += 62) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  x.strokeStyle = 'rgba(220,60,70,0.6)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 104); x.lineTo(W, 104); x.stroke();
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#100820'; x.font = '44px ' + PIX; x.fillText('WANNA HEAR ME?', W / 2, 62);
  x.fillStyle = '#5a1f8a'; x.font = '30px ' + PIX; x.fillText('TALK TO ME ON VOCIAL', W / 2, 192);
  x.fillStyle = '#1d4fd8'; x.font = '38px ' + PIX; x.fillText(LINK_TXT, W / 2, 320);
  const tw = x.measureText(LINK_TXT).width; x.fillRect(W / 2 - tw / 2, 348, tw, 4);
  x.fillStyle = '#c0306a'; x.font = '26px ' + PIX; x.fillText('\u25b6 CLICK ME', W / 2, 446);
  x.fillStyle = '#100820'; x.font = '30px ' + PIX; x.textAlign = 'right'; x.fillText('- UNITY', W - 48, 548);
  cardT.needsUpdate = true;
}
const cardT = ctex(cc);
const cardM = new THREE.MeshPhongMaterial({ map: cardT, emissiveMap: cardT, emissive: 0x4a4a4a, shininess: 20, specular: 0x111111, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
const card = new THREE.Mesh(new THREE.PlaneGeometry(CARD.w, CARD.h), cardM);
card.position.set(lz(CARD.z), CARD.y, 0.004); card.rotation.z = CARD.rot; card.name = 'vocial link card'; root.add(card);
// a soft shadow behind the card, and tape on the two top corners
const shM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
const sh = new THREE.Mesh(new THREE.PlaneGeometry(CARD.w + 0.012, CARD.h + 0.012), shM); sh.position.set(0.004, -0.005, -0.0015); card.add(sh);
const tapeM = new THREE.MeshPhongMaterial({ color: 0xece6c8, emissive: 0x202020, transparent: true, opacity: 0.8, depthWrite: false });
for (const [sx, r] of [[-1, 0.4], [1, -0.35]]) { const tp = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.024), tapeM); tp.position.set(sx * (CARD.w / 2 - 0.015), CARD.h / 2 - 0.006, 0.0015); tp.rotation.z = r; tp.renderOrder = 3; card.add(tp); }
// generous invisible click target for the card (easy to hit with the Quest ray)
const cardHit = new THREE.Mesh(new THREE.BoxGeometry(CARD.w + 0.04, CARD.h + 0.04, 0.03), new THREE.MeshBasicMaterial({ visible: false }));
cardHit.position.set(lz(CARD.z), CARD.y, 0.016); cardHit.name = 'vocial link card hit'; root.add(cardHit);

function redraw() { drawLabel(); drawCard(); }
redraw();
if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('44px "Press Start 2P"'), document.fonts.load('20px "Press Start 2P"')]).then(redraw).catch(() => { });

// ---- the video (never autoplays; only metadata until the first click)
const video = document.createElement('video');
video.src = 'assets/video/unity_voice_note.mp4';
video.crossOrigin = 'anonymous'; video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
video.preload = 'metadata'; video.autoplay = false; video.loop = false; video.style.display = 'none'; document.body.appendChild(video);
const vtex = new THREE.VideoTexture(video); vtex.encoding = THREE.sRGBEncoding; vtex.minFilter = THREE.LinearFilter; vtex.magFilter = THREE.LinearFilter; vtex.generateMipmaps = false;

// sound from the screen itself
let src = null, pan = null;
const PAN_POS = new THREE.Vector3(); root.updateWorldMatrix(true, true); img.getWorldPosition(PAN_POS);
function wireAudio() {
  const A = RV.roomba && RV.roomba.audio && RV.roomba.audio.ctx; if (!A || src) return;
  try {
    src = A.createMediaElementSource(video); const gain = A.createGain(); gain.gain.value = 1.15;
    pan = A.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 1.0; pan.rolloffFactor = 0.7; pan.maxDistance = 15;
    if (pan.positionX) { pan.positionX.value = PAN_POS.x; pan.positionY.value = PAN_POS.y; pan.positionZ.value = PAN_POS.z; } else pan.setPosition(PAN_POS.x, PAN_POS.y, PAN_POS.z);
    src.connect(gain); gain.connect(pan); pan.connect(A.destination);
  } catch (e) { console.warn('voice note audio routing', e); }
}

// rest (still) -> starting -> live (video) <-> paused (video frame held) ; ended -> rest
let live = false, starting = false, paused = false, plays = 0, opens = 0;
function showStill() { imgM.map = stillTex; imgM.color.setHex(stillTex ? 0xffffff : 0x14101c); imgM.needsUpdate = true; playIcon.visible = true; }
function showVideo() { imgM.map = vtex; imgM.color.setHex(0xffffff); imgM.needsUpdate = true; playIcon.visible = false; }
video.addEventListener('playing', () => { if (!starting && !live) return; starting = false; live = true; paused = false; showVideo(); });
video.addEventListener('ended', () => rest('ended'));
video.addEventListener('error', () => { console.warn('voice note video error', video.error && video.error.code); rest('error'); });

function quietOthers() {
  const d = RV.media._debug;
  if (d) {
    try { if (d.playing && d.playing.ep && d.video && !d.video.paused) d.video.pause(); } catch (e) { }
    try { if (d.rp && d.rp.on && d.stopRecord) d.stopRecord('voice note'); } catch (e) { }
  }
  try { const v = RV.vposter && RV.vposter._debug; if (v) { const s = v.state(); if (s.live || s.starting) v.stop('voice note'); } } catch (e) { }
  try { const o = RV.originFrame && RV.originFrame._debug; if (o) { const s = o.state(); if (s.live || s.starting) o.pause('voice note'); } } catch (e) { }
}
function othersPlaying() {
  const d = RV.media._debug, v = RV.vposter && RV.vposter._debug && RV.vposter._debug.state(), o = RV.originFrame && RV.originFrame._debug && RV.originFrame._debug.state();
  return !!((d && ((d.playing && d.playing.ep && d.video && !d.video.paused) || (d.rp && d.rp.on))) || (v && (v.live || v.starting)) || (o && (o.live || o.starting)));
}
function play() {
  wireAudio(); const A = RV.roomba && RV.roomba.audio && RV.roomba.audio.ctx; if (A && A.state === 'suspended') A.resume();
  quietOthers();
  starting = true; plays++; playIcon.visible = false;
  if (!paused) { try { video.currentTime = 0; } catch (e) { } }
  if (video.preload !== 'auto') video.preload = 'auto';
  const p = video.play(); if (p && p.catch) p.catch(err => { console.warn('voice note play', err && err.name); starting = false; live = false; if (!paused) showStill(); else playIcon.visible = true; });
  if (RV.haptic) RV.haptic(0.3, 35);
  return true;
}
function pause(why) {
  starting = false; live = false; paused = true; api.lastStop = why || 'user'; playIcon.visible = true;
  if (!video.paused) video.pause();
}
function rest(why) {
  starting = false; live = false; paused = false; api.lastStop = why || 'user';
  if (!video.paused) video.pause();
  try { video.currentTime = 0; } catch (e) { }
  showStill();
}
function toggle() { if (live || starting) pause('user'); else play(); return true; }

// ---- the Vocial link: a new tab. In VR, leave VR first and keep a card with the link on the screen.
let overlay = null;
function showOverlay(opened) {
  if (!overlay) {
    overlay = document.createElement('div'); overlay.id = 'vocialCard';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;background:rgba(6,4,12,.82)';
    overlay.innerHTML = '<div class="card" style="max-width:520px"><h1>TALK TO UNITY</h1>' +
      '<p id="vocialMsg"></p>' +
      '<div class="btns"><a id="vocialGo" href="' + LINK + '" target="_blank" rel="noopener" style="text-decoration:none"><button id="vocialBtn" style="background:#3ff0e0">OPEN ' + LINK_TXT.toUpperCase() + '</button></a>' +
      '<button id="vocialBack">BACK TO THE ROOM</button></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#vocialBack').addEventListener('click', () => { overlay.style.display = 'none'; });
    overlay.querySelector('#vocialGo').addEventListener('click', () => { api.overlayOpens++; });
  }
  overlay.querySelector('#vocialMsg').textContent = opened
    ? 'Unity\'s Vocial page opened in a new tab: hear Unity\'s voice notes and talk back. If it didn\'t open, tap the button.'
    : 'Hear Unity\'s voice notes and talk back on Vocial. Tap the button to open it in a new tab.';
  overlay.style.display = 'flex';
}
function openLink(how) {
  opens++; api.lastOpen = how;
  if (live || starting) pause('opened vocial');
  let w = null;
  try { w = window.open(LINK, '_blank'); if (w) { try { w.opener = null; } catch (e) { } } } catch (e) { w = null; }
  api.lastOpenOk = !!w;
  const s = renderer.xr.getSession && renderer.xr.getSession();
  if (s) { try { s.end().catch(() => { }); } catch (e) { } }
  if (s || !w) showOverlay(!!w);
  if (RV.haptic) RV.haptic(0.3, 35);
  return true;
}

// ---- picking: the screen (bezel + picture) plays, the card opens the link
const ray = new THREE.Raycaster(); ray.far = 12;
const screenTargets = [img, body, label], cardTargets = [cardHit];
function pickScreen(o, d) { ray.set(o, d); const h = ray.intersectObjects(screenTargets, false)[0]; return h ? h.distance : null; }
function pickCard(o, d) { ray.set(o, d); const h = ray.intersectObjects(cardTargets, false)[0]; return h ? h.distance : null; }
function pick(o, d) { const a = pickScreen(o, d), b = pickCard(o, d); return a == null ? b : b == null ? a : Math.min(a, b); }

const M = RV.media, orig = { click: M.click, selectStart: M.selectStart, hoverT: M.hoverT, tick: M.tick, playing: M.playing };
// which of mine is hit first, if it is nearer than everything else the media layer knows
function mine(o, d) {
  const a = pickScreen(o, d), b = pickCard(o, d); if (a == null && b == null) return null;
  const t = a == null ? b : b == null ? a : Math.min(a, b), m = orig.hoverT(o, d);
  if (m != null && m < t) return null;
  return (b != null && (a == null || b <= a)) ? 'card' : 'screen';
}
function act(which, how) { return which === 'card' ? openLink(how) : toggle(); }
M.click = function (o, d) { const w = mine(o, d); if (w) return act(w, 'click'); return orig.click(o, d); };
M.selectStart = function (c, o, d) { const w = mine(o, d); if (w) return act(w, 'vr'); return orig.selectStart(c, o, d); };
M.hoverT = function (o, d) { const a = orig.hoverT(o, d), b = pick(o, d); return b != null && (a == null || b < a) ? b : a; };
M.playing = function () { return orig.playing() || live || starting; };
M.tick = function (dt, T) {
  orig.tick(dt, T);
  if ((live || starting) && othersPlaying()) pause('other media');
  ledM.color.setHex(live ? 0x3cff78 : 0x5a3a10);
};

const api = RV.voiceNote = { root, scr, img, body, card, cardHit, playIcon, video, ready: false, lastStop: null, lastOpen: null, lastOpenOk: null, overlayOpens: 0,
  AT, CARD, IMG_W, IMG_H, OW, OH, LINK, PAN_POS,
  _debug: { pick, pickScreen, pickCard, toggle, play, pause, rest, openLink, showOverlay, overlay: () => overlay, mats: { bezelM, labelM, cardM },
    state: () => ({ live, starting, paused, plays, opens, t: video.currentTime, dur: video.duration, videoPaused: video.paused, ended: video.ended, preload: video.preload, autoplay: video.autoplay,
      map: imgM.map === vtex ? 'video' : imgM.map === stillTex ? 'still' : 'none', playIcon: playIcon.visible, audioWired: !!src, lastStop: api.lastStop, w: video.videoWidth, h: video.videoHeight }) } };
})();
