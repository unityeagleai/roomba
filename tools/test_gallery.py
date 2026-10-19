"""Desktop test for Unity's photo wall above the bed (js/gallery.js): ten photos load from the atlas, every photo keeps
its own shape, the prints are taped straight onto the left wall (no cork board, no frames) above the headboard, below
the picture rail, clear of the FIND ME ON poster and the cartridge shelf; real-life print sizes (13-18 cm tall), no two
prints overlap, no tape strip covers any photo, prints are a little tilted and every one is held by tape; each photo is the first thing a ray from the room hits (not hidden behind a
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
          frames: { min: f(fb.min), max: f(fb.max) }, photos: { min: f(pb.min), max: f(pb.max) }, RX: RV.room.RX, RH: RV.room.RH, inner: G.inner,
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
    # one cork board, no frames per photo: prints in loose rows, every print fully on the cork, no two prints overlap,
    # no pin or tape strip lies on any photo (only on the white print borders and the cork), slightly tilted, pins + tape
    rots = [i['rot'] for i in g['items']]; inner = g['inner']
    check('loose_and_tilted', len(set(rots)) >= 8 and all(0.3 <= abs(r) <= 3 for r in rots), rots)
    holds = [h['rot'] for i in g['items'] for h in i['holds']]
    check('taped_only', all(i['hold'].startswith('tape') and i['holds'] for i in g['items']), [(i['id'], i['hold'], len(i['holds'])) for i in g['items']])
    nb = ev("""(() => { let n = 0; RV.scene.traverse(o => { if (/cork|board/i.test(o.name)) n++; }); return { named: n, board: RV.gallery.board }; })()""")
    check('no_cork_board', nb['named'] == 0 and nb['board'] is None, nb)
    check('taped_flat_on_wallpaper', fr['min'][0] >= -RX - 1e-4 and fr['max'][0] < -RX + 0.012, fr)
    def corners(c):
        co, si = math.cos(math.radians(c['rot'])), math.sin(math.radians(c['rot']))
        return [(c['u'] + co * x - si * y, c['y'] + si * x + co * y) for x, y in ((-c['w']/2, -c['h']/2), (c['w']/2, -c['h']/2), (c['w']/2, c['h']/2), (-c['w']/2, c['h']/2))]
    def overlap(ra, rb):
        A, B = corners(ra), corners(rb)
        for P in (A, B):
            for k in range(4):
                ex, ey = P[(k+1) % 4][0] - P[k][0], P[(k+1) % 4][1] - P[k][1]; nx, ny = -ey, ex
                pa = [nx*x + ny*y for x, y in A]; pb = [nx*x + ny*y for x, y in B]
                if max(pa) <= min(pb) or max(pb) <= min(pa): return False
        return True
    printR = lambda i: {'u': i['u'], 'y': i['y'], 'w': i['W'], 'h': i['H'], 'rot': i['rot']}
    photoR = lambda i: {'u': i['u'], 'y': i['y'], 'w': i['w'], 'h': i['h'], 'rot': i['rot']}
    pp = [(a['id'], b['id']) for a, b in itertools.combinations(g['items'], 2) if overlap(printR(a), printR(b))]
    check('no_photos_overlap', not pp, pp)
    cov = [(h_owner['id'], i['id']) for h_owner in g['items'] for h in h_owner['holds'] for i in g['items'] if overlap(h, photoR(i))]
    check('no_pin_or_tape_covers_a_photo', not cov, cov)
    out = [i['id'] for i in g['items'] if not all(inner['u0'] + 0.005 < x < inner['u1'] - 0.005 and inner['y0'] + 0.005 < y < inner['y1'] - 0.005 for x, y in corners(printR(i)))]
    check('every_print_over_the_bed_area', not out, out)
    sizes = sorted(round(i['h'], 3) for i in g['items'])
    check('real_life_print_size', 0.13 <= sizes[0] and sizes[-1] <= 0.19, sizes)
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
