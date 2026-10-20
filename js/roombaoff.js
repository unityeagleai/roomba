// The Roomba's bedtime button (for when it won't stop talking): a round button on top of its charging station, under
// the ROOMBA KING poster, with a little CHARGE label on the station's front.
// Point + trigger (or click / tap on a screen): it goes quiet at once (the line it's saying is cut, the punishment song
// stops), drives back to the station, goes to sleep and shows CHARGING (a filling battery on its face, the label lights
// up CHARGING, the button glows green). It's a toggle: press it again while it's asleep (or still on its way home) and
// it wakes up and rolls back out into the room. Coming back into the room also wakes it (reloading the page, putting the
// headset on again, or walking in again on a screen), and then it says hi. Only the Roomba goes quiet: TV, records, statues, the films keep their sound.
// The behaviour itself is RV.roomba.charge() / wakeUp() in js/roomba.js. Hooks into RV.media (click / selectStart /
// hoverT / tick) like the light switch, so app.js needs no changes.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene || !RV.media || !RV.roomba || !RV.roomba.charge) return;
const scene = RV.scene, R = RV.roomba, RZ = RV.room.RZ;
const IDLE = 0xff3c46, CHARGING = 0x5ce07a;

// the printed power symbol on the cap
function iconTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#d8d8e2'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#ffffff'; x.lineCap = 'round'; x.lineWidth = 13;
  x.beginPath(); x.arc(64, 68, 33, -Math.PI / 2 + 0.75, -Math.PI / 2 - 0.75 + Math.PI * 2); x.stroke();
  x.beginPath(); x.moveTo(64, 22); x.lineTo(64, 64); x.stroke();
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}

// ---- the station (room.js: 0.26 wide, 0.14 high, 0.07 deep, at x -1.0 against the back wall): button on top, right side
const dock = new THREE.Group(); dock.position.set(-1.0, 0, -RZ); dock.name = 'roombaChargeButton'; scene.add(dock);
const r = 0.02, btn = new THREE.Group(); btn.position.set(0.075, 0.14, 0.036); dock.add(btn);
const bezel = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.3, r * 1.35, 0.006, 28), new THREE.MeshPhongMaterial({ color: 0x15151a, shininess: 40 }));
bezel.position.y = 0.003; btn.add(bezel);
const ringM = new THREE.MeshBasicMaterial({ color: IDLE });
const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.13, r * 0.11, 6, 32), ringM); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.0065; btn.add(ring);
const capM = new THREE.MeshBasicMaterial({ map: iconTex(), color: IDLE }), sideM = new THREE.MeshPhongMaterial({ color: 0x2a2a30, shininess: 60 });
const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.007, 28), [sideM, capM, sideM]); cap.position.y = 0.0095; cap.rotation.y = Math.PI / 2; btn.add(cap);
// label on the station's front, under the button: CHARGE (press me) / CHARGING (lit green, while it sleeps)
const lc = document.createElement('canvas'); lc.width = 256; lc.height = 64; const lx = lc.getContext('2d');
const labelT = new THREE.CanvasTexture(lc); labelT.encoding = THREE.sRGBEncoding;
function drawLabel(on) {
  lx.fillStyle = '#1c1c22'; lx.fillRect(0, 0, 256, 64);
  lx.fillStyle = on ? '#5ce07a' : '#e8e8f0'; lx.font = (on ? '24px' : '28px') + ' "Press Start 2P", monospace'; lx.textAlign = 'center'; lx.textBaseline = 'middle';
  lx.fillText(on ? 'CHARGING' : 'CHARGE', 128, 34); labelT.needsUpdate = true;
}
drawLabel(false); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => drawLabel(R.charging));
const label = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.019), new THREE.MeshBasicMaterial({ map: labelT, polygonOffset: true, polygonOffsetFactor: -2 }));
label.position.set(0.075, 0.118, 0.0712); dock.add(label);
// a generous invisible target around the button (it sits low, near the floor)
const hit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.12), new THREE.MeshBasicMaterial({ visible: false }));
hit.position.set(0.075, 0.15, 0.06); hit.name = 'roombaChargeHit'; dock.add(hit);

// ---- pressing it
function clickSound() {
  try {
    const A = R.audio && R.audio.ctx; if (!A) return;   // a plain switch click, straight to the speakers
    const t = A.currentTime, o = A.createOscillator(), g = A.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.06);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g); g.connect(A.destination); o.start(t); o.stop(t + 0.1);
  } catch (e) { }
}
let press = 0, painted = null;
function paint() { const on = R.charging; painted = on; ringM.color.setHex(on ? CHARGING : IDLE); capM.color.setHex(on ? CHARGING : IDLE); drawLabel(on); }
function pressButton(from) {
  api.presses++; api.last = from || 'code'; press = 1; clickSound(); if (RV.haptic) RV.haptic(0.3, 30);
  if (R.charging) { if (R.wakeUp('button')) api.wakes++, api.wokeBy = 'button'; }   // asleep: wake up, back into the room
  else R.charge();                                                                       // awake: home to charge
  paint(); return true;
}
const ray = new THREE.Raycaster(); ray.far = 12;
function pick(o, d) { ray.set(o, d); const h = ray.intersectObject(hit, false)[0]; return h ? h.distance : null; }
const M = RV.media, orig = { click: M.click, selectStart: M.selectStart, hoverT: M.hoverT, tick: M.tick };
function mine(o, d) { const t = pick(o, d); if (t == null) return false; const m = orig.hoverT(o, d); return m == null || t < m; }
M.click = function (o, d) { if (mine(o, d)) return pressButton('screen'); return orig.click(o, d); };
M.selectStart = function (c, o, d) { if (mine(o, d)) return pressButton('vr'); return orig.selectStart(c, o, d); };
M.hoverT = function (o, d) { const a = orig.hoverT(o, d), b = pick(o, d); return b != null && (a == null || b < a) ? b : a; };
M.tick = function (dt, T) {
  orig.tick(dt, T);
  if (press > 0) { press = Math.max(0, press - (dt || 0.016) * 6); cap.position.y = 0.0095 - 0.003 * Math.sin(press * Math.PI); }
  if (R.charging !== painted) paint();
  if (R.charging) { const k = 0.55 + 0.45 * Math.sin((T || performance.now() / 1000) * 2.4); ringM.color.setHex(CHARGING).multiplyScalar(k); }
};
// coming back into the room wakes it: a new headset session, or walking in again on a screen (the page reload resets it anyway)
function reenter(how) { if (R.wakeUp()) { api.wakes++; api.wokeBy = how; paint(); } }
if (RV.renderer && RV.renderer.xr) RV.renderer.xr.addEventListener('sessionstart', () => reenter('vr'));
const bFlat = document.getElementById('bFlat'); if (bFlat) bFlat.addEventListener('click', () => reenter('screen'));

const api = RV.roombaCharge = { press: pressButton, pick, reenter, button: btn, hit, label, presses: 0, wakes: 0, last: null, wokeBy: null };
paint();
})();
