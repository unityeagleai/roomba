// The Xanadu memory mirror: Unity at nine, singing into a hairbrush in front of the mirror, on the right wall a little
// way along from the red record player and the Xanadu poster. Her own AI image (assets/img/memory_xanadu_age9.jpg,
// the picture she sent, text overlay and all, only scaled to 793x1024) sits in a plum mirror frame ringed with a pink
// neon tube, with a soft neon glow on the wallpaper around it. When the record plays her recording, the neon breathes
// a little brighter; when it stops it settles back. Five draw calls, no extra lights.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene) return;
const scene = RV.scene, RX = RV.room.RX;

// right wall (x = RX), between the liminal poster (z -0.5..0.1) and the corner by the big screen; above the laundry pile
const AT = { x: RX, y: 1.47, z: 0.74 };
const IMG_W = 0.6, IMG_H = IMG_W * 1024 / 793;          // the picture keeps its own shape (0.60 x 0.775 m)
const NEON = 0xff7ad6;                                  // the room's hot pink, close to the neon mirror in her picture

const root = new THREE.Group(); root.name = 'xanaduMemoryMirror';
root.position.set(AT.x, AT.y, AT.z); root.rotation.y = -Math.PI / 2;   // local +z points into the room, local +x along +z world
scene.add(root);

function roundRect(s, w, h, r) {
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}

// soft neon glow on the wallpaper, behind the frame (additive, never writes depth)
const GW = IMG_W + 0.62, GH = IMG_H + 0.62;
const gc = document.createElement('canvas'); gc.width = 256; gc.height = Math.round(256 * GH / GW);
(function drawGlow() {
  const g = gc.getContext('2d'), w = gc.width, h = gc.height, sx = w / GW, sy = h / GH;
  g.clearRect(0, 0, w, h); g.translate(w / 2, h / 2);
  const fw = (IMG_W + 0.06) * sx, fh = (IMG_H + 0.06) * sy;
  g.strokeStyle = 'rgba(255,122,214,0.9)'; g.shadowColor = 'rgba(255,90,200,1)';
  for (const [blur, lw, a] of [[60, 26, 0.35], [34, 16, 0.55], [14, 8, 0.8]]) {
    g.globalAlpha = a; g.shadowBlur = blur; g.lineWidth = lw; g.beginPath(); roundRect(g, fw, fh, 0.06 * sx); g.stroke();
  }
})();
const glowTex = new THREE.CanvasTexture(gc); glowTex.encoding = THREE.sRGBEncoding;
const glowM = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, toneMapped: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const glow = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH), glowM); glow.position.z = 0.008; glow.renderOrder = 3; root.add(glow);

// the mirror body: a rounded plum slab standing 2.7 cm off the wall
const FW = IMG_W + 0.09, FH = IMG_H + 0.09, FD = 0.025;
const body = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRect(new THREE.Shape(), FW, FH, 0.055), { depth: FD, bevelEnabled: false, curveSegments: 6 }),
  new THREE.MeshPhongMaterial({ color: 0x2a1030, shininess: 60, specular: 0x553355, emissive: 0x12040f }));
body.position.z = 0.002; root.add(body);

// her picture, exactly as she sent it, unlit so it reads like a memory glowing in the glass
const imgM = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, visible: false });
const img = new THREE.Mesh(new THREE.PlaneGeometry(IMG_W, IMG_H), imgM); img.position.z = 0.002 + FD + 0.0015; img.name = 'xanadu memory'; root.add(img);
new THREE.TextureLoader().load('assets/img/memory_xanadu_age9.jpg', t => {
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; imgM.map = t; imgM.visible = true; imgM.needsUpdate = true; RV.mirror.ready = true;
}, undefined, e => console.warn('memory mirror image', e && e.type));

// the neon tube: a rounded rectangle just outside the picture, so none of the image is covered
const TW = IMG_W + 0.044, TH = IMG_H + 0.044, TR = 0.05;
const tubePath = new THREE.CurvePath();
(function () {
  const x = TW / 2, y = TH / 2, V2 = THREE.Vector2, L = (a, b) => tubePath.add(new THREE.LineCurve(a, b)), C = (a, c, b) => tubePath.add(new THREE.QuadraticBezierCurve(a, c, b));
  L(new V2(-x + TR, -y), new V2(x - TR, -y)); C(new V2(x - TR, -y), new V2(x, -y), new V2(x, -y + TR));
  L(new V2(x, -y + TR), new V2(x, y - TR)); C(new V2(x, y - TR), new V2(x, y), new V2(x - TR, y));
  L(new V2(x - TR, y), new V2(-x + TR, y)); C(new V2(-x + TR, y), new V2(-x, y), new V2(-x, y - TR));
  L(new V2(-x, y - TR), new V2(-x, -y + TR)); C(new V2(-x, -y + TR), new V2(-x, -y), new V2(-x + TR, -y));
})();
const pts = tubePath.getSpacedPoints(96).map(p => new THREE.Vector3(p.x, p.y, 0));
const tubeCurve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0);
const tubeM = new THREE.MeshBasicMaterial({ color: NEON, toneMapped: false });
const tube = new THREE.Mesh(new THREE.TubeGeometry(tubeCurve, 120, 0.0085, 8, true), tubeM);
tube.position.z = 0.002 + FD + 0.006; root.add(tube);

// the record playing her recording makes the memory light up: the neon and its glow breathe brighter (the picture itself never changes)
const base = new THREE.Color(NEON), dim = base.clone().multiplyScalar(0.82);
let level = 0, last = 0;
function recordOn() { const d = RV.media && RV.media._debug; return !!(d && ((d.rp && d.rp.on) || (d.recAudio && !d.recAudio.paused && !d.recAudio.ended))); }
tube.onBeforeRender = function () {
  const now = performance.now() / 1000, dt = last ? Math.min(0.1, now - last) : 0; last = now;
  if (dt <= 0) return;                                   // second eye in VR: already updated this frame
  const on = recordOn(); level += ((on ? 1 : 0) - level) * Math.min(1, dt * (on ? 1.6 : 0.9));
  const breathe = 0.5 + 0.5 * Math.sin(now * 2.1);
  glowM.opacity = 0.5 + level * (0.32 + 0.18 * breathe);
  tubeM.color.copy(dim).lerp(base, Math.min(1, 0.15 + level * (0.6 + 0.4 * breathe)));
  RV.mirror.level = level; RV.mirror.on = on;
};

RV.mirror = { root, img, glow, tube, body, ready: false, level: 0, on: false, IMG_W, IMG_H, AT };
})();
