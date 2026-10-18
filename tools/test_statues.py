"""Desktop test for the Charlie + Miles statues on the bookshelf and the beanbag / bed poses.
Statues: built, on the middle shelf clear of Unity and the shelf sides, real mouse clicks make them talk (audio buffer through
Web Audio, caption bubble), no immediate repeat, clicks while talking are ignored, media untouched, VR-style selectStart works.
Poses: click beanbag -> seated view, click bed -> lying view looking up, WASD stands up at a free spot, click again stands up,
zombie / statues / floor clicks still work. Usage: python3 tools/test_statues.py URL OUTDIR"""
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
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(80)
    st = lambda: ev('RV.statues._debug.state()')
    res['checks']['geometry'] = ev('''(() => { const out = {}; const U = new THREE.Box3().setFromObject(RV.figurine.root);
      for (const id of ['charlie', 'miles']) { const s = RV.statues.S[id]; s.root.updateMatrixWorld(true); const bx = new THREE.Box3().setFromObject(s.mesh).union(new THREE.Box3().setFromObject(s.disc));
        out[id] = { min: bx.min.toArray().map(v => +v.toFixed(3)), max: bx.max.toArray().map(v => +v.toFixed(3)), overlapsUnity: bx.intersectsBox(U), insideShelfX: bx.min.x > 1.73 && bx.max.x < 2.53,
          insideShelfZ: bx.min.z > -2.19 && bx.max.z < -1.86, underTopBoard: bx.max.y < 1.5725, tris: s.mesh.geometry.index.count / 3 }; }
      out.unity = { min: U.min.toArray().map(v => +v.toFixed(3)), max: U.max.toArray().map(v => +v.toFixed(3)) }; return out; })()''')
    # look at the shelf from the middle of the room
    ev('__rv.setPlayer(1.4, -0.6, 0)'); W(150); ev('__rv.faceAt(2.13, 1.32, -2.04)'); W(500)
    pg.screenshot(path=f'{OUT}/01_shelf.png')
    ev('__rv.setPlayer(1.9, -1.3, 0)'); W(150); ev('__rv.faceAt(2.13, 1.32, -2.04)'); W(500)
    pg.screenshot(path=f'{OUT}/02_shelf_close.png')
    res['checks']['loaded_after_start'] = st()
    def clickStatue(id):
        pt = ev(f'(() => {{ const s = RV.statues.S.{id}; const c = s.root.localToWorld(new THREE.Vector3(0, 0.13, 0)); return __rv.projectPt(c.x, c.y, c.z); }})()')
        pg.mouse.click(pt['x'], pt['y']); return pt
    media0 = ev('RV.media.playing()')
    clickStatue('charlie'); W(300); s1 = st(); pg.screenshot(path=f'{OUT}/03_charlie_talks.png')
    clickStatue('miles'); W(100); s2 = st()        # ignored while Charlie talks
    res['checks']['click_charlie'] = s1; res['checks']['click_miles_while_busy'] = s2
    W(4500); clickStatue('miles'); W(300); s3 = st(); pg.screenshot(path=f'{OUT}/04_miles_talks.png')
    res['checks']['click_miles_after'] = s3
    # repeats: 14 lines in a row from each, never the same twice in a row
    seq = {'charlie': [], 'miles': []}
    for i in range(12):
        id = 'charlie' if i % 2 == 0 else 'miles'
        ev('RV.statues.stopAll()'); W(400)
        ev(f'RV.statues.say("{id}")'); seq[id].append(ev('RV.statues.lastLine.file'))
    rep = any(a == b2 for k in seq for a, b2 in zip(seq[k], seq[k][1:]))
    res['checks']['sequence'] = seq; res['checks']['immediate_repeat'] = rep
    ev('RV.statues.stopAll()'); W(400)
    # VR-style ray select
    r = ev('''(() => { const s = RV.statues.S.miles; const c = s.root.localToWorld(new THREE.Vector3(0, 0.12, 0)); const o = new THREE.Vector3(1.6, 1.4, -1.0); const d = c.clone().sub(o).normalize();
       const ok = RV.media.selectStart({}, o, d); return { ok, line: RV.statues.lastLine, hoverT: RV.media.hoverT(o, d) }; })()''')
    res['checks']['vr_select_miles'] = r; W(300); res['checks']['vr_select_state'] = st()
    res['checks']['media_untouched'] = {'before': media0, 'after': ev('RV.media.playing()')}
    ev('RV.statues.stopAll()'); W(500)
    # ---------------- beanbag
    ev('__rv.setPlayer(0.8, 0.4, 0)'); W(150); ev('__rv.faceAt(1.85, 0.3, 1.35)'); W(400)
    pt = ev('__rv.projectPt(1.75, 0.4, 1.3)'); pg.mouse.click(pt['x'], pt['y']); W(500)
    res['checks']['beanbag_sit'] = ev('__rv.pose()'); res['checks']['beanbag_cam'] = ev('(() => { const v = new THREE.Vector3(); RV.camera.getWorldPosition(v); return v.toArray().map(x => +x.toFixed(3)); })()')
    pg.screenshot(path=f'{OUT}/05_beanbag_view.png')
    pg.keyboard.down('KeyW'); W(250); pg.keyboard.up('KeyW'); W(300)
    res['checks']['beanbag_stand_wasd'] = ev('__rv.pose()'); res['checks']['pen_after_stand'] = ev('__rv.pen()')
    pg.keyboard.down('KeyS'); W(600); pg.keyboard.up('KeyS'); res['checks']['can_walk_after_stand'] = ev('__rv.pose()')
    # ---------------- bed (click a mattress spot away from the zombie)
    ev('__rv.setPlayer(0.2, 0.9, 0)'); W(150); ev('__rv.faceAt(-1.8, 0.55, 0.0)'); W(400)
    pt = ev('__rv.projectPt(-1.8, 0.62, 0.0)'); pg.mouse.click(pt['x'], pt['y']); W(500)
    res['checks']['bed_lie'] = ev('__rv.pose()'); res['checks']['bed_cam'] = ev('(() => { const v = new THREE.Vector3(), d = new THREE.Vector3(); RV.camera.getWorldPosition(v); RV.camera.getWorldDirection(d); return { pos: v.toArray().map(x => +x.toFixed(3)), dir: d.toArray().map(x => +x.toFixed(3)) }; })()')
    pg.screenshot(path=f'{OUT}/06_bed_ceiling.png')
    # click the bed again (now from lying): stand up
    ok = ev('RV.media.click(new THREE.Vector3(-1.2, 1.6, 1.5), new THREE.Vector3(-1.8, 0.6, -0.05).sub(new THREE.Vector3(-1.2, 1.6, 1.5)).normalize())')
    res['checks']['bed_click_again'] = {'ok': ok, 'pose': ev('__rv.pose()'), 'pen': ev('__rv.pen()')}
    # zombie still wins over the bed
    z = ev('''(() => { const Z = RV.zombie; const zp = new THREE.Vector3(); Z._debug.group.getWorldPosition(zp); zp.y += 0.05;
        const o = new THREE.Vector3(0.0, 1.6, 0.2); const d = zp.clone().sub(o).normalize(); return { zp: zp.toArray(), zt: Z.hoverT(o, d), bedTake: RV.media.hoverT(o, d) }; })()''')
    res['checks']['zombie_vs_bed'] = z
    # floor click still tosses (nothing taken by poses)
    res['checks']['floor_click_not_taken'] = ev('RV.media.click(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0.2, -1, 0.3).normalize())')
    res['checks']['debug'] = ev('__rv.debug()')
    b.close()
res['console'] = [c for c in res['console'] if 'GPU stall' not in c][:40]
print(json.dumps(res, indent=1))
