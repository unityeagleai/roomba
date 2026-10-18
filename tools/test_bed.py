"""Close-up views of the bed (and a few other spots) to check for z-fighting, plus a smoke check of the rest of the room.
Usage: python3 tools/test_bed.py URL OUTDIR"""
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': []}
# name, eye x, eye y, eye z, look-at x, y, z
VIEWS = [
    ('foot_room_far', 0.9, 1.5, 1.4, -0.9, 0.4, 0.2),
    ('foot_end_near', -0.15, 0.7, 0.35, -0.6, 0.42, 0.2),
    ('foot_corner_room', -0.2, 0.75, 1.3, -0.62, 0.42, 0.72),
    ('side_room_near', -1.0, 0.75, 1.45, -0.9, 0.42, 0.76),
    ('side_room_low', -0.75, 0.35, 1.25, -0.7, 0.36, 0.76),
    ('side_night_near', -0.9, 0.8, -1.1, -0.9, 0.42, -0.36),
    ('foot_corner_night', -0.2, 0.75, -0.9, -0.62, 0.42, -0.36),
    ('headboard', -1.4, 1.2, 0.2, -2.55, 0.8, 0.2),
    ('plush', -0.6, 1.0, 0.95, -0.95, 0.85, 0.5),
    ('far_door', 0.6, 1.6, 2.0, -1.4, 0.4, 0.2),
    ('fig_plinth', 2.0, 1.4, -1.45, 2.13, 1.25, -2.04),
    ('vhs', 2.1, 1.05, -1.45, 2.12, 0.95, -1.95),
    ('console', 1.25, 0.95, -1.35, 0.85, 0.76, -1.8),
    ('record_cab', 1.7, 1.1, -1.3, 2.5, 0.6, -1.28),
    ('cart_shelf', -1.7, 1.2, 1.3, -2.45, 0.6, 1.3),
]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(3000)
    pg.click('#bFlat'); pg.wait_for_timeout(1200)
    ev = lambda js: pg.evaluate(js)
    only = sys.argv[3].split(',') if len(sys.argv) > 3 else None
    for name, x, y, z, lx, ly, lz in VIEWS:
        if only and name not in only: continue
        ev(f'__rv.setPlayer({x}, {z}, 0)'); ev(f'RV.camera.position.y = {y}'); pg.wait_for_timeout(250)
        ev(f'__rv.faceAt({lx}, {ly}, {lz})'); pg.wait_for_timeout(600)
        pg.screenshot(path=f'{OUT}/{name}.png')
    ev('RV.camera.position.y = 1.6')
    res['info'] = ev('__rv.info()')
    res['dbg'] = ev('(() => { const d = __rv.debug(); return { fps: d.fps, errors: d.errors }; })()')
    b.close()
print(json.dumps(res, indent=1))
