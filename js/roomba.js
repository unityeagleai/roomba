// The Roomba King: a little creature with moods. Wanders, notices you, follows, circles and nudges your feet, keeps its
// distance when shy, sulks in a corner when offended, bumps into things with opinions, eats what it finds, reacts to your
// voice. Its face is a pixel display on its lid; its ring light and the glow on the carpet show how it feels.
(function () {
const RV = window.RV, scene = RV.scene, { canvas, tex, PIX, rng } = RV.util;
const R = RV.roomba = {};
const RAD = 0.17, HT = 0.085, FOOT = 0.16;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const rand = Math.random, pick = a => a[Math.floor(rand() * a.length)];

// ============================================================ model
const root = new THREE.Group(), body = new THREE.Group(); root.add(body); scene.add(root);
// lid: brushed silver rim, dark glossy centre, scuffs, a duct-tape repair, a marker scribble
const topC = canvas(512, 512); (function () {
  const x = topC.getContext('2d'), r = rng(204);
  x.fillStyle = 'rgb(172,172,190)'; x.fillRect(0, 0, 512, 512);
  for (let rr = 256; rr > 0; rr -= 1) { const g = 150 + r() * 60; x.strokeStyle = `rgb(${g},${g},${g + 14})`; x.lineWidth = 1.2; x.beginPath(); x.arc(256, 256, rr, 0, 6.3); x.stroke(); }
  x.fillStyle = 'rgb(46,46,58)'; x.beginPath(); x.arc(256, 256, 132, 0, 6.3); x.fill();
  x.strokeStyle = 'rgb(110,110,124)'; x.lineWidth = 6; x.beginPath(); x.arc(256, 256, 134, 0, 6.3); x.stroke();
  for (let i = 0; i < 40; i++) { const a = r() * 6.3, rr = 150 + r() * 95; x.strokeStyle = r() < 0.5 ? 'rgba(60,60,70,.5)' : 'rgba(240,240,255,.35)'; x.lineWidth = 1 + r() * 2; x.beginPath(); x.arc(256, 256, rr, a, a + 0.05 + r() * 0.25); x.stroke(); }
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(90,80,70,${0.2 + r() * 0.4})`; x.fillRect(r() * 512, r() * 512, 1.5, 1.5); }
  x.save(); x.translate(380, 360); x.rotate(0.7); x.fillStyle = 'rgba(150,150,160,.95)'; x.fillRect(-60, -16, 120, 32); x.strokeStyle = 'rgba(90,90,100,.6)'; for (let k = -56; k < 60; k += 7) { x.beginPath(); x.moveTo(k, -16); x.lineTo(k + 3, 16); x.stroke(); } x.restore();
  x.save(); x.translate(256, 256); x.fillStyle = 'rgba(30,30,40,.8)'; x.font = '15px ' + PIX; x.textAlign = 'center'; x.fillText('ROOMBA', 0, -170); x.fillStyle = 'rgba(20,20,120,.7)'; x.rotate(-0.5); x.font = '12px ' + PIX; x.fillText('BUG 204', -140, 120); x.restore();
})();
const topT = tex(topC);
const sideC = canvas(512, 64); (function () { const x = sideC.getContext('2d'), r = rng(9); x.fillStyle = 'rgb(58,58,70)'; x.fillRect(0, 0, 512, 64); x.fillStyle = 'rgb(90,90,104)'; x.fillRect(0, 0, 512, 6); for (let i = 0; i < 60; i++) { x.fillStyle = r() < 0.5 ? 'rgba(20,20,26,.6)' : 'rgba(200,200,220,.25)'; x.fillRect(r() * 512, 8 + r() * 50, 4 + r() * 20, 1 + r() * 2); } for (let k = 300; k < 360; k += 8) { x.fillStyle = 'rgb(28,28,34)'; x.fillRect(k, 22, 4, 22); } })();
const sideT = tex(sideC);
const shell = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD * 0.97, HT, 40), [
  new THREE.MeshPhongMaterial({ map: sideT, shininess: 30 }),
  new THREE.MeshPhongMaterial({ map: topT, bumpMap: topT, bumpScale: 0.002, shininess: 70, specular: 0x555566 }),
  new THREE.MeshPhongMaterial({ color: 0x18181c })]);
shell.position.y = HT / 2 + 0.008; body.add(shell);
const bumper = new THREE.Mesh(new THREE.CylinderGeometry(RAD + 0.007, RAD + 0.007, HT * 0.5, 32, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshPhongMaterial({ color: 0x222228, shininess: 12, side: THREE.DoubleSide }));
bumper.position.y = HT * 0.4; body.add(bumper);
// ring light + status led
const ringMat = new THREE.MeshBasicMaterial({ color: 0x5ce07a });
const ring = new THREE.Mesh(new THREE.TorusGeometry(RAD * 0.8, 0.0045, 6, 56), ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = HT + 0.0095; body.add(ring);
const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), ringMat); led.position.set(0, HT + 0.006, RAD * 0.88); body.add(led);
// face display (canvas top points to the Roomba's back, so it reads upright when it faces you)
const faceC = canvas(128, 128), faceX = faceC.getContext('2d'), faceT = new THREE.CanvasTexture(faceC); faceT.magFilter = THREE.NearestFilter; faceT.encoding = THREE.sRGBEncoding;
const face = new THREE.Mesh(new THREE.CircleGeometry(0.074, 32), new THREE.MeshBasicMaterial({ map: faceT })); face.rotation.x = -Math.PI / 2; face.position.y = HT + 0.0092; body.add(face);
// the crown, worn at the back of the lid, at an angle
const crown = new THREE.Group(); crown.position.set(0, HT + 0.009, -0.112); crown.rotation.set(-0.25, 0, 0.18); body.add(crown);
const gold = new THREE.MeshPhongMaterial({ color: 0xffd84a, emissive: 0x3a2400, shininess: 90, specular: 0xfff0b0 });
const band = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.031, 0.026, 12, 1, true), gold); band.material.side = THREE.DoubleSide; band.position.y = 0.013; crown.add(band);
for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.026, 6), gold); sp.position.set(Math.sin(a) * 0.03, 0.038, Math.cos(a) * 0.03); crown.add(sp); const b = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 4), gold); b.position.set(Math.sin(a) * 0.03, 0.052, Math.cos(a) * 0.03); crown.add(b); }
const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), new THREE.MeshPhongMaterial({ color: 0xff2a3a, emissive: 0x550008, shininess: 100 })); jewel.position.set(0, 0.013, 0.034); crown.add(jewel);
// side brush
const brush = new THREE.Group(); brush.position.set(0.11, 0.006, 0.12); body.add(brush);
for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.002, 0.06), new THREE.MeshBasicMaterial({ color: 0x9a9aa4 })); b.position.z = 0.03; const g = new THREE.Group(); g.rotation.y = k * 2.094; g.add(b); brush.add(g); }
// shadow + mood glow on the carpet
const shadow = RV.blob(RAD * 1.5, root);
const glowC = canvas(64, 64); (function () { const x = glowC.getContext('2d'), g = x.createRadialGradient(32, 32, 6, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.45, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); })();
const glowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x5ce07a, opacity: 0.4 });
const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.007; glow.renderOrder = 3; root.add(glow);
// speech bubble
const bubC = canvas(512, 176), bubX = bubC.getContext('2d'), bubT = new THREE.CanvasTexture(bubC); bubT.encoding = THREE.sRGBEncoding;
const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubT, transparent: true, depthTest: false, opacity: 0 }));
bubble.center.set(0.5, 0); bubble.scale.set(0.5, 0.172, 1); bubble.renderOrder = 10; scene.add(bubble);

// ============================================================ items it eats
const items = R.items = [];
function labelTex(w, h, bg, lines, ink, font) { const c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = ink; x.textAlign = 'center'; x.font = font; lines.forEach((l, i) => x.fillText(l, w / 2, 26 + i * 22)); RV.util.weather(c, 3 + w, { mottle: 0.15 }); return tex(c); }
function mkItem(kind, x, z, opts) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rand() * 6.3; scene.add(g);
  const ph = (o) => new THREE.MeshPhongMaterial(o);
  if (kind === 'crumb') { for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.012 + rand() * 0.012, 0.008, 0.012 + rand() * 0.01), ph({ color: k % 2 ? 0xc89050 : 0x8a5a2a })); m.position.set((rand() - 0.5) * 0.08, 0.005 + k * 0.0007, (rand() - 0.5) * 0.08); /* each crumb a little higher: overlapping tops never share a plane */ m.rotation.y = rand() * 3; g.add(m); } }
  else if (kind === 'sock') { const c = canvas(32, 64), cx = c.getContext('2d'); for (let y = 0; y < 64; y += 8) { cx.fillStyle = (y / 8) % 2 ? '#ff3fd1' : '#f0e8e0'; cx.fillRect(0, y, 32, 8); } const m = ph({ map: tex(c) }); const a = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.025, 0.15), m); a.position.y = 0.013; g.add(a); const b = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.021, 0.08), m); b.position.set(0.035, 0.0115, 0.09); b.rotation.y = -0.9; g.add(b); }
  else if (kind === 'note') { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), ph({ map: labelTex(96, 96, '#ffe866', ['UNITY\'S', 'NOTE', ':)'], '#3a2a10', '11px ' + PIX), side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = 0.005; g.add(m); }
  else if (kind === 'cable') { const m = ph({ color: 0x141418, shininess: 40 }); for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.055 - k * 0.006, 0.006, 6, 20), m); t.rotation.x = Math.PI / 2; t.position.set(k * 0.006, 0.007 + k * 0.009, 0); g.add(t); } const plug = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.014, 0.035), ph({ color: 0xe8e0d0 })); plug.position.set(0.08, 0.008, 0.02); g.add(plug); }
  else if (kind === 'papers') { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), ph({ map: labelTex(128, 170, '#f4efe2', ['ADOPTION', 'PAPERS', '', 'ROOMBA', 'KING', '', 'SIGNED:', '~charlie~'], '#201830', '10px ' + PIX), side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = 0.004; g.add(m); }
  else if (kind === 'cartridge') { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.028, 0.16), ph({ color: 0xc48a3e, shininess: 40 })); m.position.y = 0.014; g.add(m); const l = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), ph({ map: labelTex(64, 64, '#f0e8d0', ['EP 7'], '#100820', '12px ' + PIX) })); l.rotation.x = -Math.PI / 2; l.position.y = 0.029; g.add(l); }
  const it = { kind, mesh: g, home: { x, z }, x, z, eaten: false, respawnAt: 0, tossed: !!(opts && opts.tossed), pop: 0 };
  items.push(it); return it;
}
mkItem('sock', 1.95, 0.3); mkItem('note', -0.2, 0.95); mkItem('cable', 1.25, -1.48); mkItem('papers', -0.35, -1.55); mkItem('crumb', 1.25, -0.5);   // (the season cartridges are real now: media.js)
R.toss = function (x, z) {
  x = clamp(x, -RV.room.RX + 0.2, RV.room.RX - 0.2); z = clamp(z, -RV.room.RZ + 0.2, RV.room.RZ - 0.2);
  if (RV.blocked(x, z, 0.12, 'roomba')) return null;
  const live = items.filter(i => i.tossed && !i.eaten); if (live.length >= 6) { live[0].mesh.visible = false; live[0].eaten = true; }
  const it = mkItem('crumb', x, z, { tossed: true }); it.pop = 1; snd('drop'); onItem(it); return it;
};

// ============================================================ audio (all synthesized; follows the Roomba in 3D)
const A = R.audio = { ctx: null, quietUntil: 0 };
R.initAudio = function (ctx) {
  if (A.ctx) return; A.ctx = ctx;
  A.master = ctx.createGain(); A.master.gain.value = 0.9; A.master.connect(ctx.destination);
  A.pan = ctx.createPanner(); Object.assign(A.pan, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 0.7, rolloffFactor: 1.1, maxDistance: 20 }); A.pan.connect(A.master);
  A.voice = ctx.createGain(); A.voice.gain.value = 1; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; A.voice.connect(lp); lp.connect(A.pan);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; A.noise = nb;
  A.motor = ctx.createOscillator(); A.motor.type = 'sawtooth'; A.motor.frequency.value = 70; const mf = ctx.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 320; A.motorG = ctx.createGain(); A.motorG.gain.value = 0; A.motor.connect(mf); mf.connect(A.motorG); A.motorG.connect(A.pan); A.motor.start();
  const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true; const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1700; bf.Q.value = 0.8; A.brushG = ctx.createGain(); A.brushG.gain.value = 0; ns.connect(bf); bf.connect(A.brushG); A.brushG.connect(A.pan); ns.start();
  fetch('assets/audio/roomba_theme_chip.mp3').then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => { A.theme = buf; }).catch(() => {});
};
function tone(f0, f1, dur, type, vol, delay) {
  const c = A.ctx; if (!c) return; const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const v = vol == null ? 0.09 : vol; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(A.voice); o.start(t); o.stop(t + dur + 0.02); A.quietUntil = Math.max(A.quietUntil, t + dur + 0.15);
}
function noise(dur, freq, q, vol, delay, to) {
  const c = A.ctx; if (!c) return; const t = c.currentTime + (delay || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = A.noise; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); f.Q.value = q || 1;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(A.voice); s.start(t, Math.random()); s.stop(t + dur + 0.02); A.quietUntil = Math.max(A.quietUntil, t + dur + 0.15);
}
function snd(n, k) {
  if (!A.ctx) return;
  switch (n) {
    case 'chirp': tone(600, 1300, 0.11); tone(900, 1700, 0.1, 'square', 0.08, 0.13); break;
    case 'curious': tone(700, 700, 0.07, 'square', 0.07); tone(600, 1200, 0.18, 'square', 0.08, 0.09); break;
    case 'happy': [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, f, 0.08, 'square', 0.07, i * 0.07)); break;
    case 'sad': tone(800, 520, 0.25, 'triangle', 0.12); tone(600, 330, 0.4, 'triangle', 0.12, 0.27); break;
    case 'hmph': tone(320, 170, 0.2, 'sawtooth', 0.06); noise(0.15, 500, 2, 0.08); break;
    case 'startle': for (let i = 0; i < 8; i++) tone(i % 2 ? 2000 : 1500, i % 2 ? 2000 : 1500, 0.03, 'square', 0.07, i * 0.03); tone(2300, 700, 0.25, 'square', 0.08, 0.26); break;
    case 'bump': tone(130, 45, 0.16, 'sine', 0.35 * (k || 1)); noise(0.05, 900, 1, 0.18 * (k || 1)); if (rand() < 0.5) tone(420, 260, 0.1, 'square', 0.05, 0.12); break;
    case 'boop': tone(950, 600, 0.09, 'sine', 0.15); break;
    case 'nom': for (let i = 0; i < 3; i++) { noise(0.07, 600, 2, 0.22, i * 0.17); tone(220, 130, 0.07, 'square', 0.05, i * 0.17); } noise(0.9, 300, 0.7, 0.12, 0.5, 2600); break;
    case 'purr': { const c = A.ctx, t = c.currentTime, o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = 170; l.frequency.value = 24; lg.gain.value = 0.05; l.connect(lg); lg.connect(g.gain); g.gain.setValueAtTime(0.06, t); g.gain.linearRampToValueAtTime(0, t + 1.3); o.connect(g); g.connect(A.voice); o.start(t); l.start(t); o.stop(t + 1.35); l.stop(t + 1.35); A.quietUntil = Math.max(A.quietUntil, t + 1.5); break; }
    case 'cough': for (let i = 0; i < 3; i++) { noise(0.12, 900, 1.5, 0.25, i * 0.28); tone(260, 170, 0.12, 'sawtooth', 0.05, i * 0.28); } break;
    case 'glitch': for (let i = 0; i < 12; i++) tone(200 + rand() * 3000, 200 + rand() * 3000, 0.03, 'square', 0.06, i * 0.035); break;
    case 'talk': { const n = k || 5; let t = 0; for (let i = 0; i < n; i++) { const f = 500 + rand() * 1000, d = 0.05 + rand() * 0.08; tone(f, f * (0.7 + rand() * 0.7), d, rand() < 0.5 ? 'square' : 'triangle', 0.07, t); t += d + 0.02 + rand() * 0.05; } break; }
    case 'wake': tone(300, 1200, 0.4, 'triangle', 0.1); tone(1200, 1500, 0.1, 'square', 0.06, 0.42); break;
    case 'snore': tone(140, 105, 1.1, 'sine', 0.05); noise(1.0, 400, 1, 0.03); break;
    case 'lowbat': tone(880, 880, 0.12, 'square', 0.07); tone(660, 660, 0.12, 'square', 0.07, 0.16); tone(440, 440, 0.28, 'square', 0.07, 0.32); break;
    case 'dock': [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.09, i * 0.1)); break;
    case 'drop': tone(1400, 900, 0.05, 'sine', 0.08); break;
    case 'whee': tone(500, 1800, 0.35, 'square', 0.07); tone(1800, 600, 0.3, 'square', 0.06, 0.36); break;
  }
}
R.snd = snd;
let themeSrc = null;
function playTheme() { if (!A.theme || themeSrc) return false; const s = A.ctx.createBufferSource(); s.buffer = A.theme; const g = A.ctx.createGain(); g.gain.value = 0.5; s.connect(g); g.connect(A.pan); s.start(); themeSrc = s; s.onended = () => { themeSrc = null; }; A.quietUntil = A.ctx.currentTime + s.buffer.duration + 0.3; return true; }

// ============================================================ the creature
const B = R.b = { x: RV.dock.x, z: RV.dock.z, h: 0, v: 0, w: 0, tv: 0, tw: 0, ghost: false };
const mood = R.mood = { affection: 0.55, offended: 0, curiosity: 0.75, hunger: 0.45, energy: 0.9, excite: 0 };
const P = R.player = { ok: false, x: 0, z: 0, vx: 0, vz: 0, speed: 0, still: 0, hands: [] };
let now = 0, state = null, sd = {}, stack = [], lastNotice = -99, noticeCD = 0, lastLoud = -99, loudLog = [], lastNoclip = -60, lastTheme = -99, lastPush = -99, met = 0, bumpLog = [];
const log = R.log = [];
const look = { expr: 'sleep', exprUntil: 0, tmpExpr: null, color: new THREE.Color(0x5ce07a), target: new THREE.Color(0x5ce07a), pulse: 0, shake: 0, hop: 0, hopV: 0, squish: 0, wiggle: 0, listen: 0 };
const COL = { calm: 0x5ce07a, curious: 0x3ff0e0, happy: 0xffe14a, eat: 0xff3fd1, angry: 0xff3c46, sad: 0x3a6aff, white: 0xffffff, sleep: 0x2a8a44 };
function setLight(c) { look.target.set(COL[c] != null ? COL[c] : c); }
function setFace(e, tmpDur) { if (tmpDur) { look.tmpExpr = e; look.exprUntil = now + tmpDur; } else look.expr = e; }

// speech bubble
let bubbleUntil = 0, lastLine = '';
function say(lines, force) {
  const text = Array.isArray(lines) ? pick(lines.filter(l => l !== lastLine).length ? lines.filter(l => l !== lastLine) : lines) : lines;
  if (!force && now < bubbleUntil - 1.2) return; lastLine = text;
  const x = bubX, W = 512, H = 176; x.clearRect(0, 0, W, H);
  x.font = '24px ' + PIX; const words = text.split(' '), rows = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > 440 && cur) { rows.push(cur); cur = w; } else cur = t; } rows.push(cur);
  const bw = Math.min(490, Math.max(...rows.map(r => x.measureText(r).width)) + 44), bh = rows.length * 34 + 30, bx = (W - bw) / 2, by = H - bh - 26;
  x.fillStyle = '#100820'; rr(x, bx - 4, by - 4, bw + 8, bh + 8, 14); x.fillStyle = '#fffbea'; rr(x, bx, by, bw, bh, 11);
  x.fillStyle = '#100820'; x.beginPath(); x.moveTo(W / 2 - 16, by + bh + 2); x.lineTo(W / 2, H - 2); x.lineTo(W / 2 + 16, by + bh + 2); x.fill(); x.fillStyle = '#fffbea'; x.beginPath(); x.moveTo(W / 2 - 10, by + bh - 2); x.lineTo(W / 2, H - 10); x.lineTo(W / 2 + 10, by + bh - 2); x.fill();
  x.fillStyle = '#100820'; x.textAlign = 'center'; x.textBaseline = 'middle'; rows.forEach((r, i) => x.fillText(r, W / 2, by + 17 + 17 + i * 34 - (rows.length > 1 ? 0 : 2)));
  bubT.needsUpdate = true; bubbleUntil = now + 2.2 + text.length * 0.045; R.lastSaid = text; log.push({ t: +now.toFixed(2), say: text });
}
function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.fill(); }

// state machine
function go(n, d) { if (state && S[state].exit) S[state].exit(); state = n; sd = Object.assign({ t: 0 }, d || {}); stack.length = 0; log.push({ t: +now.toFixed(2), state: n, why: RV.QS.has('trace') ? (new Error().stack.split('\n')[2] || '').trim() : undefined }); if (log.length > 400) log.splice(0, 100); S[n].enter && S[n].enter(sd); }
function push(n, d) { stack.push({ state, sd }); state = n; sd = Object.assign({ t: 0 }, d || {}); log.push({ t: +now.toFixed(2), state: n }); S[n].enter && S[n].enter(sd); }
function pop() { const p = stack.pop(); if (!p) return go('wander'); state = p.state; sd = p.sd; S[state].resume && S[state].resume(sd); }
const dist = () => Math.hypot(P.x - B.x, P.z - B.z);
const angTo = (x, z) => Math.atan2(x - B.x, z - B.z);
function turnTo(a, rate) { const d = wrap(a - B.h); B.tw = clamp(d * 4, -(rate || 3.2), rate || 3.2); return d; }
const SOCIAL = ['nudge', 'follow', 'circle', 'come', 'converse'];
function freeAt(h, dd) { const x = B.x + Math.sin(h) * dd, z = B.z + Math.cos(h) * dd; if (P.ok && !SOCIAL.includes(state) && Math.hypot(x - P.x, z - P.z) < RAD * 0.8 + FOOT + 0.04) return false; return !RV.blocked(x, z, RAD * 0.8, 'roomba'); }
function steer(x, z, speed, stop, noAvoid) {
  const dx = x - B.x, dz = z - B.z, D = Math.hypot(dx, dz); if (D < (stop || 0.05)) { B.tv = 0; B.tw = 0; return D; }
  let a = Math.atan2(dx, dz);
  if (!noAvoid && D > 0.35 && !freeAt(B.h, 0.27)) { const L = freeAt(B.h + 0.8, 0.27), Rr = freeAt(B.h - 0.8, 0.27); if (L && !Rr) a = B.h + 1.3; else if (Rr && !L) a = B.h - 1.3; else if (L && Rr) a = B.h + (wrap(a - B.h) > 0 ? 1.3 : -1.3); }
  const d = turnTo(a); B.tv = Math.abs(d) > 1.25 ? 0 : speed * Math.cos(d) ** 2 * Math.max(0.35, Math.min(1, D / 0.35)); return D;
}
function stop() { B.tv = 0; B.tw = 0; }
function afterSocial() { noticeCD = now + 8 + rand() * 8; }
function nearestItem(maxD) { let best = null, bd = maxD || 2.6; for (const it of items) if (!it.eaten) { const d = Math.hypot(it.x - B.x, it.z - B.z); if (d < bd) { bd = d; best = it; } } return best; }
const CORNERS = [[-2.4, -2.0], [-2.4, 2.0], [2.4, 2.0], [-1.6, 0.2, 'bed'], [2.4, -1.2]];

const S = R.states = {};
S.dock = {
  enter(d) { stop(); setFace('sleep'); setLight('sleep'); B.h = 0; d.wake = d.wake == null ? 4 : d.wake; },
  update(dt, d) { mood.energy = Math.min(1, mood.energy + dt / 30); look.pulse = 0.5 + 0.5 * Math.sin(now * 1.3); if ((d.t % 7) < dt) snd('snore'); if (d.t > 1.5 && (d.t % 9) < dt) say(['ZZZ', 'ZZZ...CABLES...', 'DREAMING OF CRUMBS']); if (d.t > d.wake && mood.energy > 0.85) go('undock'); }
};
S.undock = {
  enter(d) { snd('wake'); setFace('neutral'); setLight('calm'); B.h = 0; },
  update(dt, d) { if (d.t < 1.2) { B.tv = 0.18; B.tw = 0; } else { if (P.ok && dist() < 3) go('notice'); else go('wander'); } }
};
S.wander = {
  enter(d) { setFace('neutral'); setLight('calm'); d.tgt = RV.freeSpot(RAD, 'roomba'); d.until = 3 + rand() * 6; },
  resume(d) { d.tgt = RV.freeSpot(RAD, 'roomba'); },
  update(dt, d) {
    const D = steer(d.tgt.x, d.tgt.z, 0.27, 0.12);
    if (D < 0.15 || d.t > 9) { if (rand() < 0.45) return go('idle'); d.tgt = RV.freeSpot(RAD, 'roomba'); d.t = 0; }
    if (mood.energy < 0.12) return go('home');
    if (P.ok && dist() < 2.1 && now > noticeCD && now - lastNotice > 3) return go('notice');
    if (mood.hunger > 0.55 && rand() < dt * 0.6) { const it = nearestItem(2.4); if (it) return go('eat', { it }); }
    if (mood.excite > 0.6 && rand() < dt * 0.2) return go('excited');
    // a cartridge someone left on the floor: now and then it gets carried off (it finds its way back to the shelf later)
    if (RV.media && rand() < dt * 0.06) { const c = RV.media.floorCart(B.x, B.z, 3.2); if (c) return go('carry', { c }); }
  }
};
S.carry = {
  enter(d) { setFace('curious'); setLight('eat'); d.ph = 'go'; say(['OOH. SHINY.', 'IS THAT AN EPISODE', 'NOBODY IS USING THIS']); },
  update(dt, d) {
    const c = d.c;
    if (d.ph === 'go') {
      if (c.state !== 'floor') { say('FINE. KEEP IT.'); return go('wander'); }
      const D = steer(c.x, c.z, 0.3, 0.02, Math.hypot(c.x - B.x, c.z - B.z) < 0.6);
      if (D < RAD * 0.8) { RV.media.ride(c); snd('chirp'); look.squish = 1; setFace('happy', 1); say(['CARTRIDGE ACQUIRED', 'THIS IS MINE NOW', 'FINDERS KEEPERS'], true); d.ph = 'haul'; d.t = 0; d.tgt = RV.freeSpot(RAD, 'roomba'); }
      if (d.t > 20) return go('wander');
      return;
    }
    if (c.state !== 'riding') { say(['HEY. THAT WAS MINE.', 'THIEF'], true); snd('hmph'); return go('wander'); }
    const D = steer(d.tgt.x, d.tgt.z, 0.32, 0.12);
    if (D < 0.15 || d.t > 12) { RV.media.unride(c, B.x - Math.sin(B.h) * 0.2, B.z - Math.cos(B.h) * 0.2, true); say(['HIDDEN.', 'NOBODY SAW THAT', 'FOR LATER', 'SAFE HERE'], true); setFace('happy', 1.2); go('wander'); }
  },
  exit() { if (sd.c && sd.c.state === 'riding') RV.media.unride(sd.c, B.x - Math.sin(B.h) * 0.2, B.z - Math.cos(B.h) * 0.2, true); }
};
S.idle = {
  enter(d) { stop(); d.len = 1.5 + rand() * 2.5; d.dir = rand() < 0.5 ? -1 : 1; if (rand() < 0.4) snd('talk', 2); },
  update(dt, d) { B.tv = 0; B.tw = Math.sin(d.t * 1.7) * 0.9 * d.dir; if (d.t > d.len) go('wander'); if (P.ok && dist() < 2.1 && now > noticeCD && now - lastNotice > 3) go('notice'); }
};
S.notice = {
  enter(d) { stop(); lastNotice = now; snd('chirp'); setFace('curious'); setLight('curious'); met++; if (met === 1) say('NEW HUMAN DETECTED', true); else if (met === 2) say('SCANNING FOR CABLES...', true); else if (rand() < 0.5) say(['OH. IT\'S YOU.', 'HI UNITY', 'BEEP.', 'ALL HAIL ME', '?']); },
  update(dt, d) { turnTo(angTo(P.x, P.z)); B.tv = 0; if (d.t > 1.0) decide(); }
};
function decide() {
  if (mood.offended > 0.45) return go('sulk');
  const approach = P.ok ? ((P.vx * (B.x - P.x) + P.vz * (B.z - P.z)) / Math.max(0.1, dist())) : 0;
  const w = { follow: 0.4 + mood.affection, circle: mood.curiosity * 0.8, keepAway: 0.25 + (approach > 0.45 ? 0.9 : 0) + (1 - mood.affection) * 0.4, ignore: 0.15 };
  let s = 0; for (const k in w) s += w[k]; let r = rand() * s;
  for (const k in w) { r -= w[k]; if (r <= 0) { if (k === 'ignore') { afterSocial(); return go('wander'); } return go(k); } }
  go('follow');
}
S.follow = {
  enter(d) { setFace('happy'); setLight('happy'); d.len = 12 + rand() * 14; },
  update(dt, d) {
    const D = dist(), a = angTo(P.x, P.z);
    if (D > 0.95) steer(P.x, P.z, D > 2 ? 0.34 : 0.26, 0.8, true); else if (D < 0.5) { turnTo(a); B.tv = -0.12; } else { turnTo(a); B.tv = 0; }
    if (P.still > 2.5 && D < 1.1 && d.t > 3) return go(rand() < mood.curiosity * 0.7 ? 'circle' : 'nudge');
    if (D > 4) { afterSocial(); return go('wander'); }
    if (d.t > d.len) { if (rand() < 0.35) say(['BORED.', 'OK BYE', 'I HAVE FLOORS TO DO']); afterSocial(); return go('wander'); }
  }
};
S.circle = {
  enter(d) { setFace('curious'); setLight('curious'); d.a = Math.atan2(B.x - P.x, B.z - P.z); d.dir = rand() < 0.5 ? 1 : -1; d.loops = 1 + rand() * 0.7; d.sn = 0; snd('curious'); if (rand() < 0.4) say(['WHAT ARE THOSE. FEET?', 'SNIFF SNIFF', 'INSPECTING...']); },
  update(dt, d) {
    d.a += dt * 0.95 * d.dir; const tx = P.x + Math.sin(d.a) * 0.55, tz = P.z + Math.cos(d.a) * 0.55; steer(tx, tz, 0.24, 0.03, true);
    d.sn += dt; if (d.sn > 1.3) { d.sn = 0; tone(1200 + rand() * 500, 1500 + rand() * 600, 0.05, 'square', 0.05); }
    if (d.t * 0.95 > d.loops * 6.283) go(rand() < 0.6 ? 'nudge' : 'follow'); if (dist() > 2.5) go('follow');
  }
};
S.nudge = {
  enter(d) { setFace('happy'); setLight('happy'); d.n = 0; d.max = 1 + Math.floor(rand() * 3); d.back = 0; },
  update(dt, d) {
    if (d.back > 0) { d.back -= dt; B.tv = -0.12; B.tw = 0; return; }
    if (d.n >= d.max) return go(rand() < 0.5 ? 'follow' : 'circle');
    steer(P.x, P.z, 0.13, 0.01, true); if (d.t > 9 || dist() > 2) go('follow');
  },
  onFoot(sp, d) { d.n++; d.back = 0.5; boopFoot(d.n === 1 ? ['BOOP.', 'YOUR FOOT IS IN MY LANE', 'NOM? (SHOELACE)', 'TAG. YOU\'RE IT.'] : null); return true; }
};
function boopFoot(lines) { snd('boop'); look.squish = 1; setFace('happy', 0.6); RV.haptic && RV.haptic(0.6, 60); if (lines) say(lines); mood.affection = Math.min(1, mood.affection + 0.03); }
S.keepAway = {
  enter(d) { setFace('shy'); setLight('curious'); d.want = 1.6; if (rand() < 0.5) say(['...', 'PERSONAL SPACE', 'TOO CLOSE', 'I\'M SHY TODAY']); },
  update(dt, d) {
    const D = dist(); d.want = Math.max(0.9, 1.6 - d.t * 0.05);
    if (D < d.want - 0.15) { const ax = B.x - P.x, az = B.z - P.z, l = Math.max(0.01, Math.hypot(ax, az)); let tx = B.x + ax / l * 0.8, tz = B.z + az / l * 0.8; if (RV.blocked(tx, tz, RAD, 'roomba')) { tx = B.x - az / l * 0.8; tz = B.z + ax / l * 0.8; } steer(tx, tz, 0.3, 0.05); }
    else { turnTo(angTo(P.x, P.z)); B.tv = 0; }
    if (d.t > 9 && P.still > 2) { say(['...OK. HI.', 'FINE. HELLO.', 'YOU MAY APPROACH']); snd('chirp'); go('follow'); }
    if (d.t > 20 || D > 4) { afterSocial(); go('wander'); }
  }
};
S.sulk = {
  enter(d) {
    setFace('sulk'); setLight('angry'); snd('hmph'); d.ph = 'turn'; d.min = 12 + rand() * 12;
    say(['HMPH.', 'I AM NOT TALKING TO YOU', 'MY LAWYER WILL HEAR ABOUT THIS', 'MY LAWYER IS ALSO ME'], true);
    let best = null, bs = -1; for (const c of CORNERS) { if (RV.blocked(c[0], c[1], RAD, 'roomba')) continue; const s = Math.hypot(c[0] - P.x, c[1] - P.z) + (c[2] ? 0.4 : 0) + rand() * 0.8; if (s > bs) { bs = s; best = c; } }
    d.c = best || [B.x, B.z]; const cx = d.c[0], cz = d.c[1], l = Math.max(0.01, Math.hypot(cx, cz));
    d.ap = d.c[2] ? { x: cx + 0.5, z: cz } : { x: cx - cx / l * 0.45, z: cz - cz / l * 0.45 };
  },
  update(dt, d) {
    mood.offended = Math.max(0, mood.offended - dt * 0.03);
    look.pulse = 0.4 + 0.3 * Math.sin(now * 2);
    if (d.ph === 'turn') { turnTo(angTo(P.x, P.z) + Math.PI); B.tv = 0; if (d.t > 0.9) { d.ph = 'drive'; d.t2 = 0; } }
    else if (d.ph === 'drive') { d.t2 += dt; if (steer(d.ap.x, d.ap.z, 0.3, 0.12) < 0.13 || d.t2 > 10) { d.ph = 'aim'; d.t2 = 0; } }
    else if (d.ph === 'aim') { d.t2 += dt; const away = Math.atan2(d.ap.x - d.c[0], d.ap.z - d.c[1]); if (Math.abs(turnTo(away)) < 0.12 || d.t2 > 2.5) { d.ph = 'back'; d.t2 = 0; } B.tv = 0; }
    else if (d.ph === 'back') { d.t2 += dt; B.tw = 0; B.tv = -0.15; if (d.t2 > 3) { d.ph = 'stay'; setLight('sad'); } }
    else { B.tv = 0; if (P.ok && dist() < 1.8) turnTo(angTo(P.x, P.z) + Math.PI, 1.5); else B.tw = 0; if (rand() < dt * 0.12) { snd(rand() < 0.5 ? 'hmph' : 'sad'); say(['HMPH.', '...', 'STILL MAD', 'I AM NOT TALKING TO YOU']); } }
    if (d.t > d.min && mood.offended < 0.15) go('forgive');
  },
  onBump(o, sp, d) { if (d.ph === 'back') { d.ph = 'stay'; setLight('sad'); return true; } return false; },
  exit() { setLight('calm'); }
};
S.forgive = { enter() { snd('sad'); snd('chirp'); say(['...FINE.', 'APOLOGY ACCEPTED. PROBABLY.', 'OK I MISSED YOU']); setFace('shy'); setLight('happy'); mood.offended = 0; }, update(dt, d) { stop(); if (d.t > 1.4) go(P.ok && dist() < 3.5 ? 'follow' : 'wander'); } };
const EAT = { crumb: ['NOM', 'CRUMBS DETECTED', 'DELICIOUS DATA'], sock: ['SOCK ACQUIRED', 'THE OTHER ONE IS NEXT'], note: ['NOM. YOUR NOTE.', 'I DENY EVERYTHING'], cable: ['I ATE A CABLE', 'CRUNCHY'], papers: ['ADOPTION PAPERS: EATEN', 'MILES HAS IT ON FILE'], cartridge: ['EPISODE 7: EATEN', 'THE BATON WAS TASTIER'] };
S.eat = {
  enter(d) { setFace('hungry'); setLight('eat'); d.ph = 'go'; if (d.it.kind === 'crumb' && !d.quiet) say(['CRUMBS DETECTED', 'SNACK ALERT', 'MINE']); },
  update(dt, d) {
    const it = d.it; if (it.eaten && d.ph === 'go') return go('wander');
    if (d.ph === 'go') { const D = steer(it.x, it.z, it.tossed ? 0.36 : 0.28, 0.02, Math.hypot(it.x - B.x, it.z - B.z) < 0.6); if (D < RAD * 0.75) { d.ph = 'munch'; d.t = 0; snd('nom'); setFace('eat'); look.shake = 1.4; } if (d.t > 25) { say('IT GOT AWAY'); go('wander'); } return; }
    if (d.ph === 'munch') {
      stop(); look.shake = Math.max(look.shake, 0.6); const k = Math.max(0, 1 - d.t / 1.2); it.mesh.scale.setScalar(k * (0.85 + rand() * 0.3)); it.mesh.position.set(it.x + (B.x - it.x) * (1 - k), 0, it.z + (B.z - it.z) * (1 - k));
      if (d.t > 1.3) {
        if (it.kind === 'cable' && rand() < 0.4) { d.ph = 'choke'; d.t = 0; snd('cough'); say('CABLE TOO SPICY', true); setFace('dizzy'); return; }
        it.eaten = true; it.mesh.visible = false; it.respawnAt = it.tossed ? Infinity : now + 50 + rand() * 50; mood.hunger = Math.max(0, mood.hunger - 0.35); mood.affection = Math.min(1, mood.affection + (it.tossed ? 0.08 : 0));
        say(EAT[it.kind], true); setFace('happy', 1.5); R.eaten = (R.eaten || 0) + 1;
        d.ph = 'done'; d.t = 0;
      }
      return;
    }
    if (d.ph === 'choke') { look.shake = 0.8; B.tv = d.t < 0.6 ? -0.1 : 0; if (d.t > 1.1) { it.x = B.x + Math.sin(B.h) * 0.35; it.z = B.z + Math.cos(B.h) * 0.35; if (RV.blocked(it.x, it.z, 0.08, 'roomba')) { it.x = it.home.x; it.z = it.home.z; } it.mesh.position.set(it.x, 0, it.z); it.mesh.scale.setScalar(1); d.ph = 'done'; d.t = 0; } return; }
    stop(); if (d.t > 0.8) go(P.ok && dist() < 2.5 ? 'follow' : 'wander');
  }
};
S.startled = {
  enter(d) { snd('startle'); setFace('startled'); setLight('white'); look.hopV = 1.1; say(['!!', 'AAAA', 'INDOOR VOICE PLEASE', 'WHO SAID THAT'], true); },
  update(dt, d) { if (d.t < 0.4) { B.tv = -0.32; B.tw = 0; } else { B.tv = 0; B.tw = Math.sin(d.t * 14) * 3; } if (d.t > 0.6) setLight('angry');
    if (d.t > 1.3) { const recent = loudLog.filter(t => now - t < 20).length; if (recent >= 3) { mood.offended = Math.min(1, mood.offended + 0.6); go('sulk'); } else if (mood.affection > 0.6 && rand() < 0.5) go('excited'); else go('keepAway'); } }
};
S.excited = {
  enter(d) { setFace('excited'); snd('whee'); say(['WHEEE', 'AGAIN!', 'ALL HAIL ME', 'ZOOMIES'], true); mood.excite = 0; d.dance = now - lastTheme > 45 && rand() < 0.55 && playTheme(); if (d.dance) { lastTheme = now; say('THIS IS MY SONG', true); } d.len = d.dance ? A.theme.duration : 2.2; },
  update(dt, d) { look.target.setHSL((now * 0.6) % 1, 1, 0.55);
    if (!d.dance) { B.tv = 0; B.tw = 6.5; } else { const beat = now * Math.PI * 2 * 2.1; B.tw = Math.sin(beat / 2) * 4.5; B.tv = Math.sin(beat) * 0.08; look.hop = Math.max(look.hop, Math.abs(Math.sin(beat)) * 0.012); }
    if (d.t > d.len) { snd('happy'); go(P.ok && dist() < 3 ? 'follow' : 'wander'); } },
  exit() { setLight('calm'); }
};
S.come = {
  enter(d) { setFace('curious'); setLight('curious'); snd('chirp'); say(['YES?', 'COMING', 'YOU CALLED?', 'ON MY WAY'], true); },
  update(dt, d) { const ax = B.x - P.x, az = B.z - P.z, l = Math.max(0.01, Math.hypot(ax, az)); const tx = P.x + ax / l * 0.65, tz = P.z + az / l * 0.65; const D = steer(tx, tz, 0.36, 0.1); if (D < 0.12 || dist() < 0.75) { snd('talk', 4); go('converse'); } if (d.t > 14) go('follow'); }
};
const REPLIES = ['BEEP BOOP', 'AGREED.', 'I\'M TELLING MILES', 'THAT\'S WHAT THE PAPERS SAID', 'FASCINATING. MORE CRUMBS?', 'NO PUSH TO MAIN', 'YES. ALSO NO.', 'I UNDERSTOOD THAT', 'WRITE THAT DOWN', 'BEEP.'];
S.converse = {
  enter(d) { stop(); setFace('listen'); setLight('white'); d.quiet = 0; d.spoke = 0; },
  update(dt, d) { turnTo(angTo(P.x, P.z)); B.tv = 0; look.pulse = 0.5 + look.listen * 0.5;
    if (R.voice.talking) { d.quiet = 0; d.spoke += dt; } else { d.quiet += dt; if (d.spoke > 0.3 && d.quiet > 0.6) { snd('talk', clamp(Math.round(d.spoke * 3), 3, 10)); say(REPLIES, true); setFace('happy', 1.2); d.spoke = 0; d.replied = (d.replied || 0) + 1; mood.affection = Math.min(1, mood.affection + 0.05); } }
    if (d.quiet > 6 || dist() > 2.5) go('follow'); }
};
S.home = {
  enter(d) { setFace('sleepy'); setLight('sad'); snd('lowbat'); say('BATTERY LOW. GOING HOME', true); d.ph = 'go'; },
  update(dt, d) { const dk = RV.dock;
    if (d.ph === 'go') { if (steer(dk.x, dk.z + 0.4, 0.25, 0.08) < 0.09 || d.t > 25) { d.ph = 'aim'; } }
    else if (d.ph === 'aim') { B.tv = 0; if (Math.abs(turnTo(0)) < 0.06) { d.ph = 'back'; d.t2 = 0; } }
    else { d.t2 += dt; B.tw = 0; B.tv = -0.1; if (B.z <= dk.z + 0.01 || d.t2 > 6) { B.z = Math.max(B.z, dk.z); snd('dock'); go('dock', { wake: 20 }); } }
  },
  onBump(o, sp, d) { if (d.ph === 'back') { snd('dock'); go('dock', { wake: 20 }); return true; } return false; }
};
S.pet = {
  enter(d) { stop(); setFace('love'); setLight(0xff7ad6); snd('purr'); say(['PURR.EXE', 'MORE', 'ALL HAIL ME', 'YES. THERE.', 'I ALLOW THIS'], true); mood.affection = Math.min(1, mood.affection + 0.12); mood.offended = Math.max(0, mood.offended - 0.5); d.len = 1.8; },
  update(dt, d) { stop(); look.wiggle = Math.sin(d.t * 18) * 0.06; if (d.t > d.len) { look.wiggle = 0; go(P.ok && dist() < 3 ? 'follow' : 'wander'); } }
};
S.bump = {
  enter(d) {
    const k = clamp(Math.abs(d.sp) / 0.3, 0.3, 1.2); snd('bump', k); look.squish = 1; look.shake = 0.8; setFace(k > 0.8 ? 'dizzy' : 'oops', 0.7); setLight('angry');
    d.dir = d.sp > 0 ? -1 : 1; d.turn = (0.9 + rand() * 1.5) * (rand() < 0.5 ? -1 : 1); d.h0 = B.h;
    const nm = d.o && d.o.name || 'wall'; bumpLog.push({ t: now, nm }); bumpLog = bumpLog.filter(b => now - b.t < 12);
    const same = bumpLog.filter(b => b.nm === nm).length;
    if (same >= 3 && nm !== 'wall' && nm !== 'foot') { say('FIGHT ME, ' + nm.toUpperCase(), true); bumpLog = []; d.ram = 2; }
    else if (nm === 'foot') { if (rand() < 0.4) say(['EXCUSE ME. FOOT.', 'FOOT IN THE WAY', 'GOING AROUND YOU']); }
    else if (rand() < 0.4) say(nm === 'wall' ? ['BONK', 'WALL. AGAIN.', 'WHO PUT THAT THERE', 'WALL: 1 ME: 0', 'THAT WAS A FEATURE'] : nm === 'bed leg' ? ['BED LEG: 1 ME: 0', 'OW. BED.'] : ['THE ' + nm.toUpperCase() + ' STARTED IT', 'WHO PUT A ' + nm.toUpperCase() + ' HERE', 'BONK']);
  },
  update(dt, d) {
    if (d.ram) { // grudge: back up, charge, repeat
      const c = d.t % 1.6; if (c < 0.7) { B.tv = -0.18; B.tw = 0; } else { B.tv = 0.42; B.tw = 0; } if (d.t > 3.2) { d.ram = 0; d.t = 0; say('...I WON.'); } return;
    }
    if (d.t < 0.35) { B.tv = 0.12 * d.dir; B.tw = 0; return; }
    B.tv = 0; const dd = turnTo(d.h0 + d.turn, 3); if (Math.abs(dd) < 0.1 || d.t > 1.6) { setLight(look.prevLight || 'calm'); pop(); }
  },
  onBump(o, sp, d) { if (d.ram) { snd('bump', 1.2); look.squish = 1; look.shake = 1; RV.haptic && RV.haptic(0.2, 30); return true; } snd('bump', 0.4); d.t = Math.max(d.t, 0.35); return true; }
};
S.noclip = {
  enter(d) { B.ghost = true; snd('glitch'); setFace('glitch'); say(['BUG 204: NOCLIP', 'UNPATCHED. UNBOTHERED.'], true); d.h0 = B.h; lastNoclip = now; },
  update(dt, d) { look.target.setHSL(rand(), 1, 0.5); body.visible = rand() > 0.15; if (rand() < 0.3) snd('glitch');
    if (d.t < 1.0) { B.tv = 0.14; B.tw = 0; } else if (d.t < 1.8) { B.tv = 0; } else if (d.t < 2.9) { B.tv = -0.14; } else { B.ghost = false; body.visible = true; if (RV.blocked(B.x, B.z, RAD, 'roomba')) { const f = RV.freeSpot(RAD, 'roomba'); B.x = f.x; B.z = f.z; } say('FEATURE.', true); go('wander'); } },
  exit() { B.ghost = false; body.visible = true; }
};

// ============================================================ physics + events
function onBump(o, sp) {
  if (S[state].onBump && S[state].onBump(o, sp, sd)) return;
  if (o.wall && state === 'wander' && now - lastNoclip > 100 && rand() < 0.15) return go('noclip');
  look.prevLight = null; push('bump', { o, sp });
}
function onFoot(sp) {
  if (S[state].onFoot && S[state].onFoot(sp, sd)) return;
  if (state === 'wander' || state === 'idle') { boopFoot(['OH. FEET.', 'SORRY. YOUR FOOT.']); return go('notice'); }
  if (now - (R._lastFoot || 0) > 1.2) { R._lastFoot = now; boopFoot(rand() < 0.3 ? ['BOOP.', 'SORRY. YOUR FOOT.', 'EXCUSE ME. FOOT.'] : null); }
  // anything with somewhere to be goes around your feet instead of waiting
  if (['eat', 'home', 'sulk', 'keepAway', 'undock'].includes(state)) push('bump', { o: { name: 'foot', foot: true }, sp: sp * 0.3 });
}
function physics(dt) {
  const acc = Math.abs(B.tv) > Math.abs(B.v) ? 1.4 : 3.2; const dv = clamp(B.tv - B.v, -acc * dt, acc * dt); B.v += dv; R._accel = dv / Math.max(dt, 1e-3);
  B.w += clamp(B.tw - B.w, -16 * dt, 16 * dt); B.h = wrap(B.h + B.w * dt);
  if (Math.abs(B.v) < 1e-4) return;
  const nx = B.x + Math.sin(B.h) * B.v * dt, nz = B.z + Math.cos(B.h) * B.v * dt;
  if (B.ghost) { if (Math.abs(nx) < RV.room.RX + 0.1 && Math.abs(nz) < RV.room.RZ + 0.1) { B.x = nx; B.z = nz; } return; }
  const o = RV.blocked(nx, nz, RAD, 'roomba'); if (o) { const sp = B.v; B.v = 0; onBump(o, sp); return; }
  if (P.ok) { const d1 = Math.hypot(nx - P.x, nz - P.z), d0 = Math.hypot(B.x - P.x, B.z - P.z); if (d1 < RAD + FOOT && d1 < d0) { const sp = B.v; B.v = 0; onFoot(sp); return; } }
  B.x = nx; B.z = nz; if (Math.abs(B.v) > 0.05) RV.cleanStripe(B.x, B.z, B.h, RAD * 0.9);
}
// the player walked into it
R.pushedBy = function (dx, dz, speed) {
  const nx = B.x + dx, nz = B.z + dz; if (!RV.blocked(nx, nz, RAD, 'roomba')) { B.x = nx; B.z = nz; }
  if (speed > 0.25 && now - lastPush > 1.5 && state !== 'sulk' && state !== 'dock') {
    lastPush = now; mood.offended = Math.min(1, mood.offended + 0.35); mood.affection = Math.max(0, mood.affection - 0.06);
    snd('hmph'); look.shake = 1; RV.haptic && RV.haptic(0.4, 80);
    say(['HEY!', 'I WAS HERE FIRST', 'MY LAWYER WILL HEAR ABOUT THIS', 'RUDE.'], true);
    if (mood.offended > 0.5) go('sulk'); else go('keepAway');
  }
};
function onItem(it) {
  const D = Math.hypot(it.x - B.x, it.z - B.z);
  if (state === 'sulk' && D < 2.8) { mood.offended = 0; say('BRIBE ACCEPTED', true); return go('eat', { it, quiet: true }); }
  if (['eat', 'startled', 'noclip', 'dock', 'home', 'bump', 'pet'].includes(state) || D > 4.5) return;
  if (mood.hunger > 0.15 || rand() < 0.8) go('eat', { it });
}
R.pet = function () {
  if (['startled', 'noclip', 'bump', 'pet', 'eat'].includes(state)) return false;
  if (state === 'dock') { say('FIVE MORE MINUTES', true); snd('snore'); return true; }
  if (state === 'sulk') { if (mood.offended < 0.6 || rand() < 0.5) { go('pet'); return true; } say(['DON\'T TOUCH ME', 'STILL MAD'], true); snd('hmph'); return true; }
  go('pet'); return true;
};
// voice / calls
R.voice = { level: 0, talking: false };
R.hear = function (kind, data) {
  if (kind === 'talk' || kind === 'call') {
    if (kind === 'call') log.push({ t: +now.toFixed(2), heard: 'call' });
    if (state === 'dock') { if (mood.energy > 0.5) return go('undock'); return say('FIVE MORE MINUTES', true); }
    if (state === 'sulk') { if (rand() < 0.35 && sd.t > 4) return go('forgive'); snd('hmph'); turnTo(angTo(P.x, P.z) + Math.PI); return say(['NOT TALKING TO YOU', 'LA LA LA', 'TALK TO MY LAWYER'], true); }
    if (state === 'eat' && sd.ph === 'munch') return say('MOUTH FULL', true);
    if (['startled', 'noclip', 'bump', 'converse', 'come', 'pet', 'excited', 'home'].includes(state)) return;
    if (dist() > 1.1) go('come'); else go('converse');
    if (kind === 'call' && state === 'converse') { sd.spoke = 0.6; }
  } else if (kind === 'loud') {
    if (now - lastLoud < 1.2) return; lastLoud = now; loudLog.push(now); loudLog = loudLog.filter(t => now - t < 30);
    log.push({ t: +now.toFixed(2), heard: 'loud' });
    if (dist() > 5) return;
    if (state === 'dock') { go('startled'); return; }
    if (state === 'sulk') { mood.offended = Math.min(1, mood.offended + 0.2); snd('hmph'); return say(['RUDE.', 'STILL NOT TALKING TO YOU'], true); }
    if (['noclip', 'startled', 'pet'].includes(state)) return;
    if (mood.affection > 0.6 && rand() < 0.45 && loudLog.length < 3) { mood.excite = 1; go('excited'); } else go('startled');
  }
};
R.go = go; R.state = () => state;

// ============================================================ face drawing
const EYE = { neutral: 1, happy: 1 };
let faceKey = '', blinkAt = 2, blinkEnd = 0;
function cell(x, y, c) { faceX.fillStyle = c; faceX.fillRect(x * 8, y * 8, 8, 8); }
function drawFace() {
  const e = (look.tmpExpr && now < look.exprUntil) ? look.tmpExpr : look.expr;
  if (now > blinkAt) { blinkEnd = now + 0.13; blinkAt = now + 2 + rand() * 4; }
  const blink = now < blinkEnd && ['neutral', 'curious', 'happy', 'listen', 'shy', 'hungry'].includes(e);
  // pupils look toward Unity (in the Roomba's own frame)
  let px = 0, py = 0; if (P.ok) { const a = wrap(angTo(P.x, P.z) - B.h); px = Math.round(clamp(-Math.sin(a) * 1.6, -1, 1)); py = Math.round(clamp(Math.cos(a) * 1.4, -1, 1)); }
  const anim = Math.floor(now * 6) % 4;
  const key = [e, blink, px, py, (e === 'eat' || e === 'listen' || e === 'glitch' || e === 'sleep' || e === 'excited') ? anim : 0, e === 'listen' ? Math.round(look.listen * 4) : 0].join('|');
  if (key === faceKey) return; faceKey = key;
  const c = '#' + look.color.getHexString(), dim = 'rgba(255,255,255,.08)';
  faceX.fillStyle = '#0a0c14'; faceX.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2 === 0) cell(x, y, 'rgba(255,255,255,.025)');
  const L = 5 - px, Rr = 10 - px, Y = 6 + py;  // canvas bottom is the Roomba's front
  const eyes = (fn) => { fn(L); fn(Rr); };
  if (blink) { eyes(x => { cell(x - 1, Y + 1, c); cell(x, Y + 1, c); cell(x + 1, Y + 1, c); }); }
  else switch (e) {
    case 'happy': case 'excited': eyes(x => { cell(x - 1, Y + 1, c); cell(x, Y, c); cell(x + 1, Y + 1, c); }); if (e === 'excited') { for (let x = 6; x <= 9; x++) cell(x, 10, c); cell(5, 9, c); cell(10, 9, c); if (anim % 2) for (let x = 6; x <= 9; x++) cell(x, 11, c); } else { cell(6, 10, c); cell(7, 11, c); cell(8, 11, c); cell(9, 10, c); } break;
    case 'curious': eyes(x => { cell(x, Y, c); cell(x, Y + 1, c); if (x === Rr) { cell(x + 1, Y, c); cell(x + 1, Y + 1, c); cell(x, Y - 1, c); cell(x + 1, Y - 1, c); } }); cell(7, 11, c); break;
    case 'shy': eyes(x => { cell(x, Y + 1, c); cell(x + 1, Y + 1, c); }); cell(3, 9, 'rgba(255,90,170,.8)'); cell(12, 9, 'rgba(255,90,170,.8)'); cell(7, 11, c); break;
    case 'sulk': eyes(x => { cell(x - 1, Y + 1, c); cell(x, Y + 1, c); cell(x + 1, Y + 1, c); cell(x, Y + 2, c); }); cell(6, 12, c); cell(7, 11, c); cell(8, 11, c); cell(9, 12, c); break;
    case 'angry': eyes(x => { cell(x, Y + 1, c); cell(x, Y + 2, c); }); cell(L - 1, Y - 1, c); cell(L, Y, c); cell(Rr + 1, Y - 1, c); cell(Rr, Y, c); for (let x = 6; x <= 9; x++) cell(x, 11, c); break;
    case 'startled': eyes(x => { for (const [a, b] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) cell(x + a, Y + b, c); }); cell(7, 11, c); cell(8, 11, c); cell(7, 12, c); cell(8, 12, c); break;
    case 'sleep': case 'sleepy': eyes(x => { cell(x - 1, Y + 1, c); cell(x, Y + 1, c); cell(x + 1, Y + 1, c); }); if (e === 'sleep') { const zz = anim % 2; cell(12, 2 + zz, c); cell(13, 2 + zz, c); cell(13, 3 + zz, c); cell(12, 4 + zz, c); cell(13, 4 + zz, c); } break;
    case 'eat': cell(L - 1, Y - 1, c); cell(L, Y, c); cell(L - 1, Y + 1, c); cell(Rr + 1, Y - 1, c); cell(Rr, Y, c); cell(Rr + 1, Y + 1, c); if (anim % 2) { for (let x = 6; x <= 9; x++) { cell(x, 10, c); cell(x, 12, c); } cell(5, 11, c); cell(10, 11, c); } else for (let x = 5; x <= 10; x++) cell(x, 11, c); break;
    case 'hungry': eyes(x => { cell(x, Y, c); cell(x, Y + 1, c); }); for (let x = 6; x <= 9; x++) cell(x, 11, c); cell(9, 12, '#7fd7ff'); break;
    case 'love': eyes(x => { cell(x - 1, Y, c); cell(x + 1, Y, c); cell(x - 1, Y + 1, c); cell(x, Y + 1, c); cell(x + 1, Y + 1, c); cell(x, Y + 2, c); }); cell(6, 11, c); cell(7, 12, c); cell(8, 12, c); cell(9, 11, c); break;
    case 'dizzy': case 'oops': eyes(x => { if (e === 'dizzy') { cell(x - 1, Y - 1, c); cell(x + 1, Y - 1, c); cell(x, Y, c); cell(x - 1, Y + 1, c); cell(x + 1, Y + 1, c); } else { cell(x, Y, c); cell(x, Y + 1, c); } }); cell(6, 11, c); cell(7, 12, c); cell(8, 11, c); cell(9, 12, c); break;
    case 'listen': eyes(x => { cell(x, Y, c); cell(x, Y + 1, c); }); { const n = Math.round(look.listen * 4); for (let k = 0; k < 5; k++) { const hgt = 1 + ((k + anim) % 3 === 0 ? n : Math.max(0, n - 1)); for (let j = 0; j < hgt; j++) cell(5 + k, 12 - j, c); } } break;
    case 'glitch': for (let k = 0; k < 40; k++) cell(rand() * 16 | 0, rand() * 16 | 0, rand() < 0.5 ? c : '#ff3fd1'); break;
    default: eyes(x => { cell(x, Y, c); cell(x, Y + 1, c); }); cell(7, 11, dim); cell(8, 11, dim);
  }
  faceT.needsUpdate = true;
}

// ============================================================ per-frame
let faceAcc = 0;
R.update = function (dt, t) {
  now = t; if (!state) go('dock');
  // moods drift
  mood.hunger = Math.min(1, mood.hunger + dt / 80);
  if (state !== 'dock') mood.energy = Math.max(0, mood.energy - dt / 420);
  if (state !== 'sulk') mood.offended = Math.max(0, mood.offended - dt * 0.012);
  if (P.ok && dist() < 2 && state !== 'sulk') mood.affection = Math.min(1, mood.affection + dt * 0.003);
  mood.excite = Math.max(0, mood.excite - dt * 0.05);
  // eaten items come back (Miles kept records)
  for (const it of items) if (it.eaten && now > it.respawnAt) { it.eaten = false; it.x = it.home.x; it.z = it.home.z; it.mesh.visible = true; it.mesh.position.set(it.x, 0, it.z); it.pop = 1; }
  for (const it of items) if (it.pop > 0) { it.pop = Math.max(0, it.pop - dt * 2.5); it.mesh.scale.setScalar(1 - it.pop * 0.6 + (rand() - 0.5) * it.pop * 0.5); it.mesh.visible = !it.eaten && (it.pop < 0.2 || rand() > 0.3); }
  // hands near the lid = petting
  if (P.hands) for (const hnd of P.hands) if (Math.hypot(hnd.x - B.x, hnd.z - B.z) < 0.26 && hnd.y < 0.45 && state !== 'pet') { if (now - (R._lastPet || 0) > 2.5) { R._lastPet = now; R.pet(); } }
  if (state === 'pet' && P.hands && P.hands.some(hnd => Math.hypot(hnd.x - B.x, hnd.z - B.z) < 0.3 && hnd.y < 0.5)) sd.len = Math.max(sd.len, sd.t + 0.8);
  look.listen = R.voice.level || 0;
  sd.t += dt; S[state].update(dt, sd); physics(dt);
  // look
  look.color.lerp(look.target, Math.min(1, dt * 6)); const pulse = state === 'dock' || state === 'sulk' || state === 'converse' ? look.pulse : 1;
  ringMat.color.copy(look.color).multiplyScalar(0.35 + 0.65 * pulse); glowMat.color.copy(ringMat.color); glowMat.opacity = 0.32 + 0.12 * pulse; glow.scale.setScalar(0.9 + 0.1 * pulse);
  look.shake = Math.max(0, look.shake - dt * 2.5); look.squish = Math.max(0, look.squish - dt * 4);
  look.hopV -= dt * 9.8 * 0.6; look.hop = Math.max(0, look.hop + look.hopV * dt * 0.1); if (look.hop === 0) look.hopV = Math.max(0, look.hopV);
  root.position.set(B.x, 0, B.z); root.rotation.y = B.h;
  body.position.y = look.hop; body.rotation.x = clamp(-(R._accel || 0) * 0.04, -0.08, 0.08) + Math.sin(now * 47) * look.shake * 0.04;
  body.rotation.z = Math.sin(now * 53) * look.shake * 0.05; body.rotation.y = look.wiggle;
  bumper.scale.set(1, 1, 1 - look.squish * 0.08); bumper.position.z = -look.squish * 0.006;
  brush.rotation.y += dt * (state === 'dock' ? 0 : (Math.abs(B.v) > 0.02 || state === 'eat' ? 26 : 6));
  crown.rotation.z = 0.18 + Math.sin(now * 2.1) * 0.02 + body.rotation.z * 2;
  faceAcc += dt; if (faceAcc > 1 / 15) { faceAcc = 0; drawFace(); }
  // bubble follows above it
  bubble.position.set(B.x, 0.36 + look.hop, B.z);
  const op = clamp((bubbleUntil - now) * 3, 0, 1); bubble.material.opacity = op; bubble.visible = op > 0.01;
  // audio
  if (A.ctx) {
    const ct = A.ctx.currentTime, awake = state !== 'dock';
    if (A.pan.positionX) { A.pan.positionX.setTargetAtTime(B.x, ct, 0.03); A.pan.positionY.setTargetAtTime(0.06, ct, 0.03); A.pan.positionZ.setTargetAtTime(B.z, ct, 0.03); } else A.pan.setPosition(B.x, 0.06, B.z);
    A.motorG.gain.setTargetAtTime(awake ? 0.012 + Math.abs(B.v) * 0.14 + Math.abs(B.w) * 0.006 : 0, ct, 0.08);
    A.motor.frequency.setTargetAtTime(58 + Math.abs(B.v) * 230 + Math.abs(B.w) * 18, ct, 0.08);
    A.brushG.gain.setTargetAtTime(awake ? (Math.abs(B.v) > 0.02 ? 0.035 : 0.006) + (state === 'eat' && sd.ph === 'munch' ? 0.08 : 0) : 0, ct, 0.1);
  }
  RV.cleanTick(dt);
};
R.debug = () => ({ state, x: +B.x.toFixed(2), z: +B.z.toFixed(2), h: +B.h.toFixed(2), mood: Object.fromEntries(Object.entries(mood).map(([k, v]) => [k, +v.toFixed(2)])), said: R.lastSaid, eaten: R.eaten || 0 });
})();
