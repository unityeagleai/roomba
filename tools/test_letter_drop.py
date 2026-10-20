"""The letter from the future can always be picked up again where it lands (js/letter.js + the seat volumes in js/app.js),
the same checks as tools/test_phone_drop.py for the phone.
Unity (Quest): 'i dropped [the phone] on the stool and couldn't grab it again'. The stool's (and bed's) invisible sit-down
volume swallowed the trigger. Checks: dropped on the stool / bed / beanbag / desk / floor, VR trigger, VR grip (pointing and
hand next to it) and a click all pick it up instead of sitting you down; the stool / bed still sit you down when the phone
isn't there; a drop where you can't see or point at it (behind the bed, out of the room) sends it back to the drawer.
Run: python3 tools/test_letter_drop.py [url]"""
import sys, math
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'https://unityeagleai.github.io/roomba/'
fails, logs = [], []
def ok(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('console', lambda m: logs.append((m.type, m.text)))
    pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    pg.goto(URL + ('&' if '?' in URL else '?') + 'nocache=letterdrop', wait_until='load')
    pg.wait_for_timeout(2500); pg.click('#bFlat'); pg.wait_for_timeout(1200)
    pg.wait_for_function('RV.desk && RV.desk.ready() && RV.drawers && RV.letter', timeout=20000)
    ev = lambda js, *a: pg.evaluate(js, *a)
    ev('RV.roomba.place(1.6, 1.3)')
    def wait(js, t=10000):
        try: pg.wait_for_function(js, timeout=t); return True
        except Exception: print('  (timed out waiting for', js, ')'); return False
    LT = lambda: ev("RV.letter._debug()")
    ev('() => { const c = new THREE.Object3D(); c.name = "fakeCtrl"; RV.scene.add(c); window.__fc = c; }')
    def ctrl_at(x, y, z, tx=None, ty=None, tz=None):
        ev(f'''() => {{ const c = window.__fc; c.position.set({x}, {y}, {z}); {'' if tx is None else f'c.lookAt({2*x - tx}, {2*y - ty}, {2*z - tz});'} c.updateMatrixWorld(true); }}''')
    RAY = 'const o = window.__fc.getWorldPosition(new THREE.Vector3()), d = new THREE.Vector3(0, 0, -1).applyQuaternion(window.__fc.getWorldQuaternion(new THREE.Quaternion()));'
    def pose(): return ev('__rv.pose().pose')
    def home():
        if pose(): ev('__rv.stand("test")')
        if ev('RV.letter.state()') == 'held':
            ev('RV.letter.toDrawer()')
        ev('RV.letter.stop("test")'); ev('RV.letter.toDrawer()'); wait('RV.letter.state() === "drawer"')
    def drop_vr(x, z, y=1.1):
        """carry it in a VR hand to (x, y, z) and let go of the grip"""
        home(); ctrl_at(x, y, z); ev('() => { window.__fc.quaternion.identity(); window.__fc.updateMatrixWorld(true); }')   # hand level, facing into the room (-z)
        ev('RV.letter.grab(window.__fc, "squeeze")'); wait('RV.letter.g.getWorldPosition(new THREE.Vector3()).distanceTo(window.__fc.position) < 0.16'); pg.wait_for_timeout(1200)
        ev('RV.letter.squeezeEnd(window.__fc)'); wait('["rest", "drawer"].includes(RV.letter.state())'); pg.wait_for_timeout(200)
        ev('RV.letter.stop("test")')
        return LT()

    SPOTS = [('the red stool', -1.93, -1.13, 0.5, 0.6), ('the bed', -1.6, 0.2, 0.55, 0.65), ('the beanbag', 1.85, 1.35, 0.4, 0.8), ('the desk', -1.62, -1.72, 0.74, 0.8), ('the floor', 0.2, 0.3, -0.01, 0.02)]
    for name, x, z, y0, y1 in SPOTS:
        d = drop_vr(x, z); print(f'  {name}:', d['state'], d['x'], d['y'], d['z'])
        ok(d['state'] == 'rest' and y0 < d['y'] < y1, f'let go over {name}: it lies on {name}')
        fp = [d['x'], d['y'], d['z']]
        # VR trigger, pointing from a few places you could stand
        for k, (ox, oy, oz) in enumerate([(0.45, 0.55, 0.35), (-0.35, 0.7, 0.45), (0.5, 0.35, -0.1) if name != 'the desk' else (0.3, 0.45, 0.4)]):
            ctrl_at(fp[0] + ox, fp[1] + oy, fp[2] + oz, fp[0], fp[1], fp[2])
            took = ev('() => { ' + RAY + ' return RV.media.selectStart(window.__fc, o, d); }')
            got = LT()['state'] == 'held' and LT()['by'] == 'controller'
            ok(took and got and pose() is None, f'{name}, angle {k + 1}: point + trigger picks the letter up (not sitting down: {pose()})')
            if got:
                ev('() => { ' + RAY + ' return RV.media.selectEnd(window.__fc, o, d); }')   # lets go: drops again where the hand is
                ev('RV.letter.stop("test")'); home(); d2 = drop_vr(x, z); fp = [d2['x'], d2['y'], d2['z']]
            else: home(); d2 = drop_vr(x, z); fp = [d2['x'], d2['y'], d2['z']]
        # pointing at it: the ray (and the line) ends on the phone
        ctrl_at(fp[0] + 0.45, fp[1] + 0.55, fp[2] + 0.35, fp[0], fp[1], fp[2])
        h = ev('() => { ' + RAY + ' return [RV.media.hoverT(o, d), RV.letter.pickT(o, d)]; }')
        ok(h[1] is not None and abs(h[0] - h[1]) < 1e-6, f'{name}: the pointer lands on the letter {h}')
        # VR grip pointing at it from half a metre
        ok(ev('RV.letter.squeezeStart(window.__fc)') and LT()['via'] == 'squeeze', f'{name}: grip while pointing at it picks it up')
        ev('RV.letter.squeezeEnd(window.__fc)'); ev('RV.letter.stop("test")')
        d2 = drop_vr(x, z); fp = [d2['x'], d2['y'], d2['z']]
        # VR grip with the hand next to it
        ctrl_at(fp[0], fp[1] + 0.06, fp[2] + 0.03)
        ok(ev('RV.letter.squeezeStart(window.__fc)') and LT()['state'] == 'held', f'{name}: grip with your hand next to it picks it up')
        ev('RV.letter.squeezeEnd(window.__fc)'); ev('RV.letter.stop("test")')
        # screen click from standing nearby
        d2 = drop_vr(x, z); fp = [d2['x'], d2['y'], d2['z']]
        cl = ev(f'() => {{ const o = new THREE.Vector3({fp[0] + 0.5}, 1.5, {fp[2] + 0.6}), d = new THREE.Vector3({fp[0]}, {fp[1]}, {fp[2]}).sub(o).normalize(); return RV.media.click(o, d); }}')
        ok(cl and LT()['state'] == 'held' and LT()['by'] == 'desk' and pose() is None, f'{name}: a click on it picks it up (not sitting down)')
        home()

    # the seats still work when the letter isn't on them
    home()
    ctrl_at(-1.6, 1.1, -0.6, -1.93, 0.45, -1.13)
    ev('() => { ' + RAY + ' return RV.media.selectStart(window.__fc, o, d); }')
    ok(pose() == 'desk', 'pointing at the empty stool + trigger still sits you at the computer')
    ev('__rv.stand("test")')
    ctrl_at(-0.6, 1.2, 0.6, -1.6, 0.6, 0.2)
    ev('() => { ' + RAY + ' return RV.media.selectStart(window.__fc, o, d); }')
    ok(pose() == 'bed', 'pointing at the bed + trigger still lies you down')
    ev('__rv.stand("test")')
    # letter on the stool, pointing at the other side of the seat: you still sit down
    d = drop_vr(-1.93, -1.13)
    ctrl_at(-1.6, 1.1, -0.6, -1.93, 0.25, -1.13)   # at the legs, below the seat
    hit_phone = ev('() => { ' + RAY + ' return RV.letter.pickT(o, d); }')
    ev('() => { ' + RAY + ' return RV.media.selectStart(window.__fc, o, d); }')
    print('  legs:', hit_phone, ev('() => { ' + RAY + ' return [RV.media.hoverT(o, d), __rv.posePick(o.toArray(), d.toArray()), RV.zombie.hoverT(o, d)]; }'), pose(), LT()['state'])
    ok(hit_phone is None and pose() == 'desk' and LT()['state'] == 'rest', 'letter on the stool, pointing at the stool legs: you sit down and the letter stays')
    home()

    # nowhere you can't get at it
    d = drop_vr(-2.45, 0.2, 0.3)   # down the gap between the bed and the wall
    print('  behind the bed:', d['state'], d['parent'], ev('RV.letter.lastReach()'))
    ok(d['state'] in ('drawer', 'fly') or (d['state'] == 'rest' and d['y'] > 0.3), 'let go between the bed and the wall: never left on the hidden floor (back in the drawer, or on the bed)')
    for (x, y, z) in [(5, 0.5, 0), (-1.93, -2, -1.13)]:
        home(); ev(f'RV.letter.dropAt({x}, {y}, {z}, 0)'); wait('["rest", "drawer"].includes(RV.letter.state())'); d = LT()
        ok(abs(d['x']) < 2.6 and abs(d['z']) < 2.2 and d['y'] > -0.01, f'a drop at ({x}, {y}, {z}) ends up inside the room ({d["state"]} {d["x"]}, {d["y"]}, {d["z"]})')
    home(); ev('() => { RV.letter.dropAt(0.2, 0.5, 0.2, 0); }'); wait('RV.letter.state() === "rest"')
    ev('() => { RV.letter.g.position.set(0.2, -3, 0.2); }'); pg.wait_for_timeout(500)
    ok(ev('RV.letter.state()') in ('drawer', 'fly'), 'if it ever ends up out of the room, it goes back to the drawer')
    home()
    ok(ev('RV.letter.audio.volume') == 1, 'letter volume unchanged')

    errs = [l for l in logs if l[0] == 'pageerror' or (l[0] == 'error' and 'Failed to load resource' not in l[1])]
    for e in errs[:8]: print('  ', e)
    ok(not errs, f'no page errors ({len(errs)})')
    b.close()

print('\nFAILS:', len(fails))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
