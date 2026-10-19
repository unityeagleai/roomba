"""Desktop test for the two door stickers (js/stickers.js): both PNGs load with alpha, unchanged files, on the inside of
the door, inside their panels, clear of the ROOMBA XING sign, the knob and each other, a little tilted, floating off the
panel (no z-fighting), premultiplied blending (no dark fringe), dimmed by the light switch like the prints, nothing
solid in front of them from the middle of the room, where you start, the foot of the bed and the beanbag, and they
really change the pixels on screen. Usage: python3 tools/test_stickers.py URL OUTDIR"""
import sys, json, os, math, itertools, hashlib
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageStat
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
res = {'console': [], 'checks': {}, 'fail': []}
def check(name, ok, info=None):
    res['checks'][name] = {'ok': bool(ok), 'info': info}
    if not ok: res['fail'].append(name)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.on('response', lambda r: r.status >= 400 and res['console'].append(f'HTTP {r.status} {r.url}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500)
    pg.click('#bFlat'); pg.wait_for_timeout(1500)
    ev = lambda js, *a: pg.evaluate(js, *a)
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(80)
    for _ in range(40):
        if ev('RV.stickers && RV.stickers.ready') == 2: break
        pg.wait_for_timeout(250)
    s = ev('''() => { const S = RV.stickers, R = RV.room; RV.scene.updateMatrixWorld(true);
        return { ready: S.ready, Z: S.Z, panelZ: S.PANEL_Z, RZ: R.RZ, items: S.items.map(i => { const m = i.mesh, t = m.material.map, mt = m.material;
          const box = new THREE.Box3().setFromObject(m); const n = new THREE.Vector3(0, 0, 1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()));
          const r = new THREE.Vector3(1, 0, 0).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()));
          return { id: i.id, x: i.x, y: i.y, w: i.w, h: i.h, rot: i.rot, src: t.image && t.image.src.split('/').pop(), img: t.image ? t.image.width + 'x' + t.image.height : null,
            z: m.position.z, normal: n.toArray(), right: r.toArray(), premult: t.premultiplyAlpha, blend: [mt.blending === THREE.CustomBlending, mt.blendSrc === THREE.OneFactor, mt.blendDst === THREE.OneMinusSrcAlphaFactor],
            depthWrite: mt.depthWrite, polyOff: mt.polygonOffset, emissive: mt.emissive.getHex(), visible: m.visible,
            box: [box.min.toArray(), box.max.toArray()] }; }) }; }''')
    res['stickers'] = s
    check('two_stickers_loaded', s['ready'] == 2 and len(s['items']) == 2 and all(i['img'] == '1111x1379' for i in s['items']), [s['ready'], [i['img'] for i in s['items']]])
    sha = {'sticker_lol.png': 'd2d9ebee707e09aaf5b724e4f2435ab3af1b7906', 'sticker_feathers.png': 'f1d541149b53f6b8d73be255ba716b97a9abe3a4'}
    files = {f: hashlib.sha1(open(os.path.join(HERE, '..', 'assets', 'img', f), 'rb').read()).hexdigest() for f in sha}
    check('files_unchanged_from_drive', files == sha, files)
    alpha = {}
    for f in sha:
        im = Image.open(os.path.join(HERE, '..', 'assets', 'img', f)); alpha[f] = [im.mode, im.getpixel((0, 0))[3] if im.mode == 'RGBA' else None]
    check('pngs_have_transparency', all(v[0] == 'RGBA' and v[1] == 0 for v in alpha.values()), alpha)
    # on the inside of the door, facing into the room, not mirrored (right vector = world -x as seen from inside)
    check('face_into_room', all(i['normal'][2] < -0.999 and i['right'][0] < -0.98 for i in s['items']), [(i['normal'], i['right']) for i in s['items']])
    gap = s['panelZ'] - s['Z']
    check('float_off_panel_no_zfight', 0.0015 <= gap <= 0.004 and all(not i['depthWrite'] and i['polyOff'] for i in s['items']), round(gap, 4))
    check('premultiplied_clean_edges', all(i['premult'] and all(i['blend']) for i in s['items']), [(i['premult'], i['blend']) for i in s['items']])
    check('grey_selflight_for_switch', all(i['emissive'] in (0x404040,) for i in s['items']), [hex(i['emissive']) for i in s['items']])
    # rotated visible rectangles (door plane: x, y)
    def corners(i):
        a = math.radians(-i['rot']); c, sn = math.cos(a), math.sin(a); out = []
        for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            lx, ly = dx * i['w'] / 2, dy * i['h'] / 2
            # local +x maps to world -x (quad turned round), the tilt is about the door normal
            out.append((i['x'] - (lx * c - ly * sn), i['y'] + (lx * sn + ly * c)))
        return out
    def overlap(A, B):
        for P in (A, B):
            for k in range(4):
                x1, y1 = P[k]; x2, y2 = P[(k + 1) % 4]; nx, ny = y2 - y1, x1 - x2
                pa = [nx*x + ny*y for x, y in A]; pb = [nx*x + ny*y for x, y in B]
                if max(pa) <= min(pb) or max(pb) <= min(pa): return False
        return True
    C = {i['id']: corners(i) for i in s['items']}
    check('stickers_dont_overlap', not overlap(*C.values()), C)
    panels = {'upper': (-1.70, -1.10, 1.15, 1.75), 'lower': (-1.70, -1.10, 0.25, 0.85)}
    inpanel = {}
    for i in s['items']:
        inpanel[i['id']] = [k for k, (x0, x1, y0, y1) in panels.items() if all(x0 + 0.005 < x < x1 - 0.005 and y0 + 0.005 < y < y1 - 0.005 for x, y in C[i['id']])]
    check('each_sticker_inside_one_door_panel', all(len(v) == 1 for v in inpanel.values()), inpanel)
    sign = [(-1.4, 1.635), (-1.265, 1.5), (-1.4, 1.365), (-1.535, 1.5)]
    check('clear_of_roomba_xing_sign', not any(overlap(c, sign) for c in C.values()))
    knob = (-1.1, 1.0, 0.045)
    check('clear_of_knob', all(min(math.hypot(x - knob[0], y - knob[1]) for x, y in c) > 0.1 for c in C.values()))
    check('a_little_tilted_like_real_stickers', all(2 <= abs(i['rot']) <= 12 for i in s['items']), [i['rot'] for i in s['items']])
    check('real_sticker_size', all(0.10 <= i['h'] <= 0.2 for i in s['items']), [(round(i['w'], 3), i['h']) for i in s['items']])
    # nothing solid between your eyes and each sticker (rays to its centre and four inner points)
    spots = {'start': (0.35, 1.45), 'mid_room': (0.3, 0.2), 'foot_of_bed': (-0.3, 0.2), 'beanbag': (1.5, 1.0), 'by_tv': (0.6, -1.4)}
    vis = ev('''(spots) => { const S = RV.stickers, out = {}; const rc = new THREE.Raycaster(); RV.scene.updateMatrixWorld(true);
        const solid = []; RV.scene.traverse(o => { if (o.isMesh && o.visible && !(o.material.transparent && !o.material.depthWrite) && o.name !== 'reticle') solid.push(o); });
        for (const [name, [x, z]] of Object.entries(spots)) { out[name] = {};
          for (const it of S.items) { const res = [];
            for (const [fx, fy] of [[0, 0], [-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]]) {
              const eye = new THREE.Vector3(x, 1.6, z), tgt = new THREE.Vector3(it.x - fx * it.w, it.y + fy * it.h, S.Z);
              const d = tgt.clone().sub(eye), L = d.length(); rc.set(eye, d.normalize()); const h = rc.intersectObjects(solid, false)[0];
              res.push(h && h.distance < L - 0.001 ? (h.object.name || h.object.geometry.type) + '@' + h.distance.toFixed(2) : 'clear'); }
            out[name][it.id] = res; } }
        return out; }''', spots)
    res['visibility'] = vis
    for name, hits in vis.items():
        check(f'unoccluded_from_{name}', all(v == 'clear' for r in hits.values() for v in r), hits)
    # pixels: screenshot with and without the stickers; the sticker area must change
    shots = {'01_start': (0.35, 1.45), '02_mid_room': (0.3, 0.2), '03_foot_of_bed': (-0.3, 0.2), '04_beanbag': (1.5, 1.0), '05_close': (-1.35, 1.2)}
    for n, (x, z) in shots.items():
        ev(f'__rv.setPlayer({x}, {z}, 0)'); W(150); ev('__rv.faceAt(-1.42, 1.0, 2.2)'); W(500)
        a = f'{OUT}/{n}.png'; pg.screenshot(path=a)
        ev('RV.stickers.root.visible = false'); W(250); bp = f'{OUT}/{n}_without.png'; pg.screenshot(path=bp); ev('RV.stickers.root.visible = true'); W(150)
        pts = ev('''() => RV.stickers.items.map(it => { const pts = [[-0.25, -0.25], [0.25, -0.25], [0.25, 0.25], [-0.25, 0.25], [0, 0]].map(([fx, fy]) => {
            const v = new THREE.Vector3(it.x - fx * it.w, it.y + fy * it.h, RV.stickers.Z).project(RV.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight, v.z < 1]; });
            return [it.id, pts]; })''')
        ia, ib = Image.open(a).convert('RGB'), Image.open(bp).convert('RGB'); diff = ImageChops.difference(ia, ib); px = {}
        for sid, P in pts:
            xs = [q[0] for q in P]; ys = [q[1] for q in P]
            if not all(q[2] for q in P) or min(xs) < 0 or min(ys) < 0 or max(xs) >= ia.width or max(ys) >= ia.height: px[sid] = 'off screen'; continue
            box = (int(min(xs)), int(min(ys)), int(max(xs)) + 1, int(max(ys)) + 1)
            st = ImageStat.Stat(diff.crop(box)); px[sid] = {'box': box, 'mean_diff': round(sum(st.mean) / 3, 1)}
        res['checks'][f'pixels_{n}'] = px
        check(f'both_drawn_{n}', all(v != 'off screen' and v['mean_diff'] > 8 for v in px.values()), px)
    # the light switch still dims them (grey self-light goes to 0.28 at night)
    lit = ev('''() => { const m = RV.stickers.items[0].mesh.material; return m.emissive.getHex(); }''')
    res['emissive_day'] = hex(lit)
    b.close()
http = [c for c in res['console'] if c.startswith('HTTP')]
errs = [c for c in res['console'] if c.startswith('PAGEERROR') or (c.startswith('HTTP') and 'episodes.json' not in c)
        or (c.startswith('error') and 'Failed to load resource' not in c)]
res['errors'] = errs
if errs: res['fail'].append('console_errors')
print(json.dumps({k: v for k, v in res.items() if k != 'console'}, indent=1, default=str))
print('FAIL' if res['fail'] else 'PASS', res['fail'])
