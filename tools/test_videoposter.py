"""Desktop test for the PARALLEL UNIVERSE ACCESS video poster on the right wall: Unity's still loads at its shape, the poster
sits on the wall clear of the mirror, the corner, the rail and the skirting; it is visible from around the room; a real mouse
click on it plays the video in the frame (no button), with sound routed through a panner at the poster; it returns to the still
when the video ends; a click while playing stops it; a VR-style selectStart ray toggles it too; an episode / the record stop it,
and it pauses them. Usage: python3 tools/test_videoposter.py URL OUTDIR"""
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(3000)
    pg.click('#bFlat'); pg.wait_for_timeout(1200)
    ev = lambda js: pg.evaluate(js)
    st = lambda: ev('RV.vposter._debug.state()')
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(80)
    res['checks']['geometry'] = ev('''(() => { const v = RV.vposter, r = RV.room, m = RV.mirror; v.root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(v.root); const mb = new THREE.Box3().setFromObject(m.body); const mg = new THREE.Box3().setFromObject(m.glow);
        const ib = new THREE.Box3().setFromObject(v.img);
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(v.root.getWorldQuaternion(new THREE.Quaternion()));
        const t = v.img.material.map; const f = a => a.toArray().map(x => +x.toFixed(3));
        return { ready: v.ready, stillTex: t ? t.image.width + 'x' + t.image.height : null, imgAspect: +(v.IMG_W / v.IMG_H).toFixed(4), videoAspect: +(784 / 1168).toFixed(4), stillAspect: +(1033 / 1536).toFixed(4),
          box: { min: f(box.min), max: f(box.max) }, picture: { min: f(ib.min), max: f(ib.max) }, facesRoom: f(n), insideRoom: box.max.x <= r.RX + 1e-6,
          gapToMirrorFrame: +(box.min.z - mb.max.z).toFixed(3), gapToMirrorGlow: +(box.min.z - mg.max.z).toFixed(3), gapToFrontCorner: +(r.RZ - box.max.z).toFixed(3),
          belowPictureRail: box.max.y < r.RH - 0.14, aboveSkirting: box.min.y > 0.12, mirrorStillThere: !!m.ready };
      })()''')
    for name, (x, z) in {'01_mid': (0.6, 0.6), '02_from_tv': (0.6, -1.3), '03_door': (-1.2, 1.6), '04_by_bed': (-0.3, 0.2)}.items():
        ev(f'__rv.setPlayer({x}, {z}, 0)'); W(150); ev('__rv.faceAt(RV.vposter.AT.x, RV.vposter.AT.y, RV.vposter.AT.z)'); W(400)
        vis = ev('''(() => { const o = new THREE.Vector3(); RV.camera.getWorldPosition(o); const a = RV.vposter.AT; const d = new THREE.Vector3(a.x - 0.02, a.y, a.z).sub(o).normalize();
          const rc = new THREE.Raycaster(o, d); rc.camera = RV.camera; const hits = rc.intersectObjects(RV.scene.children, true).filter(h => h.object.visible && h.object.material && !h.object.material.transparent);
          return hits.length ? hits[0].object.name || hits[0].object.type : 'none'; })()''')
        pg.screenshot(path=f'{OUT}/{name}.png'); res['checks'][name] = {'firstOpaqueHitTowardPoster': vis}
    # close up, straight on, at rest: the still
    ev('__rv.setPlayer(1.6, 1.78, 0)'); W(150); ev('__rv.faceAt(RV.vposter.AT.x, RV.vposter.AT.y, RV.vposter.AT.z)'); W(500)
    pg.screenshot(path=f'{OUT}/05_close_still.png'); res['checks']['rest'] = st()
    # pixel check: the picture on screen matches Unity's still (correlation of the projected picture area with the file)
    corners = ev('[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v]) => __rv.projectPt(RV.vposter.AT.x - 0.022, RV.vposter.AT.y + v * RV.vposter.IMG_H / 2 * 0.9, RV.vposter.AT.z + u * RV.vposter.IMG_W / 2 * 0.9))')
    res['checks']['still_corners_px'] = corners
    real = lambda ms: pg.wait_for_timeout(ms)
    # a real mouse click on the middle of the picture (wall-clock waits: the video runs on real time)
    pt = ev('__rv.projectPt(RV.vposter.AT.x - 0.04, RV.vposter.AT.y, RV.vposter.AT.z)')
    pg.mouse.click(pt['x'], pt['y']); real(1500)
    res['checks']['after_click_1_5s'] = st(); pg.screenshot(path=f'{OUT}/06_close_playing.png')
    real(1500); res['checks']['after_click_3s'] = st()
    # click while playing: stops, back to the still
    pg.mouse.click(pt['x'], pt['y']); real(500); res['checks']['click_while_playing'] = st()
    # click again: replays from the start, then let it run out
    pg.mouse.click(pt['x'], pt['y']); real(1200); res['checks']['replay'] = st()
    real(10500); res['checks']['after_end'] = st(); pg.screenshot(path=f'{OUT}/07_after_end_still.png')
    res['checks']['dom'] = ev('({ controls: RV.vposter.video.controls, videoHidden: getComputedStyle(RV.vposter.video).display, buttons: [...document.querySelectorAll("button")].map(b => b.id) })')
    # VR-style: a controller ray from the head toward the poster through RV.media.selectStart
    res['checks']['xr_select'] = ev('''(() => { const o = new THREE.Vector3(); RV.camera.getWorldPosition(o); const a = RV.vposter.AT; const d = new THREE.Vector3(a.x, a.y - 0.1, a.z + 0.05).sub(o).normalize();
        const handled = RV.media.selectStart({}, o, d); const h = RV.media.hoverT(o, d); return { handled, hoverT: h && +h.toFixed(2) }; })()''')
    pg.wait_for_timeout(1500); res['checks']['xr_select_state'] = st()
    # the record starting stops the badge
    ev('__rv.media().toggleRecord()'); W(300); pg.wait_for_timeout(500); res['checks']['record_started'] = {**st(), 'rpOn': ev('__rv.media().rp.on')}
    # the badge starting lifts the needle
    pg.mouse.click(pt['x'], pt['y']); pg.wait_for_timeout(1200); res['checks']['badge_after_record'] = {**st(), 'rpOn': ev('__rv.media().rp.on')}
    pg.mouse.click(pt['x'], pt['y']); W(300)
    # a click on the floor still tosses a crumb (the hook doesn't swallow other clicks)
    ev('__rv.setPlayer(0.6, 0.6, 0)'); W(150); ev('__rv.faceAt(0.6, 0, -0.6)'); W(300)
    fp = ev('__rv.projectPt(0.6, 0, -0.6)'); res['checks']['floor_click_not_poster'] = st()['plays']
    pg.mouse.click(fp['x'], fp['y']); W(400); res['checks']['floor_click_plays_after'] = st()['plays']
    res['checks']['draws'] = ev('RV.renderer.info.render.calls')
    b.close()
errs = [c for c in res['console'] if c.startswith('error') or c.startswith('PAGEERROR')]
res['errors'] = errs
json.dump(res, open(f'{OUT}/result.json', 'w'), indent=1)
print(json.dumps(res, indent=1))
