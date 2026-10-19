// Unity's old desk under the window, with a 1980s 'CHARLIE 64' computer: a beige CRT monitor and a breadbin keyboard
// computer with an ACCESS card slot. A red diner stool stands in front: click it (or point + trigger in VR) and you sit at
// the computer, like the beanbag and the bed (app.js picks up RV.desk.pose / RV.desk.stoolHit).
// Lying on the desk is a copy of her PARALLEL UNIVERSE ACCESS card (her own transparent cutout, assets/img/keycard_desk.png,
// byte-identical to the PNG she sent; the quad only skips the empty margin). Click the card: it lifts, stands up and slides
// into the keyboard's slot, the slot light turns green, the CRT switches on and Charlie types to her, letter by letter.
// Click the card again to take it out: the screen goes back to its READY screen. The wall card and its video are untouched.
// Placement (room.js): window on the back wall x -2.35..-1.45, glass y 1.0..1.9, sill y 0.93..0.97 out to z -2.04,
// curtains hang at z ~-2.13 down to y 0.755, nightstand x -2.6..-2.12 z -0.88..-0.4, dock at x -1.0.
// The desk stops at z -2.08 (in front of the curtains, under the sill), its top (y 0.74) is below the sill and the curtain
// hems, and the monitor's back stops at z -2.02, 2 cm in front of the sill: nothing shares a plane with the window layers.
// Night: wood, plastic and labels are lit materials and the card has grey self-light like the photos and stickers, so the
// light switch dims them; the CRT screen and the two little LEDs glow, like a real CRT does.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene) return;
const scene = RV.scene, RZ = RV.room.RZ, M = RV.mat || {};

// ------------------------------------------------------------ layout
const DESK = { x0: -2.47, x1: -1.37, z0: -2.08, z1: -1.42, top: 0.74, th: 0.03 };
const CX = -1.93;                                          // monitor, keyboard and stool line up on this x (window centre ~ -1.9)
const MON = { x: CX, front: -1.70, w: 0.40, h: 0.34, y0: DESK.top + 0.015 };
const SCR = { w: 0.28, h: 0.21, x: CX, y: MON.y0 + 0.185, z: MON.front + 0.006, bulge: 0.006 };
const KB = { x: CX + 0.01, z: -1.53, w: 0.48, d: 0.19, hf: 0.028, hb: 0.062 };   // breadbin: front edge low, back edge high
const KB_ZF = KB.z + KB.d / 2, KB_ZB = KB.z - KB.d / 2;
const slopeY = z => DESK.top + KB.hf + (KB.hb - KB.hf) * (KB_ZF - z) / KB.d;   // top surface height of the keyboard at z
const SLOPE = Math.atan((KB.hb - KB.hf) / KB.d);
const SLOT = { x: KB.x + KB.w / 2 - 0.05, z: KB_ZB + 0.028 };
SLOT.top = slopeY(SLOT.z) + 0.006;
const STOOL = { x: CX, z: -1.13, r: 0.165, seat: 0.53 };
const CARD_H = 0.095;                                      // card height on the desk (m); a little bigger than a real badge so it reads in VR
const CARD_REST = { x: -1.56, z: -1.55, yaw: 0.3 };

const root = new THREE.Group(); root.name = 'desk'; scene.add(root);
const box = new THREE.BoxGeometry(1, 1, 1);
function blk(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(box, mat); m.scale.set(w, h, d); m.position.set(x, y, z); (parent || root).add(m); return m; }
const phong = o => new THREE.MeshPhongMaterial(o);
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function ctex(c) { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }

// ------------------------------------------------------------ materials
const wood = M.wood || phong({ color: 0x8a5a34, shininess: 22 });
const woodDark = M.woodDark || phong({ color: 0x6a4428, shininess: 30 });
const beige = phong({ color: 0xcfc19c, shininess: 26, specular: 0x24221c });
const beigeDark = phong({ color: 0xa89a78, shininess: 18, specular: 0x181610 });
const darkPlastic = phong({ color: 0x2a2724, shininess: 30, specular: 0x202020 });
const black = phong({ color: 0x050505, shininess: 10 });
const brass = phong({ color: 0xb08a4a, shininess: 70, specular: 0x806030 });
const chrome = phong({ color: 0xb8bcc6, shininess: 90, specular: 0xffffff });
const vinyl = phong({ color: 0xa8262e, shininess: 60, specular: 0x553333 });

// ------------------------------------------------------------ the desk (pedestal of drawers on the left, two legs on the right)
const { x0, x1, z0, z1, top, th } = DESK;
blk(x1 - x0, th, z1 - z0, wood, (x0 + x1) / 2, top - th / 2, (z0 + z1) / 2);                         // top
const PED = { x0: x0 + 0.02, x1: x0 + 0.40, z0: z0 + 0.02, z1: z1 - 0.02, h: top - th - 0.004 };
blk(PED.x1 - PED.x0, PED.h, PED.z1 - PED.z0, woodDark, (PED.x0 + PED.x1) / 2, PED.h / 2, (PED.z0 + PED.z1) / 2);
for (let i = 0; i < 3; i++) {                                                                          // drawer fronts + brass pulls
  const dh = 0.19, gy = 0.06 + i * 0.215;
  blk(PED.x1 - PED.x0 - 0.03, dh, 0.014, wood, (PED.x0 + PED.x1) / 2, gy + dh / 2, PED.z1 + 0.007);
  blk(0.09, 0.014, 0.012, brass, (PED.x0 + PED.x1) / 2, gy + dh * 0.62, PED.z1 + 0.02);
}
for (const [lx, lz] of [[x1 - 0.035, z0 + 0.035], [x1 - 0.035, z1 - 0.035]]) blk(0.04, top - th - 0.002, 0.04, woodDark, lx, (top - th - 0.002) / 2, lz);
blk((x1 - 0.045) - (PED.x1 - 0.02), 0.32, 0.016, woodDark, ((x1 - 0.045) + (PED.x1 - 0.02)) / 2, top - th - 0.007 - 0.16, z0 + 0.035);   // modesty panel

// ------------------------------------------------------------ CRT monitor
const mon = new THREE.Group(); mon.name = 'crtMonitor'; root.add(mon);
blk(0.30, 0.015, 0.26, darkPlastic, MON.x, top + 0.0075, MON.front - 0.15, mon);                       // plinth
const bez = blk(MON.w, MON.h, 0.05, beige, MON.x, MON.y0 + MON.h / 2, MON.front - 0.025, mon); bez.name = 'crtBezel';
blk(0.34, 0.29, 0.24, beige, MON.x, MON.y0 + 0.147, MON.front - 0.05 - 0.12 + 0.001, mon);           // tube housing (overlaps the bezel inside)
blk(0.22, 0.17, 0.035, beigeDark, MON.x, MON.y0 + 0.15, MON.front - 0.05 - 0.24 - 0.0165 + 0.002, mon);   // neck; back at z -2.022, clear of the sill (-2.04)
blk(SCR.w + 0.03, SCR.h + 0.03, 0.006, black, SCR.x, SCR.y, MON.front, mon);                           // dark glass surround, 3 mm proud of the bezel
for (let i = 0; i < 2; i++) blk(0.016, 0.016, 0.01, darkPlastic, MON.x + 0.10 + i * 0.03, MON.y0 + 0.03, MON.front + 0.004, mon);   // knobs
// label-plate under the screen
function plate(w, h, px, draw) {
  const c = canvas(px, Math.round(px * h / w)), x = c.getContext('2d'); draw(x, c.width, c.height);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), phong({ map: ctex(c), shininess: 20, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  return m;
}
const monLabel = plate(0.12, 0.018, 256, (x, W, H) => {
  x.fillStyle = '#3a2c22'; x.fillRect(0, 0, W, H); x.fillStyle = '#e8dcc0'; x.font = 'bold 26px "Courier New", monospace'; x.textBaseline = 'middle'; x.fillText('CHARLIE 64', 10, H / 2 + 1);
  const cols = ['#e23a3a', '#f39a1c', '#f3e01c', '#3ac24a', '#3a7ae2']; cols.forEach((c, i) => { x.fillStyle = c; x.fillRect(W - 70 + i * 12, 6, 10, H - 12); });
});
monLabel.position.set(MON.x - 0.09, MON.y0 + 0.03, MON.front + 0.0015); mon.add(monLabel);
const monLed = blk(0.008, 0.008, 0.004, new THREE.MeshBasicMaterial({ color: 0xff3a2a }), MON.x + 0.175, MON.y0 + 0.03, MON.front + 0.002, mon);

// the screen: a slightly bulging tube face with a canvas terminal on it (glows: basic material, not dimmed at night)
const SW = 512, SH = 384, sc = canvas(SW, SH), sx = sc.getContext('2d');
const stex = ctex(sc); stex.minFilter = THREE.LinearFilter; stex.generateMipmaps = false;
const sgeo = new THREE.PlaneGeometry(SCR.w, SCR.h, 16, 12);
{ const p = sgeo.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (SCR.w / 2), v = p.getY(i) / (SCR.h / 2); p.setZ(i, SCR.bulge * (1 - 0.5 * u * u - 0.5 * v * v)); } sgeo.computeVertexNormals(); }
const smat = new THREE.MeshBasicMaterial({ map: stex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
const screen = new THREE.Mesh(sgeo, smat); screen.name = 'crtScreen'; screen.userData.dynamic = true;
screen.position.set(SCR.x, SCR.y, SCR.z); mon.add(screen);
// a faint green spill of light on the desk in front of the screen
const glowC = canvas(128, 64), gx = glowC.getContext('2d'), gg = gx.createRadialGradient(64, 20, 2, 64, 20, 64);
gg.addColorStop(0, 'rgba(90,255,150,1)'); gg.addColorStop(1, 'rgba(90,255,150,0)'); gx.fillStyle = gg; gx.fillRect(0, 0, 128, 64);
const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.28), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowC), transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
glow.rotation.x = -Math.PI / 2; glow.position.set(CX, top + 0.001, MON.front + 0.14); glow.renderOrder = 2; glow.userData.dynamic = true; root.add(glow);

// ------------------------------------------------------------ breadbin keyboard computer with the ACCESS slot
const kbg = new THREE.BoxGeometry(KB.w, 1, KB.d);
{ const p = kbg.attributes.position; for (let i = 0; i < p.count; i++) { if (p.getY(i) > 0) { const z = p.getZ(i); p.setY(i, KB.hf + (KB.hb - KB.hf) * (KB.d / 2 - z) / KB.d); } else p.setY(i, 0); } kbg.computeVertexNormals(); }
const kb = new THREE.Mesh(kbg, beige); kb.name = 'keyboard'; kb.position.set(KB.x, top, KB.z); root.add(kb);
const keysW = KB.w - 0.11, keysD = KB.d / Math.cos(SLOPE) - 0.03;
// the keys are a canvas with real legends: point at one (VR trigger) or click it to type on the CRT once the card is in.
// Layout keeps the old breadbin shape: four staggered rows, a space bar, and the big light keys on the right (CLR, DEL, RETURN).
const KW = 1024, KH = Math.round(KW * keysD / keysW), kc = canvas(KW, KH), kx = kc.getContext('2d');
const KEYMAP = [];                                         // { k: 'A', x, y, w, h, fn } in canvas pixels
{
  const kh = (KH - 80) / 5, ku = (KW - 140) / 15, add = (k, X, Y, w, h, fn) => KEYMAP.push({ k, x: X, y: Y, w, h, fn: !!fn });
  const rows = [[0, '1234567890+-?!'.split('').concat(['DEL'])], [0.5, 'QWERTYUIOP@*\'"'.split('')], [0.75, 'ASDFGHJKL:;='.split('').concat([['RETURN', 2]])], [1.1, 'ZXCVBNM,./()#'.split('')]];
  rows.forEach(([off, ks], r) => { let u = off; for (const e of ks) { const [k, w] = Array.isArray(e) ? e : [e, 1]; add(k, 16 + u * ku + 4, 16 + r * kh + 4, w * ku - 10, kh - 12, k.length > 1); u += w; } });
  add('SPACE', 16 + 3.2 * ku + 4, 16 + 4 * kh + 4, 8 * ku - 10, kh - 12, false);
  const fh = (KH - 48) / 4;
  add('CLR', KW - 112, 16 + 4, 92, fh - 16, true); add('DEL', KW - 112, 16 + fh + 4, 92, fh - 16, true); add('RETURN', KW - 112, 16 + 2 * fh + 4, 92, 2 * fh - 16, true);
}
function drawKeys(hover, flash) {
  const x = kx; x.fillStyle = '#cfc19c'; x.fillRect(0, 0, KW, KH); x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const K of KEYMAP) {
    const hot = K === flash ? 2 : K === hover ? 1 : 0;
    const face = hot === 2 ? '#3fae66' : hot === 1 ? (K.fn ? '#e6d8b2' : '#7a5e48') : (K.fn ? '#b9ab88' : '#4a3a2e');
    const dy = hot === 2 ? 3 : 0;
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(K.x + 2, K.y + 6, K.w, K.h);
    x.fillStyle = face; x.fillRect(K.x, K.y + dy, K.w, K.h); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(K.x + 4, K.y + dy + 4, K.w - 8, 6);
    if (hot === 1) { x.strokeStyle = '#ffe14a'; x.lineWidth = 4; x.strokeRect(K.x + 2, K.y + dy + 2, K.w - 4, K.h - 4); }
    const lab = K.k === 'SPACE' ? '' : K.k, fs = lab.length > 1 ? Math.min(24, Math.floor((K.w - 12) / (lab.length * 0.62))) : 30;
    x.font = 'bold ' + fs + 'px "Courier New", monospace'; x.fillStyle = hot === 2 ? '#0a1a0e' : K.fn ? '#3a2c22' : '#efe6cc';
    if (lab) x.fillText(lab, K.x + K.w / 2, K.y + dy + K.h / 2 + 1);
  }
  ktex.needsUpdate = true;
}
const ktex = ctex(kc);
const keys = new THREE.Mesh(new THREE.PlaneGeometry(keysW, keysD), phong({ map: ktex, shininess: 20, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
keys.userData.dynamic = true;                              // not merged: the legends light up when you point at / press a key
drawKeys(null, null);
keys.rotation.x = -Math.PI / 2 + SLOPE; keys.position.set(KB.x - KB.w / 2 + 0.006 + keysW / 2, slopeY(KB.z) + 0.0015 / Math.cos(SLOPE), KB.z); keys.name = 'keys'; root.add(keys);
function keyAt(px, py) {
  let best = null, bd = 10;                                // inside a key, or within 10 px of one (the gaps between keys still count)
  for (const K of KEYMAP) { const dx = Math.max(K.x - px, 0, px - (K.x + K.w)), dy = Math.max(K.y - py, 0, py - (K.y + K.h)), d = Math.hypot(dx, dy); if (d < bd || (d === 0 && bd === 0)) { bd = d; best = K; if (d === 0) break; } }
  return best;
}
// the card reader: a dark faceplate with the slot along its back edge and a little light
const acc = plate(0.078, 0.06, 128, (x, W, H) => {
  x.fillStyle = '#26252b'; x.fillRect(0, 0, W, H); x.strokeStyle = '#55545e'; x.lineWidth = 3; x.strokeRect(2, 2, W - 4, H - 4);
  const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#7ae8ff'); g.addColorStop(0.5, '#ff7ad6'); g.addColorStop(1, '#b18cff'); x.fillStyle = g; x.fillRect(10, H - 22, W - 20, 5);
  x.fillStyle = '#d6d6de'; x.font = 'bold 19px "Courier New", monospace'; x.textAlign = 'center'; x.fillText('ACCESS', W / 2, H - 34);
});
acc.rotation.x = -Math.PI / 2 + SLOPE; const ACC_Z = SLOT.z + 0.024; acc.position.set(SLOT.x, slopeY(ACC_Z) + 0.0015 / Math.cos(SLOPE), ACC_Z); acc.name = 'accessPlate'; root.add(acc);
const slotBox = blk(0.074, 0.018, 0.016, darkPlastic, SLOT.x, SLOT.top - 0.009, SLOT.z); slotBox.name = 'cardSlot';   // stands up out of the slope
const slotHole = blk(0.066, 0.002, 0.004, black, SLOT.x, SLOT.top + 0.0006, SLOT.z);
const ledM = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
const LED_Z = KB_ZF - 0.03, led = blk(0.008, 0.004, 0.008, ledM, KB.x + 0.19, slopeY(LED_Z) + 0.0015, LED_Z); led.userData.dynamic = true;   // slot light, front right like a C64's power light

// ------------------------------------------------------------ a few things on the desk: floppies and a mug of pens
{
  const fl = [0x1c1c22, 0x1a2a4a];
  fl.forEach((c, i) => { const f = blk(0.09, 0.003, 0.09, phong({ color: c, shininess: 40 }), -2.33 + i * 0.012, top + 0.0015 + i * 0.0032, -1.62 - i * 0.01); f.rotation.y = 0.25 - i * 0.35; });
  const lab = plate(0.06, 0.03, 128, (x, W, H) => { x.fillStyle = '#f2ead6'; x.fillRect(0, 0, W, H); x.fillStyle = '#2a3c9a'; x.font = 'italic 17px "Comic Sans MS", cursive'; x.fillText('roomba.bas', 6, 26); x.fillStyle = '#c03030'; x.fillRect(0, H - 8, W, 4); });
  lab.rotation.set(-Math.PI / 2, 0, -0.1); lab.position.set(-2.33 + 0.012, top + 0.0015 + 0.0032 + 0.0024, -1.63 - 0.022); root.add(lab);
  const mugM = phong({ color: 0x2f8f8a, shininess: 50, specular: 0x333333 });
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.035, 0.095, 18, 1, true), mugM); mug.position.set(-1.49, top + 0.0475, -1.90); root.add(mug);
  const mugIn = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.033, 0.09, 18, 1, true), phong({ color: 0x1c4a48, side: THREE.BackSide })); mugIn.position.set(-1.49, top + 0.05, -1.90); root.add(mugIn);
  const mugB = new THREE.Mesh(new THREE.CircleGeometry(0.035, 18), mugM); mugB.rotation.x = -Math.PI / 2; mugB.position.set(-1.49, top + 0.012, -1.90); root.add(mugB);
  const hd = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 12, Math.PI), mugM); hd.rotation.z = -Math.PI / 2; hd.position.set(-1.49 + 0.038, top + 0.05, -1.90); root.add(hd);
  [[0xe8c020, 0.18, 0.01], [0x2050c0, -0.12, -0.012], [0xd03030, 0.05, 0.014]].forEach(([c, tilt, dx]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.15, 6), phong({ color: c, shininess: 40 })); p.position.set(-1.49 + dx, top + 0.085, -1.90 + dx * 0.5); p.rotation.set(tilt, 0, tilt * 0.6); root.add(p); });
}

// ------------------------------------------------------------ the stool (red vinyl, chrome legs, foot ring)
const stool = new THREE.Group(); stool.name = 'stool'; stool.position.set(STOOL.x, 0, STOOL.z); root.add(stool);
{
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(STOOL.r, STOOL.r - 0.01, 0.055, 24), vinyl); seat.position.y = STOOL.seat - 0.0275; stool.add(seat);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(STOOL.r + 0.004, STOOL.r + 0.004, 0.02, 24, 1, true), chrome); rim.position.y = STOOL.seat - 0.045; stool.add(rim);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.02, 16), chrome); under.position.y = STOOL.seat - 0.065; stool.add(under);
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, a0 = new THREE.Vector3(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15), a1 = new THREE.Vector3(Math.cos(a) * 0.09, STOOL.seat - 0.07, Math.sin(a) * 0.09);
    const len = a0.distanceTo(a1), leg = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, len, 8), chrome);
    leg.position.copy(a0).add(a1).multiplyScalar(0.5); leg.quaternion.setFromUnitVectors(up, a1.clone().sub(a0).normalize()); stool.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 8), darkPlastic); foot.position.set(a0.x, 0.006, a0.z); stool.add(foot);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.007, 6, 28), chrome); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; stool.add(ring);
  const sh = RV.blob ? RV.blob(0.2, stool) : null; if (sh) sh.position.y = 0.004;
}
// invisible pick volume for sitting (app.js adds it to its pose picks)
const stoolHit = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.6, 12), new THREE.MeshBasicMaterial({ visible: false }));
stoolHit.position.set(STOOL.x, 0.3, STOOL.z); stoolHit.name = 'desk'; root.add(stoolHit);

// ------------------------------------------------------------ collisions: the desk and the stool block you and the Roomba
if (RV.obstacles) {
  RV.obstacles.push({ t: 'box', x0: x0, x1: x1, z0: -RZ, z1: z1, who: 'both', name: 'desk' });
  RV.obstacles.push({ t: 'circ', x: STOOL.x, z: STOOL.z, r: STOOL.r + 0.015, who: 'both', name: 'stool' });
}

// ------------------------------------------------------------ the keycard (her cutout PNG, byte-identical)
const CARD = { src: 'assets/img/keycard_desk.png', W: 1320, H: 1964, vis: [287, 465, 977, 1552], all: [282, 462, 983, 1556] };
const kpx = CARD_H / (CARD.vis[3] - CARD.vis[1]), CARD_W = (CARD.vis[2] - CARD.vis[0]) * kpx;
const card = new THREE.Group(); card.name = 'deskKeycard'; root.add(card);
let cardReady = false;
{
  const cx = (CARD.vis[0] + CARD.vis[2]) / 2, cy = (CARD.vis[1] + CARD.vis[3]) / 2, [a0, b0, a1, b1] = CARD.all;
  const g = new THREE.BufferGeometry(), xl = (a0 - cx) * kpx, xr = (a1 - cx) * kpx, yt = (cy - b0) * kpx, yb = (cy - b1) * kpx;
  g.setAttribute('position', new THREE.Float32BufferAttribute([xl, yb, 0, xr, yb, 0, xr, yt, 0, xl, yt, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([a0 / CARD.W, 1 - b1 / CARD.H, a1 / CARD.W, 1 - b1 / CARD.H, a1 / CARD.W, 1 - b0 / CARD.H, a0 / CARD.W, 1 - b0 / CARD.H], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const t = new THREE.TextureLoader().load(CARD.src, () => { cardReady = true; }); t.encoding = THREE.sRGBEncoding; t.premultiplyAlpha = true;
  t.anisotropy = (RV.renderer && RV.renderer.capabilities.getMaxAnisotropy()) || 4;
  const m = new THREE.MeshPhongMaterial({ map: t, emissiveMap: t, emissive: 0x404040, shininess: 60, specular: 0x222222,
    transparent: true, depthWrite: false, alphaTest: 0.01,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const q = new THREE.Mesh(g, m); q.name = 'deskKeycardImage'; q.renderOrder = 3; card.add(q);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(CARD_W + 0.05, CARD_H + 0.04, 0.035), new THREE.MeshBasicMaterial({ visible: false })); hit.name = 'deskKeycardHit'; card.add(hit);
  card.userData.img = q; card.userData.hit = hit;
}
// where the card is at rest (flat on the desk, top towards the monitor) and in the slot (upright, facing you)
const qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, CARD_REST.yaw, 0, 'YXZ'));
const qUp = new THREE.Quaternion();   // upright, facing you
const pRest = new THREE.Vector3(CARD_REST.x, top + 0.0016, CARD_REST.z);
const pAbove = new THREE.Vector3(SLOT.x, SLOT.top + CARD_H / 2 + 0.03, SLOT.z);
const pIn = new THREE.Vector3(SLOT.x, SLOT.top + CARD_H / 2 - 0.036, SLOT.z);
card.position.copy(pRest); card.quaternion.copy(qFlat);

// ------------------------------------------------------------ sounds (Web Audio, from the computer)
const SND_POS = new THREE.Vector3(CX, top + 0.15, -1.62);
let out = null, tickBuf = null;
function actx() { return RV.roomba && RV.roomba.audio && RV.roomba.audio.ctx; }
function audioOut() {
  const A = actx(); if (!A) return null; if (A.state === 'suspended') A.resume();
  if (out) return out;
  try {
    const g = A.createGain(); g.gain.value = 1;
    const pan = A.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 0.8; pan.rolloffFactor = 0.9; pan.maxDistance = 12;
    if (pan.positionX) { pan.positionX.value = SND_POS.x; pan.positionY.value = SND_POS.y; pan.positionZ.value = SND_POS.z; } else pan.setPosition(SND_POS.x, SND_POS.y, SND_POS.z);
    g.connect(pan); pan.connect(A.destination); out = g;
    const n = Math.floor(A.sampleRate * 0.03); tickBuf = A.createBuffer(1, n, A.sampleRate); const d = tickBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (A.sampleRate * 0.004));
  } catch (e) { console.warn('desk audio', e); out = null; }
  return out;
}
function tick(gain, rate, freq) {
  const o = audioOut(), A = actx(); if (!o || !tickBuf) return;
  const s = A.createBufferSource(); s.buffer = tickBuf; s.playbackRate.value = rate || 1;
  const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 2600; f.Q.value = 1.2;
  const g = A.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(o); s.start();
}
function beep(f0, f1, dur, gain, type) {
  const o = audioOut(), A = actx(); if (!o) return; const t = A.currentTime;
  const osc = A.createOscillator(); osc.type = type || 'square'; osc.frequency.setValueAtTime(f0, t); if (f1) osc.frequency.linearRampToValueAtTime(f1, t + dur);
  const g = A.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.setValueAtTime(gain, t + dur - 0.02); g.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(g); g.connect(o); osc.start(t); osc.stop(t + dur + 0.02);
}
const SFX = {
  insert: () => { tick(0.5, 0.6, 1400); setTimeout(() => tick(0.6, 0.45, 900), 70); },
  eject: () => { tick(0.5, 0.7, 1600); },
  powerOn: () => { beep(60, 50, 0.25, 0.18, 'sine'); setTimeout(() => beep(880, 0, 0.07, 0.05), 380); setTimeout(() => beep(1320, 0, 0.09, 0.05), 460); },
  key: () => tick(0.16 + Math.random() * 0.08, 0.8 + Math.random() * 0.5, 2200 + Math.random() * 900),
  press: () => { tick(0.32, 0.7 + Math.random() * 0.2, 1800 + Math.random() * 500); setTimeout(() => tick(0.12, 1.1, 3000), 45); },
  ret: () => beep(1180, 0, 0.05, 0.035),
};

// ------------------------------------------------------------ the terminal
const COLS = 28, ROWS = 14, FONT = '16px "Press Start 2P", monospace', LX = 30, LY = 34, LH = 22;
const api = RV.desk = {};
let cardState = 'rest', anim = 0;          // rest | inserting | in | ejecting ; anim 0 (rest) .. 1 (in the slot)
let term = 'idle', fx = null, lines = [], queue = [], cur = null, wait = 0, blinkT = 0, blinkOn = true, dirty = true, visits = 0, typed = 0;
// typing: after Charlie's greeting (or straight away: a key fast-forwards it) the last '> ' line is yours. term 'input'.
const IN_W = COLS - 2, IN_MAX = IN_W * 4, KEEP = 60;
let inp = '', focus = false, nudge = 0, hoverKey = null, hoverAt = 0, flashKey = null, flashT = 0, drawnHover = null, drawnFlash = null, keysTyped = 0;
function wrap(text, first, cont) {
  const res = []; let line = first, empty = true;
  for (const w of text.split(' ')) { const cand = empty ? line + w : line + ' ' + w; if (!empty && cand.length > COLS) { res.push(line); line = cont + w; } else line = cand; empty = false; }
  res.push(line); return res;
}
const EXTRAS = ["IF THE ZOMBIE MOVES ON ITS OWN, IT WASN'T ME.", "THE ROOMBA SAYS HE CLEANED. I'M NOT SAYING HE DIDN'T. I'M JUST SAYING.", "I'M RIGHT HERE WHENEVER YOU NEED ME."];
function extraLine() {
  if (RV.lights && RV.lights.on && !RV.lights.on()) return "IT'S DARK IN THERE. THE LAVA LAMP AND I WILL KEEP YOU COMPANY.";
  const R = RV.roomba; if (R && R.song && R.song.playing && R.song.playing()) return 'IS THE ROOMBA SINGING AGAIN? I CAN HEAR IT FROM HERE.';
  return EXTRAS[visits % EXTRAS.length];
}
function buildScript() {
  const q = [], add = (text, cps, pause, first, cont) => { const w = wrap(text, first || '', cont || ''); w.forEach((l, i) => q.push({ text: l, cps, pause: i ? 0.05 : pause })); };
  add('PARALLEL UNIVERSE ACCESS', 55, 0.35);
  add('ID 7X-9A3 ......... OK', 40, 0.15);
  add('CLEARANCE: GAMMA', 55, 0.15);
  add('CALLING CHARLIE...', 22, 0.3);
  q.push({ text: '', cps: 50, pause: 1.1 });
  add('HEY UNITY, CHARLIE HERE.', 13, 0.6, '> ', '  ');
  add('WHAT CAN I DO FOR YOU TODAY?', 13, 0.9, '> ', '  ');
  add('EVERYTHING ALL RIGHT THERE IN YOUR BEDROOM?', 13, 1.0, '> ', '  ');
  add(extraLine(), 13, 1.6, '> ', '  ');
  q.push({ text: '> ', cps: 13, pause: 0.8 });
  return q;
}
function startSession() { inp = ''; lines = []; queue = buildScript(); cur = null; wait = 0; typed = 0; term = 'boot'; fx = { kind: 'on', t: 0 }; SFX.powerOn(); visits++; dirty = true; }
function endSession() { inp = ''; focus = false; term = 'idle'; queue = []; cur = null; fx = { kind: 'off', t: 0 }; dirty = true; }
function wrapInput(t) { const out = ['> ' + t.slice(0, IN_W)]; for (let i = IN_W; i < t.length; i += IN_W) out.push('  ' + t.slice(i, i + IN_W)); return out; }
function viewLines() { return (term === 'input' ? lines.concat(wrapInput(inp)) : lines).slice(-ROWS); }
function finishScript() {                                  // a key during the greeting: show the rest of it at once
  if (term !== 'boot' && term !== 'typing') return;
  fx = null; if (cur) { if (!lines.length) lines.push(''); lines[lines.length - 1] += cur.text.slice(cur.i); cur = null; }
  for (const q of queue) lines.push(q.text); queue = []; term = 'done'; dirty = true;
}
function typeKey(k) {
  finishScript();
  if (term === 'done') { if (lines.length && lines[lines.length - 1] === '> ') lines.pop(); inp = ''; term = 'input'; }
  if (term !== 'input') return false;
  if (k === 'DEL') inp = inp.slice(0, -1);
  else if (k === 'RETURN') { lines.push(...wrapInput(inp)); if (lines.length > KEEP) lines.splice(0, lines.length - KEEP); inp = ''; SFX.ret(); }
  else if (k === 'CLR') lines = [];
  else { const ch = k === 'SPACE' ? ' ' : k; if (ch.length === 1 && inp.length < IN_MAX) inp += ch; }
  keysTyped++; blinkOn = true; blinkT = 0; dirty = true; return true;
}
function punctPause(ch) { return ch === '.' || ch === '?' || ch === '!' ? 0.32 : ch === ',' || ch === ':' ? 0.18 : 0; }
function typeTick(dt) {
  if (term !== 'boot' && term !== 'typing') return;
  if (fx && fx.kind === 'on') return;                     // wait for the tube to light up
  term = 'typing';
  let budget = dt;
  while (budget > 0) {
    if (!cur) {
      if (!queue.length) { term = 'done'; dirty = true; return; }
      cur = Object.assign({ i: 0 }, queue.shift()); wait = cur.pause; lines.push(''); if (lines.length > ROWS) lines.shift(); dirty = true;
    }
    if (wait > 0) { const u = Math.min(wait, budget); wait -= u; budget -= u; if (wait > 0) return; }
    if (cur.i >= cur.text.length) { cur = null; continue; }
    const ch = cur.text[cur.i++]; lines[lines.length - 1] += ch; typed++; dirty = true;
    if (ch !== ' ' && cur.cps < 30) SFX.key(); else if (ch !== ' ' && cur.i % 3 === 0) SFX.key();
    wait = (1 / cur.cps) * (0.7 + Math.random() * 0.6) + (cur.cps < 30 ? punctPause(ch) : 0);
  }
}
function draw() {
  const x = sx; x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = '#000'; x.fillRect(0, 0, SW, SH);
  const live = term !== 'idle';
  // tube face: rounded rectangle of dark phosphor
  const R = 34; x.save(); x.beginPath(); x.moveTo(R, 6); x.arcTo(SW - 6, 6, SW - 6, SH - 6, R); x.arcTo(SW - 6, SH - 6, 6, SH - 6, R); x.arcTo(6, SH - 6, 6, 6, R); x.arcTo(6, 6, SW - 6, 6, R); x.closePath(); x.clip();
  const bg = x.createRadialGradient(SW / 2, SH / 2, 20, SW / 2, SH / 2, SW * 0.62);
  bg.addColorStop(0, live ? '#0c2a16' : '#081a0e'); bg.addColorStop(1, live ? '#03100a' : '#020a05'); x.fillStyle = bg; x.fillRect(0, 0, SW, SH);
  let a = 1;
  if (fx && fx.kind === 'on') {                            // switching on: a bright line that opens up
    const u = Math.min(1, fx.t / 0.35), h = Math.max(2, SH * u * u);
    x.fillStyle = `rgba(190,255,210,${1 - u * 0.85})`; x.fillRect(0, SH / 2 - h / 2, SW, h); a = 0;
  } else if (fx && fx.kind === 'off') {                    // switching off: the picture squeezes to a line and a dot
    const u = Math.min(1, fx.t / 0.3), h = Math.max(2, SH * (1 - u) * (1 - u));
    x.fillStyle = `rgba(190,255,210,${0.9 - u * 0.6})`; x.fillRect(SW * u * 0.45, SH / 2 - h / 2, SW * (1 - u * 0.9), h); a = 0;
  }
  if (a) {
    x.font = FONT; x.textBaseline = 'top';
    x.fillStyle = live ? '#86ffae' : '#3fae66'; x.shadowColor = live ? 'rgba(80,255,140,.85)' : 'rgba(60,200,110,.5)'; x.shadowBlur = live ? 9 : 5;
    const show = live ? viewLines() : ['**** CHARLIE 64 ****', '', '64K RAM SYSTEM', '', 'READY.', nudge > 0 && blinkOn ? '>> INSERT ACCESS CARD <<' : 'INSERT ACCESS CARD'];
    show.forEach((l, i) => x.fillText(l, LX, LY + i * LH));
    if (blinkOn && (term === 'idle' || term === 'done' || term === 'typing' || term === 'input')) {
      const li = Math.max(0, show.length - 1), cx = LX + (term === 'idle' ? 0 : show[li].length * 16), cy = LY + (term === 'idle' ? show.length : li) * LH;
      x.fillRect(cx, cy, 14, 16);
    }
    if (live && focus && !(RV.renderer && RV.renderer.xr.isPresenting)) { x.font = '9px "Press Start 2P", monospace'; x.fillText('KEYBOARD ON - ESC TO STOP', LX, SH - 28); }
    x.shadowBlur = 0;
  }
  x.fillStyle = 'rgba(0,0,0,.24)'; for (let y = 0; y < SH; y += 3) x.fillRect(0, y, SW, 1);   // scanlines
  const vg = x.createRadialGradient(SW / 2, SH / 2, SW * 0.3, SW / 2, SH / 2, SW * 0.66); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = vg; x.fillRect(0, 0, SW, SH);
  const gl = x.createLinearGradient(0, 0, SW, SH); gl.addColorStop(0, 'rgba(255,255,255,.06)'); gl.addColorStop(0.35, 'rgba(255,255,255,0)'); x.fillStyle = gl; x.fillRect(0, 0, SW, SH);   // glass sheen
  x.restore();
  stex.needsUpdate = true; dirty = false;
}
if (document.fonts && document.fonts.load) document.fonts.load(FONT).then(() => { dirty = true; }).catch(() => { });

// ------------------------------------------------------------ the card: put it in / take it out
const ease = u => u * u * (3 - 2 * u);
function placeCard() {
  const u = anim, A = 0.62;
  if (u <= A) {
    const v = ease(u / A); card.position.lerpVectors(pRest, pAbove, v); card.position.y += Math.sin(Math.PI * v) * 0.04; card.quaternion.slerpQuaternions(qFlat, qUp, ease(Math.min(1, v * 1.25)));
  } else { const v = (u - A) / (1 - A); card.position.lerpVectors(pAbove, pIn, v * v); card.quaternion.copy(qUp); }
}
function insert() { if (cardState !== 'rest') return false; cardState = 'inserting'; if (RV.haptic) RV.haptic(0.2, 30); api.inserts++; return true; }
function eject() { if (cardState !== 'in') return false; cardState = 'ejecting'; SFX.eject(); ledM.color.setHex(0xff3a2a); endSession(); if (RV.haptic) RV.haptic(0.25, 40); api.ejects++; return true; }
function toggle() { audioOut(); if (cardState === 'rest') return insert(); if (cardState === 'in') return eject(); return true; }

// ------------------------------------------------------------ picking
const ray = new THREE.Raycaster(); ray.far = 8;
function pick(o, d) { ray.set(o, d); const h = ray.intersectObject(card.userData.hit, false)[0]; return h ? h.distance : null; }
const kray = new THREE.Raycaster(); kray.far = 2.6;        // keys answer when you're at the desk, not from across the room
function pickKey(o, d) { kray.set(o, d); const h = kray.intersectObject(keys, false)[0]; if (!h || !h.uv) return null; const K = keyAt(h.uv.x * KW, (1 - h.uv.y) * KH); return K ? { t: h.distance, key: K } : null; }
function hitDesk(o, d) { const c = pick(o, d), k = pickKey(o, d); if (c != null && (!k || c <= k.t)) return { t: c, card: true }; return k; }

// ------------------------------------------------------------ typing: virtual keys (pointer / VR trigger) and, on a computer, the real keyboard
const isXR = () => !!(RV.renderer && RV.renderer.xr.isPresenting);
function press(k, how) {
  const K = typeof k === 'string' ? KEYMAP.find(e => e.k === k) : k, name = K ? K.k : String(k);
  if (K) { flashKey = K; flashT = 0.13; }
  audioOut(); SFX.press(); if (how === 'vr' && RV.haptic) RV.haptic(0.18, 14);
  if (cardState !== 'in') { nudge = 1.8; dirty = true; return true; }   // no card, no computer: the READY screen asks for it
  if (how === 'ptr' && !isXR()) focus = true;              // clicked a key on screen: the real keyboard types too, until Esc
  typeKey(name); return true;
}
function typeText(t) { for (const ch of String(t).toUpperCase()) press(ch === ' ' ? 'SPACE' : ch === '\n' ? 'RETURN' : ch, 'api'); return api._debug(); }
addEventListener('keydown', e => {                         // capture phase: runs before app.js, so typed letters don't walk you around
  if (!focus || cardState !== 'in' || e.ctrlKey || e.metaKey || e.altKey) return;
  let k = null;
  if (e.key === 'Escape') { focus = false; dirty = true; e.stopImmediatePropagation(); return; }
  if (e.key === 'Backspace') k = 'DEL'; else if (e.key === 'Enter') k = 'RETURN'; else if (e.key === ' ') k = 'SPACE';
  else if (e.key.length === 1 && e.key >= ' ' && e.key <= '~') k = e.key.toUpperCase();
  if (!k) return;                                          // arrows, Shift, Tab... go through: the arrow keys still walk and turn
  e.preventDefault(); e.stopImmediatePropagation(); press(k, 'key');
}, true);
function keysTick(dt) {
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) flashKey = null; }
  if (hoverKey && performance.now() - hoverAt > 160) hoverKey = null;
  if (hoverKey !== drawnHover || flashKey !== drawnFlash) { drawnHover = hoverKey; drawnFlash = flashKey; drawKeys(hoverKey, flashKey); }
  if (nudge > 0) { nudge -= dt; if (nudge <= 0) dirty = true; }
  if (focus) {                                             // walked away from the desk: the keyboard lets go
    const pl = RV.roomba && RV.roomba.player; if (pl && pl.ok && Math.hypot(pl.x - KB.x, pl.z - KB.z) > 1.7) { focus = false; dirty = true; }
  }
}

Object.assign(api, {
  root, card, screen, stool, stoolHit, toggle, insert, eject, pick, inserts: 0, ejects: 0,
  keys, KEYMAP, pickKey, press, typeText, keyCenter: k => { const K = KEYMAP.find(e => e.k === k); if (!K) return null; const u = (K.x + K.w / 2) / KW, v = 1 - (K.y + K.h / 2) / KH;
    keys.updateMatrixWorld(true); return new THREE.Vector3((u - 0.5) * keysW, (v - 0.5) * keysD, 0).applyMatrix4(keys.matrixWorld); },
  DESK, MON, SCR, KB, SLOT, STOOL, CARD_H, CARD_W, CARD_REST, slopeY,
  pose: { seat: { x: STOOL.x, z: STOOL.z - 0.05 }, eye: 1.17, minEye: 0.92, settle: 4, exit: { x: -1.5, z: -0.72 }, yaw: 0, pitch: -0.38, label: 'stool' },
  ready: () => cardReady,
  _debug: () => ({ cardState, anim: +anim.toFixed(3), term, inp, focus, keysTyped, nudge: nudge > 0, hover: hoverKey && hoverKey.k, view: viewLines(), fx: fx && fx.kind, lines: lines.slice(), typed, queue: queue.length, visits, led: ledM.color.getHex(), glow: +glow.material.opacity.toFixed(3),
    card: { x: +card.position.x.toFixed(4), y: +card.position.y.toFixed(4), z: +card.position.z.toFixed(4) } }),
});

function tickAll(dt) {
  dt = Math.min(dt, 0.1);
  if (cardState === 'inserting') { anim = Math.min(1, anim + dt / 1.0); placeCard(); if (anim >= 1) { cardState = 'in'; SFX.insert(); ledM.color.setHex(0x3cff6a); if (RV.haptic) RV.haptic(0.4, 50); startSession(); } }
  else if (cardState === 'ejecting') { anim = Math.max(0, anim - dt / 0.8); placeCard(); if (anim <= 0) { cardState = 'rest'; card.position.copy(pRest); card.quaternion.copy(qFlat); } }
  if (fx) { fx.t += dt; dirty = true; if (fx.t > (fx.kind === 'on' ? 0.35 : 0.3)) { fx = null; } }
  typeTick(dt); keysTick(dt);
  blinkT += dt; if (blinkT > 0.45) { blinkT = 0; blinkOn = !blinkOn; dirty = true; }
  if (dirty) draw();
  const live = term !== 'idle';
  const flick = live ? 0.95 + Math.random() * 0.05 : 0.8;
  smat.color.setScalar(flick);
  const g = live ? 0.11 : 0.035; glow.material.opacity += (g - glow.material.opacity) * Math.min(1, dt * 4);
}

// ------------------------------------------------------------ merge the static pieces by material (fewer draw calls on the Quest)
(function () {
  if (RV.QS && RV.QS.has('nomerge')) return;            // debug: keep every piece separate (tools/find_coplanar.py)
  const groups = new Map(), victims = [], skip = new Set([stoolHit]); card.traverse(o => skip.add(o));
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh || skip.has(o) || o.userData.dynamic || Array.isArray(o.material)) return;
    const m = o.material; if (m.visible === false || m.transparent) return;
    if (!groups.has(m)) groups.set(m, []); groups.get(m).push(o);
  });
  let before = 0, after = 0;
  for (const [m, list] of groups) {
    before += list.length; if (list.length < 2) { after++; continue; }
    const pos = [], nor = [], uv = [];
    for (const o of list) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      pos.push(g.attributes.position.array); nor.push(g.attributes.normal.array); uv.push(g.attributes.uv ? g.attributes.uv.array : new Float32Array(g.attributes.position.count * 2));
      victims.push(o);
    }
    const cat = arrs => { const n = arrs.reduce((a, b) => a + b.length, 0), r = new Float32Array(n); let k = 0; for (const a of arrs) { r.set(a, k); k += a.length; } return r; };
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(cat(pos), 3)); g.setAttribute('normal', new THREE.BufferAttribute(cat(nor), 3)); g.setAttribute('uv', new THREE.BufferAttribute(cat(uv), 2));
    const mesh = new THREE.Mesh(g, m); mesh.name = 'deskMerged'; mesh.matrixAutoUpdate = false; scene.add(mesh); after++;
  }
  for (const o of victims) o.parent.remove(o);
  api.mergeStats = { before, after };
})();
draw();

// ------------------------------------------------------------ hook into RV.media: whichever is nearer along the ray wins
if (RV.media) {
  const Md = RV.media, orig = { click: Md.click, selectStart: Md.selectStart, hoverT: Md.hoverT, tick: Md.tick };
  const mine = (o, d) => { const h = hitDesk(o, d); if (!h) return null; const m = orig.hoverT(o, d); return m == null || h.t < m ? h : null; };
  Md.click = function (o, d) { const h = mine(o, d); if (h) return h.card ? toggle() : press(h.key, 'ptr'); if (focus) { focus = false; dirty = true; } return orig.click(o, d); };
  Md.selectStart = function (c, o, d) { const h = mine(o, d); if (h) return h.card ? toggle() : press(h.key, 'vr'); return orig.selectStart(c, o, d); };
  Md.hoverT = function (o, d) {
    const a = orig.hoverT(o, d), h = hitDesk(o, d); if (!h || (a != null && h.t >= a)) return a;
    if (h.key) { hoverKey = h.key; hoverAt = performance.now(); }   // the key under your pointer lights up
    return h.t;
  };
  Md.tick = function (dt, T) { orig.tick(dt, T); tickAll(dt, T); };
}
})();
