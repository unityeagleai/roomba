// The Roomba's room: Unity's 80s bedroom from the charlie-season arcade site, built in 3D.
// Everything is drawn here at load time on canvases (no big downloads): weathered wallpaper with the ghosts of old posters,
// worn navy carpet the Roomba leaves clean stripes on, glow stars on the popcorn ceiling, the lava lamp, the CRT, the shelf
// of season cartridges, the posters cropped from the arcade room. Light enough for the Quest browser: no shadows, ~60 meshes.
(function () {
const RV = window.RV = window.RV || {};
const QS = RV.QS = new URLSearchParams(location.search);
const UA = navigator.userAgent || '';
const isHeadset = RV.isHeadset = /OculusBrowser|Quest|Pico|Wolvic/i.test(UA) || QS.has('quest');

// ------------------------------------------------------------ renderer, scene, camera, rig
const renderer = new THREE.WebGLRenderer({ antialias: !isHeadset, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isHeadset ? 1 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
if (isHeadset) renderer.xr.setFramebufferScaleFactor(0.9);
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x06040c);
scene.fog = new THREE.Fog(0x0a0614, 7, 16);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 60);
const rig = new THREE.Group(); rig.add(camera); scene.add(rig);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
Object.assign(RV, { renderer, scene, camera, rig });

// ------------------------------------------------------------ helpers
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function makeNoise(seed, period) {
  const r = rng(seed), g = new Float32Array(period * period); for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const i0 = ((xi % period) + period) % period, i1 = (i0 + 1) % period, j0 = ((yi % period) + period) % period, j1 = (j0 + 1) % period;
    const a = g[j0 * period + i0], b = g[j0 * period + i1], c = g[j1 * period + i0], d = g[j1 * period + i1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(n, x, y, oct) { let a = 0.5, f = 1, s = 0, t = 0; for (let o = 0; o < oct; o++) { s += a * n(x * f, y * f); t += a; a *= 0.5; f *= 2; } return s / t; }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, rep, nearest) {
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; }
  return t;
}
// multiply a canvas by weathering: low mottling, grain, optional extra per-pixel function (returns [mul, add])
function weather(c, seed, opts) {
  opts = opts || {};
  const ctx = c.getContext('2d'), w = c.width, h = c.height, id = ctx.getImageData(0, 0, w, h), d = id.data;
  const n = makeNoise(seed, 32), n2 = makeNoise(seed + 7, 64), r = rng(seed + 3);
  const sx = 32 / w * (opts.scale || 4), sy = 32 / h * (opts.scale || 4) * (opts.aspect || 1);
  const mott = opts.mottle == null ? 0.22 : opts.mottle, grain = opts.grain == null ? 0.07 : opts.grain;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    let m = 1 - mott * 0.5 + mott * fbm(n, x * sx, y * sy, 4);
    m += (r() - 0.5) * grain;
    let add = 0;
    if (opts.fn) { const o = opts.fn(x / w, y / h, n2); m *= o[0]; add = o[1]; }
    d[i] = Math.max(0, Math.min(255, d[i] * m + add));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * m + add * (opts.warm ? 0.9 : 1)));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * m + add * (opts.warm ? 0.6 : 1)));
  }
  ctx.putImageData(id, 0, 0);
  return c;
}
const rgb = (r, g, b) => `rgb(${r},${g},${b})`;
const PIX = '"Press Start 2P", monospace';
RV.util = { rng, makeNoise, fbm, canvas, tex, weather, PIX };

// ------------------------------------------------------------ the room's footprint (metres). Back wall is -Z (TV), door in front (+Z).
const RX = 2.6, RZ = 2.2, RH = 2.6;
RV.room = { RX, RZ, RH };
// obstacles in the floor plane. who: 'both' blocks Unity and the Roomba; 'player' only Unity (the Roomba fits under the bed);
// 'roomba' only the Roomba (things you would step over).
const OBST = RV.obstacles = [];
function box(x0, x1, z0, z1, who, name) { OBST.push({ t: 'box', x0, x1, z0, z1, who, name }); }
function circ(x, z, r, who, name) { OBST.push({ t: 'circ', x, z, r, who, name }); }

// ------------------------------------------------------------ materials
const M = RV.mat = {};
function phong(o) { return new THREE.MeshPhongMaterial(Object.assign({ shininess: 8, specular: 0x111111 }, o)); }

// wallpaper: purple stripes + memphis confetti, then life: mottling, a yellowed top, a grimy skirting band, scuffs, water
// streaks, brighter rectangles where posters used to hang (with old tape), and one misprinted strip that slipped sideways.
function wallpaper(wm, seed, ghosts) {
  const W = 1024, H = 512, c = canvas(W, H), x = c.getContext('2d'), ppm = W / wm, r = rng(seed);
  x.fillStyle = rgb(52, 34, 90); x.fillRect(0, 0, W, H);
  const per = 0.26 * ppm;
  for (let s = 0; s < W; s += per) { x.fillStyle = rgb(60, 40, 104); x.fillRect(s, 0, per * 0.38, H); x.fillStyle = rgb(44, 28, 78); x.fillRect(s + per * 0.42, 0, Math.max(1, per * 0.05), H); }
  const step = 0.13 * ppm;
  for (let yy = step * 0.6; yy < H; yy += step) for (let xx = ((yy / step | 0) % 2) * step * 0.5 + 4; xx < W; xx += step) {
    const k = (Math.round(xx * 7 + yy * 3)) % 5;
    if (k === 0) { x.strokeStyle = rgb(63, 200, 200); x.lineWidth = 2.2; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 5, yy - 4); x.lineTo(xx + 10, yy); x.lineTo(xx + 15, yy - 4); x.stroke(); }
    else if (k === 2) { x.fillStyle = rgb(220, 70, 180); x.beginPath(); x.arc(xx, yy, 2.6, 0, 6.3); x.fill(); }
    else if (k === 4 && r() < 0.5) { x.fillStyle = rgb(255, 225, 74); x.beginPath(); x.moveTo(xx, yy - 4); x.lineTo(xx + 4, yy + 3); x.lineTo(xx - 4, yy + 3); x.fill(); }
  }
  // the happy accident: a strip that was pasted 6 cm off
  const gx = Math.floor(r() * (W - 140)), gw = 60 + Math.floor(r() * 50);
  const strip = x.getImageData(gx, 0, gw, H); x.putImageData(strip, gx, Math.floor(0.06 * ppm));
  x.fillStyle = 'rgba(20,10,30,.55)'; x.fillRect(gx, 0, gw, Math.floor(0.06 * ppm));
  // ghosts of old posters + old tape
  for (const g of ghosts || []) {
    const gx0 = (g[0] + wm / 2) * ppm, gy0 = (RH - g[1]) * (H / RH), gw0 = g[2] * ppm, gh0 = g[3] * (H / RH);
    x.fillStyle = 'rgba(150,120,200,.16)'; x.fillRect(gx0 - gw0 / 2, gy0 - gh0 / 2, gw0, gh0);
    x.fillStyle = 'rgba(236,230,200,.55)'; for (const [tx, ty] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) x.fillRect(gx0 + tx * gw0 / 2 - 6, gy0 + ty * gh0 / 2 - 3, 12, 6);
  }
  return weather(c, seed, {
    scale: 5, mottle: 0.3, grain: 0.08, aspect: 0.5, fn: (u, v, n) => {
      let m = 1, add = 0;
      if (v < 0.12) { m *= 0.9 + v; add += (0.12 - v) * 90; }                       // nicotine-yellow ceiling line
      if (v > 0.9) m *= 0.75 + (1 - v) * 2.5;                                        // grime near the floor
      const st = n(u * 40, v * 3);                                                 // water streaks
      if (st > 0.82) m *= 0.85;
      if (n(u * 90 + 3, v * 12) > 0.9 && v > 0.6) m *= 0.7;                        // scuffs
      return [m, add];
    }, warm: true
  });
}
const wallMatBack = phong({ map: tex(wallpaper(RX * 2, 11, [[-1.75, 1.95, 0.5, 0.65], [0.55, 2.05, 0.45, 0.35]])) });
const wallMatFront = phong({ map: tex(wallpaper(RX * 2, 23, [[0.6, 1.5, 0.6, 0.8]])) });
const wallMatSide = phong({ map: tex(wallpaper(RZ * 2, 37, [[0.4, 1.7, 0.5, 0.6]])) });
const wallMatSide2 = phong({ map: tex(wallpaper(RZ * 2, 41, [])) });
for (const m of [wallMatBack, wallMatFront, wallMatSide, wallMatSide2]) m.bumpMap = m.map, m.bumpScale = 0.004;
function plane(w, h, mat, pos, rotY) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(pos[0], pos[1], pos[2]); m.rotation.y = rotY || 0; scene.add(m); return m; }
plane(RX * 2, RH, wallMatBack, [0, RH / 2, -RZ], 0);
plane(RX * 2, RH, wallMatFront, [0, RH / 2, RZ], Math.PI);
plane(RZ * 2, RH, wallMatSide, [-RX, RH / 2, 0], Math.PI / 2);
plane(RZ * 2, RH, wallMatSide2, [RX, RH / 2, 0], -Math.PI / 2);

// carpet: navy, speckled, fibrous, worn; tiled
(function () {
  const S = 512, c = canvas(S, S), x = c.getContext('2d'), r = rng(5), id = x.createImageData(S, S), d = id.data, n = makeNoise(9, 32), nf = makeNoise(19, 128);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const i = (y * S + xx) * 4, q = r();
    let col = q < 0.07 ? [38, 64, 96] : q < 0.1 ? [24, 42, 66] : q < 0.103 ? [120, 60, 140] : [30, 52, 80];
    const m = 0.8 + 0.35 * fbm(n, xx / 16, y / 16, 4) + 0.18 * (nf(xx / 1.5, y / 1.5) - 0.5);
    d[i] = col[0] * m; d[i + 1] = col[1] * m; d[i + 2] = col[2] * m; d[i + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  const t = tex(c, [3, 2.5]);
  M.carpet = phong({ map: t, bumpMap: t, bumpScale: 0.01, shininess: 2 });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2), M.carpet); fl.rotation.x = -Math.PI / 2; scene.add(fl);
})();
// the Roomba's clean stripes on the carpet (a canvas the Roomba draws on as it drives; uploaded twice a second)
(function () {
  const W = 256, H = Math.round(256 * RZ / RX), c = canvas(W, H), x = c.getContext('2d');
  // a few old stains and a worn path by the door, so the floor already has a history
  x.fillStyle = 'rgba(12,8,4,.35)'; x.beginPath(); x.ellipse(W * 0.62, H * 0.72, 9, 6, 0.4, 0, 6.3); x.fill();
  x.strokeStyle = 'rgba(30,18,8,.25)'; x.lineWidth = 2; x.beginPath(); x.ellipse(W * 0.3, H * 0.4, 6, 5, 0, 0, 5.5); x.stroke();
  x.fillStyle = 'rgba(10,8,14,.25)'; x.beginPath(); x.ellipse(W * 0.24, H * 0.92, 30, 10, 0, 0, 6.3); x.fill();
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.9 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.003; m.renderOrder = 1; scene.add(m);
  let dirty = false, acc = 0;
  RV.cleanStripe = (px, pz, heading, width) => {
    const u = (px + RX) / (2 * RX) * W, v = (pz + RZ) / (2 * RZ) * H, s = width / (2 * RX) * W;
    x.save(); x.translate(u, v); x.rotate(-heading); x.fillStyle = 'rgba(120,150,190,0.05)'; x.fillRect(-s, -1, s * 2, 2); x.restore(); dirty = true;
  };
  RV.cleanTick = dt => { acc += dt; if (dirty && acc > 0.5) { acc = 0; dirty = false; t.needsUpdate = true; } };
})();

// ceiling: popcorn plaster, a water ring, glow-in-the-dark stars (emissive)
(function () {
  const S = 512, c = canvas(S, S), x = c.getContext('2d'), e = canvas(S, S), ex = e.getContext('2d'), r = rng(77);
  x.fillStyle = rgb(178, 170, 160); x.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { const g = 120 + r() * 90; x.fillStyle = rgb(g, g - 6, g - 14); x.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  x.strokeStyle = 'rgba(120,96,50,.35)'; x.lineWidth = 5; x.beginPath(); x.arc(S * 0.7, S * 0.3, 40, 0, 6.3); x.stroke();
  ex.fillStyle = '#000'; ex.fillRect(0, 0, S, S);
  function star(cx, cy, R, ctx, col) { ctx.fillStyle = col; ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? R * 0.45 : R; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.fill(); }
  for (let i = 0; i < 26; i++) { const cx = r() * S, cy = r() * S, R = 6 + r() * 12; star(cx, cy, R, x, rgb(200, 220, 170)); star(cx, cy, R, ex, rgb(120, 255, 170)); }
  ex.fillStyle = rgb(120, 255, 170); ex.beginPath(); ex.arc(S * 0.35, S * 0.62, 22, 0, 6.3); ex.fill(); ex.fillStyle = '#000'; ex.beginPath(); ex.arc(S * 0.35 + 9, S * 0.62 - 5, 20, 0, 6.3); ex.fill();
  weather(c, 78, { mottle: 0.25, grain: 0.05 });
  const t = tex(c), te = tex(e);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2), phong({ map: t, bumpMap: t, bumpScale: 0.01, emissiveMap: te, emissive: 0x9fffc0, emissiveIntensity: 0.55 }));
  m.rotation.x = Math.PI / 2; m.position.y = RH; scene.add(m);
})();

// wood
function woodTex(seed, base, w, h) {
  w = w || 256; h = h || 512; const c = canvas(w, h), x = c.getContext('2d'), r = rng(seed), n = makeNoise(seed, 16);
  x.fillStyle = rgb(base[0], base[1], base[2]); x.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { const yy = r() * h, a = 0.08 + r() * 0.16; x.strokeStyle = `rgba(60,30,12,${a})`; x.lineWidth = 0.6 + r() * 2.2; x.beginPath(); for (let xx = 0; xx <= w; xx += 8) x.lineTo(xx, yy + Math.sin(xx / 37 + i) * 5 + (n(xx / 40, i) - 0.5) * 14); x.stroke(); }
  for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(50,24,10,.4)'; x.beginPath(); x.ellipse(r() * w, r() * h, 3 + r() * 5, 7 + r() * 9, 0, 0, 6.3); x.fill(); }
  for (let i = 0; i < 30; i++) { x.strokeStyle = 'rgba(230,200,160,.12)'; x.lineWidth = 0.8; const sx = r() * w, sy = r() * h; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (r() - 0.5) * 40, sy + (r() - 0.5) * 10); x.stroke(); }
  return weather(c, seed + 1, { mottle: 0.18, grain: 0.06 });
}
const woodT = tex(woodTex(3, [150, 94, 52])), woodT2 = tex(woodTex(4, [120, 76, 44]));
M.wood = phong({ map: woodT, bumpMap: woodT, bumpScale: 0.006, shininess: 22, specular: 0x2a2018 });
M.woodDark = phong({ map: woodT2, bumpMap: woodT2, bumpScale: 0.006, shininess: 30, specular: 0x2a2018 });
M.cream = phong({ color: 0xc4b6a0 });
M.ink = phong({ color: 0x100820 });
const G = { box: new THREE.BoxGeometry(1, 1, 1) };
function blk(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(G.box, mat); m.scale.set(w, h, d); m.position.set(x, y, z); (parent || scene).add(m); return m; }
RV.blk = blk;

// skirting board + picture rail (scuffed cream)
(function () {
  const c = canvas(512, 32), x = c.getContext('2d'); x.fillStyle = rgb(196, 182, 160); x.fillRect(0, 0, 512, 32); x.fillStyle = rgb(232, 222, 204); x.fillRect(0, 0, 512, 4);
  weather(c, 61, { mottle: 0.25, grain: 0.1, fn: (u, v, n) => [n(u * 200, 1) > 0.85 ? 0.6 : 1, 0] });
  const mt = phong({ map: tex(c, [4, 1]) });
  blk(RX * 2, 0.12, 0.02, mt, 0, 0.06, -RZ + 0.01); blk(RX * 2, 0.12, 0.02, mt, 0, 0.06, RZ - 0.01);
  blk(0.02, 0.12, RZ * 2, mt, -RX + 0.01, 0.06, 0); blk(0.02, 0.12, RZ * 2, mt, RX - 0.01, 0.06, 0);
  const pr = phong({ color: 0x543a84 });
  blk(RX * 2, 0.04, 0.02, pr, 0, RH - 0.12, -RZ + 0.01); blk(RX * 2, 0.04, 0.02, pr, 0, RH - 0.12, RZ - 0.01);
  blk(0.02, 0.04, RZ * 2, pr, -RX + 0.01, RH - 0.12, 0); blk(0.02, 0.04, RZ * 2, pr, RX - 0.01, RH - 0.12, 0);
})();

// ------------------------------------------------------------ window with the night city + pink curtains (back wall, left)
(function () {
  const c = canvas(256, 256), x = c.getContext('2d'), r = rng(8);
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, rgb(10, 12, 38)); g.addColorStop(0.7, rgb(18, 20, 58)); g.addColorStop(1, rgb(46, 34, 80)); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,255,230,${0.3 + r() * 0.7})`; x.fillRect(r() * 256, r() * 150, 1.5, 1.5); }
  x.fillStyle = rgb(250, 240, 190); x.beginPath(); x.arc(185, 52, 22, 0, 6.3); x.fill(); x.fillStyle = rgb(10, 12, 38); x.beginPath(); x.arc(197, 45, 20, 0, 6.3); x.fill();
  for (let bx = 0; bx < 256; bx += 18 + r() * 10) { const bh = 40 + r() * 80, bw = 14 + r() * 14; x.fillStyle = rgb(24, 22, 54); x.fillRect(bx, 256 - bh, bw, bh); for (let wy = 256 - bh + 6; wy < 252; wy += 8) for (let wx = bx + 3; wx < bx + bw - 3; wx += 6) if (r() < 0.3) { x.fillStyle = r() < 0.5 ? rgb(255, 210, 90) : rgb(255, 225, 74); x.fillRect(wx, wy, 3, 4); } }
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.9), new THREE.MeshBasicMaterial({ map: tex(c), fog: false }));
  sky.position.set(-1.9, 1.45, -RZ + 0.004); scene.add(sky);
  const fr = phong({ color: 0xe2d6c4 });
  blk(0.9, 0.05, 0.06, fr, -1.9, 1.925, -RZ + 0.03); blk(0.9, 0.05, 0.06, fr, -1.9, 0.975, -RZ + 0.03);
  blk(0.05, 0.95, 0.06, fr, -2.33, 1.45, -RZ + 0.03); blk(0.05, 0.95, 0.06, fr, -1.47, 1.45, -RZ + 0.03);
  blk(0.03, 0.9, 0.04, fr, -1.9, 1.45, -RZ + 0.025); blk(0.84, 0.03, 0.04, fr, -1.9, 1.45, -RZ + 0.025);
  blk(1.0, 0.04, 0.16, phong({ color: 0xc8baa4 }), -1.9, 0.95, -RZ + 0.08);   // sill
  // curtains: pink with folds
  const cc = canvas(128, 256), cx = cc.getContext('2d'); cx.fillStyle = rgb(232, 80, 170); cx.fillRect(0, 0, 128, 256);
  for (let xx = 0; xx < 128; xx += 12) { const gr = cx.createLinearGradient(xx, 0, xx + 12, 0); gr.addColorStop(0, 'rgba(120,20,80,.45)'); gr.addColorStop(0.5, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(120,20,80,.45)'); cx.fillStyle = gr; cx.fillRect(xx, 0, 12, 256); }
  weather(cc, 88, { mottle: 0.2 });
  const cm = phong({ map: tex(cc), side: THREE.DoubleSide });
  for (const sx of [-2.47, -1.33]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 1.25, 6, 1), cm); const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 60) * 0.025); m.geometry.computeVertexNormals(); m.position.set(sx, 1.38, -RZ + 0.07); scene.add(m); }
  blk(1.3, 0.03, 0.03, phong({ color: 0x966e46 }), -1.9, 2.02, -RZ + 0.07);
})();

// ------------------------------------------------------------ posters (cropped from the arcade room, pixel-crisp), with tape
const loader = new THREE.TextureLoader();
function poster(file, w, h, pos, rotY, tilt) {
  const t = loader.load('assets/img/' + file); t.encoding = THREE.sRGBEncoding; t.magFilter = THREE.NearestFilter;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), phong({ map: t, shininess: 30, specular: 0x222222 }));
  m.position.set(pos[0], pos[1], pos[2]); m.rotation.set(0, rotY || 0, tilt || 0); scene.add(m);
  const tape = phong({ color: 0xece6c8, transparent: true, opacity: 0.8 });
  for (const s of [-1, 1]) { const tp = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.025), tape); tp.position.set(s * w * 0.45, h * 0.5, 0.001); tp.rotation.z = s * 0.3; m.add(tp); }
  return m;
}
poster('poster_roomba_king.png', 0.42, 0.55, [-1.0, 1.62, -RZ + 0.005], 0, 0.02);
poster('poster_the_papers.png', 0.36, 0.52, [-0.45, 1.5, -RZ + 0.005], 0, -0.03);
poster('poster_no_push.png', 0.62, 0.33, [2.1, 1.98, -RZ + 0.005], 0, 0.01);
poster('poster_liminal.png', 0.6, 0.48, [RX - 0.005, 1.55, -0.2], -Math.PI / 2, 0);

// ------------------------------------------------------------ bed along the left wall, headboard on the wall, room to hide under
(function () {
  const X0 = -RX, X1 = -0.6, Z0 = -0.35, Z1 = 0.75, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2, L = X1 - X0, Wd = Z1 - Z0;
  blk(0.06, 1.05, Wd + 0.06, M.wood, X0 + 0.03, 0.525, cz);                                  // headboard
  blk(0.04, 0.32, Wd - 0.2, phong({ color: 0xc4844f }), X0 + 0.07, 0.8, cz);
  blk(L, 0.16, 0.05, M.wood, cx, 0.3, Z0 + 0.025); blk(L, 0.16, 0.05, M.wood, cx, 0.3, Z1 - 0.025); blk(0.05, 0.3, Wd, M.wood, X1 - 0.025, 0.37, cz);
  for (const [lx, lz] of [[X0 + 0.1, Z0 + 0.05], [X0 + 0.1, Z1 - 0.05], [X1 - 0.05, Z0 + 0.05], [X1 - 0.05, Z1 - 0.05]]) { blk(0.06, 0.22, 0.06, M.woodDark, lx, 0.11, lz); box(lx - 0.03, lx + 0.03, lz - 0.03, lz + 0.03, 'roomba', 'bed leg'); }
  // dark under the bed
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(L, Wd), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.set(cx, 0.004, cz); scene.add(sh);
  // slats underneath so it's dark but real
  blk(L - 0.1, 0.02, Wd - 0.1, phong({ color: 0x20140c }), cx, 0.37, cz);
  // mattress + sheet
  const sc = canvas(128, 128); sc.getContext('2d').fillStyle = rgb(240, 236, 226); sc.getContext('2d').fillRect(0, 0, 128, 128); weather(sc, 31, { mottle: 0.12 });
  blk(L - 0.08, 0.2, Wd - 0.04, phong({ map: tex(sc) }), cx + 0.02, 0.48, cz);
  // quilt: teal with pink triangles + yellow squares (the arcade blanket), worn, draped over the sides
  const qc = canvas(512, 256), q = qc.getContext('2d'); q.fillStyle = rgb(70, 200, 210); q.fillRect(0, 0, 512, 256);
  for (let xx = 0; xx < 512; xx += 32) { q.fillStyle = rgb(255, 63, 209); q.beginPath(); q.moveTo(xx, 256); q.lineTo(xx + 16, 222); q.lineTo(xx + 32, 256); q.fill(); q.beginPath(); q.moveTo(xx, 0); q.lineTo(xx + 16, 34); q.lineTo(xx + 32, 0); q.fill(); }
  for (let yy = 60; yy < 200; yy += 34) for (let xx = 10 + (yy % 68 ? 18 : 0); xx < 512; xx += 40) { q.fillStyle = rgb(255, 225, 74); q.fillRect(xx, yy, 9, 9); q.strokeStyle = rgb(16, 8, 32); q.lineWidth = 3; q.beginPath(); q.moveTo(xx + 18, yy + 16); q.lineTo(xx + 26, yy + 8); q.stroke(); }
  weather(qc, 33, { mottle: 0.28, grain: 0.1, fn: (u, v, n) => [n(u * 30, v * 15) > 0.8 ? 0.82 : 1, 0] });
  const qt = tex(qc), quilt = phong({ map: qt, bumpMap: qt, bumpScale: 0.005 });
  const qg = new THREE.BoxGeometry(1, 1, 1, 12, 2, 8), qp = qg.attributes.position;
  for (let i = 0; i < qp.count; i++) { const px = qp.getX(i), py = qp.getY(i), pz = qp.getZ(i); qp.setY(i, py + Math.sin(px * 9) * 0.04 * (py > 0 ? 1 : 0) + Math.sin(pz * 7 + px * 3) * 0.03 * (py > 0 ? 1 : 0)); }
  qg.computeVertexNormals();
  const qm = new THREE.Mesh(qg, quilt); qm.scale.set(L * 0.66, 0.26, Wd + 0.06); qm.position.set(X1 - L * 0.33, 0.47, cz); scene.add(qm);
  // pillow
  const pg = new THREE.SphereGeometry(0.5, 16, 8); const pil = new THREE.Mesh(pg, phong({ color: 0xf6f2e8 })); pil.scale.set(0.3, 0.12, 0.62); pil.position.set(X0 + 0.28, 0.63, cz); scene.add(pil);
  // the zombie plush (green, pixel eyes)
  const z = new THREE.Group(); z.position.set(X1 - 0.35, 0.66, Z1 - 0.25); z.rotation.y = -0.6; scene.add(z);
  const zg = phong({ color: 0x5ce07a }); blk(0.14, 0.16, 0.08, zg, 0, 0.08, 0, z); blk(0.1, 0.1, 0.09, zg, 0, 0.21, 0, z); blk(0.1, 0.03, 0.09, phong({ color: 0x46964f }), 0, 0.27, 0, z);
  blk(0.02, 0.02, 0.01, M.ink, -0.025, 0.22, 0.046, z); blk(0.02, 0.02, 0.01, M.ink, 0.025, 0.22, 0.046, z); blk(0.05, 0.01, 0.01, phong({ color: 0x287838 }), 0, 0.185, 0.046, z);
  blk(0.04, 0.1, 0.04, zg, -0.09, 0.1, 0.02, z).rotation.z = 0.8; blk(0.04, 0.1, 0.04, zg, 0.09, 0.1, 0.02, z).rotation.z = -0.8;
  box(X0, X1, Z0, Z1, 'player', 'bed');
})();

// ------------------------------------------------------------ nightstand + lava lamp (the warm light of the room)
(function () {
  const x0 = -RX, x1 = -2.12, z0 = -0.88, z1 = -0.4, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  blk(x1 - x0, 0.55, z1 - z0, M.wood, cx, 0.275, cz);
  blk(0.01, 0.18, 0.36, M.woodDark, x1 + 0.004, 0.38, cz); blk(0.01, 0.18, 0.36, M.woodDark, x1 + 0.004, 0.16, cz);
  blk(0.015, 0.02, 0.06, phong({ color: 0xe6c878, shininess: 80 }), x1 + 0.01, 0.38, cz); blk(0.015, 0.02, 0.06, phong({ color: 0xe6c878, shininess: 80 }), x1 + 0.01, 0.16, cz);
  box(x0, x1, z0, z1, 'both', 'nightstand');
  const gold = phong({ color: 0xc4aa5a, shininess: 60, specular: 0x665533 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.12, 16), gold); base.position.set(cx, 0.61, cz); scene.add(base);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.05, 16), gold); cap.position.set(cx, 0.95, cz); scene.add(cap);
  // glass with moving wax blobs (one tiny shader)
  const lavaMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } }, transparent: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform float uT; varying vec3 vP; float b(vec3 p, vec3 c, float r){ return r*r/max(dot(p-c,p-c),1e-4); }\n void main(){ vec3 p = vP*vec3(1.,1.,1.); float s = 0.;\n s += b(p, vec3(0.008*sin(uT*.7), -0.12+0.1*sin(uT*.31), 0.), 0.022);\n s += b(p, vec3(-0.01, 0.02+0.12*sin(uT*.23+2.), 0.006), 0.018);\n s += b(p, vec3(0.006, 0.1*sin(uT*.17+4.), -0.005), 0.015);\n s += b(p, vec3(0., -0.15, 0.), 0.03);\n float w = smoothstep(0.9, 1.3, s);\n vec3 liquid = vec3(0.55, 0.1, 0.32); vec3 wax = vec3(1.0, 0.55, 0.22);\n gl_FragColor = vec4(mix(liquid, wax, w), 1.); }'
  });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.3, 18, 1, true), lavaMat); glass.position.set(cx, 0.82, cz); scene.add(glass);
  RV.lava = lavaMat;
  const L = new THREE.PointLight(0xff7040, 1.15, 4.2, 1.4); L.position.set(cx + 0.15, 0.95, cz); scene.add(L); RV.lavaLight = L;
  // glow on the wall behind it
  const gc = canvas(128, 128), gx = gc.getContext('2d'), gr = gx.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(255,120,60,.55)'); gr.addColorStop(1, 'rgba(255,120,60,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 128, 128);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: tex(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.set(-RX + 0.006, 0.9, cz); glow.rotation.y = Math.PI / 2; scene.add(glow);
})();

// ------------------------------------------------------------ dresser + CRT TV (static, test card, the Roomba's channel)
(function () {
  const x0 = 0.0, x1 = 1.5, z0 = -RZ, z1 = -1.72, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  blk(x1 - x0, 0.72, z1 - z0, M.wood, cx, 0.36, cz);
  for (const dx of [0.37, 1.12]) for (const dy of [0.22, 0.52]) { blk(0.66, 0.24, 0.012, M.woodDark, dx, dy, z1 + 0.006); blk(0.1, 0.022, 0.02, phong({ color: 0xe6c878, shininess: 80 }), dx, dy, z1 + 0.016); }
  box(x0, x1, z0, z1, 'both', 'dresser');
  const tx = 0.72, tz = -1.97;
  blk(0.66, 0.52, 0.46, M.woodDark, tx, 0.72 + 0.26, tz);
  blk(0.5, 0.44, 0.02, phong({ color: 0x24222c }), tx - 0.06, 0.98, tz + 0.232);
  blk(0.1, 0.44, 0.02, phong({ color: 0x3c3846 }), tx + 0.26, 0.98, tz + 0.232);
  for (const yy of [1.12, 1.03]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), phong({ color: 0xc8c8d8, shininess: 60 })); k.rotation.x = Math.PI / 2; k.position.set(tx + 0.26, yy, tz + 0.245); scene.add(k); }
  blk(0.015, 0.01, 0.01, new THREE.MeshBasicMaterial({ color: 0x3cff78 }), tx + 0.22, 0.79, tz + 0.245);
  const ant = phong({ color: 0xc8c8d8, shininess: 90 });
  for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 6), ant); a.position.set(tx + s * 0.12, 1.24 + 0.2, tz); a.rotation.z = -s * 0.5; scene.add(a); const bb = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), phong({ color: 0xff3c46 })); bb.position.set(tx + s * 0.24, 1.66, tz); scene.add(bb); }
  // screen
  const W = 160, H = 120, c = canvas(W, H), x = c.getContext('2d'), id = x.createImageData(W, H), r = rng(2);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.magFilter = THREE.NearestFilter;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.33), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); scr.position.set(tx - 0.06, 0.98, tz + 0.244); scene.add(scr);
  const sprite = new Image(); sprite.src = 'assets/img/roomba_sprite.png';
  const L = new THREE.PointLight(0x7ab4ff, 0.7, 3.2, 1.5); L.position.set(tx - 0.06, 1.0, tz + 0.6); scene.add(L);
  let acc = 0, mode = 0, modeT = 0, frameN = 0;
  const MODES = ['static', 'roomba', 'static', 'bars'];
  RV.tvTick = (dt, now) => {
    acc += dt; modeT += dt; if (acc < 1 / 12) return; acc = 0; frameN++;
    if (modeT > (MODES[mode] === 'static' ? 5 : 9)) { modeT = 0; mode = (mode + 1) % MODES.length; }
    const md = MODES[mode], d = id.data;
    if (md === 'static' || md === 'bars') {
      for (let i = 0; i < d.length; i += 4) { const v = r() * 200; d[i] = v * 0.8; d[i + 1] = v * 0.9; d[i + 2] = v; d[i + 3] = 255; }
      x.putImageData(id, 0, 0);
      if (md === 'bars') { const cols = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']; cols.forEach((cc, i) => { x.fillStyle = cc; x.globalAlpha = 0.85; x.fillRect(i * W / 7, 0, W / 7 + 1, H * 0.7); }); x.globalAlpha = 1; x.fillStyle = '#000'; x.fillRect(30, 50, 100, 18); x.fillStyle = '#fff'; x.font = '8px ' + PIX; x.textAlign = 'center'; x.fillText('NO PUSH', 80, 63); }
      L.intensity = 0.55 + r() * 0.25;
    } else {
      x.fillStyle = rgb(14, 16, 44); x.fillRect(0, 0, W, H);
      x.fillStyle = rgb(30, 52, 80); x.fillRect(0, 84, W, 36);
      const px = 20 + ((frameN * 3) % 260) - 50; if (sprite.complete) { x.imageSmoothingEnabled = false; x.drawImage(sprite, px, 52, 32, 34); }
      x.fillStyle = '#ffe14a'; x.font = '8px ' + PIX; x.textAlign = 'center'; x.fillText('CH 3', 80, 16); x.fillStyle = '#fff'; x.fillText('ROOMBA RAN', 80, 30); x.fillText('AWAY', 80, 41);
      for (let yy = 0; yy < H; yy += 2) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, yy, W, 1); }
      L.intensity = 0.6;
    }
    // rolling bar + the odd glitch tear
    const by = (frameN * 4) % H; x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, by, W, 10);
    if (r() < 0.06) { const yy = r() * H | 0, hh = 4 + r() * 10 | 0; const im = x.getImageData(0, yy, W, hh); x.putImageData(im, (r() - 0.5) * 30 | 0, yy); }
    t.needsUpdate = true;
  };
  // the TV cable runs down to a socket (the Roomba's favourite snack is the spare one on the floor)
  const cab = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(tx + 0.25, 0.8, tz - 0.15), new THREE.Vector3(1.45, 0.6, -2.17), new THREE.Vector3(1.55, 0.02, -2.15), new THREE.Vector3(1.62, 0.02, -2.18), new THREE.Vector3(1.66, 0.3, -2.19)]), 24, 0.008, 6), phong({ color: 0x18161c }));
  scene.add(cab);
  blk(0.08, 0.12, 0.015, phong({ color: 0xece4d0 }), 1.66, 0.3, -RZ + 0.008);
})();

// ------------------------------------------------------------ the cartridge shelf (one cartridge per episode of the season)
(function () {
  const x0 = 1.7, x1 = RX - 0.04, z0 = -RZ, z1 = -1.86, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  blk(w, 0.03, d, M.wood, cx, 1.585, cz); blk(0.03, 1.6, d, M.wood, x0 + 0.015, 0.8, cz); blk(0.03, 1.6, d, M.wood, x1 - 0.015, 0.8, cz);
  blk(w, 1.6, 0.01, phong({ color: 0x2e1a16 }), cx, 0.8, z0 + 0.012);
  for (const yy of [0.04, 0.42, 0.82, 1.2]) blk(w - 0.04, 0.025, d, M.wood, cx, yy, cz);
  blk(w - 0.06, 0.3, 0.012, M.woodDark, cx, 0.22, z1 - 0.006);
  box(x0, x1, z0, z1, 'both', 'shelf');
  const cols = ['#3aa0ff', '#ff3fd1', '#ff8a1f', '#5ce07a', '#ffe14a', '#3ff0e0', '#d6964a'];
  const lc = canvas(64, 64), lx = lc.getContext('2d'); lx.fillStyle = '#f0e8d0'; lx.fillRect(0, 0, 64, 64); lx.fillStyle = '#100820'; lx.fillRect(6, 30, 52, 4); lx.fillRect(6, 40, 40, 4); lx.fillRect(6, 50, 46, 4); weather(lc, 4, { mottle: 0.2 });
  const lt = tex(lc);
  cols.forEach((cc, i) => {
    const row = i < 4 ? 0.85 : 0.45, col = i < 4 ? i : i - 4;
    const g = new THREE.Group(); g.position.set(x0 + 0.13 + col * 0.17, row + 0.11, cz + 0.02); g.rotation.z = (i === 5 ? 0.18 : 0); scene.add(g);
    blk(0.12, 0.17, 0.03, phong({ color: new THREE.Color(cc).multiplyScalar(0.85), shininess: 40 }), 0, 0, 0, g);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), phong({ map: lt })); lab.position.set(0, 0.02, 0.016); g.add(lab);
  });
  // a boombox on the top, a cassette leaning on it
  blk(0.4, 0.2, 0.12, phong({ color: 0x2a2a30, shininess: 40 }), cx, 1.7, cz + 0.02);
  for (const s of [-1, 1]) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 18), phong({ color: 0x111114 })); sp.rotation.x = Math.PI / 2; sp.position.set(cx + s * 0.12, 1.69, cz + 0.083); scene.add(sp); }
  blk(0.1, 0.05, 0.01, phong({ color: 0x9a9aa4 }), cx, 1.75, cz + 0.083);
})();

// ------------------------------------------------------------ rug, the console, Unity's cushion, beanbag, door
(function () {
  const S = 512, c = canvas(S, S), x = c.getContext('2d');
  const rings = [[120, 40, 110], [160, 60, 150], [255, 140, 60], [160, 60, 150], [120, 40, 110]];
  rings.forEach((col, i) => { x.fillStyle = rgb(...col); x.beginPath(); x.arc(S / 2, S / 2, S / 2 - i * 44, 0, 6.3); x.fill(); });
  x.fillStyle = rgb(255, 225, 74); for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; x.fillRect(S / 2 + Math.cos(a) * 190 - 4, S / 2 + Math.sin(a) * 190 - 4, 8, 8); }
  weather(c, 51, { mottle: 0.3, grain: 0.14 });
  // frayed edge
  const id = x.getImageData(0, 0, S, S), d = id.data, r = rng(52);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) { const dd = Math.hypot(xx - S / 2, y - S / 2); if (dd > S / 2 - 6 - r() * 8) d[(y * S + xx) * 4 + 3] = 0; }
  x.putImageData(id, 0, 0);
  const t = tex(c);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 48), phong({ map: t, bumpMap: t, bumpScale: 0.01, transparent: true, alphaTest: 0.5 }));
  rug.rotation.x = -Math.PI / 2; rug.scale.set(1.15, 0.8, 1); rug.position.set(0.55, 0.006, -0.35); scene.add(rug);
  // console
  const con = new THREE.Group(); con.position.set(0.35, 0, -1.3); con.rotation.y = 0.15; scene.add(con);
  blk(0.34, 0.06, 0.2, phong({ color: 0x141418, shininess: 50 }), 0, 0.03, 0, con);
  blk(0.34, 0.025, 0.08, M.woodDark, 0, 0.065, 0.06, con);
  blk(0.12, 0.04, 0.05, phong({ color: 0x8a5a2a }), 0.06, 0.08, -0.04, con);
  for (let k = 0; k < 4; k++) blk(0.02, 0.012, 0.02, phong({ color: 0xc0c0c8 }), -0.12 + k * 0.04, 0.066, -0.06, con);
  const js = new THREE.Group(); js.position.set(0.62, 0, -0.95); js.rotation.y = -0.4; scene.add(js);
  blk(0.08, 0.035, 0.08, phong({ color: 0x141418 }), 0, 0.017, 0, js); const stk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.08, 8), phong({ color: 0x141418 })); stk.position.set(0, 0.07, 0); stk.rotation.x = 0.3; js.add(stk); blk(0.016, 0.008, 0.016, phong({ color: 0xff2a2a }), -0.025, 0.04, -0.025, js);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.6, 0.01, -0.98), new THREE.Vector3(0.5, 0.01, -1.1), new THREE.Vector3(0.45, 0.01, -1.2), new THREE.Vector3(0.42, 0.03, -1.24)]), 12, 0.004, 5), phong({ color: 0x101012 })); scene.add(cord);
  box(0.16, 0.54, -1.42, -1.18, 'roomba', 'console');
  // Unity's floor cushion
  const cu = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.1, 20), phong({ color: 0x46c8d2, shininess: 10 })); cu.position.set(0.85, 0.05, -0.75); cu.scale.z = 0.9; scene.add(cu);
  const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 10), phong({ color: 0xff3fd1 })); bt.position.set(0.85, 0.106, -0.75); scene.add(bt);
  circ(0.85, -0.75, 0.27, 'roomba', 'cushion');
  // beanbag: vinyl, shiny, slumped
  const bg = new THREE.SphereGeometry(0.5, 24, 14), bp = bg.attributes.position;
  for (let i = 0; i < bp.count; i++) { const py = bp.getY(i); bp.setY(i, py < 0 ? py * 0.5 : py * 0.75 - Math.max(0, bp.getZ(i)) * 0.25); }
  bg.computeVertexNormals();
  const bb = new THREE.Mesh(bg, phong({ color: 0xa83c96, shininess: 70, specular: 0x553355 })); bb.position.set(1.85, 0.25, 1.35); bb.rotation.y = 2.4; scene.add(bb);
  circ(1.85, 1.35, 0.46, 'both', 'beanbag');
  // door (front wall) with a sign
  const dm = phong({ map: woodT2, bumpMap: woodT2, bumpScale: 0.006 });
  blk(0.86, 2.04, 0.04, dm, -1.4, 1.02, RZ - 0.02);
  for (const yy of [0.55, 1.45]) blk(0.6, 0.6, 0.012, M.woodDark, -1.4, yy, RZ - 0.045);
  const kn = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), phong({ color: 0xe6c878, shininess: 90 })); kn.position.set(-1.1, 1.0, RZ - 0.07); scene.add(kn);
  blk(0.96, 0.06, 0.05, M.cream, -1.4, 2.07, RZ - 0.02); blk(0.05, 2.07, 0.05, M.cream, -1.86, 1.035, RZ - 0.02); blk(0.05, 2.07, 0.05, M.cream, -0.94, 1.035, RZ - 0.02);
  const sc = canvas(256, 256), sx = sc.getContext('2d');
  sx.translate(128, 128); sx.rotate(Math.PI / 4); sx.fillStyle = '#ffe14a'; sx.fillRect(-82, -82, 164, 164); sx.strokeStyle = '#100820'; sx.lineWidth = 8; sx.strokeRect(-74, -74, 148, 148); sx.rotate(-Math.PI / 4);
  sx.fillStyle = '#100820'; sx.font = '18px ' + PIX; sx.textAlign = 'center'; sx.fillText('ROOMBA', 0, -24); sx.fillText('XING', 0, 50);
  sx.beginPath(); sx.ellipse(0, 8, 34, 14, 0, 0, 6.3); sx.fill(); sx.fillStyle = '#ffe14a'; sx.fillRect(-4, 2, 8, 4);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshPhongMaterial({ map: tex(sc), transparent: true, alphaTest: 0.1 }));
  sign.position.set(-1.4, 1.5, RZ - 0.055); sign.rotation.y = Math.PI; scene.add(sign);
  // some laundry by the beanbag (a sock lives here when it isn't being eaten)
  const sh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), phong({ color: 0x3a6a9a })); sh.scale.set(1, 0.35, 0.8); sh.position.set(2.3, 0.05, 0.6); scene.add(sh);
  circ(2.3, 0.6, 0.2, 'roomba', 'laundry');
})();

// ------------------------------------------------------------ the dock under the ROOMBA KING poster
(function () {
  const g = new THREE.Group(); g.position.set(-1.0, 0, -RZ); scene.add(g);
  blk(0.26, 0.14, 0.07, phong({ color: 0x1c1c22, shininess: 40 }), 0, 0.07, 0.035, g);
  blk(0.26, 0.012, 0.16, phong({ color: 0x24242a }), 0, 0.006, 0.12, g);
  const led = blk(0.03, 0.012, 0.005, new THREE.MeshBasicMaterial({ color: 0x5ce07a }), 0, 0.11, 0.072, g); led.userData.dynamic = true; RV.dockLed = led;
  for (const s of [-1, 1]) blk(0.03, 0.004, 0.06, phong({ color: 0xc8c8d8, shininess: 90 }), s * 0.06, 0.014, 0.12, g);
  // tiny gold crown sticker on the dock (it insists)
  blk(0.05, 0.02, 0.003, phong({ color: 0xffe14a, emissive: 0x332200 }), 0, 0.05, 0.072, g);
  RV.dock = { x: -1.0, z: -RZ + 0.27, face: Math.PI };   // where the Roomba parks; it faces +Z out of the dock
})();

// ------------------------------------------------------------ light
scene.add(new THREE.HemisphereLight(0x6a58a8, 0x1a2436, 0.62));
const moon = new THREE.DirectionalLight(0x8fa8ff, 0.28); moon.position.set(-1.2, 2.4, -3); moon.target.position.set(0, 0, 0.5); scene.add(moon); scene.add(moon.target);
const lamp = new THREE.PointLight(0xffd6a0, 0.45, 6, 1.2); lamp.position.set(0.3, 2.35, 0.2); scene.add(lamp);

// ------------------------------------------------------------ blob shadow helper
(function () {
  const c = canvas(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  RV.shadowMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
  RV.blob = (r, parent) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), RV.shadowMat); m.rotation.x = -Math.PI / 2; m.position.y = 0.005; m.renderOrder = 2; (parent || scene).add(m); return m; };
  for (const [bx, bz, br] of [[1.85, 1.35, 0.62], [0.75, -1.95, 0.9], [2.1, -2.05, 0.6], [-2.37, -0.64, 0.4]]) { const m = RV.blob(br); m.position.set(bx, 0.005, bz); }
})();


// ------------------------------------------------------------ merge the static room into a few draw calls (Quest likes this)
(function () {
  const groups = new Map(), victims = [];
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh || o.material.isShaderMaterial || Array.isArray(o.material) || o.userData.dynamic) return;
    const m = o.material, key = [m.type, m.color && m.color.getHex(), m.map && m.map.uuid, m.emissive && m.emissive.getHex(), m.emissiveMap && m.emissiveMap.uuid, m.transparent, m.opacity, m.side, m.shininess, m.blending, m.depthWrite, m.alphaTest, m.bumpMap && m.bumpMap.uuid, o.renderOrder].join('|');
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(o);
  });
  let before = 0, after = 0;
  for (const [, list] of groups) {
    before += list.length; if (list.length < 2) { after++; continue; }
    const pos = [], nor = [], uv = []; const nm = new THREE.Matrix3();
    for (const o of list) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      pos.push(g.attributes.position.array); nor.push(g.attributes.normal ? g.attributes.normal.array : new Float32Array(g.attributes.position.count * 3));
      uv.push(g.attributes.uv ? g.attributes.uv.array : new Float32Array(g.attributes.position.count * 2));
      victims.push(o);
    }
    const cat = arrs => { const n = arrs.reduce((a, b) => a + b.length, 0), out = new Float32Array(n); let k = 0; for (const a of arrs) { out.set(a, k); k += a.length; } return out; };
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(cat(pos), 3)); g.setAttribute('normal', new THREE.BufferAttribute(cat(nor), 3)); g.setAttribute('uv', new THREE.BufferAttribute(cat(uv), 2));
    const mesh = new THREE.Mesh(g, list[0].material); mesh.renderOrder = list[0].renderOrder; mesh.matrixAutoUpdate = false; scene.add(mesh); after++;
  }
  for (const o of victims) o.parent.remove(o);
  RV.mergeStats = { before, after };
})();

// ------------------------------------------------------------ collision queries
RV.blocked = function (x, z, r, who) {
  if (x < -RX + r || x > RX - r || z < -RZ + r || z > RZ - r) return { name: 'wall', wall: true };
  for (const o of OBST) {
    if (o.who !== 'both' && o.who !== who) continue;
    if (o.t === 'box') { const cx = Math.max(o.x0, Math.min(x, o.x1)), cz = Math.max(o.z0, Math.min(z, o.z1)); if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return o; }
    else if ((x - o.x) ** 2 + (z - o.z) ** 2 < (r + o.r) ** 2) return o;
  }
  return null;
};
// a random free spot on the floor (for wandering)
RV.freeSpot = function (r, who, rand) {
  rand = rand || Math.random;
  for (let k = 0; k < 40; k++) { const x = (rand() * 2 - 1) * (RX - r - 0.05), z = (rand() * 2 - 1) * (RZ - r - 0.05); if (!RV.blocked(x, z, r + 0.05, who)) return { x, z }; }
  return { x: 0.3, z: 0.6 };
};
})();
