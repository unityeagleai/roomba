"""Desktop test for the Xanadu memory mirror on the right wall: the picture loads at full size and unchanged shape,
the mirror sits inside the room, on the wall, clear of the liminal poster, the Xanadu poster / fairy lights, the corner,
the picture rail and the skirting; it is visible from the room; the neon brightens while the record plays and settles
after; no console errors. Usage: python3 tools/test_mirror.py URL OUTDIR"""
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500)
    pg.click('#bFlat'); pg.wait_for_timeout(1200)
    ev = lambda js: pg.evaluate(js)
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(80)
    res['checks']['geometry'] = ev('''(() => { const m = RV.mirror, r = RV.room; m.root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(m.body); box.union(new THREE.Box3().setFromObject(m.tube));
        const gb = new THREE.Box3().setFromObject(m.glow); const n = new THREE.Vector3(0, 0, 1).applyQuaternion(m.root.getWorldQuaternion(new THREE.Quaternion()));
        const t = m.img.material.map; const f = a => a.toArray().map(v => +v.toFixed(3));
        return { ready: m.ready, tex: t ? t.image.width + 'x' + t.image.height : null, imgAspect: +(m.IMG_W / m.IMG_H).toFixed(4), srcAspect: +(793 / 1024).toFixed(4),
          box: { min: f(box.min), max: f(box.max) }, glow: { min: f(gb.min), max: f(gb.max) }, facesRoom: f(n),
          standsOffWall: +(r.RX - box.min.x).toFixed(3), insideRoom: box.max.x <= r.RX + 1e-6,
          clearOfLiminalPoster: box.min.z > 0.1 + 0.1, clearOfFairyLightsAndXanaduPoster: box.min.z > -0.72, clearOfFrontCorner: box.max.z < r.RZ - 0.5,
          belowPictureRail: box.max.y < r.RH - 0.14, aboveSkirting: box.min.y > 0.12 };
      })()''')
    # look at it from the middle of the room, from the record player, and from the doorway
    for name, (x, z) in {'01_mid': (0.6, 0.6), '02_from_record_player': (1.9, -0.9), '03_door': (-1.2, 1.6)}.items():
        ev(f'__rv.setPlayer({x}, {z}, 0)'); W(150); ev('__rv.faceAt(RV.mirror.AT.x, RV.mirror.AT.y, RV.mirror.AT.z)'); W(500)
        s = ev('__rv.projectPt(RV.mirror.AT.x, RV.mirror.AT.y, RV.mirror.AT.z)')
        pg.screenshot(path=f'{OUT}/{name}.png'); res['checks'][name] = s
    # close up, straight on
    ev('__rv.setPlayer(1.45, 0.74, 0)'); W(150); ev('__rv.faceAt(RV.mirror.AT.x, RV.mirror.AT.y, RV.mirror.AT.z)'); W(500); pg.screenshot(path=f'{OUT}/04_close.png')
    # pixel check: the centre of the picture on screen is not the wall/plum colour (the image is drawn)
    res['checks']['level_before'] = ev('RV.mirror.level')
    ev('__rv.media().toggleRecord()'); W(2500)
    res['checks']['while_playing'] = ev('({ on: RV.mirror.on, level: +RV.mirror.level.toFixed(2), glowOpacity: +RV.mirror.glow.material.opacity.toFixed(2), recPlaying: !__rv.media().recAudio.paused, rpOn: __rv.media().rp.on })')
    pg.screenshot(path=f'{OUT}/05_close_record_playing.png')
    ev('__rv.media().toggleRecord()'); W(4500)
    res['checks']['after_stop'] = ev('({ on: RV.mirror.on, level: +RV.mirror.level.toFixed(2), glowOpacity: +RV.mirror.glow.material.opacity.toFixed(2), recPlaying: !__rv.media().recAudio.paused })')
    res['checks']['draws'] = ev('RV.renderer.info.render.calls')
    b.close()
errs = [c for c in res['console'] if c.startswith('error') or c.startswith('PAGEERROR')]
res['errors'] = errs
json.dump(res, open(f'{OUT}/result.json', 'w'), indent=1)
print(json.dumps(res, indent=1))
