"""List meshes whose world box overlaps a region. Usage: python3 tools/probe_box.py URL x0 x1 y0 y1 z0 z1"""
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; b6 = [float(v) for v in sys.argv[2:8]]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.goto(URL + ('&' if '?' in URL else '?') + 'nomerge', wait_until='load'); pg.wait_for_timeout(3000)
    out = pg.evaluate('''(b) => { const r = []; const q = new THREE.Box3(new THREE.Vector3(b[0], b[2], b[4]), new THREE.Vector3(b[1], b[3], b[5]));
      RV.scene.traverse(o => { if (!o.isMesh && !o.isPoints) return; const bb = new THREE.Box3().setFromObject(o); if (bb.isEmpty() || !bb.intersectsBox(q)) return;
        const s = bb.getSize(new THREE.Vector3()); if (s.x > 3 || s.z > 3) return;
        r.push({ n: o.name || o.parent && o.parent.name || o.geometry.type, min: bb.min.toArray().map(v => +v.toFixed(3)), max: bb.max.toArray().map(v => +v.toFixed(3)) }); });
      return r; }''', b6)
    print(json.dumps(out, indent=0))
    b.close()
