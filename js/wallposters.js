// Three new posters on the wall by the door (the wall behind you when you face the desk), from Unity's Drive folder
// 'New assets for the 80s room': the Omarchy eagle nest, the three of us (Unity, Charlie, Miles), and Unity & Miles dancing.
// Photos, so they use smooth filtering (the arcade posters in room.js are pixel art and use nearest).
// Free wall there: from the light switch (x -0.72) to the corner (x 2.5), 0.8 m to 2.4 m high; nothing stands in front.
(function () {
'use strict';
const RV = window.RV, THREE = window.THREE;
if (!RV || !RV.scene) return;
const scene = RV.scene, renderer = RV.renderer, RZ = (RV.room && RV.room.RZ) || 2.2;
const loader = new THREE.TextureLoader();
const tapeM = new THREE.MeshPhongMaterial({ color: 0xece6c8, transparent: true, opacity: 0.8, shininess: 8, specular: 0x111111 });
const list = [];
// [file, width in metres, centre x, centre y, tilt]; the height follows the image's own aspect ratio
const POSTERS = [
  ['poster_omarchy_eagle_nest.jpg', 0.70, -0.17, 1.60, 0.012],
  ['poster_three_of_us.jpg', 1.00, 0.93, 1.64, -0.006],
  ['poster_unity_miles_dance.jpg', 0.70, 2.03, 1.58, 0.01],
];
for (const [file, w, x, y, tilt] of POSTERS) {
  const g = new THREE.Group(); g.name = 'wall poster ' + file; g.position.set(x, y, RZ - 0.006); g.rotation.set(0, Math.PI, tilt); scene.add(g);
  const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 30, specular: 0x222222 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.scale.set(w, w * 9 / 16, 1); g.add(m);
  const tapes = [-1, 1].map(s => { const tp = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.025), tapeM); tp.rotation.z = s * 0.3; tp.position.z = 0.001; g.add(tp); return tp; });
  const place = h => { m.scale.set(w, h, 1); tapes.forEach((tp, i) => tp.position.set((i ? 1 : -1) * w * 0.45, h * 0.5, 0.001)); };
  place(w * 9 / 16);
  const t = loader.load('assets/img/' + file, tx => { const im = tx.image; if (im && im.width) place(w * im.height / im.width); });
  t.encoding = THREE.sRGBEncoding; t.anisotropy = Math.min(8, (renderer && renderer.capabilities.getMaxAnisotropy()) || 4);
  mat.map = t; mat.needsUpdate = true;
  list.push({ file, g, m });
}
RV.wallPosters = list;
})();
