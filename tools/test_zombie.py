"""Desktop test for the zombie jump scare: the plush is never merged; clicking it (real mouse click) does nothing visible
for a few seconds, extra clicks while armed are swallowed (no stacking), then it jumps in front of wherever you look now,
facing you, big, red eyes, clear of your face, inside the room; the camera and the player are never moved; it goes back to
exactly where it sat; cooldown swallows triggers; up against a wall it lands smaller and still in the room; a stand-in VR
controller ray triggers it and doesn't toss a crumb; no console errors.
Usage: python3 tools/test_zombie.py URL OUTDIR"""
import sys, json, os, math
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}, 'fail': []}
def check(name, ok, info=None):
    print(('ok  ' if ok else 'FAIL') + ' ' + name, info if not ok else '', flush=True)
    res['checks'][name] = {'ok': bool(ok), 'info': info}
    if not ok: res['fail'].append(name)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500)
    pg.click('#bFlat'); pg.wait_for_timeout(1000)
    ev = lambda js: pg.evaluate(js)
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(60)
    def until(js, maxms=12000):
        t0 = ev('__rv.time()')
        while not ev(js):
            if ev('__rv.time()') - t0 > maxms / 1000: return False
            pg.wait_for_timeout(40)
        return True
    ZD = '(() => { const d = __rv.zombie(); return { state: d.state, t: d.t, wait: d.wait, triggers: d.triggers, scares: d.scares, scale: d.scale, target: d.target }; })()'
    POSE = '(() => { const g = RV.zombiePlush.group; return { p: g.position.toArray().map(v => +v.toFixed(4)), ry: +g.rotation.y.toFixed(4), s: +g.scale.x.toFixed(3), eye: RV.zombiePlush.eyes[0].material.color.getHexString() }; })()'
    CAM = '(() => { RV.rig.updateMatrixWorld(true); const v = new THREE.Vector3(); RV.camera.getWorldPosition(v); return { rig: RV.rig.position.toArray().map(v => +v.toFixed(4)), rigRy: +RV.rig.rotation.y.toFixed(4), cam: v.toArray().map(v => +v.toFixed(4)), camRot: RV.camera.rotation.toArray().slice(0, 3).map(v => +(+v).toFixed(4)) }; })()'
    inScene = ev('(() => { let n = 0, inS = false; RV.zombiePlush.group.traverse(o => { if (o.isMesh) n++; }); let q = RV.zombiePlush.group; while (q.parent) q = q.parent; return { meshes: n, inScene: q === RV.scene, merged: RV.mergeStats }; })()')
    check('plush_not_merged', inScene['meshes'] == 8 and inScene['inScene'], inScene)
    home = ev(POSE)
    ev('(() => { window.__toss = 0; const R = RV.roomba, o = R.toss; R.toss = (...a) => { window.__toss++; return o.apply(R, a); }; })()')

    # 1. stand at the foot of the bed, look at the plush, real click on it
    ev('__rv.setPlayer(0.4, 1.3, 0)'); W(150)
    ev('(() => { const h = RV.zombie._debug.home.pos; __rv.faceAt(h.x, h.y + 0.14, h.z); })()'); W(400)
    pt = ev('(() => { const h = RV.zombie._debug.home.pos; return __rv.projectPt(h.x, h.y + 0.14, h.z); })()')
    pg.screenshot(path=f'{OUT}/01_before_click.png')
    crumbs0 = ev('window.__toss')
    pg.mouse.click(pt['x'], pt['y']); W(200)
    d = ev(ZD)
    check('click_arms_it', d['state'] == 'armed' and d['triggers'] == 1, {'state': d['state'], 'wait': d['wait'], 'pt': pt})
    check('wait_is_a_real_beat', 2.5 <= d['wait'] <= 4.3, d['wait'])
    W(1000)
    p1 = ev(POSE)
    check('looks_like_nothing_happened_1s_later', p1 == home and ev('__rv.zombie().state') == 'armed', {'home': home, 'now': p1})
    pg.screenshot(path=f'{OUT}/02_one_second_after_click_nothing.png')
    # extra clicks while armed are swallowed
    w0 = ev('__rv.zombie().wait'); t0 = ev('__rv.zombie().t')
    pg.mouse.click(pt['x'], pt['y']); pg.mouse.click(pt['x'], pt['y']); W(100)
    d = ev(ZD)
    check('no_stacking_while_armed', d['state'] == 'armed' and d['wait'] == w0 and d['t'] >= t0 and d['triggers'] == 3 and d['scares'] == 0, d['triggers'])
    crumbs1 = ev('window.__toss')
    check('clicks_on_zombie_toss_no_crumb', crumbs0 == crumbs1, [crumbs0, crumbs1])
    # turn away to the TV wall before it fires: it must land in front of the NEW gaze
    ev('__rv.setPlayer(0.6, 0.9, 0)'); ev('__rv.pitch(-0.05)'); W(80)
    cam0 = ev(CAM)
    ok = until('__rv.zombie().state === "hold"', 6000)
    W(250)
    d = ev(ZD); cam1 = ev(CAM); pose = ev(POSE)
    tgt = d['target']
    head = cam1['cam']
    dist = math.hypot(tgt[0] - head[0], tgt[2] - head[2])
    proj = ev(f'__rv.projectPt({tgt[0]}, {tgt[1]} + 0.21 * {d["scale"]}, {tgt[2]})')
    facing = ev('(() => { const g = RV.zombiePlush.group, v = new THREE.Vector3(); RV.camera.getWorldPosition(v); const f = new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion); const to = v.clone().sub(g.position); to.y = 0; to.normalize(); f.y = 0; f.normalize(); return +f.dot(to).toFixed(3); })()')
    pg.screenshot(path=f'{OUT}/03_jump_scare.png')
    check('scare_fired', ok and d['scares'] == 1, d)
    check('lands_in_front_of_new_gaze', proj['inFront'] and 80 < proj['x'] < 880 and 40 < proj['y'] < 500 and tgt[2] < head[2], {'proj': proj, 'target': tgt, 'head': head})
    check('clear_of_face', 0.5 - 1e-3 <= dist <= 0.85, round(dist, 3))
    check('big_and_scary', pose['s'] > 2.0 and pose['eye'] == 'ff2a2a', pose)
    check('faces_you', facing > 0.9, facing)
    check('eyes_at_eye_level', abs((tgt[1] + 0.22 * d['scale']) - head[1]) < 0.12, [tgt[1] + 0.22 * d['scale'], head[1]])
    check('inside_room', abs(tgt[0]) < 2.6 - 0.15 and abs(tgt[2]) < 2.2 - 0.15, tgt)
    check('camera_never_moved', cam0 == cam1, {'before': cam0, 'during': cam1})
    # triggers during the scare are ignored
    ev('RV.zombie.trigger()'); check('no_stacking_during_scare', ev('__rv.zombie().scares') == 1 and ev('__rv.zombie().state') in ('hold', 'back'))
    # back on the bed, exactly
    ok = until('__rv.zombie().state === "cool"', 5000)
    back = ev(POSE)
    check('back_exactly_where_it_sat', ok and back == home, {'home': home, 'back': back})
    ev('RV.zombie.trigger()'); check('cooldown_swallows_trigger', ev('__rv.zombie().state') == 'cool')
    ok = until('__rv.zombie().state === "idle"', 5000); check('cooldown_ends', ok)
    ev('(() => { const h = RV.zombie._debug.home.pos; __rv.faceAt(h.x, h.y + 0.14, h.z); })()'); W(300)
    pg.screenshot(path=f'{OUT}/04_back_on_bed.png')

    # 2. nose to the wall: lands smaller, still inside the room, still clear
    ev('__rv.setPlayer(2.3, 1.0, -Math.PI / 2)'); ev('__rv.pitch(0)'); W(150)
    ev('RV.zombie.trigger({ delay: 0.2 })'); ok = until('__rv.zombie().state === "hold"', 4000); W(200)
    d = ev(ZD); cam = ev(CAM); tgt = d['target']; dist = math.hypot(tgt[0] - cam['cam'][0], tgt[2] - cam['cam'][2])
    pg.screenshot(path=f'{OUT}/05_against_wall.png')
    check('wall_case', ok and tgt[0] <= 2.6 - 0.15 and abs(tgt[2]) <= 2.2 - 0.15 and dist >= 0.49, {'target': tgt, 'scale': d['scale'], 'dist': round(dist, 3)})
    until('__rv.zombie().state === "idle"', 8000)

    # 3. stand-in VR controller: selectstart on a controller pointed at the plush triggers it and tosses no crumb
    ev('__rv.setPlayer(0.4, 1.3, 0)'); W(150)
    r = ev('''(() => { const c = RV.renderer.xr.getController(0), h = RV.zombie._debug.home.pos; RV.rig.updateMatrixWorld(true);
        const head = new THREE.Vector3(); RV.camera.getWorldPosition(head); const o = head.clone().add(new THREE.Vector3(0.2, -0.4, -0.2));
        const local = RV.rig.worldToLocal(o.clone()); c.position.copy(local); c.updateMatrixWorld(true);
        const tgt = new THREE.Vector3(h.x, h.y + 0.14, h.z); const qw = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), tgt.clone().sub(o).normalize()), qr = RV.rig.getWorldQuaternion(new THREE.Quaternion()).invert(); c.quaternion.copy(qr.multiply(qw)); c.updateMatrix(); c.updateMatrixWorld(true);   // XR controller groups have matrixAutoUpdate off
        const before = window.__toss; c.dispatchEvent({ type: 'selectstart' }); c.dispatchEvent({ type: 'selectend' });
        return { state: RV.zombie.state(), crumbsBefore: before, crumbsAfter: window.__toss }; })()''')
    check('vr_trigger_arms_it', r['state'] == 'armed' and r['crumbsBefore'] == r['crumbsAfter'], r)
    ok = until('__rv.zombie().state === "idle"', 12000); check('vr_round_completes', ok and ev(POSE) == home)
    # spam: 20 triggers -> one scare
    s0 = ev('__rv.zombie().scares')
    ev('for (let i = 0; i < 20; i++) RV.zombie.trigger({ delay: 0.1 })'); until('__rv.zombie().state === "idle"', 8000)
    check('spam_is_one_scare', ev('__rv.zombie().scares') == s0 + 1)
    res['checks']['draws'] = ev('RV.renderer.info.render.calls')
    b.close()
errs = [c for c in res['console'] if c.startswith('error') or c.startswith('PAGEERROR')]
res['errors'] = errs
if errs: res['fail'].append('console_errors')
json.dump(res, open(f'{OUT}/result.json', 'w'), indent=1)
print(json.dumps(res, indent=1))
print('PASS' if not res['fail'] else 'FAIL: ' + ', '.join(res['fail']))
