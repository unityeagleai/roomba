"""Desktop test for the Unity Eagle origin photo frame on the dresser: sits on the dresser top clear of the CRT and the bookshelf,
shows the still, never autoplays (metadata preload only), a real mouse click plays it in the frame with sound through a panner,
a click pauses (frame held), a click resumes from there, the end returns to the still, a VR-style selectStart ray toggles it,
the keycard poster / record pause it and it stops them, floor clicks are untouched. Usage: python3 tools/test_originframe.py URL OUTDIR"""
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('response', lambda r: res['console'].append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(3000)
    pg.click('#bFlat'); pg.wait_for_timeout(1500)
    ev = lambda js: pg.evaluate(js)
    st = lambda: ev('RV.originFrame._debug.state()')
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(80)
    res['checks']['no_autoplay_after_load'] = st()
    res['checks']['geometry'] = ev('''(() => { const F = RV.originFrame; F.root.updateMatrixWorld(true); const f = a => a.toArray().map(x => +x.toFixed(3));
        const gp = F.glow.parent; gp.remove(F.glow); const box = new THREE.Box3().setFromObject(F.root); gp.add(F.glow); const tv = RV.tv; const ib = new THREE.Box3().setFromObject(F.img);
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(F.img.getWorldQuaternion(new THREE.Quaternion()));
        const t = F.img.material.map;
        return { ready: F.ready, still: t ? t.image.width + 'x' + t.image.height : null, box: { min: f(box.min), max: f(box.max) }, screen: { min: f(ib.min), max: f(ib.max) },
          screenFacing: f(n), bottomOnDresser: +(box.min.y - 0.72).toFixed(4), onDresserX: box.min.x >= 0 && box.max.x <= 1.5, onDresserZ: box.min.z >= -2.2 && box.max.z <= -1.72,
          gapToCRT: +(box.min.x - 1.05).toFixed(3), gapToBookshelf: +(1.7 - box.max.x).toFixed(3), gapToDresserFront: +(-1.72 - box.max.z).toFixed(3) }; })()''')
    shots = {'01_mid': (0.6, 0.3), '02_cushion': (0.85, -0.75), '03_door': (-1.2, 1.6), '04_close': (1.15, -1.25), '05_bed': (-1.2, 0.2), '06_side': (2.0, -1.2)}
    for name, (x, z) in shots.items():
        ev(f'__rv.setPlayer({x}, {z}, 0)'); W(150); ev('__rv.faceAt(RV.originFrame.AT.x, 0.84, RV.originFrame.AT.z)'); W(400)
        vis = ev('''(() => { const o = new THREE.Vector3(); RV.camera.getWorldPosition(o); const c = RV.originFrame.img.localToWorld(new THREE.Vector3(0.03, 0.02, 0)); const d = c.clone().sub(o).normalize();   // just off the centre (the exact centre sits on the triangle seam)
          const rc = new THREE.Raycaster(o, d); rc.camera = RV.camera; const hits = rc.intersectObjects(RV.scene.children, true).filter(h => h.object.visible && h.object.material && !h.object.material.transparent && h.object.type === 'Mesh');
          return hits.length ? (hits[0].object.name || hits[0].object.type) : 'none'; })()''')
        pg.screenshot(path=f'{OUT}/{name}.png'); res['checks'][name] = vis
    real = lambda ms: pg.wait_for_timeout(ms)
    ev('__rv.setPlayer(1.15, -1.25, 0)'); W(150); ev('__rv.faceAt(RV.originFrame.AT.x, 0.84, RV.originFrame.AT.z)'); W(400)
    res['checks']['still_at_rest'] = st()
    pt = ev('(() => { const c = new THREE.Vector3(); RV.originFrame.img.getWorldPosition(c); return __rv.projectPt(c.x, c.y, c.z); })()')
    pg.mouse.click(pt['x'], pt['y']); real(2500); res['checks']['after_click_2_5s'] = st(); pg.screenshot(path=f'{OUT}/07_playing.png')
    pg.mouse.click(pt['x'], pt['y']); real(800); s1 = st(); real(1200); s2 = st(); res['checks']['click_pauses'] = {'a': s1, 'b': s2, 'held': abs(s1['t'] - s2['t']) < 0.05}
    pg.mouse.click(pt['x'], pt['y']); real(1500); res['checks']['click_resumes'] = st()
    # VR-style selectStart ray pauses it, again resumes
    xr = '''(() => { const o = new THREE.Vector3(); RV.camera.getWorldPosition(o); const c = new THREE.Vector3(); RV.originFrame.img.getWorldPosition(c); const d = c.sub(o).normalize();
        return { handled: RV.media.selectStart({}, o, d), hoverT: +(RV.media.hoverT(o, d) || 0).toFixed(2) }; })()'''
    res['checks']['xr_select_1'] = ev(xr); real(500); res['checks']['xr_state_1'] = st()
    res['checks']['xr_select_2'] = ev(xr); real(1200); res['checks']['xr_state_2'] = st()
    # the record starting pauses the frame; the frame starting lifts the needle
    ev('__rv.media().toggleRecord()'); W(300); real(400); res['checks']['record_started'] = {**st(), 'rpOn': ev('__rv.media().rp.on')}
    pg.mouse.click(pt['x'], pt['y']); real(1200); res['checks']['frame_after_record'] = {**st(), 'rpOn': ev('__rv.media().rp.on')}
    # the keycard poster starting pauses the frame; the frame starting stops the poster
    ev('RV.vposter._debug.start()'); W(300); real(1200); res['checks']['poster_started'] = {**st(), 'poster': ev('RV.vposter._debug.state().live')}
    pg.mouse.click(pt['x'], pt['y']); real(1200); res['checks']['frame_after_poster'] = {**st(), 'poster': ev('RV.vposter._debug.state().live')}
    # jump to near the end: it ends and goes back to the still
    ev('RV.originFrame.video.currentTime = RV.originFrame.video.duration - 1.2'); real(3500); res['checks']['after_end'] = st()
    pg.screenshot(path=f'{OUT}/08_after_end.png')
    res['checks']['dom'] = ev('({ controls: RV.originFrame.video.controls, hidden: getComputedStyle(RV.originFrame.video).display })')
    ev('__rv.setPlayer(0.6, 0.6, 0)'); W(150); ev('__rv.faceAt(0.6, 0, -0.6)'); W(300)
    fp = ev('__rv.projectPt(0.6, 0, -0.6)'); before = st()['plays']; pg.mouse.click(fp['x'], fp['y']); W(400); res['checks']['floor_click_plays_unchanged'] = st()['plays'] == before
    res['checks']['draws'] = ev('RV.renderer.info.render.calls')
    b.close()
errs = [c for c in res['console'] if c.startswith('error') or c.startswith('PAGEERROR')]
res['errors'] = errs
json.dump(res, open(f'{OUT}/result.json', 'w'), indent=1)
print(json.dumps(res, indent=1))
