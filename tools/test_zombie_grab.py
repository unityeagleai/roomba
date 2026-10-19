"""Desktop test for moving the zombie plush: it starts on the floor by the door (off the bed), the landing ray finds the
floor / bed / dresser and never the inside of furniture or outside the walls; a stand-in VR controller grabs it with the
grip (pointing or hand next to it), carries it, and dropping lands it upright on the dresser / floor under it; holding
the trigger picks it up too, a tap is still the scare and the scare goes back to the new spot; the spot is remembered
over a reload; resetSpot puts it back; a mouse drag moves it on screen and a plain click still arms it; the Roomba bumps
into it on the floor only; no console errors.
Usage: python3 tools/test_zombie_grab.py URL OUTDIR"""
import sys, json, os, math
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}, 'fail': []}
def check(name, ok, info=None):
    print(('ok  ' if ok else 'FAIL') + ' ' + name, info if not ok else '', flush=True)
    res['checks'][name] = {'ok': bool(ok), 'info': info}
    if not ok: res['fail'].append(name)
CTRL = '''(([x, y, z, tx, ty, tz]) => { const c = RV.renderer.xr.getController(0); RV.rig.updateMatrixWorld(true);
    const o = new THREE.Vector3(x, y, z); c.position.copy(RV.rig.worldToLocal(o.clone()));
    const tgt = new THREE.Vector3(tx, ty, tz); const qw = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), tgt.clone().sub(o).normalize()), qr = RV.rig.getWorldQuaternion(new THREE.Quaternion()).invert();
    c.quaternion.copy(qr.multiply(qw)); c.updateMatrix(); c.updateMatrixWorld(true); return true; })'''
POSE = '(() => { const g = RV.zombiePlush.group, d = RV.zombie._debug; return { p: g.position.toArray().map(v => +v.toFixed(4)), rx: +g.rotation.x.toFixed(4), ry: +g.rotation.y.toFixed(4), rz: +g.rotation.z.toFixed(4), s: +g.scale.x.toFixed(3), sy: +g.scale.y.toFixed(3), state: RV.zombie.state(), holder: d.holder, saved: localStorage.getItem(d.KEY), obst: [d.obst.x, d.obst.z] }; })()'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 960, 'height': 540})
    pg = ctx.new_page()
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.on('response', lambda r: res['console'].append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)
    def load():
        pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500); pg.click('#bFlat'); pg.wait_for_timeout(1000)
    load()
    ev = lambda js, a=None: pg.evaluate(js, a)
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(50)
    def until(js, maxms=8000):
        t0 = ev('__rv.time()')
        while not ev(js):
            if ev('__rv.time()') - t0 > maxms / 1000: return False
            pg.wait_for_timeout(40)
        return True
    ev('(() => { window.__toss = 0; const R = RV.roomba, o = R.toss; R.toss = (...a) => { window.__toss++; return o.apply(R, a); }; })()')
    OB = ev('Object.fromEntries(RV.obstacles.filter(o => o.name).map(o => [o.name, o]))')
    dres = OB.get('dresser'); bed = OB.get('bed')
    W(2500)

    # 1. default spot: on the floor by the door, not on the bed
    a = ev(POSE); D = ev('RV.zombie._debug.DEFAULT')
    onBed = bed and bed['x0'] - 0.05 <= a['p'][0] <= bed['x1'] + 0.05 and bed['z0'] - 0.05 <= a['p'][2] <= bed['z1'] + 0.05
    check('default_on_floor_by_door', abs(a['p'][0] - D['x']) < 1e-3 and abs(a['p'][2] - D['z']) < 1e-3 and abs(a['p'][1]) < 0.01 and not onBed and a['saved'] is None and a['state'] == 'idle', a)
    check('roomba_bumps_it_on_floor', abs(a['obst'][0] - D['x']) < 1e-3 and abs(a['obst'][1] - D['z']) < 1e-3, a['obst'])
    # lying in bed: the plush isn't in the view any more
    ev('__rv.sit("bed")'); W(1500)
    pg.screenshot(path=f'{OUT}/01_lying_view.png')
    pr = ev('(() => { const h = RV.zombie._debug.home.pos; return __rv.projectPt(h.x, h.y + 0.14, h.z); })()')
    po = ev('__rv.pose()')
    vis = pr['inFront'] and 0 <= pr['x'] <= 960 and 0 <= pr['y'] <= 540
    check('not_in_lying_view', po['pose'] == 'bed' and not vis, {'proj': pr, 'pose': po['pose']})
    ev('__rv.stand("test")'); W(400)

    # 2. landing ray
    L = lambda x, y, z: ev('([x, y, z]) => RV.zombie.landAt(x, y, z)', [x, y, z])
    fl = L(0.3, 1.2, 0.3); dt = L((dres['x0'] + dres['x1']) / 2 + 0.3, 1.5, (dres['z0'] + dres['z1']) / 2) if dres else None
    inside = L((dres['x0'] + dres['x1']) / 2 + 0.3, 0.35, (dres['z0'] + dres['z1']) / 2) if dres else None
    bd = L((bed['x0'] + bed['x1']) / 2, 1.4, (bed['z0'] + bed['z1']) / 2)
    out = L(3.5, 1.0, 0.0)
    check('lands_on_floor', abs(fl['y']) < 0.02, fl)
    check('lands_on_dresser_top', dt and dt['y'] > 0.4, dt)
    check('inside_dresser_goes_on_top', inside and dt and abs(inside['y'] - dt['y']) < 0.02, {'inside': inside, 'top': dt})
    check('lands_on_bed', bd['y'] > 0.4, bd)
    check('never_outside_walls', out['x'] <= ev('RV.room.RX') - 0.09 and abs(out['y']) < 0.02, out)
    res['land'] = {'floor': fl, 'dresser': dt, 'inside': inside, 'bed': bd, 'out': out}

    # 3. VR grip: stand near it, point at it, squeeze -> it's in your hand and follows the controller
    h = ev('RV.zombie._debug.home.pos')
    ev('__rv.setPlayer(-1.3, 1.2, 0)'); W(200)
    ev(CTRL, [-1.5, 1.1, 1.4, h['x'], h['y'] + 0.14, h['z']])
    c0 = ev('window.__toss')
    ev('RV.renderer.xr.getController(0).dispatchEvent({ type: "squeezestart" })'); W(400)
    a = ev(POSE)
    cp = ev('(() => { const v = new THREE.Vector3(); RV.renderer.xr.getController(0).getWorldPosition(v); return v.toArray(); })()')
    check('grip_grabs_it', a['state'] == 'held' and a['holder'] == 'controller', a)
    check('in_your_hand', math.dist(a['p'], cp) < 0.25, {'zombie': a['p'], 'ctrl': cp})
    # carry it over the dresser
    tx, tz = (dres['x0'] + dres['x1']) / 2 + 0.3, (dres['z0'] + dres['z1']) / 2 + 0.05
    ev('__rv.setPlayer(%f, %f, 0)' % (tx, tz + 0.9)); W(200)
    ev(CTRL, [tx, 1.25, tz, tx, 1.25, tz - 1])
    W(400)
    a = ev(POSE); mk = ev('(() => { const m = RV.zombie._debug.marker; return { v: m.visible, p: m.position.toArray().map(v => +v.toFixed(3)) }; })()')
    check('follows_controller', abs(a['p'][0] - tx) < 0.15 and abs(a['p'][2] - tz) < 0.15, a)
    check('landing_marker_on_dresser', mk['v'] and abs(mk['p'][1] - dt['y']) < 0.03, mk)
    pg.screenshot(path=f'{OUT}/02_carrying.png')
    ev('RV.renderer.xr.getController(0).dispatchEvent({ type: "squeezeend" })')
    ok = until('RV.zombie.state() === "idle"', 4000); W(200)
    a = ev(POSE); sv = json.loads(a['saved'] or 'null')
    check('drops_onto_dresser', ok and abs(a['p'][1] - dt['y']) < 0.02 and abs(a['p'][0] - tx) < 0.15 and abs(a['p'][2] - tz) < 0.15, a)
    check('lands_upright_normal_size', abs(a['rx']) < 1e-3 and abs(a['rz']) < 1e-3 and a['s'] == 1 and a['sy'] == 1, a)
    check('spot_saved', sv and abs(sv['x'] - a['p'][0]) < 1e-3 and abs(sv['y'] - a['p'][1]) < 1e-3 and abs(sv['z'] - a['p'][2]) < 1e-3, sv)
    check('roomba_ignores_it_off_floor', a['obst'] == [99, 99], a['obst'])
    check('grip_tossed_no_crumb', ev('window.__toss') == c0)
    pg.screenshot(path=f'{OUT}/03_on_dresser.png')

    # 4. hold the trigger on it -> picks up; carry to open floor high up, let go -> falls to the floor
    h = ev('RV.zombie._debug.home.pos')
    ev(CTRL, [tx + 0.1, 1.3, tz + 0.6, h['x'], h['y'] + 0.14, h['z']])
    ev('RV.renderer.xr.getController(0).dispatchEvent({ type: "selectstart" })'); W(150)
    early = ev('RV.zombie.state()')
    W(450); a = ev(POSE)
    check('trigger_hold_picks_up', early != 'held' and early != 'armed' and a['state'] == 'held', {'early': early, 'later': a})
    ev('__rv.setPlayer(0.5, 1.4, 0)'); W(150)
    ev(CTRL, [0.5, 1.6, 0.6, 0.5, 1.6, -0.4]); W(300)
    ev('RV.renderer.xr.getController(0).dispatchEvent({ type: "selectend" })')
    ok = until('RV.zombie.state() === "idle"', 4000); W(200)
    a = ev(POSE)
    check('drops_to_floor', ok and abs(a['p'][1]) < 0.02 and abs(a['p'][0] - 0.5) < 0.15 and abs(a['p'][2] - 0.6) < 0.15, a)
    check('roomba_bumps_new_floor_spot', abs(a['obst'][0] - a['p'][0]) < 1e-3, a['obst'])
    check('trigger_tossed_no_crumb', ev('window.__toss') == c0)
    spot = a

    # 5. a quick tap is still the scare, and it goes back to the new spot
    h = ev('RV.zombie._debug.home.pos')
    ev('__rv.setPlayer(0.6, 1.8, 0)'); W(150)
    ev(CTRL, [0.7, 1.2, 1.6, h['x'], h['y'] + 0.14, h['z']])
    ev('(() => { const c = RV.renderer.xr.getController(0); c.dispatchEvent({ type: "selectstart" }); c.dispatchEvent({ type: "selectend" }); })()')
    check('tap_still_arms_scare', ev('RV.zombie.state()') == 'armed')
    sc0 = ev('__rv.zombie().scares')
    ok = until('__rv.zombie().scares > %d' % sc0, 8000)
    ok2 = until('RV.zombie.state() === "idle"', 10000)
    a = ev(POSE)
    check('scare_returns_to_new_spot', ok and ok2 and a['p'] == spot['p'] and a['ry'] == spot['ry'], {'now': a['p'], 'spot': spot['p']})

    # 6. grab during the 'nothing happens' beat calls the scare off
    ev('RV.zombie.trigger({ delay: 2 })'); W(200)
    ev(CTRL, [0.7, 1.2, 1.6, h['x'], h['y'] + 0.14, h['z']])
    ev('RV.renderer.xr.getController(0).dispatchEvent({ type: "squeezestart" })'); W(2500)
    sc1 = ev('__rv.zombie().scares')
    check('grab_while_armed_cancels_scare', ev('RV.zombie.state()') == 'held' and sc1 == sc0 + 1, {'state': ev('RV.zombie.state()'), 'scares': sc1})
    # hand next to it (ray pointing away) also grabs: drop it first, then reach
    ev('RV.renderer.xr.getController(0).dispatchEvent({ type: "squeezeend" })'); until('RV.zombie.state() === "idle"', 4000)
    h = ev('RV.zombie._debug.home.pos')
    ev(CTRL, [h['x'] + 0.05, h['y'] + 0.2, h['z'], h['x'] + 2, h['y'] + 0.2, h['z']])
    ev('RV.renderer.xr.getController(0).dispatchEvent({ type: "squeezestart" })'); W(200)
    check('hand_next_to_it_grabs', ev('RV.zombie.state()') == 'held')
    # inside the wall: carried 'through' the wall it still lands inside the room
    ev(CTRL, [3.3, 1.0, 0.3, 4, 1.0, 0.3]); W(300)
    ev('RV.renderer.xr.getController(0).dispatchEvent({ type: "squeezeend" })'); until('RV.zombie.state() === "idle"', 4000)
    a = ev(POSE); RX = ev('RV.room.RX')
    check('wall_drop_stays_in_room', a['p'][0] <= RX - 0.09 and a['p'][1] >= -0.001, a)

    # 7. put it on the bed, reload: it's still there
    ev(CTRL, [a['p'][0] - 0.1, a['p'][1] + 0.2, a['p'][2], a['p'][0], a['p'][1] + 0.2, a['p'][2]])
    ev('RV.renderer.xr.getController(0).dispatchEvent({ type: "squeezestart" })'); W(250)
    bx, bz = bed['x0'] + 0.5, (bed['z0'] + bed['z1']) / 2
    ev(CTRL, [bx, 1.3, bz, bx, 1.3, bz - 1]); W(300)
    ev('RV.renderer.xr.getController(0).dispatchEvent({ type: "squeezeend" })'); until('RV.zombie.state() === "idle"', 4000); W(200)
    before = ev(POSE)
    check('drops_onto_bed', abs(before['p'][1] - L(bx, 1.3, bz)['y']) < 0.02 and before['p'][1] > 0.4, before)
    load(); W(3000)
    after = ev(POSE)
    check('remembered_after_reload', after['p'] == before['p'] and abs(after['ry'] - before['ry']) < 1e-3 and after['state'] == 'idle', {'before': before['p'], 'after': after['p']})
    ev('(() => { window.__toss = 0; const R = RV.roomba, o = R.toss; R.toss = (...a) => { window.__toss++; return o.apply(R, a); }; })()')

    # 8. mouse: drag it from the bed to the floor; the view doesn't turn while dragging; a plain click still arms it
    h = ev('RV.zombie._debug.home.pos')
    ev('__rv.setPlayer(0.3, 1.4, 0)'); W(150)
    ev('(() => { const h = RV.zombie._debug.home.pos; __rv.faceAt(h.x, h.y + 0.14, h.z); })()'); W(300)
    yaw0 = ev('__rv.P().yaw')
    s = ev('(() => { const h = RV.zombie._debug.home.pos; return __rv.projectPt(h.x, h.y + 0.14, h.z); })()')
    e = ev('__rv.projectPt(-0.3, 0, 0.95)')
    pg.mouse.move(s['x'], s['y']); pg.mouse.down()
    for i in range(1, 13):
        pg.mouse.move(s['x'] + (e['x'] - s['x']) * i / 12, s['y'] + (e['y'] - s['y']) * i / 12); pg.wait_for_timeout(40)
    W(300); mid = ev(POSE); yaw1 = ev('__rv.P().yaw')
    pg.screenshot(path=f'{OUT}/04_mouse_drag.png')
    pg.mouse.up()
    ok = until('RV.zombie.state() === "idle"', 4000); W(200)
    a = ev(POSE)
    check('mouse_drag_holds_it', mid['holder'] == 'mouse', mid)
    check('mouse_drag_moves_it', ok and abs(a['p'][1]) < 0.02 and math.hypot(a['p'][0] + 0.3, a['p'][2] - 0.95) < 0.2, a)
    check('view_did_not_turn_while_dragging', abs(yaw1 - yaw0) < 1e-6, [yaw0, yaw1])
    check('drag_tossed_no_crumb', ev('window.__toss') == 0)
    ev('(() => { const h = RV.zombie._debug.home.pos; __rv.faceAt(h.x, h.y + 0.14, h.z); })()'); W(300)
    s = ev('(() => { const h = RV.zombie._debug.home.pos; return __rv.projectPt(h.x, h.y + 0.14, h.z); })()')
    pg.mouse.click(s['x'], s['y'])
    check('mouse_click_still_arms', ev('RV.zombie.state()') == 'armed' and ev('window.__toss') == 0)
    until('RV.zombie.state() === "idle"', 12000)
    a2 = ev(POSE)
    check('mouse_scare_back_to_spot', a2['p'] == a['p'], {'now': a2['p'], 'spot': a['p']})

    # 9. resetSpot: back to the door, saved spot forgotten
    ev('RV.zombie.resetSpot()'); W(300)
    a = ev(POSE)
    check('reset_spot', abs(a['p'][0] - D['x']) < 1e-3 and abs(a['p'][2] - D['z']) < 1e-3 and abs(a['p'][1]) < 0.01 and a['saved'] is None, a)
    ev('__rv.setPlayer(0.4, 1.3, 0)'); ev('(() => { const h = RV.zombie._debug.home.pos; __rv.faceAt(h.x, h.y + 0.14, h.z); })()'); W(500)
    pg.screenshot(path=f'{OUT}/05_default_spot.png')

    errs = [c for c in res['console'] if (c.startswith('error') or c.startswith('PAGEERROR') or c.startswith('HTTP')) and 'charlie-season/episodes.json' not in c and 'status of 404' not in c]
    check('no_console_errors', not errs, errs)
    b.close()
json.dump(res, open(f'{OUT}/result.json', 'w'), indent=1)
print('FAIL: ' + ', '.join(res['fail']) if res['fail'] else 'ALL OK')
