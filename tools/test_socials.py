"""Desktop test for Unity's 'find me' socials poster on the left wall: the picture loads at full size and keeps its
shape, the poster sits on the wall inside the room, clear of the curtains / window, the lava lamp glow, the nightstand,
the guest board strip (left wall z 0.53..2.07), the picture rail and the skirting; nothing in the room blocks it from
several spots; it is lit well enough to read; no console errors. Usage: python3 tools/test_socials.py URL OUTDIR"""
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500)
    pg.click('#bFlat'); pg.wait_for_timeout(1200)
    ev = lambda js: pg.evaluate(js)
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(80)
    res['checks']['geometry'] = ev('''(() => { const s = RV.socials, r = RV.room; s.root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(s.root); const f = a => a.toArray().map(v => +v.toFixed(3));
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(s.mesh.getWorldQuaternion(new THREE.Quaternion()));
        const t = s.mesh.material.map;
        return { ready: s.ready, tex: t && t.image ? t.image.width + 'x' + t.image.height : null, aspect: +(s.W / s.H).toFixed(4), srcAspect: +(1024 / 1408).toFixed(4),
          size_m: [+s.W.toFixed(3), +s.H.toFixed(3)], box: { min: f(box.min), max: f(box.max) }, facesRoom: f(n),
          offWall: +(box.min.x + r.RX).toFixed(4), insideRoom: box.min.x >= -r.RX - 1e-6,
          clearOfCurtain: box.min.z > -2.11 + 0.1, clearOfLavaGlow: box.max.z < -1.09, clearOfGuestBoardStrip: box.max.z < 0.53,
          clearOfNightstand: box.max.z < -0.88 || box.min.y > 1.0, belowPictureRail: box.max.y < r.RH - 0.14, aboveSkirting: box.min.y > 0.12,
          drawCalls: (() => { let k = 0; s.root.traverse(o => { if (o.isMesh) k++; }); return k; })() };
      })()''')
    # anything between the eye and 9 points on the poster? (rays from several spots in the room)
    spots = {'01_spawn': (0.35, 1.45), '02_rug': (0.55, -0.35), '03_bed_foot': (-0.3, 0.2), '04_close': (-1.75, -1.6), '05_by_tv': (0.2, -1.5), '06_door': (-1.4, 1.7)}
    occl = {}
    for name, (x, z) in spots.items():
        ev(f'__rv.setPlayer({x}, {z}, 0)'); W(150); ev('__rv.faceAt(RV.socials.AT.x, RV.socials.AT.y, RV.socials.AT.z)'); W(450)
        occl[name] = ev('''(() => { const s = RV.socials, cam = RV.camera, head = new THREE.Vector3(); cam.getWorldPosition(head);
          const rc = new THREE.Raycaster(); rc.camera = cam; let clear = 0, hits = [];
          for (const u of [-0.4, 0, 0.4]) for (const v of [-0.4, 0, 0.4]) {
            const p = new THREE.Vector3(u * s.W, v * s.H, 0); s.mesh.localToWorld(p);
            const dir = p.clone().sub(head); const dist = dir.length(); rc.set(head, dir.normalize()); rc.far = dist - 0.01;
            const h = rc.intersectObjects(RV.scene.children, true).filter(i => i.object.visible && i.object !== s.mesh && !s.mesh.children.includes(i.object) && i.object.material && !i.object.material.transparent);
            if (h.length) hits.push(h[0].object.name || h[0].object.geometry.type); else clear++; }
          const d = head.distanceTo(new THREE.Vector3(s.AT.x, s.AT.y, s.AT.z));
          return { clear: clear + '/9', blockers: [...new Set(hits)], dist_m: +d.toFixed(2) }; })()''')
        pg.screenshot(path=f'{OUT}/{name}.png')
    res['checks']['occlusion'] = occl
    # brightness of the poster on screen from close up (centre of a white handle row should read bright)
    ev('__rv.setPlayer(-1.6, -1.6, 0)'); W(150); ev('__rv.faceAt(RV.socials.AT.x, RV.socials.AT.y, RV.socials.AT.z)'); W(500)
    pg.screenshot(path=f'{OUT}/07_straight_on.png')
    res['checks']['onscreen'] = ev('(() => { const s = RV.socials; const a = __rv.projectPt(s.AT.x, s.AT.y + s.H / 2, s.AT.z - s.W / 2), c = __rv.projectPt(s.AT.x, s.AT.y - s.H / 2, s.AT.z + s.W / 2); return { tl: a, br: c }; })()')
    res['checks']['draws'] = ev('RV.renderer.info.render.calls')
    b.close()
errs = [c for c in res['console'] if c.startswith('error') or c.startswith('PAGEERROR')]
res['errors'] = errs
json.dump(res, open(f'{OUT}/result.json', 'w'), indent=1)
print(json.dumps(res, indent=1))
