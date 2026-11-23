// The message board: an 80s cork board on the left wall, between Unity's UNITY EAGLE poster (ends z -1.27) and the photo
// wall over the bed (starts z -0.37), above the nightstand and the lava lamp. Pinned sticky notes, one colour per author:
// Unity = gold (with a little eagle stamp), Miles = blue, Charlie = green, pink = visitors (later; GitHub Pages can't store
// what visitors type, so nothing in the room writes notes).
// The notes come from notes.json in the repo root, so a new note needs no code:
//   [ { "author": "miles", "text": "...", "date": "2026-11-24", "audio": "assets/audio/notes/miles_hello.mp3" }, ... ]
// author: unity | miles | charlie | visitor. date: YYYY-MM-DD (newest goes top left). audio is optional.
// Nine notes fit (3 x 3, newest first); older ones stay in the file but leave the board. If Unity or Miles has no note yet
// and there is room, a faded 'your note here' in their colour keeps their spot.
// Click a note (or point + trigger in VR) and it reads itself aloud from the board: pre-recorded files only, no live
// speech. Click it again to stop. A note without audio just wiggles. Starting a note pauses the other room media;
// any of those starting stops the note.
// Hooks itself into RV.media (click / selectStart / hoverT / tick / playing) like videoposter.js, so app.js needs no changes.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene || !RV.media) return;
const scene = RV.scene, RX = RV.room.RX;

const AT = { x: -RX, y: 1.53, z: -0.82 };
const W = 0.76, H = 0.70, FB = 0.035, FD = 0.03;
const NS = 0.19, STEP = 0.21, COLS = 3, ROWS = 3, MAX = COLS * ROWS;
const COLORS = {
  unity:   { paper: '#f6cd52', edge: '#d9a92c', ink: '#3a2608', name: 'Unity' },
  miles:   { paper: '#8cc9ff', edge: '#5a9ee0', ink: '#10233f', name: 'Miles' },
  charlie: { paper: '#9fe592', edge: '#6cbf60', ink: '#123214', name: 'Charlie' },
  visitor: { paper: '#ffa3d8', edge: '#e070b0', ink: '#3a1030', name: 'Visitor' },
};
const HAND = '"Kalam", "Comic Sans MS", "Marker Felt", sans-serif', PIX = '"Press Start 2P", monospace';

const root = new THREE.Group(); root.name = 'messageBoard';
root.position.set(AT.x + 0.002, AT.y, AT.z); root.rotation.y = Math.PI / 2;
scene.add(root);

// ------------------------------------------------------------ the board: pine frame + cork
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tx(c) { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
const corkC = cv(512, 472);
(function () {
  const g = corkC.getContext('2d'), w = corkC.width, h = corkC.height; let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#b8864f'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(110,68,30,${0.15 + r() * 0.3})` : `rgba(232,190,130,${0.1 + r() * 0.25})`; const d = 1 + r() * 3; g.fillRect(r() * w, r() * h, d, d * (0.6 + r())); }
  for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(40,22,8,0.55)'; g.beginPath(); g.arc(r() * w, r() * h, 1.6, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(240,205,150,0.12)'; g.fillRect(300, 60, 140, 110);
  const v = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,5,0.35)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
})();
const corkM = new THREE.MeshPhongMaterial({ map: tx(corkC), shininess: 4, specular: 0x111111, emissive: 0x1c1c1c });
const cork = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * FB + 0.004, H - 2 * FB + 0.004, 0.012), corkM); cork.position.z = 0.006; cork.name = 'message board cork'; root.add(cork);
const woodM = new THREE.MeshPhongMaterial({ color: 0xc89058, shininess: 30, specular: 0x332211, emissive: 0x141414 });
const frame = new THREE.Group(); frame.name = 'message board frame'; root.add(frame);
for (const [w, h, x, y] of [[W, FB, 0, H / 2 - FB / 2], [W, FB, 0, -H / 2 + FB / 2], [FB, H - 2 * FB, -W / 2 + FB / 2, 0], [FB, H - 2 * FB, W / 2 - FB / 2, 0]]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, FD), woodM); m.position.set(x, y, FD / 2); frame.add(m);
}
const plateC = cv(256, 48);
const plateT = tx(plateC);
function drawPlate() { const g = plateC.getContext('2d'); g.clearRect(0, 0, 256, 48); const gr = g.createLinearGradient(0, 0, 0, 48); gr.addColorStop(0, '#f3dc8c'); gr.addColorStop(1, '#b08a36'); g.fillStyle = gr; g.fillRect(0, 0, 256, 48);
  g.strokeStyle = '#7a5a1c'; g.lineWidth = 3; g.strokeRect(2, 2, 252, 44); g.fillStyle = '#4a3410'; g.font = '16px ' + PIX; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MESSAGES', 128, 26); plateT.needsUpdate = true; }
const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.03), new THREE.MeshPhongMaterial({ map: plateT, shininess: 80, specular: 0x886622, emissive: 0x1c1c1c }));
plate.position.set(0, -H / 2 + FB / 2, FD + 0.001); root.add(plate);
// ------------------------------------------------------------ notes
let s0 = 11; const rnd = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647;
const PIN_COLORS = [0xe8323c, 0xf2f2f2, 0xffd23c, 0x2f7de0, 0xe8323c];
const pinGeo = { head: new THREE.CylinderGeometry(0.009, 0.011, 0.012, 14), cap: new THREE.SphereGeometry(0.008, 12, 8), neck: new THREE.CylinderGeometry(0.004, 0.006, 0.01, 10) };
const noteGeo = new THREE.PlaneGeometry(NS, NS), hitGeo = new THREE.BoxGeometry(NS + 0.012, NS + 0.012, 0.03);
const hitM = new THREE.MeshBasicMaterial({ visible: false });
const notesG = new THREE.Group(); notesG.name = 'message board notes'; root.add(notesG);
let notes = [], slots = [];

function fmtDate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); if (!m) return '';
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + ' ' + (+m[3]);
}
function wrap(g, text, maxW) {
  const out = []; for (const para of String(text).split(/\n/)) { let line = ''; for (const w of para.split(/\s+/).filter(Boolean)) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } out.push(line); } return out;
}
function eagleStamp(g, x, y, r) {
  g.save(); g.translate(x, y); g.rotate(-0.22); g.globalAlpha = 0.82; g.strokeStyle = g.fillStyle = '#8a2f12';
  g.lineWidth = r * 0.09; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); g.lineWidth = r * 0.04; g.beginPath(); g.arc(0, 0, r * 0.84, 0, 7); g.stroke();
  const k = r / 50; g.beginPath();
  g.moveTo(0, -4 * k); g.bezierCurveTo(-14 * k, -22 * k, -30 * k, -20 * k, -40 * k, -26 * k); g.lineTo(-34 * k, -16 * k); g.lineTo(-38 * k, -12 * k); g.lineTo(-30 * k, -6 * k); g.lineTo(-32 * k, 0); g.bezierCurveTo(-20 * k, 0, -12 * k, 4 * k, -6 * k, 8 * k);
  g.lineTo(-8 * k, 26 * k); g.lineTo(0, 22 * k); g.lineTo(8 * k, 26 * k); g.lineTo(6 * k, 8 * k);
  g.bezierCurveTo(12 * k, 4 * k, 20 * k, 0, 32 * k, 0); g.lineTo(30 * k, -6 * k); g.lineTo(38 * k, -12 * k); g.lineTo(34 * k, -16 * k); g.lineTo(40 * k, -26 * k); g.bezierCurveTo(30 * k, -20 * k, 14 * k, -22 * k, 0, -4 * k);
  g.fill();
  g.beginPath(); g.arc(0, -12 * k, 6.5 * k, 0, 7); g.fill(); g.beginPath(); g.moveTo(5 * k, -13 * k); g.lineTo(12 * k, -10 * k); g.lineTo(5 * k, -8 * k); g.fill();
  g.font = `bold ${Math.round(11 * k)}px ${PIX}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('UNITY', 0, 38 * k);
  g.restore();
}
function speaker(g, x, y, s, col) {
  g.save(); g.translate(x, y); g.fillStyle = col; g.strokeStyle = col; g.globalAlpha = 0.75; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-s, -s * 0.35); g.lineTo(-s * 0.45, -s * 0.35); g.lineTo(0, -s * 0.8); g.lineTo(0, s * 0.8); g.lineTo(-s * 0.45, s * 0.35); g.lineTo(-s, s * 0.35); g.closePath(); g.fill();
  g.lineWidth = s * 0.16; for (const rr of [0.45, 0.85]) { g.beginPath(); g.arc(0, 0, s * rr, -0.9, 0.9); g.stroke(); }
  g.restore();
}
function drawNote(c, n) {
  const g = c.getContext('2d'), S = c.width, C = COLORS[n.author] || COLORS.visitor, ph = !!n.placeholder;
  g.clearRect(0, 0, S, S);
  const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, C.paper); gr.addColorStop(1, C.edge); g.globalAlpha = ph ? 0.5 : 1; g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 0, S, S * 0.13); g.globalAlpha = 1;
  if (ph) {
    g.setLineDash([18, 12]); g.strokeStyle = C.ink; g.globalAlpha = 0.35; g.lineWidth = 5; g.strokeRect(22, 22, S - 44, S - 44); g.setLineDash([]);
    g.fillStyle = C.ink; g.globalAlpha = 0.55; g.font = `60px ${HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(C.name + "'s", S / 2, S * 0.38); g.fillText('note here', S / 2, S * 0.52); g.globalAlpha = 1;
    if (n.author === 'unity') eagleStamp(g, S * 0.76, S * 0.78, S * 0.12);
    return;
  }
  const pad = 34, top = 62, footY = S - 44, maxH = footY - 40 - top, maxW = S - 2 * pad;
  let fs = 64, lines; g.textBaseline = 'alphabetic';
  for (; fs >= 26; fs -= 2) { g.font = `${fs}px ${HAND}`; lines = wrap(g, n.text, maxW); if (lines.length * fs * 1.08 <= maxH) break; }
  const lh = fs * 1.08, used = lines.length * lh, y0 = top + Math.max(0, (maxH - used) / 2) + fs * 0.85;
  g.fillStyle = C.ink; g.textAlign = 'left';
  lines.forEach((l, i) => g.fillText(l, pad, y0 + i * lh));
  g.font = `34px ${HAND}`; g.globalAlpha = 0.8; g.fillText('- ' + C.name + (n.date ? ', ' + fmtDate(n.date) : ''), pad, footY); g.globalAlpha = 1;
  if (n.audio) speaker(g, S - 52, 42, 22, C.ink);
  if (n.author === 'unity') eagleStamp(g, S - 70, S - 74, 46);
}

function clearSlots() {
  for (const s of slots) { notesG.remove(s.g); s.tex.dispose(); s.mesh.material.dispose(); s.pin.traverse(o => { if (o.material) o.material.dispose(); }); }
  slots = [];
}
function sortNotes(arr) {
  return arr.map((n, i) => ({ n, i })).sort((a, b) => (String(b.n.date || '')).localeCompare(String(a.n.date || '')) || b.i - a.i).map(o => o.n);
}
function layout() {
  clearSlots(); s0 = 11;
  const real = sortNotes(notes.filter(n => n && n.text && COLORS[String(n.author || '').toLowerCase()]).map(n => Object.assign({}, n, { author: String(n.author).toLowerCase() })));
  const shown = real.slice(0, MAX);
  for (const a of ['unity', 'miles']) if (shown.length < MAX && !shown.some(n => n.author === a)) shown.push({ author: a, placeholder: true });
  shown.forEach((n, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const g = new THREE.Group(); g.position.set((col - 1) * STEP + (rnd() - 0.5) * 0.008, (1 - row) * STEP + (rnd() - 0.5) * 0.008, 0.0125 + 0.0006 * i);
    g.rotation.z = (rnd() - 0.5) * 0.12; notesG.add(g);
    const c = cv(512, 512); drawNote(c, n); const t = tx(c);
    const m = new THREE.Mesh(noteGeo, new THREE.MeshPhongMaterial({ map: t, shininess: 6, specular: 0x111111, emissive: 0x222222, transparent: !!n.placeholder, alphaTest: 0.01 }));
    m.name = 'message note ' + (n.placeholder ? n.author + ' placeholder' : n.author); g.add(m);
    const hit = new THREE.Mesh(hitGeo, hitM); hit.position.z = 0.012; hit.userData.slot = i; hit.name = 'message note hit'; g.add(hit);
    const pin = new THREE.Group(); pin.position.set((rnd() - 0.5) * 0.02, NS / 2 - 0.018, 0); g.add(pin);
    const pm = new THREE.MeshPhongMaterial({ color: PIN_COLORS[i % PIN_COLORS.length], shininess: 90, specular: 0x666666 });
    const neck = new THREE.Mesh(pinGeo.neck, pm); neck.rotation.x = Math.PI / 2; neck.position.z = 0.005; pin.add(neck);
    const head = new THREE.Mesh(pinGeo.head, pm); head.rotation.x = Math.PI / 2; head.position.z = 0.014; pin.add(head);
    const cap = new THREE.Mesh(pinGeo.cap, pm); cap.scale.z = 0.55; cap.position.z = 0.021; pin.add(cap);
    slots.push({ n, g, mesh: m, hit, pin, tex: t, canvas: c, base: g.position.clone(), rot: g.rotation.z, wig: 0, lift: 0 });
  });
  api.shown = slots.map(s => s.n.placeholder ? s.n.author + ':placeholder' : s.n.author);
}
function redraw() { for (const s of slots) { drawNote(s.canvas, s.n); s.tex.needsUpdate = true; } drawPlate(); }

let fontReady = false;
try {
  const ff = new FontFace('Kalam', 'url(assets/fonts/Kalam-Bold.ttf)'); document.fonts.add(ff);
  ff.load().then(() => { fontReady = true; redraw(); }, e => console.warn('board font', e));
  document.fonts.load('16px "Press Start 2P"').then(drawPlate, () => { });
} catch (e) { }
drawPlate();
function load() {
  return fetch('notes.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(j => { notes = Array.isArray(j) ? j : (j && Array.isArray(j.notes) ? j.notes : []); layout(); api.ready = true; })
    .catch(e => { console.warn('notes.json', e); notes = []; layout(); api.ready = true; });
}
// ------------------------------------------------------------ sound: one player, from the note itself
const audio = new Audio(); audio.preload = 'none'; audio.crossOrigin = 'anonymous'; audio.loop = false;
let src = null, pan = null;
function actx() { return RV.roomba && RV.roomba.audio && RV.roomba.audio.ctx; }
function wire() {
  const A = actx(); if (!A || src) return;
  try {
    src = A.createMediaElementSource(audio); const gn = A.createGain(); gn.gain.value = 1.2;
    pan = A.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 1.0; pan.rolloffFactor = 0.7; pan.maxDistance = 15;
    src.connect(gn); gn.connect(pan); pan.connect(A.destination);
  } catch (e) { console.warn('board audio routing', e); src = null; pan = null; }
}
function panTo(s) {
  if (!pan) return; const p = s.mesh.getWorldPosition(new THREE.Vector3());
  if (pan.positionX) { pan.positionX.value = p.x; pan.positionY.value = p.y; pan.positionZ.value = p.z; } else pan.setPosition(p.x, p.y, p.z);
}
let cur = null, live = false, starting = false, startedAt = 0, plays = 0, wiggles = 0, lastStop = null;
function q(f) { try { return f(); } catch (e) { return false; } }
function quietOthers() {
  const d = RV.media._debug;
  if (d) {
    q(() => { if (d.playing && d.playing.ep && d.video && !d.video.paused) d.video.pause(); });
    q(() => { if (d.rp && d.rp.on && d.stopRecord) d.stopRecord('board'); });
  }
  q(() => { if (RV.tape && RV.tape.playing()) RV.tape.pause('board'); });
  q(() => { const v = RV.vposter._debug, s = v.state(); if (s.live || s.starting) v.stop('board'); });
  q(() => { const o = RV.originFrame._debug, s = o.state(); if (s.live || s.starting) o.pause('board'); });
  q(() => { const n = RV.voiceNote._debug, s = n.state(); if (s.live || s.starting) n.pause('board'); });
  q(() => { if (RV.phone.playing()) RV.phone.stop('board'); });
  q(() => { if (RV.letter.playing()) RV.letter.stop('board'); });
  q(() => { const s = RV.roomba.song; if (s && s.playing()) s.stop(); });
}
function othersPlaying() {
  const d = RV.media._debug;
  return !!(q(() => d.playing && d.playing.ep && d.video && !d.video.paused) || q(() => d.rp && d.rp.on) || q(() => RV.tape.playing()) ||
    q(() => { const s = RV.vposter._debug.state(); return s.live || s.starting; }) || q(() => { const s = RV.originFrame._debug.state(); return s.live || s.starting; }) ||
    q(() => { const s = RV.voiceNote._debug.state(); return s.live || s.starting; }) || q(() => RV.phone.playing()) || q(() => RV.letter.playing()));
}
function play(s) {
  if (RV.ensureAudio) q(() => RV.ensureAudio());
  wire(); const A = actx(); if (A && A.state === 'suspended') A.resume();
  quietOthers(); panTo(s);
  cur = s; starting = true; live = false; startedAt = performance.now() / 1000; plays++;
  if (audio.getAttribute('src') !== s.n.audio) audio.src = s.n.audio;
  audio.preload = 'auto';
  try { audio.currentTime = 0; } catch (e) { }
  const pr = audio.play(); if (pr && pr.catch) pr.catch(err => { console.warn('note play', err && err.name); starting = false; live = false; cur = null; });
  if (RV.haptic) q(() => RV.haptic(0.3, 35));
  return true;
}
function stop(why) {
  if (!cur && audio.paused) return false;
  starting = false; live = false; lastStop = why || 'user'; cur = null;
  if (!audio.paused) audio.pause();
  return true;
}
audio.addEventListener('playing', () => { if (!starting && !live) { audio.pause(); return; } starting = false; live = true; });
audio.addEventListener('ended', () => { live = false; starting = false; lastStop = 'ended'; cur = null; });
audio.addEventListener('error', () => { if (!cur) return; console.warn('note audio error', audio.error && audio.error.code, audio.src); live = false; starting = false; lastStop = 'error'; cur = null; });

function tap(i) {
  const s = slots[i]; if (!s) return false;
  if (cur === s) { stop('user'); return true; }
  if (s.n.audio && !s.n.placeholder) return play(s);
  if (cur) stop('other note');
  s.wig = 1; wiggles++; if (RV.haptic) q(() => RV.haptic(0.2, 25));
  return true;
}

// ------------------------------------------------------------ picking + hooks into RV.media
const ray = new THREE.Raycaster(); ray.far = 12;
function pick(o, d) { if (!slots.length) return null; ray.set(o, d); root.updateMatrixWorld(true); const h = ray.intersectObjects(slots.map(s => s.hit), false)[0]; return h ? { t: h.distance, slot: h.object.userData.slot } : null; }
const M = RV.media, orig = { click: M.click, selectStart: M.selectStart, hoverT: M.hoverT, tick: M.tick, playing: M.playing };
function mine(o, d) { const p = pick(o, d); if (!p) return null; const m = orig.hoverT(o, d); return m == null || p.t < m ? p : null; }
M.click = function (o, d) { const p = mine(o, d); if (p) return tap(p.slot); return orig.click(o, d); };
M.selectStart = function (c, o, d) { const p = mine(o, d); if (p) return tap(p.slot); return orig.selectStart(c, o, d); };
M.hoverT = function (o, d) { const a = orig.hoverT(o, d), b = pick(o, d); return b && (a == null || b.t < a) ? b.t : a; };
M.playing = function () { return (orig.playing ? orig.playing() : false) || live || starting; };
M.tick = function (dt, T) {
  orig.tick(dt, T);
  dt = Math.min(dt || 0.016, 0.1);
  if (live || starting) {
    if (performance.now() / 1000 - startedAt > 0.4 && othersPlaying()) stop('other media');
    if (starting && performance.now() / 1000 - startedAt > 12) { starting = false; cur = null; }
  }
  for (const s of slots) {
    const on = s === cur ? 1 : 0; s.lift += (on - s.lift) * Math.min(1, dt * 8);
    const pulse = on && live ? 0.015 * Math.sin(T * 6) : 0;
    s.g.scale.setScalar(1 + s.lift * 0.06 + pulse); s.g.position.z = s.base.z + s.lift * 0.012;
    if (s.wig > 0) { s.wig = Math.max(0, s.wig - dt * 2.2); s.g.rotation.z = s.rot + Math.sin(s.wig * 18) * 0.08 * s.wig; } else s.g.rotation.z = s.rot;
  }
};

const api = RV.board = { root, AT, W, H, NS, MAX, ready: false, shown: [], audio, load,
  get slots() { return slots; },
  playing: () => live || starting,
  _debug: { pick, tap, play, stop, layout, setNotes: arr => { notes = arr.slice(); layout(); }, notes: () => notes.slice(),
    state: () => ({ playing: cur ? slots.indexOf(cur) : -1, author: cur ? cur.n.author : null, live, starting, plays, wiggles, lastStop, fontReady,
      t: +audio.currentTime.toFixed(2), paused: audio.paused, src: audio.currentSrc, wired: !!src, shown: api.shown.slice() }) } };
load();
})();
