// The light switch: an old cream rocker switch on the front wall, just right of the door (the latch side, where your
// hand finds it). Point + trigger (or click / tap) flips it: the big light goes off and the room goes night-time.
// What goes OFF with the switch (only the bright main room light):
//   - the ceiling lamp (the warm point light up top; its new flush ceiling fitting glows when on, goes dark when off)
//   - most of the soft purple room fill (hemisphere light), the moonlight through the window drops to a faint blue
//   - the grey 'readability' self-light on prints and posters (so the photos really go dim, lit only by the lamps)
// What STAYS ON, never touched by the switch:
//   - the lava lamp on the nightstand (its glow, its blobs and its own little warm light)
//   - the glow-in-the-dark stars on the ceiling (they even read brighter once the room is dark)
//   - the Xanadu poster's existing string lights, and the Xanadu poster itself (the string lights keep it lit),
//   - the Xanadu memory mirror with its glowing pink neon frame
//   - the Parallel Universe Access keycard poster and its glow, the TV, the statues, the origin frame
// A tiny amber locator LED in the switch lights up when the big light is off, so you can find it in the dark.
// Hooks into RV.media (click / selectStart / hoverT / tick) like the other add-ons, so app.js needs no changes.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene || !RV.media) return;
const scene = RV.scene, RZ = RV.room.RZ, RH = RV.room.RH;

// ---- the lights the switch controls (found in the scene, never re-created)
let hemi = null, moon = null, lamp = null;
scene.traverse(o => {
  if (o.isHemisphereLight && !hemi) hemi = o;
  else if (o.isDirectionalLight && !moon) moon = o;
  else if (o.isPointLight && o.position.y > 2.2 && o.color.getHex() === 0xffd6a0) lamp = o;
});
const DAY = { hemi: hemi ? hemi.intensity : 0, moon: moon ? moon.intensity : 0, lamp: lamp ? lamp.intensity : 0 };
const NIGHT = { hemi: DAY.hemi * 0.08, moon: DAY.moon * 0.32, lamp: 0 };
const GREY_NIGHT = 0.28;          // grey self-light on prints/posters at night (x day value)

// ---- the big light you switch off: a flush frosted dome on the ceiling, right where the lamp light hangs
const fixture = new THREE.Group(); fixture.name = 'ceilingLight';
const lx = lamp ? lamp.position.x : 0.3, lz = lamp ? lamp.position.z : 0.2;
fixture.position.set(lx, RH, lz); scene.add(fixture);
const baseM = new THREE.MeshPhongMaterial({ color: 0xd9d2c2, shininess: 30 });
const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.018, 32), baseM); base.position.y = -0.009; fixture.add(base);
const domeM = new THREE.MeshBasicMaterial({ color: 0xfff1d6 });
const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), domeM);
dome.scale.y = 0.42; dome.position.y = -0.018; dome.name = 'ceilingLightDome'; fixture.add(dome);
const DOME_ON = new THREE.Color(0xfff1d6), DOME_OFF = new THREE.Color(0x2a2630);

// ---- the switch: a cream plate with a rocker, on the front wall right of the door frame (frame ends at x -0.915;
// the big wall screen, when it's out, starts at x -0.72, so the plate at x -0.80 sits clear of both)
const SW = { x: -0.80, y: 1.22, z: RZ };
const sw = new THREE.Group(); sw.name = 'lightSwitch'; sw.position.set(SW.x, SW.y, SW.z); sw.rotation.y = Math.PI; scene.add(sw);
const plateM = new THREE.MeshPhongMaterial({ color: 0xece4cf, emissive: 0x2a2620, shininess: 40, specular: 0x333333 });
const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.008), plateM); plate.position.z = 0.004; plate.name = 'lightSwitchPlate'; sw.add(plate);
const rockerM = new THREE.MeshPhongMaterial({ color: 0xf6f0de, emissive: 0x2a2620, shininess: 60, specular: 0x444444 });
const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.056, 0.012), rockerM); rocker.position.z = 0.012; rocker.name = 'lightSwitchRocker'; sw.add(rocker);
const ledM = new THREE.MeshBasicMaterial({ color: 0x3a2a14 });
const led = new THREE.Mesh(new THREE.CircleGeometry(0.0035, 12), ledM); led.position.set(0, -0.019, 0.0185); sw.add(led);
// generous invisible target so it's easy to hit with the Quest ray
const hit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.06), new THREE.MeshBasicMaterial({ visible: false }));
hit.position.z = 0.02; hit.name = 'lightSwitchHit'; sw.add(hit);

// ---- grey 'readability' self-light on prints/posters: dimmed at night. Coloured emissives (the green ceiling stars,
// neon, the Xanadu poster's pink tint) and every unlit (MeshBasic / shader) glow are left alone.
let greys = null;
function collectGreys() {
  greys = []; const seen = new Set(), keep = new Set([plateM, rockerM, baseM]);
  const xan = RV.media._debug && RV.media._debug.poster; if (xan) keep.add(xan.material);
  scene.traverse(o => {
    if (!o.isMesh) return; const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || seen.has(m) || keep.has(m) || !m.emissive) continue; seen.add(m);
      const c = m.emissive; if (!(c.r > 0 && Math.abs(c.r - c.g) < 1e-4 && Math.abs(c.g - c.b) < 1e-4)) continue;
      greys.push({ m, day: c.clone() });
    }
  });
}
// the Xanadu poster: at night its existing string lights keep it lit (a little self-light from its own picture)
const xanadu = RV.media._debug && RV.media._debug.poster;
const XAN = xanadu ? { day: xanadu.material.emissive.clone(), night: new THREE.Color(0x3a3036) } : null;
if (xanadu) { xanadu.material.emissiveMap = xanadu.material.map; xanadu.material.needsUpdate = true; }
// with an emissiveMap the day tint now multiplies the picture; keep the old flat tint look by day: 0x1a0820 on the art
// is subtle either way, and by night the picture glows softly as if lit by the bulbs above it.

let on = true, level = 1, target = 1;   // level 1 = big light on, 0 = night
const tmp = new THREE.Color();
function apply(k) {
  if (hemi) hemi.intensity = NIGHT.hemi + (DAY.hemi - NIGHT.hemi) * k;
  if (moon) moon.intensity = NIGHT.moon + (DAY.moon - NIGHT.moon) * k;
  if (lamp) lamp.intensity = NIGHT.lamp + (DAY.lamp - NIGHT.lamp) * k;
  domeM.color.copy(DOME_OFF).lerp(DOME_ON, k);
  if (greys) for (const g of greys) g.m.emissive.copy(g.day).multiplyScalar(GREY_NIGHT + (1 - GREY_NIGHT) * k);
  if (XAN) xanadu.material.emissive.copy(XAN.night).lerp(XAN.day, k);
  ledM.color.setHex(k < 0.5 ? 0xffa030 : 0x3a2a14);
}

function click() {
  try {
    const A = RV.roomba && RV.roomba.audio && RV.roomba.audio.ctx; if (!A) return;
    const t = A.currentTime, o = A.createOscillator(), g = A.createGain(), f = A.createBiquadFilter();
    o.type = 'square'; o.frequency.setValueAtTime(on ? 1800 : 1400, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.03);
    f.type = 'highpass'; f.frequency.value = 600;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(f); f.connect(g); g.connect(A.destination); o.start(t); o.stop(t + 0.06);
  } catch (e) { }
}
function setLight(v) {
  if (!greys) collectGreys();
  on = !!v; target = on ? 1 : 0; api.flips++;
  rocker.rotation.x = on ? -0.2 : 0.2;   // top pressed in = on, bottom pressed in = off
  click(); if (RV.haptic) RV.haptic(0.25, 25);
  return true;
}
function toggle() { return setLight(!on); }
rocker.rotation.x = -0.2;

const ray = new THREE.Raycaster(); ray.far = 12;
function pick(o, d) { ray.set(o, d); const h = ray.intersectObject(hit, false)[0]; return h ? h.distance : null; }
const M = RV.media, orig = { click: M.click, selectStart: M.selectStart, hoverT: M.hoverT, tick: M.tick };
function mine(o, d) { const t = pick(o, d); if (t == null) return false; const m = orig.hoverT(o, d); return m == null || t < m; }
M.click = function (o, d) { if (mine(o, d)) return toggle(); return orig.click(o, d); };
M.selectStart = function (c, o, d) { if (mine(o, d)) return toggle(); return orig.selectStart(c, o, d); };
M.hoverT = function (o, d) { const a = orig.hoverT(o, d), b = pick(o, d); return b != null && (a == null || b < a) ? b : a; };
M.tick = function (dt, T) {
  orig.tick(dt, T);
  if (level !== target) { const s = Math.min(1, (dt || 0.016) / 0.25); level = target > level ? Math.min(target, level + s) : Math.max(target, level - s); apply(level); }
};
apply(1);

const api = RV.lights = { set: setLight, toggle, on: () => on, level: () => level, switchObj: sw, hit, fixture, dome, pick, flips: 0,
  _debug: { hemi, moon, lamp, DAY, NIGHT, greys: () => greys, SW, xanadu } };
})();
