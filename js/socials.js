// Unity's 'find me' poster: an 80s arcade card with her 8-bit Unity Eagle sprite and where to find her,
// taped to the left wall in the corner by the window, between the curtains and the nightstand with the lava lamp.
// The picture is assets/img/poster_socials.png (tools/make_socials_poster.py). Every link on it is from her own
// contact page, unityeagleai.com/contact: X @unityeagle, Instagram @unityeagle, website unityeagleai.com.
// Two draw calls (the poster, the tape), no lights. It is a lit poster like the others, with a little of its own
// glow so the handles stay readable in that dim corner of the room.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE; if (!RV || !RV.scene) return;
const scene = RV.scene, RX = RV.room.RX;

// left wall (x = -RX). Free strip there: z -2.11 (left curtain) .. -1.09 (the lava lamp's glow on the wall).
const AT = { x: -RX, y: 1.5, z: -1.6 };
const W = 0.62, H = W * 1408 / 1024;                    // keeps the picture's own shape: 0.62 x 0.85 m
const LINKS = { x: 'https://x.com/unityeagle', instagram: 'https://instagram.com/unityeagle', website: 'https://unityeagleai.com' };

const root = new THREE.Group(); root.name = 'socialsPoster';
root.position.set(AT.x + 0.005, AT.y, AT.z); root.rotation.y = Math.PI / 2;   // local +z points into the room
scene.add(root);

const t = new THREE.TextureLoader().load('assets/img/poster_socials.png', () => { api.ready = true; });
t.encoding = THREE.sRGBEncoding;
t.anisotropy = (RV.renderer && RV.renderer.capabilities.getMaxAnisotropy()) || 4;   // sharp text at an angle
const mat = new THREE.MeshPhongMaterial({ map: t, emissiveMap: t, emissive: 0x4a4a4a, shininess: 30, specular: 0x222222 });
const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
mesh.name = 'socialsPosterFace'; mesh.rotation.z = 0.012;   // hung by hand, a hair off level
root.add(mesh);

// tape on the four corners, merged into one mesh
const tapes = [];
for (const [sx, sy, r] of [[-1, 1, 0.35], [1, 1, -0.3], [-1, -1, -0.3], [1, -1, 0.4]]) {
  const g = new THREE.PlaneGeometry(0.075, 0.026);
  g.applyMatrix4(new THREE.Matrix4().makeRotationZ(r));
  g.translate(sx * (W / 2 - 0.02), sy * (H / 2 - 0.012), 0.0015);
  tapes.push(g);
}
const merge = THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeBufferGeometries;
const tapeM = new THREE.MeshPhongMaterial({ color: 0xece6c8, transparent: true, opacity: 0.8, depthWrite: false });
if (merge) mesh.add(new THREE.Mesh(merge(tapes), tapeM));
else { const all = new THREE.BufferGeometry(); const pos = [], uv = [], idx = []; let o = 0;
  for (const g of tapes) { const p = g.attributes.position.array, u = g.attributes.uv.array, ix = g.index.array; pos.push(...p); uv.push(...u); for (const i of ix) idx.push(i + o); o += p.length / 3; }
  all.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); all.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); all.setIndex(idx); all.computeVertexNormals();
  mesh.add(new THREE.Mesh(all, tapeM)); }

const api = RV.socials = { root, mesh, AT, W, H, LINKS, ready: false };
})();
