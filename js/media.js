// media.js: the things in the bedroom that play.
//  - the season's seven brass cartridges on a shelf next to the bed (videos read from the live charlie-season site)
//  - the console under the CRT: push a cartridge in and the episode plays on the TV, sound from the TV; pull it out, it stops
//  - a BIG SCREEN button: the TV throws the picture onto the free wall right across from it (next to the door), with a
//    'look behind you' cue in front of you; on desktop the FULL SCREEN button / F key still fill the view. And a way back to the TV
//  - Unity's red record player with her Xanadu single: her own 3D recording, played as stereo, louder near the corner
//  - the Xanadu poster above it
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE, scene = RV.scene, camera = RV.camera, renderer = RV.renderer;
const { canvas, tex, PIX } = RV.util, RX = RV.room.RX, RZ = RV.room.RZ;
const R = RV.roomba;
const BASE = RV.QS.get('eps') || '../charlie-season/';
const V3 = THREE.Vector3, Q = THREE.Quaternion;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
function phong(o) { return new THREE.MeshPhongMaterial(Object.assign({ shininess: 8, specular: 0x111111 }, o)); }
const G = { box: new THREE.BoxGeometry(1, 1, 1) };
const stat = new THREE.Group(); scene.add(stat);          // static furniture added here gets merged at the end
function blk(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(G.box, mat); m.scale.set(w, h, d); m.position.set(x, y, z); (parent || stat).add(m); return m; }
const invis = new THREE.MeshBasicMaterial({ visible: false });
const hitables = [];
function hitBox(w, h, d, x, y, z, data, parent) { const m = new THREE.Mesh(G.box, invis); m.scale.set(w, h, d); m.position.set(x, y, z); m.userData = data; (parent || scene).add(m); hitables.push(m); return m; }
const OBST = RV.obstacles;

// ================================================================ episodes
const EPISODES = [
  { number: '1', title: 'Charlie vs Miles: Check the Papers', video: 'videos/ep01-check-the-papers.mp4', color: '#3aa0ff' },
  { number: '2', title: 'Backrooms.exe: Debug Mode', video: 'videos/ep02-vr-backrooms.mp4', color: '#ff3fd1' },
  { number: '3', title: 'Build the Basement', video: 'videos/ep03-build-the-basement.mp4', color: '#ff8a1f' },
  { number: '4', title: 'The Basement Records', video: 'videos/ep04-the-basement-records.mp4', color: '#5ce07a' },
  { number: '5', title: 'Between Signals: The Handoff', video: 'videos/ep05-the-handoff.mp4', color: '#ffe14a' },
  { number: '6', title: 'The Rap Battle', video: 'videos/ep06-the-rap-battle.mp4', color: '#3ff0e0' },
  { number: '7', title: 'Floor Four and a Half', video: 'videos/ep07-floor-four-and-a-half.mp4', color: '#d6964a' }
];

// ================================================================ the shelf next to the bed (left wall, past the foot of the bed)
const SH = { x0: -RX, x1: -RX + 0.3, z0: 0.84, z1: 1.76, top: 0.9 };
OBST.push({ t: 'box', x0: SH.x0, x1: SH.x1, z0: SH.z0, z1: SH.z1, who: 'both', name: 'cart shelf' });
(function shelf() {
  const wood = phong({ color: 0x8a5a34, shininess: 20 }), woodD = phong({ color: 0x5a3820, shininess: 10 });
  const cx = (SH.x0 + SH.x1) / 2, cz = (SH.z0 + SH.z1) / 2, W = SH.z1 - SH.z0, D = SH.x1 - SH.x0;
  blk(D, 0.03, W, wood, cx, SH.top - 0.015, cz); blk(D, 0.03, W - 0.04, wood, cx, 0.48, cz); blk(D, 0.03, W - 0.04, wood, cx, 0.06, cz);
  for (const s of [-1, 1]) blk(D, SH.top, 0.025, wood, cx, SH.top / 2, cz + s * (W / 2 - 0.0125));
  blk(0.015, SH.top - 0.03, W - 0.05, woodD, SH.x0 + 0.008, (SH.top - 0.03) / 2, cz);   // back panel tucked between the sides and under the top (no shared faces)
  // brass plaque on the front edge
  const pc = canvas(256, 40), px = pc.getContext('2d'); px.fillStyle = '#b8913f'; px.fillRect(0, 0, 256, 40); px.fillStyle = '#5a3a10'; px.font = '18px ' + PIX; px.textAlign = 'center'; px.textBaseline = 'middle'; px.fillText('CHARLIE SEASON', 128, 21);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.04), phong({ map: tex(pc), shininess: 60, specular: 0x6a5020 })); pl.position.set(SH.x1 + 0.001, SH.top - 0.016, cz); pl.rotation.y = Math.PI / 2; stat.add(pl);
  // lower shelves: comics, a shoebox, old game boxes
  const cols = [0xd8202a, 0x2a6ad8, 0xffd23a, 0x30a050, 0xff7ad6, 0x6a3ad8];
  for (let i = 0; i < 11; i++) blk(0.2, 0.2 + (i % 3) * 0.03, 0.022, phong({ color: cols[i % cols.length] }), cx + 0.01, 0.075 + 0.1 + (i % 3) * 0.015, SH.z0 + 0.08 + i * 0.03);
  blk(0.22, 0.13, 0.3, phong({ color: 0xe8e0c8 }), cx, 0.06 + 0.065, SH.z1 - 0.22);
  for (let i = 0; i < 3; i++) blk(0.19, 0.03, 0.26, phong({ color: [0x1a1a2a, 0xc03030, 0x2a2a6a][i] }), cx, 0.495 + 0.015 + i * 0.03, SH.z0 + 0.25);
  blk(0.2, 0.25, 0.022, phong({ color: 0x3aa0ff }), cx, 0.495 + 0.125, SH.z1 - 0.12).rotation.x = 0.25;
})();

// ================================================================ cartridges
const brass = phong({ color: 0xb48a3c, shininess: 80, specular: 0xa0803a });
const brassD = phong({ color: 0x7a5a24, shininess: 40, specular: 0x50401a });
const CW = 0.11, CH = 0.13, CT = 0.022;
function wrap(ctx, text, maxW) { const words = text.split(' '), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
function labelTex(ep) {
  const c = canvas(176, 160), x = c.getContext('2d');
  x.fillStyle = '#120a1e'; x.fillRect(0, 0, 176, 160);
  x.fillStyle = ep.color; x.fillRect(0, 0, 176, 42);
  x.fillStyle = '#120a1e'; x.font = '20px ' + PIX; x.textBaseline = 'middle'; x.fillText('EP ' + ep.number, 10, 23);
  x.fillStyle = ep.color; for (let k = 0; k < 4; k++) x.fillRect(0, 48 + k * 6, 176, 2);
  x.fillStyle = '#f4ecd8'; x.font = '13px ' + PIX; x.textBaseline = 'top';
  wrap(x, ep.title.toUpperCase(), 156).slice(0, 5).forEach((l, i) => x.fillText(l, 10, 78 + i * 17));
  return tex(c);
}
function endTex(ep) {
  const c = canvas(176, 36), x = c.getContext('2d'); x.fillStyle = ep.color; x.fillRect(0, 0, 176, 36); x.fillStyle = '#120a1e'; x.font = '18px ' + PIX; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('EP ' + ep.number, 88, 19); return tex(c);
}
// orientations (cartridge local axes: x = width, y = height (connector at -y), z = label side)
const qBasis = (x, y, z) => new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(...x), new V3(...y), new V3(...z)));
const Q_IN = qBasis([-1, 0, 0], [0, 0, 1], [0, 1, 0]);        // lying flat, label up, connector pointing into the console (-z)
const Q_SHELF = qBasis([0, 0, -1], [0, 1, 0], [1, 0, 0]);     // standing, label facing the room (+x)
const SLOT = RV.consoleSlot;
const IN_POS = new V3(SLOT.x, SLOT.y, SLOT.z - CH / 2 + 0.035);
const MOUTH = new V3(SLOT.x, SLOT.y, SLOT.z + 0.01);
const carts = [];
function makeCart(ep, i) {
  const g = new THREE.Group(); scene.add(g);
  const body = new THREE.Mesh(G.box, brass); body.scale.set(CW, CH, CT); g.add(body);
  const grip = new THREE.Mesh(G.box, brassD); grip.scale.set(CW * 0.9, 0.018, CT * 1.06); grip.position.y = CH / 2 - 0.016; g.add(grip);
  const conn = new THREE.Mesh(G.box, brassD); conn.scale.set(CW * 0.8, 0.012, CT * 0.6); conn.position.y = -CH / 2 - 0.004; g.add(conn);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.094, 0.085), new THREE.MeshPhongMaterial({ map: labelTex(ep), shininess: 30 })); lab.position.set(0, -0.012, CT / 2 + 0.0006); g.add(lab);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.02), new THREE.MeshBasicMaterial({ map: endTex(ep) })); top.position.set(0, CH / 2 + 0.0006, 0); top.rotation.x = -Math.PI / 2; g.add(top);
  const hit = hitBox(CW * 1.25, CH * 1.15, 0.05, 0, 0, 0, null, g);
  const home = new V3(SH.x1 - 0.1, SH.top + CH / 2, SH.z0 + 0.08 + i * 0.127);
  const homeQ = Q_SHELF.clone().multiply(new Q().setFromAxisAngle(new V3(1, 0, 0), -0.06)).multiply(new Q().setFromAxisAngle(new V3(0, 1, 0), (i % 3 - 1) * 0.05));
  const c = { ep, i, g, hit, home, homeQ, state: 'shelf', x: home.x, z: home.z, anim: null, vy: 0, returnAt: 0, by: null, lab, top };
  hit.userData = { cart: c };
  g.position.copy(home); g.quaternion.copy(homeQ);
  carts.push(c); return c;
}
EPISODES.forEach(makeCart);
// if the season site has newer data (titles, colours, files), use it; the seven slots stay
function relabel(c) { c.lab.material.map.dispose(); c.lab.material.map = labelTex(c.ep); c.top.material.map.dispose(); c.top.material.map = endTex(c.ep); c.lab.material.needsUpdate = c.top.material.needsUpdate = true; }
const fontRedraws = [() => carts.forEach(relabel)];
fetch(BASE + 'episodes.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(list => {
  if (!Array.isArray(list)) return;
  list.slice(0, carts.length).forEach((e, i) => { if (!e || !e.video) return; const c = carts[i]; c.ep = Object.assign({}, c.ep, e); relabel(c); });
}).catch(() => { });

// ---------------------------------------------------------------- animation helpers
function animTo(c, pos, quat, dur, arc, done) { c.anim = { p0: c.g.position.clone(), q0: c.g.quaternion.clone(), p1: pos.clone(), q1: quat.clone(), t: 0, dur, arc: arc || 0, done }; }
function sendHome(c, why) {
  c.state = 'returning'; c.by = null;
  animTo(c, c.home, c.homeQ, why === 'quick' ? 0.5 : 1.3, why === 'quick' ? 0.1 : 0.45, () => { c.state = 'shelf'; c.x = c.home.x; c.z = c.home.z; if (why !== 'quick') chime(); });
}

// ================================================================ video: one <video>, on the CRT or the big screen
const video = document.createElement('video');
video.crossOrigin = 'anonymous'; video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', ''); video.preload = 'none';
video.style.display = 'none'; document.body.appendChild(video);
const vtex = new THREE.VideoTexture(video); vtex.encoding = THREE.sRGBEncoding; vtex.minFilter = THREE.LinearFilter; vtex.magFilter = THREE.LinearFilter; vtex.generateMipmaps = false;
const TV = RV.tv;
// the picture: 16:9 letterboxed inside the 4:3 tube, with faint scanlines over it
const vidMat = new THREE.MeshBasicMaterial({ map: vtex, toneMapped: false });
const vidPlane = new THREE.Mesh(new THREE.PlaneGeometry(TV.sw, TV.sw * 9 / 16), vidMat);
vidPlane.position.set(TV.sx, TV.sy, TV.sz + 0.002); vidPlane.visible = false; scene.add(vidPlane);
const slc = canvas(4, 128), slx = slc.getContext('2d'); for (let y = 0; y < 128; y++) { slx.fillStyle = y % 2 ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0)'; slx.fillRect(0, y, 4, 1); }
const slTex = new THREE.CanvasTexture(slc); slTex.wrapS = slTex.wrapT = THREE.RepeatWrapping; slTex.repeat.set(1, 1.4);
const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(TV.sw, TV.sh), new THREE.MeshBasicMaterial({ map: slTex, transparent: true, depthWrite: false }));
scanPlane.position.set(TV.sx, TV.sy, TV.sz + 0.003); scanPlane.visible = false; scene.add(scanPlane);
// what the tube shows around the picture / while loading
const stc = canvas(256, 200), stx = stc.getContext('2d'), stTex = tex(stc);
function tubeMsg(lines, col) {
  stx.fillStyle = '#05060a'; stx.fillRect(0, 0, 256, 200);
  if (lines) { stx.fillStyle = col || '#ffe14a'; stx.font = '13px ' + PIX; stx.textAlign = 'center'; stx.textBaseline = 'middle'; lines.forEach((l, i) => stx.fillText(l, 128, 100 + (i - (lines.length - 1) / 2) * 22)); }
  stTex.needsUpdate = true;
}
let tvOrigMap = null;
function tubeTake(lines, col) { if (!RV.tvBusy) { tvOrigMap = TV.scr.material.map; RV.tvBusy = true; } tubeMsg(lines, col); TV.scr.material.map = stTex; TV.scr.material.needsUpdate = true; }
function tubeRelease() { if (!RV.tvBusy) return; RV.tvBusy = false; TV.scr.material.map = tvOrigMap || TV.tex; TV.scr.material.needsUpdate = true; vidPlane.visible = false; scanPlane.visible = false; }

// ---------------------------------------------------------------- 3D buttons
function btnTex(text, w, h, bg, fg) {
  const c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = Math.max(3, h * 0.08); x.strokeRect(x.lineWidth, x.lineWidth, w - 2 * x.lineWidth, h - 2 * x.lineWidth);
  x.fillStyle = fg; x.font = Math.round(h * 0.36) + 'px ' + PIX; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 1); return tex(c);
}
function button(text, w, h, data, parent, opts) {
  opts = opts || {};
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: btnTex(text, 512, Math.round(512 * h / w), opts.bg || '#1a0f2e', opts.fg || '#ffe14a'), transparent: true, toneMapped: false, depthTest: !opts.top, depthWrite: !opts.top }));
  if (opts.top) m.renderOrder = 22;
  m.userData = data; (parent || scene).add(m); hitables.push(m);
  fontRedraws.push(() => { m.material.map = btnTex(text, 512, Math.round(512 * h / w), opts.bg || '#1a0f2e', opts.fg || '#ffe14a'); m.material.needsUpdate = true; });
  return m;
}
// BIG SCREEN button on the TV, in the bezel strip under the picture
const bigBtn = button('BIG SCREEN', 0.17, 0.038, { btn: 'big' });
bigBtn.position.set(TV.sx, TV.sy - TV.sh / 2 - 0.028, TV.sz + 0.003); bigBtn.visible = false;
// the console: clicking it ejects; clicking the screen while an episode plays opens the big screen
hitBox(0.56, 0.1, 0.12, SLOT.x, SLOT.y, SLOT.z - 0.02, { console: true });
const screenHit = hitBox(TV.sw, TV.sh, 0.02, TV.sx, TV.sy, TV.sz + 0.01, { screen: true });

// ---------------------------------------------------------------- the big screen
// 'wall': projected on the front wall exactly across from the TV (same x as the TV picture), between the door and the right-hand
//         corner. That stretch of wall is empty: the door frame ends at x = -0.915, the right wall is at x = RX.
// 'view': desktop only (FULL SCREEN button / F key), fills the view, drawn over everything.
const big = new THREE.Group(); big.visible = false; scene.add(big);
const WALL = { x: TV.sx, y: 1.42, z: RZ - 0.04, s: 1.15 };   // 3.6 cm off the wallpaper, clear of the picture rail and skirting
let bigMode = 'wall';
const BW = 2.4, BH = BW * 9 / 16;
const frameM = new THREE.Mesh(new THREE.PlaneGeometry(BW + 0.08, BH + 0.08), new THREE.MeshBasicMaterial({ color: 0x0b0814, depthTest: false, depthWrite: false })); frameM.renderOrder = 20; big.add(frameM);
const bigVid = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshBasicMaterial({ map: vtex, depthTest: false, depthWrite: false, toneMapped: false })); bigVid.position.z = 0.002; bigVid.renderOrder = 21; bigVid.userData = { btn: 'pause' }; big.add(bigVid); hitables.push(bigVid);
const backBtn = button('BACK TO TV', 0.6, 0.13, { btn: 'back' }, big, { top: true }); backBtn.position.set(0.36, -BH / 2 - 0.13, 0.004);
const pauseBtn = button('PAUSE', 0.46, 0.13, { btn: 'pause' }, big, { top: true }); pauseBtn.position.set(-0.36, -BH / 2 - 0.13, 0.004);
let pauseTexP = btnTex('PAUSE', 512, 145, '#1a0f2e', '#ffe14a'), pauseTexR = btnTex('PLAY', 512, 145, '#1a0f2e', '#5ce07a');
fontRedraws.push(() => { const wasP = pauseBtn.material.map === pauseTexP; pauseTexP = btnTex('PAUSE', 512, 145, '#1a0f2e', '#ffe14a'); pauseTexR = btnTex('PLAY', 512, 145, '#1a0f2e', '#5ce07a'); pauseBtn.material.map = wasP || !playing.ep ? pauseTexP : pauseTexR; });
const titleC = canvas(1024, 64), titleX = titleC.getContext('2d'), titleT = tex(titleC);
const titleM = new THREE.Mesh(new THREE.PlaneGeometry(BW, BW * 64 / 1024), new THREE.MeshBasicMaterial({ map: titleT, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); titleM.position.set(0, BH / 2 + 0.11, 0.004); titleM.renderOrder = 22; big.add(titleM);
function setTitle(ep) { titleX.clearRect(0, 0, 1024, 64); titleX.fillStyle = ep.color; titleX.font = '26px ' + PIX; titleX.textAlign = 'center'; titleX.textBaseline = 'middle'; titleX.fillText('EP ' + ep.number + '  ' + ep.title.toUpperCase(), 512, 34); titleT.needsUpdate = true; }
const bigHit = [bigVid, backBtn, pauseBtn];
// on the wall the screen is part of the room (depth tested, so hands, rays and the Roomba sort properly); in 'view' it is drawn on top
function setBigOnTop(top) { for (const m of [frameM, bigVid, titleM, backBtn, pauseBtn]) { m.material.depthTest = !top; m.material.depthWrite = !top && m !== titleM && m !== backBtn && m !== pauseBtn; m.material.needsUpdate = true; } }

// ---------------------------------------------------------------- 'look behind you' cue, floats in front of your face until you turn round
function cueTex() {
  const w = 1024, h = 224, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = 'rgba(16,8,32,0.92)'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffe14a'; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10);
  x.fillStyle = '#ffe14a'; x.font = '58px ' + PIX; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('look behind you', w / 2, h / 2 + 4);
  return tex(c);
}
const CUE_W = 0.62, cue = new THREE.Mesh(new THREE.PlaneGeometry(CUE_W, CUE_W * 224 / 1024), new THREE.MeshBasicMaterial({ map: cueTex(), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
cue.renderOrder = 40; cue.visible = false; cue.name = 'look behind you'; scene.add(cue);
fontRedraws.push(() => { cue.material.map = cueTex(); cue.material.needsUpdate = true; });
let cueT = 0;
const _cf = new V3(), _ct = new V3(), _cto = new V3();
function headFwd() { camera.getWorldPosition(_hp); camera.getWorldQuaternion(_hq); _cf.set(0, 0, -1).applyQuaternion(_hq); _cf.y = 0; if (_cf.lengthSq() < 1e-4) _cf.set(0, 0, -1); return _cf.normalize(); }
function screenAngle() { const f = headFwd(); _ct.set(WALL.x - _hp.x, 0, WALL.z - _hp.z); if (_ct.lengthSq() < 1e-4) return 0; _ct.normalize(); return Math.acos(clamp(f.dot(_ct), -1, 1)) * 180 / Math.PI; }
function cueTarget(out) { const f = headFwd(); camera.getWorldPosition(_hp); return out.set(_hp.x + f.x * 1.15, _hp.y - 0.08, _hp.z + f.z * 1.15); }
function showCue() { cueTarget(cue.position); camera.getWorldPosition(_hp); cue.lookAt(_hp); cue.visible = true; cueT = 0; }
function hideCue() { cue.visible = false; }
function cueTick(dt) {
  if (!cue.visible) return;
  cueT += dt;
  if (!bigOn || bigMode !== 'wall' || cueT > 9 || (cueT > 0.4 && screenAngle() < 40)) { hideCue(); return; }
  cueTarget(_cto); cue.position.lerp(_cto, 1 - Math.exp(-dt * 5)); camera.getWorldPosition(_hp); cue.lookAt(_hp);
}
for (const m of bigHit) m.visible = true;
let bigOn = false;
const _hp = new V3(), _hq = new Q(), _fw = new V3();
function placeBig() {
  if (bigMode === 'wall') {
    if (big.parent !== scene) { if (big.parent) big.parent.remove(big); scene.add(big); }
    big.position.set(WALL.x, WALL.y, WALL.z); big.rotation.set(0, Math.PI, 0); big.scale.setScalar(WALL.s);   // faces back into the room, towards the TV
    setBigOnTop(false);
  } else {
    setBigOnTop(true);
    if (big.parent !== camera) camera.add(big);
    const th = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), needH = BH + 0.44, needW = BW + 0.1;
    const d = Math.max(needH / (2 * th), needW / (2 * th * camera.aspect)) * 1.02;
    big.position.set(0, -0.02, -d); big.quaternion.identity(); big.scale.setScalar(1);
  }
}
function openBig(mode) {
  if (!playing.ep) return;
  bigMode = renderer.xr.isPresenting ? 'wall' : (mode || 'wall');
  bigOn = true; placeBig(); big.visible = true; setTitle(playing.ep); updatePanner(); syncHtml();
  if (bigMode === 'wall' && screenAngle() > 75) showCue(); else hideCue();
}
function closeBig() { bigOn = false; big.visible = false; hideCue(); if (big.parent === camera) { camera.remove(big); scene.add(big); } updatePanner(); syncHtml(); }

// ---------------------------------------------------------------- audio routing
let vSrc = null, vPan = null, vGain = null;
function ctx() { return R.audio && R.audio.ctx; }
function wireVideo() {
  const A = ctx(); if (!A || vSrc) return;
  try {
    vSrc = A.createMediaElementSource(video); vGain = A.createGain(); vGain.gain.value = 1.0;
    vPan = A.createPanner(); vPan.panningModel = 'HRTF'; vPan.distanceModel = 'inverse'; vPan.refDistance = 1.3; vPan.rolloffFactor = 0.8; vPan.maxDistance = 20;
    vSrc.connect(vGain); vGain.connect(vPan); vPan.connect(A.destination); updatePanner();
  } catch (e) { console.warn('video audio routing', e); }
}
const _bp = new V3();
function updatePanner() {
  if (!vPan) return; let p;
  if (bigOn) { big.getWorldPosition(_bp); p = _bp; } else p = { x: TV.sx, y: TV.sy, z: TV.sz };
  if (vPan.positionX) { vPan.positionX.value = p.x; vPan.positionY.value = p.y; vPan.positionZ.value = p.z; } else vPan.setPosition(p.x, p.y, p.z);
}

// ---------------------------------------------------------------- playing an episode
const playing = { ep: null, cart: null };
let inserted = null;
function playEpisode(c) {
  stopRecord('episode');
  wireVideo();
  const url = new URL(c.ep.video, new URL(BASE, location.href)).href;
  playing.ep = c.ep; playing.cart = c;
  tubeTake(['EP ' + c.ep.number, 'LOADING...'], c.ep.color);
  if (video.src !== url) { video.src = url; video.preload = 'auto'; }
  try { video.currentTime = 0; } catch (e) { }
  const pr = video.play(); if (pr && pr.catch) pr.catch(err => { if (playing.cart === c) tubeMsg(['EP ' + c.ep.number, 'PRESS THE', 'SCREEN TO PLAY'], c.ep.color); console.warn('video play', err && err.name); });
  setLed(true); syncHtml();
}
video.addEventListener('playing', () => { if (!playing.ep) return; tubeMsg(null); vidPlane.visible = true; scanPlane.visible = true; bigBtn.visible = true; pauseBtn.material.map = pauseTexP; });
video.addEventListener('pause', () => { pauseBtn.material.map = pauseTexR; syncHtml(); });
video.addEventListener('play', () => { pauseBtn.material.map = pauseTexP; syncHtml(); });
video.addEventListener('ended', () => { pauseBtn.material.map = pauseTexR; });
video.addEventListener('error', () => { if (playing.ep) { vidPlane.visible = false; tubeMsg(['EP ' + playing.ep.number, 'NO SIGNAL', 'TRY AGAIN'], '#ff6a6a'); } });
function stopEpisode() {
  if (!playing.ep) return;
  video.pause(); playing.ep = null; playing.cart = null;
  closeBig(); bigBtn.visible = false; tubeRelease(); setLed(false); syncHtml();
}
function togglePause() {
  if (!playing.ep) return;
  if (video.paused || video.ended) { stopRecord('episode'); if (video.ended) video.currentTime = 0; const pr = video.play(); if (pr && pr.catch) pr.catch(() => { }); }
  else video.pause();
}

// ---------------------------------------------------------------- slot light on the console
const led = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.004), new THREE.MeshBasicMaterial({ color: 0x3a1010 }));
led.position.set(SLOT.x - 0.2 + 0.06, SLOT.y + 0.012, SLOT.z + 0.004); scene.add(led);
function setLed(on) { led.material.color.setHex(on ? 0xff3030 : 0x3a1010); }

// ---------------------------------------------------------------- insert / eject
function insert(c) {
  if (inserted && inserted !== c) { const old = inserted; ejectCart(); sendHome(old, 'quick'); }
  c.state = 'inserting'; c.by = null;
  const pre = IN_POS.clone(); pre.z += 0.12;
  animTo(c, pre, Q_IN, 0.22, 0, () => { animTo(c, IN_POS, Q_IN, 0.16, 0, () => { c.state = 'in'; inserted = c; clunk(); RV.haptic && RV.haptic('insert', 40); }); });
  // start the episode right now, inside the trigger press, so the browser allows the sound
  inserted = c; playEpisode(c);
}
function ejectCart() {
  const c = inserted; if (!c) return null;
  inserted = null; stopEpisode(); click(); return c;
}

// ================================================================ record player corner (right wall)
const CAB = { x0: RX - 0.36, x1: RX, z0: -1.52, z1: -0.86, top: 0.62 };
OBST.push({ t: 'box', x0: CAB.x0, x1: CAB.x1, z0: CAB.z0, z1: CAB.z1, who: 'both', name: 'record cabinet' });
const rp = { spin: 0, spinV: 0, arm: 0, armT: 0, on: false };
const PL = new THREE.Group(); PL.position.set(RX - 0.19, CAB.top, -1.28); PL.rotation.y = -Math.PI / 2; scene.add(PL);   // local +z faces into the room
(function corner() {
  const cx = (CAB.x0 + CAB.x1) / 2, cz = (CAB.z0 + CAB.z1) / 2, W = CAB.z1 - CAB.z0, D = CAB.x1 - CAB.x0;
  const wood = phong({ color: 0xc89a62, shininess: 25 }), woodD = phong({ color: 0x7a5232, shininess: 10 });
  blk(D, 0.025, W, wood, cx, CAB.top - 0.0125, cz);
  blk(D, 0.025, W, wood, cx, 0.05, cz);
  for (const s of [-1, 1]) blk(D, CAB.top - 0.04, 0.025, wood, cx, CAB.top / 2, cz + s * (W / 2 - 0.0125));
  blk(D, 0.022, W - 0.05, wood, cx, 0.33, cz);
  blk(0.012, CAB.top - 0.025, W - 0.054, woodD, RX - 0.006, (CAB.top - 0.025) / 2, cz);   // tucked between the sides and under the top
  for (const s of [-1, 1]) for (const k of [0.04, D - 0.04]) blk(0.03, 0.04, 0.03, woodD, CAB.x0 + k, 0.02, cz + s * (W / 2 - 0.04));
  // the record collection, spines out
  const sp = [0xf2c12e, 0xe8452c, 0x2b7de9, 0xffffff, 0x1b1b1b, 0xff7ad6, 0x40c090, 0xa050e0, 0xe86a1a, 0x20304a];
  for (let i = 0; i < 22; i++) blk(0.18, 0.18 + (i % 2) * 0.01, 0.009, phong({ color: sp[(i * 7) % sp.length] }), cx + 0.02 - ((i % 5 === 4) ? 0.003 : 0), 0.0625 + 0.095, CAB.z0 + 0.05 + i * 0.012).rotation.x = (i % 5 === 4) ? 0.12 : 0;   // leaning ones stick out 3 mm so spines don't share a plane
  for (let i = 0; i < 9; i++) blk(0.19, 0.19, 0.012, phong({ color: sp[(i * 3 + 2) % sp.length] }), cx + 0.02 - (i === 8 ? 0.003 : 0), 0.345 + 0.1, CAB.z0 + 0.06 + i * 0.016).rotation.x = i === 8 ? 0.3 : 0;
  blk(0.2, 0.2, 0.12, phong({ color: 0xd8c8a0 }), cx + 0.02, 0.345 + 0.1, CAB.z1 - 0.15);   // a shoebox of singles
})();
// the player itself: a red 80s portable, lid up, a 7-inch on the platter
const RED = phong({ color: 0xd31f2a, shininess: 70, specular: 0x553333 }), CREAM = phong({ color: 0xf2e6cc, shininess: 30 }), SILVER = phong({ color: 0xc8c8d0, shininess: 90, specular: 0x888888 });
const PW = 0.34, PD = 0.27, PH = 0.085;
blk(PW, PH, PD, RED, 0, PH / 2, 0, PL);
blk(PW + 0.004, 0.012, PD + 0.004, CREAM, 0, 0.012, 0, PL);
blk(PW - 0.02, 0.004, PD - 0.02, phong({ color: 0x2a2a30, shininess: 30 }), 0, PH + 0.002, 0, PL);
// handle on the front, knobs, the power light, a label-maker name strip and stickers
blk(0.12, 0.012, 0.02, CREAM, 0, 0.045, PD / 2 + 0.014, PL); for (const s of [-1, 1]) blk(0.012, 0.012, 0.02, CREAM, s * 0.055, 0.045, PD / 2 + 0.005, PL);
for (const s of [0.12, 0.085]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.012, 14), CREAM); k.rotation.x = Math.PI / 2; k.position.set(s, 0.05, PD / 2 + 0.006); PL.add(k); }
const pwr = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3a0a0a })); pwr.position.set(0.145, 0.072, PD / 2 + 0.002); PL.add(pwr);
function decal(w, h, draw, x, y, z, parent, rx) { const c = canvas(Math.round(w * 2000), Math.round(h * 2000)), g = c.getContext('2d'); draw(g, c.width, c.height); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhongMaterial({ map: tex(c), transparent: true, shininess: 40 })); m.position.set(x, y, z); if (rx) m.rotation.x = rx; parent.add(m); return m; }
decal(0.09, 0.018, (g, w, h) => { g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f4f4'; g.font = 'bold ' + Math.round(h * 0.7) + 'px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('UNITY', w / 2, h / 2 + 1); }, -0.1, 0.06, PD / 2 + 0.0015, PL);
decal(0.03, 0.028, (g, w, h) => { g.fillStyle = '#ff7ad6'; g.beginPath(); g.moveTo(w / 2, h * 0.92); g.bezierCurveTo(-w * 0.2, h * 0.4, w * 0.2, -h * 0.2, w / 2, h * 0.28); g.bezierCurveTo(w * 0.8, -h * 0.2, w * 1.2, h * 0.4, w / 2, h * 0.92); g.fill(); }, -0.02, 0.06, PD / 2 + 0.0015, PL);
decal(0.03, 0.03, (g, w, h) => { g.fillStyle = '#ffe14a'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = (k % 2 ? 0.2 : 0.48) * w; g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } g.fill(); }, 0.03, 0.062, PD / 2 + 0.0015, PL);
// lid: hinged at the back, standing open, speaker grille facing the room
const lidPivot = new THREE.Group(); lidPivot.position.set(0, PH, -PD / 2); lidPivot.rotation.x = -1.72; PL.add(lidPivot);
blk(PW, 0.016, PD, RED, 0, 0.008, PD / 2, lidPivot);
const grill = decal(0.2, 0.2, (g, w, h) => { g.fillStyle = '#efe2c4'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.48, 0, 7); g.fill(); g.fillStyle = '#8a7a60'; for (let y = 0; y < h; y += 22) for (let x = 0; x < w; x += 22) if ((x - w / 2) ** 2 + (y - h / 2) ** 2 < (w * 0.44) ** 2) { g.beginPath(); g.arc(x + 11, y + 11, 5, 0, 7); g.fill(); } }, 0, -0.0005, PD / 2, lidPivot, Math.PI / 2);
grill.rotation.x = Math.PI / 2;
decal(0.12, 0.024, (g, w, h) => { g.fillStyle = '#d8b04a'; g.fillRect(0, 0, w, h); g.fillStyle = '#5a1010'; g.font = 'bold ' + Math.round(h * 0.62) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DISCO KID', w / 2, h / 2 + 1); }, 0, -0.0012, PD - 0.03, lidPivot, Math.PI / 2);
// platter + record (spins), spindle and the yellow 45 adapter
const plat = new THREE.Group(); plat.position.set(-0.045, PH + 0.004, 0.005); PL.add(plat);
const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.008, 40), phong({ color: 0x1c1c1c })); mat.position.y = 0.004; plat.add(mat);
const recC = canvas(512, 512), rx2 = recC.getContext('2d');
(function drawRecord() {
  const g = rx2, c = 256; g.fillStyle = '#0c0c0e'; g.beginPath(); g.arc(c, c, 255, 0, 7); g.fill();
  for (let r = 250; r > 100; r -= 2.2) { g.strokeStyle = 'rgba(255,255,255,' + (0.025 + 0.03 * Math.abs(Math.sin(r * 0.37))) + ')'; g.lineWidth = 1; g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke(); }
  const sh = g.createLinearGradient(0, 0, 512, 512); sh.addColorStop(0.35, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.1)'); sh.addColorStop(0.65, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.beginPath(); g.arc(c, c, 250, 0, 7); g.fill();
  // label: hot pink with a gold ring, XANADU / OLIVIA NEWTON-JOHN, a big 45 hole
  g.fillStyle = '#e8337a'; g.beginPath(); g.arc(c, c, 98, 0, 7); g.fill(); g.strokeStyle = '#ffd36a'; g.lineWidth = 4; g.beginPath(); g.arc(c, c, 90, 0, 7); g.stroke();
  g.fillStyle = '#fff4d0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 30px sans-serif'; g.fillText('XANADU', c, c - 56); g.font = 'bold 13px sans-serif'; g.fillText('OLIVIA NEWTON-JOHN', c, c + 52); g.font = '11px sans-serif'; g.fillText('45 RPM', c + 62, c); g.fillText('A', c - 62, c);
  g.fillStyle = '#0c0c0e'; g.beginPath(); g.arc(c, c, 19, 0, 7); g.fill();
})();
const recT = tex(recC);
const rec = new THREE.Mesh(new THREE.CircleGeometry(0.0875, 48), new THREE.MeshPhongMaterial({ map: recT, shininess: 90, specular: 0x444444 })); rec.rotation.x = -Math.PI / 2; rec.position.y = 0.0095; plat.add(rec);
const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.004, 3), phong({ color: 0xffd23a })); adapter.position.y = 0.011; plat.add(adapter);
const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.02, 6), SILVER); spindle.position.set(-0.045, PH + 0.014, 0.005); PL.add(spindle);
// tonearm: pivot at the back right, swings in over the record
const armPivot = new THREE.Group(); armPivot.position.set(0.11, PH + 0.004, -0.085); PL.add(armPivot);
const armBase = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.018, 14), SILVER); armBase.position.y = 0.009; armPivot.add(armBase);
const armLift = new THREE.Group(); armLift.position.y = 0.022; armPivot.add(armLift);
const armTube = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.15, 6), SILVER); armTube.rotation.x = Math.PI / 2; armTube.position.z = 0.075; armLift.add(armTube);
const head = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.006, 0.026), phong({ color: 0x202020, shininess: 40 })); head.position.set(0, -0.003, 0.152); armLift.add(head);
const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.016, 10), SILVER); cw.rotation.x = Math.PI / 2; cw.position.z = -0.02; armLift.add(cw);
const rest = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.02, 6), SILVER); rest.position.set(0.125, PH + 0.01, 0.07); PL.add(rest);
const ARM_PARK = 0.08, ARM_OUT = -0.6, ARM_IN = -0.88;   // radians about y (0 = straight to the front)
armPivot.rotation.y = ARM_PARK;
// The deck is scenery; the sleeves below are the record selectors.
// the sleeve propped against the wall, the hairbrush microphone, a sticky note, fairy lights, the poster
const SLEEVE = { x: RX - 0.02, z: -0.98 };
const slvC = canvas(512, 512), slvX = slvC.getContext('2d'), slvT = tex(slvC);
function drawSleeve(img) {
  const g = slvX; g.fillStyle = '#1a0a3a'; g.fillRect(0, 0, 512, 512);
  if (img) { const s = img.width / 512; g.drawImage(img, 0, img.height * 0.33, img.width, img.width * 0.75, 0, 120, 512, 384); }
  const gr = g.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, '#12062c'); gr.addColorStop(1, 'rgba(18,6,44,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 220);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff3fd1'; g.shadowBlur = 24; g.fillStyle = '#ffe9ff'; g.font = 'bold 92px sans-serif'; g.fillText('XANADU', 256, 78);
  g.shadowColor = '#3ff0ff'; g.shadowBlur = 14; g.font = 'bold 30px sans-serif'; g.fillStyle = '#d8fbff'; g.fillText('OLIVIA NEWTON-JOHN', 256, 148); g.shadowBlur = 0;
  g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(452, 452, 40, 0, 7); g.fill(); g.fillStyle = '#5a1010'; g.font = 'bold 30px sans-serif'; g.fillText('45', 452, 455);
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 6; g.strokeRect(3, 3, 506, 506);
  slvT.needsUpdate = true;
}
drawSleeve(null);
const slv = new THREE.Group(); slv.position.set(SLEEVE.x - 0.02, CAB.top, SLEEVE.z); slv.rotation.y = -Math.PI / 2; scene.add(slv);
const slvTilt = new THREE.Group(); slvTilt.rotation.x = -0.16; slv.add(slvTilt);
const slvFront = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), new THREE.MeshPhongMaterial({ map: slvT, shininess: 30 })); slvFront.position.set(0, 0.09, 0.002); slvTilt.add(slvFront);
const slvBack = new THREE.Mesh(G.box, phong({ color: 0xe8dcc0 })); slvBack.scale.set(0.18, 0.18, 0.003); slvBack.position.set(0, 0.09, 0); slvTilt.add(slvBack);
// Album definitions keep the cover hit targets and their audio together.
const albums = {
  xanadu: { title: 'Xanadu', audio: 'assets/audio/xanadu_story.m4a' },
  littleRoom: { title: 'Little Room for You', audio: 'assets/audio/little_room_for_you.mp3' }
};
const xanaduHit = hitBox(0.18, 0.18, 0.018, 0, 0.09, 0.005, { album: 'xanadu' }, slvTilt);
// A second sleeve rests on the floor beside the cabinet, leaning against the wall.
const littleSleeve = new THREE.Group(); littleSleeve.position.set(RX - 0.04, 0.002, -0.72); littleSleeve.rotation.y = -Math.PI / 2; scene.add(littleSleeve);
const littleTilt = new THREE.Group(); littleTilt.rotation.x = -0.16; littleSleeve.add(littleTilt);
const littleTexture = new THREE.TextureLoader().load('assets/img/little_room_for_you.jpg'); littleTexture.encoding = THREE.sRGBEncoding; littleTexture.anisotropy = 4;
const littleFront = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshPhongMaterial({ map: littleTexture, shininess: 30 })); littleFront.position.set(0, 0.11, 0.002); littleTilt.add(littleFront);
const littleBack = new THREE.Mesh(G.box, phong({ color: 0xe8dcc0 })); littleBack.scale.set(0.22, 0.22, 0.003); littleBack.position.set(0, 0.11, 0); littleTilt.add(littleBack);
const littleHit = hitBox(0.22, 0.22, 0.018, 0, 0.11, 0.005, { album: 'littleRoom' }, littleTilt);
// hairbrush (it was her microphone)
const hb = new THREE.Group(); hb.position.set(RX - 0.14, CAB.top + 0.012, -0.98); hb.rotation.y = 0.7; scene.add(hb);
const hbH = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.12, 10), phong({ color: 0xff7ad6, shininess: 60 })); hbH.rotation.z = Math.PI / 2; hbH.position.x = -0.06; hb.add(hbH);
const hbHead = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.018, 18), phong({ color: 0xff7ad6, shininess: 60 })); hbHead.scale.set(1.3, 1, 0.85); hbHead.position.x = 0.03; hb.add(hbHead);
const hbB = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.01, 18), phong({ color: 0x1a1a1a })); hbB.scale.set(1.25, 1, 0.8); hbB.position.set(0.03, 0.012, 0); hb.add(hbB);
// sticky note on the wall
function handFont(px) { return 'bold ' + px + 'px "Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive'; }
const note = decal(0.11, 0.11, (g, w, h) => { g.fillStyle = '#ffe873'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 0, w, h * 0.12); g.fillStyle = '#2a1a6a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = handFont(30); g.fillText('my first', w / 2, h * 0.27); g.fillText('single!', w / 2, h * 0.47); g.font = handFont(24); g.fillText('age 9', w / 2, h * 0.67); g.fillStyle = '#e8337a'; g.font = handFont(34); g.fillText('\u2665', w / 2, h * 0.85); }, 0, 0, 0, scene);
note.position.set(RX - 0.004, CAB.top + 0.33, -0.95); note.rotation.set(0, -Math.PI / 2, 0.08);
// the poster: original roller-disco art, a little sun-faded, held up with tape
const POS = { z: -1.19, y: 1.44, w: 0.5, h: 0.72 };
const posterImg = new Image();
const posterTex = new THREE.Texture(posterImg); posterTex.encoding = THREE.sRGBEncoding; posterTex.anisotropy = 4;
posterImg.onload = () => { posterTex.needsUpdate = true; drawSleeve(posterImg); };
posterImg.src = 'assets/img/poster_xanadu.jpg';
const poster = new THREE.Mesh(new THREE.PlaneGeometry(POS.w, POS.h), new THREE.MeshPhongMaterial({ map: posterTex, shininess: 12, emissive: 0x1a0820 }));
poster.position.set(RX - 0.006, POS.y, POS.z); poster.rotation.y = -Math.PI / 2; poster.name = 'xanadu poster'; scene.add(poster);
const tapeM = phong({ color: 0xf0e8c8, transparent: true, opacity: 0.75 });
for (const [dz, dy, r] of [[-1, 1, 0.5], [1, 1, -0.5], [-1, -1, -0.5], [1, -1, 0.4]]) { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.022), tapeM); t.position.set(RX - 0.008, POS.y + dy * (POS.h / 2 - 0.008), POS.z + dz * (POS.w / 2 - 0.008)); t.rotation.set(0, -Math.PI / 2, r); stat.add(t); }
// fairy lights over the poster
const bulbs = [], bulbCols = [0xffd27a, 0xff7ad6, 0x7ae8ff];
const wireCurve = new THREE.CatmullRomCurve3([[-1.72, 1.86], [-1.5, 1.8], [-1.3, 1.84], [-1.1, 1.79], [-0.9, 1.83], [-0.72, 1.88]].map(([z, y]) => new V3(RX - 0.012, y, z)));
const wire = new THREE.Mesh(new THREE.TubeGeometry(wireCurve, 40, 0.0015, 4), phong({ color: 0x2a3a2a })); stat.add(wire);
const bulbG = new THREE.SphereGeometry(0.009, 8, 6);
const bulbMats = bulbCols.map(c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
for (let i = 0; i < 15; i++) { const p = wireCurve.getPoint((i + 0.5) / 15); const b = new THREE.Mesh(bulbG, bulbMats[i % 3]); b.position.copy(p); b.position.y -= 0.01; b.position.x -= 0.006; stat.add(b); }
const glowC = canvas(64, 64), glx = glowC.getContext('2d'); const rg = glx.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,210,150,0.55)'); rg.addColorStop(1, 'rgba(255,210,150,0)'); glx.fillStyle = rg; glx.fillRect(0, 0, 64, 64);
const glowM = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.5), glowM); glow.position.set(RX - 0.01, 1.78, -1.22); glow.rotation.y = -Math.PI / 2; scene.add(glow);

// ---------------------------------------------------------------- the record's sound: Unity's own recording (the 0:00.3-4:11.3 clip), positional from the deck
const recAudio = document.createElement('audio');
recAudio.preload = 'none'; recAudio.crossOrigin = 'anonymous';
recAudio.style.display = 'none'; document.body.appendChild(recAudio);
let rSrc = null, rGain = null, rPan = null;
function wireRecord() {
  const A = ctx(); if (!A || rSrc) return;
  try {
    // positional: her voice comes out of the record player's corner (HRTF panner at the deck, follows your head via the listener)
    rSrc = A.createMediaElementSource(recAudio); rGain = A.createGain(); rGain.gain.value = 0;
    rPan = A.createPanner(); rPan.panningModel = 'HRTF'; rPan.distanceModel = 'inverse'; rPan.refDistance = 0.7; rPan.rolloffFactor = 0.8; rPan.maxDistance = 12;
    if (rPan.positionX) { rPan.positionX.value = RP_POS.x; rPan.positionY.value = RP_POS.y; rPan.positionZ.value = RP_POS.z; } else rPan.setPosition(RP_POS.x, RP_POS.y, RP_POS.z);
    rSrc.connect(rGain); rGain.connect(rPan); rPan.connect(A.destination);
  }
  catch (e) { console.warn('record audio routing', e); }
}
const RP_POS = new V3(); PL.getWorldPosition(RP_POS); RP_POS.y += 0.08;
function recordGainAt(d) { return clamp(1.15 / (1 + Math.max(0, d - 0.8) * 0.6), 0.22, 1.0); }
let selectedAlbum = null, recordRequest = 0;
function startRecord(id) {
  id = id || 'xanadu';
  const album = albums[id]; if (!album) return;
  if (rp.on) stopRecord('switch');
  if (playing.ep && !video.paused) video.pause();
  wireRecord();
  selectedAlbum = id;
  recAudio.src = album.audio;
  rp.on = true; rp.armT = 0; rp.phase = 'cue';
  const request = ++recordRequest;
  const pr = recAudio.play();
  if (pr && pr.catch) pr.catch(err => {
    if (request !== recordRequest) return;
    console.warn('record play', err && err.name);
    rp.on = false; rp.phase = 'park'; pwr.material.color.setHex(0x3a0a0a); syncHtml();
  });
  pwr.material.color.setHex(0xff3a2a); click(); syncHtml();
}
function stopRecord(why) {
  if (!rp.on) return;
  ++recordRequest; rp.on = false; rp.phase = 'park'; recAudio.pause();
  pwr.material.color.setHex(0x3a0a0a); if (why !== 'episode' && why !== 'switch') click(); syncHtml();
}
recAudio.addEventListener('ended', () => { rp.on = false; rp.phase = 'park'; pwr.material.color.setHex(0x3a0a0a); syncHtml(); });
function toggleRecord(id) {
  id = id || 'xanadu';
  if (rp.on && selectedAlbum === id) stopRecord('user'); else startRecord(id);
}

// ================================================================ little sounds (WebAudio, tiny)
function blip(f0, f1, dur, type, vol, at) {
  const A = ctx(); if (!A) return; const t = A.currentTime, o = A.createOscillator(), g = A.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  let out = g; if (at) { const p = A.createPanner(); p.panningModel = 'HRTF'; p.refDistance = 0.6; if (p.positionX) { p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z; } else p.setPosition(at.x, at.y, at.z); g.connect(p); out = p; }
  o.connect(g); out.connect(A.destination); o.start(t); o.stop(t + dur + 0.02);
  if (R.audio) R.audio.quietUntil = Math.max(R.audio.quietUntil || 0, t + dur + 0.3);
}
function clunk() { blip(180, 60, 0.12, 'square', 0.12, MOUTH); }
function click() { blip(1400, 600, 0.04, 'square', 0.05); }
function chime() { blip(880, 1320, 0.25, 'triangle', 0.06); setTimeout(() => blip(1320, 1760, 0.3, 'triangle', 0.05), 120); }

// ================================================================ holding cartridges
const holds = new Map();   // ctrl (or 'desk') -> cart
const Q_HAND = Q_IN.clone();   // connector forward, label up
const Q_DESK = new Q().setFromAxisAngle(new V3(1, 0, 0), 0.55).multiply(Q_IN);
const _m = new THREE.Matrix4(), _p = new V3(), _q = new Q(), _s = new V3();
function grab(c, by) {
  if (c.state === 'in') { ejectCart(); }
  for (const [k, v] of holds) if (v === c) holds.delete(k);
  if (holds.get(by)) { const prev = holds.get(by); holds.delete(by); sendHome(prev, 'quick'); }
  c.state = 'held'; c.by = by; c.anim = { fly: true, t: 0, dur: 0.18, p0: c.g.position.clone(), q0: c.g.quaternion.clone() }; holds.set(by, c);
  click(); RV.haptic && RV.haptic('grab', 25);
}
function holdPose(by, outP, outQ) {
  if (by === 'desk') {
    camera.updateMatrixWorld(); _m.copy(camera.matrixWorld); _m.decompose(_p, _q, _s);
    outP.set(0.15, -0.16, -0.4).applyQuaternion(_q).add(_p); outQ.copy(_q).multiply(Q_DESK);
  } else {
    by.updateMatrixWorld(); by.matrixWorld.decompose(_p, _q, _s);
    outP.set(0, -0.015, -0.085).applyQuaternion(_q).add(_p); outQ.copy(_q).multiply(Q_HAND);
  }
}
function dropCart(c, x, z) {
  for (const [k, v] of holds) if (v === c) holds.delete(k);
  c.by = null;
  if (Math.abs(x) > RX - 0.08 || Math.abs(z) > RZ - 0.08 || RV.blocked(x, z, 0.07, 'player') || RV.blocked(x, z, 0.07, 'roomba')) { sendHome(c); return; }
  c.state = 'falling'; c.vy = 0; c.x = x; c.z = z; c.anim = null;
  c.fallQ = Q_IN.clone().premultiply(new Q().setFromAxisAngle(new V3(0, 1, 0), Math.random() * 6.28));
}
function nearShelf(p) { return p.x < SH.x1 + 0.25 && p.z > SH.z0 - 0.15 && p.z < SH.z1 + 0.15 && p.y > SH.top - 0.3 && p.y < SH.top + 0.5; }
function release(by, rayHit) {
  const c = holds.get(by); if (!c) return false;
  const p = c.g.position;
  if ((rayHit && (rayHit.console || rayHit.screen)) || p.distanceTo(MOUTH) < 0.25) { holds.delete(by); insert(c); return true; }
  if ((rayHit && rayHit.cart && rayHit.cart.state === 'shelf') || nearShelf(p)) { holds.delete(by); sendHome(c, 'quick'); return true; }
  if (rayHit && rayHit.floorHit && by === 'desk') { dropCart(c, rayHit.floorHit.x, rayHit.floorHit.z); return true; }
  dropCart(c, p.x, p.z); return true;
}

// ================================================================ ray picking
const ray = new THREE.Raycaster(); ray.far = 9;
function pick(o, d) {
  ray.set(o, d);
  const list = hitables.filter(m => {
    for (let n = m; n; n = n.parent) if (!n.visible && n !== m) return false;   // inside a hidden group
    if (m.material !== invis && !m.visible) return false;
    const u = m.userData; if (u.cart && (u.cart.state === 'held' || u.cart.state === 'inserting' || u.cart.state === 'returning')) return false;
    if (u.screen && !playing.ep) return false;
    return true;
  });
  const hits = ray.intersectObjects(list, false);
  // the big screen is drawn on top of everything, so it wins when it is open
  if (bigOn && bigMode === 'view') { const h = hits.find(h => bigHit.includes(h.object)); if (h) return Object.assign({ t: h.distance }, h.object.userData); }
  if (!hits.length) return null;
  const h = hits[0]; return Object.assign({ t: h.distance, point: h.point }, h.object.userData);
}
function floorOf(o, d) { if (d.y < -0.02) { const t = -o.y / d.y; if (t < 7) return { x: o.x + d.x * t, z: o.z + d.z * t, t }; } return null; }
function useHit(h, by) {
  if (h.btn === 'big') { openBig('wall'); click(); return true; }
  if (h.btn === 'back') { closeBig(); click(); return true; }
  if (h.btn === 'pause') { togglePause(); click(); return true; }
  if (h.album) { toggleRecord(h.album); return true; }
  if (h.screen) { if (video.paused && playing.ep) togglePause(); else openBig('wall'); click(); return true; }
  if (h.cart) { grab(h.cart, by); return true; }
  if (h.console) { if (inserted) { const c = inserted; ejectCart(); grab(c, by); } else { chirpNo(); } return true; }
  return false;
}
function chirpNo() { blip(300, 220, 0.12, 'square', 0.05, MOUTH); }

// VR: trigger pressed / released
function selectStart(c, o, d) {
  if (holds.get(c)) return true;   // already holding something in this hand: the release decides
  const h = pick(o, d); if (!h) return false;
  if (h.t > (h.cart && h.cart.state === 'floor' ? 7 : 6)) return false;
  return useHit(h, c);
}
function selectEnd(c, o, d) {
  if (!holds.get(c)) return false;
  const h = pick(o, d); return release(c, h);
}
// desktop: one click picks up, the next click puts it somewhere
function click2(o, d) {
  const held = holds.get('desk'), h = pick(o, d);
  if (held) {
    if (h && h.btn) return useHit(h, 'desk');
    if (h && h.cart && h.cart.state !== 'shelf') { release('desk', null); return true; }
    if (h && h.cart && h.cart.state === 'shelf') { holds.delete('desk'); sendHome(held, 'quick'); grab(h.cart, 'desk'); return true; }
    const f = floorOf(o, d);
    if (h && (h.console || h.screen)) return release('desk', h);
    if (h && h.album) { toggleRecord(h.album); return true; }
    if (f && (!h || h.t > f.t)) return release('desk', { floorHit: f });
    if (h && h.point && nearShelf(h.point)) { holds.delete('desk'); sendHome(held, 'quick'); return true; }
    return release('desk', f ? { floorHit: f } : null);
  }
  if (!h) return false;
  return useHit(h, 'desk');
}
function hoverT(o, d) { const h = pick(o, d); return h ? h.t : null; }

// ================================================================ the Roomba and loose cartridges
function floorCart(x, z, maxD) {
  let best = null, bd = maxD || 99;
  for (const c of carts) if (c.state === 'floor' && !RV.blocked(c.x, c.z, 0.15, 'roomba')) { const dd = Math.hypot(c.x - x, c.z - z); if (dd < bd) { bd = dd; best = c; } }
  return best;
}
function ride(c) { if (c.state !== 'floor') return; c.state = 'riding'; c.anim = null; }
function unride(c, x, z, hidden) {
  if (c.state !== 'riding') return;
  x = clamp(x, -RX + 0.1, RX - 0.1); z = clamp(z, -RZ + 0.1, RZ - 0.1);
  c.state = 'floor'; c.x = x; c.z = z; c.g.position.set(x, CT / 2 + 0.001, z);
  c.returnAt = performance.now() / 1000 + (hidden ? 22 + Math.random() * 16 : 60);
}

// ================================================================ frame
const _hp2 = new THREE.Vector3(), _hq2 = new THREE.Quaternion();
let twinkleT = 0;
function tick(dt, T) {
  const now = performance.now() / 1000;
  for (const c of carts) {
    const g = c.g;
    if (c.state === 'held') {
      holdPose(c.by, _hp2, _hq2);
      if (c.anim && c.anim.fly) { c.anim.t += dt; const k = ease(clamp(c.anim.t / c.anim.dur, 0, 1)); g.position.lerpVectors(c.anim.p0, _hp2, k); g.quaternion.slerpQuaternions(c.anim.q0, _hq2, k); if (k >= 1) c.anim = null; }
      else { g.position.copy(_hp2); g.quaternion.copy(_hq2); }
      // pushing it into the slot by hand
      if (c.by !== 'desk' && !c.anim && g.position.distanceTo(MOUTH) < 0.11) { holds.delete(c.by); insert(c); }
      continue;
    }
    if (c.anim) {
      const a = c.anim; a.t += dt; const k = ease(clamp(a.t / a.dur, 0, 1));
      g.position.lerpVectors(a.p0, a.p1, k); g.position.y += Math.sin(k * Math.PI) * a.arc; g.quaternion.slerpQuaternions(a.q0, a.q1, k);
      if (k >= 1) { c.anim = null; a.done && a.done(); }
      continue;
    }
    if (c.state === 'falling') {
      c.vy -= 9.8 * dt; g.position.y += c.vy * dt; g.quaternion.slerp(c.fallQ, clamp(dt * 9, 0, 1));
      if (g.position.y <= CT / 2 + 0.001) { g.position.set(c.x, CT / 2 + 0.001, c.z); g.quaternion.copy(c.fallQ); c.state = 'floor'; c.returnAt = now + 75; clunk(); }
      continue;
    }
    if (c.state === 'riding') {
      const B = R.b; const st = R.state();
      if (st !== 'carry' && st !== 'bump') { unride(c, B.x, B.z, true); continue; }
      g.position.set(B.x, 0.085 + 0.014 + CT / 2, B.z); g.quaternion.copy(Q_IN).premultiply(_hq2.setFromAxisAngle(new V3(0, 1, 0), B.h + Math.PI));
      c.x = B.x; c.z = B.z; continue;
    }
    if (c.state === 'floor' && now > c.returnAt) sendHome(c);
  }
  // the episode on the TV: the room glows with it
  if (playing.ep && TV.light) TV.light.intensity = video.paused ? 0.25 : 0.5 + Math.sin(T * 9) * 0.06 + Math.sin(T * 23) * 0.04;
  cueTick(dt);
  // record player
  const target = rp.on ? 4.71 : 0;
  rp.spinV += clamp(target - rp.spinV, -dt * 6, dt * 6); rp.spin += rp.spinV * dt; plat.rotation.y = -rp.spin;
  let aimArm = ARM_PARK, lift = 0.006;
  if (rp.on) {
    rp.armT += dt; const dur = recAudio.duration || 251, prog = clamp((recAudio.currentTime || 0) / dur, 0, 1);
    aimArm = ARM_OUT + (ARM_IN - ARM_OUT) * prog;
    lift = rp.armT < 0.9 ? 0.006 : 0;
  }
  armPivot.rotation.y += clamp(aimArm - armPivot.rotation.y, -dt * 1.6, dt * 1.6);
  armLift.position.y += clamp(0.022 + lift - armLift.position.y, -dt * 0.03, dt * 0.03);
  // her voice lives in the corner: louder near the record player
  if (rGain && ctx()) { camera.getWorldPosition(_hp); const d = _hp.distanceTo(RP_POS); rGain.gain.setTargetAtTime(rp.on ? 1.0 : 0, ctx().currentTime, 0.08); }
  // fairy lights breathe
  twinkleT += dt; if (twinkleT > 0.1) { twinkleT = 0; bulbMats.forEach((m, i) => m.color.setHex(bulbCols[i]).multiplyScalar(0.75 + 0.25 * Math.sin(T * (1.3 + i * 0.4) + i * 2))); glowM.opacity = rp.on ? 0.95 + Math.sin(T * 3) * 0.05 : 0.7; }
}

// ================================================================ desktop buttons (HTML)
const $ = id => document.getElementById(id);
function syncHtml() {
  const b = $('bBig'); if (!b) return;
  b.classList.toggle('gone', !playing.ep || renderer.xr.isPresenting);
  b.textContent = bigOn ? 'BACK TO TV' : 'FULL SCREEN';
}
setTimeout(() => {
  const b = $('bBig'); if (b) b.addEventListener('click', e => { e.stopPropagation(); if (bigOn) closeBig(); else openBig('view'); });
  syncHtml();
}, 0);
addEventListener('keydown', e => { if (e.code === 'Escape' && bigOn) closeBig(); if (e.code === 'KeyF' && playing.ep) { if (bigOn) closeBig(); else openBig('view'); } });
addEventListener('resize', () => { if (bigOn && bigMode === 'view' && !renderer.xr.isPresenting) placeBig(); });
renderer.xr.addEventListener('sessionstart', () => { if (bigOn) { closeBig(); openBig('wall'); } syncHtml(); });
renderer.xr.addEventListener('sessionend', () => { if (bigOn) { const m = bigMode; closeBig(); openBig(m); } for (const [k, c] of holds) if (k !== 'desk') { holds.delete(k); sendHome(c, 'quick'); } syncHtml(); });

// Set up audio routing on a gesture without starting either media element.
function unlock() { wireRecord(); wireVideo(); }

// ================================================================ merge the static furniture (fewer draw calls on the Quest)
(function merge() {
  if (RV.QS && RV.QS.has('nomerge')) return;   // debug: keep every piece separate
  stat.updateMatrixWorld(true);
  const groups = new Map();
  stat.traverse(o => { if (o.isMesh) { const k = o.material.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); } });
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const pos = [], nor = [], uv = [], nm = new THREE.Matrix3();
    for (const o of list) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0); }
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(mg, list[0].material); m.userData.merged = true; scene.add(m);
    for (const o of list) o.parent.remove(o);
  }
})();

if (document.fonts && document.fonts.load) document.fonts.load('20px "Press Start 2P"').then(() => fontRedraws.forEach(f => f())).catch(() => { });

RV.media = { tick, selectStart, selectEnd, click: click2, hoverT, floorCart, ride, unride, unlock, carts, playing: () => (!!playing.ep && !video.paused) || rp.on,
  _debug: { rPan: () => rPan, vPan: () => vPan, bigBtn, backBtn, xanaduHit, littleHit, albums, selectedAlbum: () => selectedAlbum, playing, video, recAudio, rp, carts, insert, ejectCart, grab, release, openBig, closeBig, cue, big, WALL, bigMode: () => bigMode, screenAngle, toggleRecord, startRecord, stopRecord, holds, pick, sendHome, dropCart, bigOn: () => bigOn, inserted: () => inserted, poster, PL, RP_POS } };
})();
