"""Desktop test for the Unity Eagle voxel figurine on the bookshelf next to the TV.
Usage: python3 tools/test_figurine.py URL OUTDIR"""
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': []}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(3000)
    pg.click('#bFlat'); pg.wait_for_timeout(1200)
    ev = lambda js: pg.evaluate(js)
    res['fig'] = ev('(() => { const f = RV.figurine; return { ready: f.ready, error: f.error, voxels: f.voxels, verts: f.verts, tris: f.tris, size: f.size, vox: f.vox, inScene: !!(f.root && f.root.parent) }; })()')
    res['wp'] = ev('(() => { const b = new THREE.Box3().setFromObject(RV.figurine.root); return { min: b.min.toArray().map(v => +v.toFixed(3)), max: b.max.toArray().map(v => +v.toFixed(3)) }; })()')
    views = [('front_far', 1.2, -0.4, 1.3), ('front_near', 2.0, -1.3, 1.25), ('side_left', 1.35, -1.75, 1.3), ('side_right', 2.45, -1.45, 1.3), ('room', 0.0, 0.8, 1.3)]
    for name, x, z, _ in views:
        ev(f'__rv.setPlayer({x}, {z}, 0)'); pg.wait_for_timeout(300)
        ev('__rv.faceAt(2.13, 1.34, -2.04)'); pg.wait_for_timeout(700)
        res.setdefault('proj', {})[name] = ev('__rv.projectPt(2.13, 1.34, -2.04)')
        pg.screenshot(path=f'{OUT}/fig_{name}.png')
    res['info'] = ev('__rv.info()')
    res['dbg'] = ev('(() => { const d = __rv.debug(); return { fps: d.fps, errors: d.errors }; })()')
    b.close()
print(json.dumps(res, indent=1))
