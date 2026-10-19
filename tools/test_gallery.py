"""Desktop test for Unity's photo wall above the bed (js/gallery.js): ten photos load from the atlas, every photo keeps
its own shape, every frame sits on the left wall above the headboard, below the picture rail, clear of the FIND ME ON
poster and the cartridge shelf; the layout is scattered (several heights, sizes and tilts, not a grid) and any two frames
that overlap hang on different layers; each photo is the first thing a ray from the room hits (not hidden behind a
neighbour or furniture), and on screen each photo centre is drawn grey (the black-and-white print, not the purple
wallpaper); no console errors. Usage: python3 tools/test_gallery.py URL OUTDIR"""
import sys, json, os, itertools, math
from playwright.sync_api import sync_playwright
from PIL import Image
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}, 'fail': []}
def check(name, ok, info=None):
    res['checks'][name] = {'ok': bool(ok), 'info': info}
    if not ok: res['fail'].append(name)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('response', lambda r: res['console'].append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(3000)
    pg.click('#bFlat'); pg.wait_for_timeout(1500)
    ev = lambda js, *a: pg.evaluate(js, *a)
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(80)
    g = ev('''(() => { const G = RV.gallery; const t = G.photos.material.map;
        G.root.updateMatrixWorld(true); const f = a => a.toArray().map(v => +v.toFixed(3));
        const fb = new THREE.Box3().setFromObject(G.frames), pb = new THREE.Box3().setFromObject(G.photos);
        return { ready: G.ready, count: G.count, tex: t && t.image ? t.image.width + 'x' + t.image.height : null, items: G.items,
          frames: { min: f(fb.min), max: f(fb.max) }, photos: { min: f(pb.min), max: f(pb.max) }, RX: RV.room.RX, RH: RV.room.RH,
          socialsZ: RV.socials ? [RV.socials.AT.z - RV.socials.W / 2, RV.socials.AT.z + RV.socials.W / 2] : null };
      })()''')
    res['gallery'] = g
    check('atlas_loaded_10_photos', g['ready'] and g['count'] == 10 and g['tex'] == '2048x2048', [g['ready'], g['count'], g['tex']])
    check('every_photo_keeps_its_shape', all(abs(i['aspect'] - i['srcAspect']) < 0.002 for i in g['items']), [(i['id'], i['aspect'], i['srcAspect']) for i in g['items']])
    fr = g['frames']; RX = g['RX']
    check('on_left_wall_facing_room', fr['min'][0] >= -RX - 1e-4 and fr['max'][0] < -RX + 0.08, fr)
    check('above_headboard', fr['min'][1] > 1.08, fr['min'][1])
    check('below_picture_rail', fr['max'][1] < 2.455, fr['max'][1])
    check('clear_of_socials_poster', g['socialsZ'] is None or fr['min'][2] > g['socialsZ'][1] + 0.05, [fr['min'][2], g['socialsZ']])
    check('clear_of_cartridge_shelf_side', fr['max'][2] < 1.76, fr['max'][2])
    ys = sorted(set(round(i['y'], 2) for i in g['items'])); ws = sorted(set(round(i['w'], 2) for i in g['items'])); rots = [i['rot'] for i in g['items']]
    check('scattered_not_a_grid', len(ys) >= 8 and len(ws) >= 6 and len(set(rots)) >= 8, {'heights': ys, 'widths': ws, 'tilts': rots})
    # overlapping frames (rotated rectangles, separating axis test) must hang on different layers
    def corners(i, shrink=0):
        c, s = math.cos(math.radians(i['rot'])), math.sin(math.radians(i['rot'])); Wd, Hd = i['W'] - shrink, i['H'] - shrink
        return [(i['u'] + c * x - s * y, i['y'] + s * x + c * y) for x, y in ((-Wd/2, -Hd/2), (Wd/2, -Hd/2), (Wd/2, Hd/2), (-Wd/2, Hd/2))]
    def overlap(a, b, sa=0):
        A, B = corners(a, sa), corners(b)
        for P in (A, B):
            for k in range(4):
                ex, ey = P[(k+1) % 4][0] - P[k][0], P[(k+1) % 4][1] - P[k][1]; nx, ny = -ey, ex
                pa = [nx*x + ny*y for x, y in A]; pb = [nx*x + ny*y for x, y in B]
                if max(pa) <= min(pb) or max(pb) <= min(pa): return False
        return True
    pairs = [(a['id'], b['id'], a['layer'], b['layer']) for a, b in itertools.combinations(g['items'], 2) if overlap(a, b)]
    check('some_frames_overlap', len(pairs) >= 2, pairs)
    check('overlapping_frames_on_different_layers', all(la != lb for _, _, la, lb in pairs), pairs)
    # the spacer block behind a deeper frame (inset 5 cm each side) must not cut through the frame it hangs over
    hits = [(a['id'], b['id']) for a in g['items'] for b in g['items'] if a['layer'] > b['layer'] and overlap(a, b, 0.1)]
    check('spacers_clear_of_lower_frames', not hits, hits)
    # rays from three spots in the room to each photo centre: the first solid thing hit is the photo mesh
    spots = {'mid_room': (0.6, 0.3), 'foot_of_bed': (-0.3, 0.2), 'by_door': (-1.0, 1.6)}
    vis = ev('''(spots) => { const G = RV.gallery, out = {}; const rc = new THREE.Raycaster(); RV.scene.updateMatrixWorld(true);
        const solid = []; RV.scene.traverse(o => { if (o.isMesh && o.visible && !(o.material.transparent && !o.material.depthWrite) && o.name !== 'reticle') solid.push(o); });
        for (const [name, [x, z]] of Object.entries(spots)) { out[name] = {};
          for (const it of G.items) { const eye = new THREE.Vector3(x, 1.6, z), tgt = new THREE.Vector3(-RV.room.RX + it.front, it.y, it.worldZ);
            rc.set(eye, tgt.clone().sub(eye).normalize()); const h = rc.intersectObjects(solid, false)[0];
            out[name][it.id] = h ? h.object.name : 'nothing'; } }
        return out; }''', spots)
    res['visibility'] = vis
    for name, hits in vis.items():
        check(f'unoccluded_from_{name}', all(v == 'photoWallPhotos' for v in hits.values()), hits)
    # screenshots + pixel check: the centre of each photo on screen is grey-ish (a b/w print), not purple wallpaper
    shots = {'01_mid_room': (0.6, 0.3, (-2.6, 1.75, 0.05)), '02_foot_of_bed': (-0.3, 0.2, (-2.6, 1.75, 0.05)), '03_door': (-1.0, 1.6, (-2.6, 1.75, 0.0))}
    for n, (x, z, t) in shots.items():
        ev(f'__rv.setPlayer({x}, {z}, 0)'); W(150); ev(f'__rv.faceAt({t[0]}, {t[1]}, {t[2]})'); W(600)
        path = f'{OUT}/{n}.png'; pg.screenshot(path=path)
        pts = ev('''() => RV.gallery.items.map(it => { const v = new THREE.Vector3(-RV.room.RX + it.front, it.y, it.worldZ).project(RV.camera);
            return [it.id, (v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight, v.z < 1]; })''')
        im = Image.open(path).convert('RGB'); px = {}
        for pid, sx, sy, front in pts:
            if not (front and 3 <= sx < im.width - 3 and 3 <= sy < im.height - 3): px[pid] = 'off screen'; continue
            rs = [im.getpixel((int(sx) + dx, int(sy) + dy)) for dx in (-2, 0, 2) for dy in (-2, 0, 2)]
            r_, g_, b_ = [sum(c[k] for c in rs) / 9 for k in range(3)]
            # a b/w print lit by the room (warm lava-lamp light tints it orange): neutral or warm, never the blue-purple wallpaper
            px[pid] = {'rgb': [round(r_), round(g_), round(b_)], 'grey': r_ >= b_ - 6 and g_ >= b_ - 6 and (r_ + g_ + b_) / 3 > 50}
        res['checks'][f'pixels_{n}'] = px
        on = [v for v in px.values() if v != 'off screen']
        check(f'photos_drawn_{n}', len(on) >= 8 and all(v['grey'] for v in on), px)
    ev('__rv.setPlayer(-1.25, 0.2, 0)'); W(150); ev('__rv.faceAt(-2.6, 1.7, 0.1)'); W(600); pg.screenshot(path=f'{OUT}/04_close.png')
    res['draws'] = ev('RV.renderer.info.render.calls')
    b.close()
http = [c for c in res['console'] if c.startswith('HTTP')]
only_eps = all('episodes.json' in c for c in http)   # a local server has no ../charlie-season; the live site does
errs = [c for c in res['console'] if c.startswith('PAGEERROR') or (c.startswith('HTTP') and 'episodes.json' not in c)
        or (c.startswith('error') and not (only_eps and 'Failed to load resource' in c))]
res['errors'] = errs
if errs: res['fail'].append('console_errors')
json.dump(res, open(f'{OUT}/result.json', 'w'), indent=1)
print(json.dumps({'fail': res['fail'], 'errors': errs, 'draws': res['draws'], 'visibility': res['visibility'], 'checks': {k: v for k, v in res['checks'].items() if isinstance(v, dict) and 'ok' in v and not v['ok']}}, indent=1))
sys.exit(1 if res['fail'] else 0)
