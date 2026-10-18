"""Render the figurine alone (orthographic front / side / 3-quarter) and compare its front silhouette and colours with the sprite.
Usage: python3 tools/test_figurine_iso.py URL OUTDIR"""
import sys, json, os, base64, io
from playwright.sync_api import sync_playwright
from PIL import Image
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
JS = '''(view) => {
  const f = RV.figurine, r = RV.renderer; r.setAnimationLoop(null);
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0xff00ff);
  const m = f.mesh.clone(); sc.add(m);
  const s = 0.13, cam = new THREE.OrthographicCamera(-s * 960 / 540, s * 960 / 540, s, -s, 0.01, 10);
  const cy = 0.022 + 0.12;
  if (view === 'front') cam.position.set(0, cy, 2); else if (view === 'side') cam.position.set(2, cy, 0); else cam.position.set(1.4, cy + 0.6, 1.4);
  cam.lookAt(0, cy, 0); r.setRenderTarget(null); r.render(sc, cam);
  return r.domElement.toDataURL('image/png');
}'''
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(3000)
    pg.wait_for_function('window.RV && RV.figurine && RV.figurine.ready')
    for v in ['front', 'side', 'quarter']:
        d = pg.evaluate(JS, v)
        im = Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGB'); im.save(f'{OUT}/iso_{v}.png')
        px = im.load(); W, H = im.size
        on = [(x, y) for y in range(H) for x in range(W) if px[x, y] != (255, 0, 255)]
        xs = [q[0] for q in on]; ys = [q[1] for q in on]
        res[v] = {'pixels': len(on), 'bbox': [min(xs), min(ys), max(xs), max(ys)] if on else None}
    b.close()
# compare front silhouette to sprite mask
spr = Image.open('assets/img/unity_eagle_sprite.png').convert('RGBA')
fr = Image.open(f'{OUT}/iso_front.png').convert('RGB')
x0, y0, x1, y1 = res['front']['bbox']
sb = spr.getbbox(); sc = spr.crop(sb)
fc = fr.crop((x0, y0, x1 + 1, y1 + 1)).resize(sc.size, Image.NEAREST)
sp, fp = sc.load(), fc.load(); agree = 0; tot = sc.size[0] * sc.size[1]; cerr = []
for y in range(sc.size[1]):
    for x in range(sc.size[0]):
        a = sp[x, y][3] > 128; bfill = fp[x, y] != (255, 0, 255)
        agree += (a == bfill)
        if a and bfill: cerr.append(sum(abs(sp[x, y][k] * 0.95 - fp[x, y][k]) for k in range(3)) / 3)
res['silhouette_agreement'] = round(agree / tot, 4)
res['mean_colour_err_0_255'] = round(sum(cerr) / max(1, len(cerr)), 1)
print(json.dumps(res, indent=1))
