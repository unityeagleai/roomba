"""Checks for the phone from the future (js/phone.js) and the locked desk drawer (js/drawers.js): the drawer only opens with
the keycard in the CHARLIE 64; the phone lies in it; grabbing / clicking it plays Miles' message (and pauses other media);
it can be carried, put back, put on the desk / floor, in VR (trigger + grip, stand-in controller) and on screen.
Run: python3 tools/test_phone.py [url]   (default: the live site)"""
import sys, io, math
from PIL import Image
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'https://unityeagleai.github.io/roomba/'
fails, logs = [], []
def ok(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 960, 'height': 540})
    pg = ctx.new_page()
    pg.on('console', lambda m: logs.append((m.type, m.text)))
    pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    bad404 = []
    pg.on('response', lambda r: bad404.append(r.url) if r.status == 404 and 'episodes.json' not in r.url else None)
    pg.goto(URL + ('&' if '?' in URL else '?') + 'nocache=phone1', wait_until='load')
    pg.wait_for_timeout(2500); pg.click('#bFlat'); pg.wait_for_timeout(1200)
    pg.evaluate('RV.roomba.place(1.6, 1.3)')
    pg.wait_for_function('RV.desk && RV.desk.ready() && RV.drawers && RV.phone', timeout=20000)
    ev = lambda js, *a: pg.evaluate(js, *a)
    def wait(js, t=15000):
        try: pg.wait_for_function(js, timeout=t); return True
        except Exception: print('  (timed out waiting for', js, ')'); return False
    def frames(n=5): ev('(n) => new Promise(r => { let k = 0; const f = () => ++k >= n ? r() : requestAnimationFrame(f); requestAnimationFrame(f); })', n)
    def look(x, z, tx, ty, tz):
        ev(f'__rv.setPlayer({x}, {z})'); pg.wait_for_timeout(500); ev(f'__rv.faceAt({tx}, {ty}, {tz})'); pg.wait_for_timeout(400)
    def click_at_world(js):
        return ev('(js) => { const o = RV.camera.getWorldPosition(new THREE.Vector3()), t = eval(js); return RV.media.click(o, t.sub(o).normalize()); }', js)
    PH = lambda: ev('RV.phone._debug()')
    DR = lambda: ev('RV.drawers._debug()')
    PHW = 'RV.phone.g.getWorldPosition(new THREE.Vector3())'
    PULLW = 'RV.drawers.pull.getWorldPosition(new THREE.Vector3())'
    settle = lambda: (frames(3), wait('["drawer","rest","held"].includes(RV.phone.state()) && RV.drawers.amount() === (RV.drawers.isOpen() ? 1 : 0)'), frames(3))
    ev('RV.drawers.reset()'); frames(3)

    # ---- the prop and where it lives
    wait('RV.phone._debug().texReady')
    d = PH(); print('  phone', d)
    ok(d['state'] == 'drawer' and d['parent'] == 'deskDrawer', 'the phone starts inside the top desk drawer')
    ok(d['texW'] == 172 and d['texH'] == 348, "Unity's phone picture is on its front (172 x 348 crop)")
    ok(d['z'] < ev('RV.drawers.PED.z1'), 'drawer shut: the phone is hidden inside the desk')
    dims = ev('() => { const g = RV.phone.g, q = g.quaternion.clone(), par = g.parent; RV.scene.attach(g); g.quaternion.identity(); g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g.children[0]); par.attach(g); g.quaternion.copy(q); const s = b.getSize(new THREE.Vector3()); return [s.x, s.y, s.z]; }')
    print('  size', dims)
    ok(abs(dims[0] - 0.072) < 0.004 and abs(dims[2] - 0.147) < 0.006 and dims[1] < 0.014, 'phone-sized: about 7 x 15 cm and under a centimetre and a half thick (with the camera bump)')
    sl = [f['slot'] for f in DR()['floppies'] if f['state'] == 'drawer']
    ok(not (set(sl) & {2, 5}), f'no floppy lies where the phone is (drawer slots {sl})')

    # ---- locked without the keycard
    look(-2.0, -0.55, -2.26, 0.56, -1.45)
    ok(ev('RV.desk.cardIn()') is False and DR()['locked'] and DR()['led'] == 'red', 'no keycard in the computer: drawer locked, LED red')
    r0 = DR()['rattles']
    click_at_world(PULLW); frames(20)
    ok(DR()['target'] == 0 and ev('RV.drawers.amount()') == 0, 'clicking the locked drawer does not open it')
    ok(DR()['rattles'] == r0 + 1, 'it rattles instead')
    ok(ev('RV.desk._debug().nudge') > 0 if ev('"nudge" in RV.desk._debug()') else True, 'the CRT asks for the card')
    ev('RV.drawers.open()'); frames(10)
    ok(ev('RV.drawers.amount()') == 0, 'opening it from code is refused too while it is locked')
    # VR grip on the pull while locked
    ev('''() => { const c = new THREE.Object3D(); c.name = 'fakeCtrl'; RV.scene.add(c); window.__fc = c; }''')
    def ctrl_at(x, y, z, tx=None, ty=None, tz=None):
        ev(f'''() => {{ const c = window.__fc; c.position.set({x}, {y}, {z}); {'' if tx is None else f'c.lookAt({2*x - tx}, {2*y - ty}, {2*z - tz});'} c.updateMatrixWorld(true); }}''')
    def ctrl_ray(): return 'const o = window.__fc.getWorldPosition(new THREE.Vector3()), d = new THREE.Vector3(0, 0, -1).applyQuaternion(window.__fc.getWorldQuaternion(new THREE.Quaternion()));'
    pw = ev(PULLW + '.toArray()'); ctrl_at(pw[0], pw[1], pw[2] + 0.03)
    ev('RV.drawers.squeezeStart(window.__fc)'); frames(10)
    ok(ev('RV.drawers.amount()') == 0 and DR()['rattles'] == r0 + 3, 'grip on the pull: still shut, rattles')

    # ---- keycard in: unlocked
    look(-1.55, -0.6, -1.6, 0.74, -1.55)
    click_at_world('RV.desk.card.getWorldPosition(new THREE.Vector3())')
    wait('RV.desk.cardIn()'); frames(3)
    ok(ev('RV.desk.cardIn()') and not DR()['locked'] and DR()['led'] == 'green', 'keycard in the CHARLIE 64: unlocked, LED green')
    look(-2.0, -0.55, -2.26, 0.56, -1.45)
    click_at_world(PULLW); settle()
    ok(ev('RV.drawers.amount()') == 1, 'now the drawer opens')
    d = PH()
    ok(d['z'] > ev('RV.drawers.PED.z1') - 0.02, f'the phone rides out with it ({d["z"]:.3f})')
    look(-2.1, -0.75, -2.16, 0.5, -1.33)
    img = Image.open(io.BytesIO(pg.screenshot())); img.save('/tmp/phone_drawer_open.png')
    pp = ev('() => { const v = ' + PHW + '.project(RV.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight, v.z]; }')
    print('  phone on screen at', pp)
    ok(0 < pp[0] < 960 and 0 < pp[1] < 540 and pp[2] < 1, 'the phone is in view in the open drawer')
    hov = ev('() => { const o = RV.camera.getWorldPosition(new THREE.Vector3()), d = ' + PHW + '.sub(o).normalize(); return [RV.media.hoverT(o, d), RV.phone.pickT(o, d)]; }')
    ok(hov[1] is not None and abs(hov[0] - hov[1]) < 1e-6, f'pointing at it lands on the phone, not the drawer or a floppy {hov}')

    # ---- screen: click = pick up + Miles plays
    ev('RV.voiceNote._debug.play()'); pg.wait_for_timeout(1500)
    vn_before = ev('RV.voiceNote._debug.state()')
    click_at_world(PHW); frames(10)
    ok(PH()['state'] == 'held' and PH()['by'] == 'desk', 'click: the phone is in your hand')
    ok(wait('RV.phone._debug().live && RV.phone.audio.currentTime > 0.5'), 'the message plays')
    d = PH(); print('  audio', {k: d[k] for k in ('live', 't', 'dur', 'wired', 'plays')})
    ok(d['dur'] and 40 < d['dur'] < 46, f'it is the 43 s message ({d["dur"]})')
    vs = ev('RV.voiceNote._debug.state()')
    print('  voice note before/after', vn_before.get('live'), vs.get('live'), vs.get('lastStop'))
    ok(not vs['live'] and ev('RV.voiceNote.video.paused'), 'the voice note screen paused when the phone started')
    ok(ev('RV.media.playing()'), 'counts as media playing (Roomba does not punish / listen)')
    img = Image.open(io.BytesIO(pg.screenshot())); img.save('/tmp/phone_held.png')
    pp = ev('() => { const v = ' + PHW + '.project(RV.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }')
    ok(400 < pp[0] < 960 and 200 < pp[1] < 540, f'held up in the lower right of your view {pp}')
    # click the phone in your hand: stop / replay
    click_at_world(PHW); frames(5)
    ok(not PH()['live'] and not PH()['starting'] and ev('RV.phone.audio.paused') and PH()['state'] == 'held', 'clicking the phone in your hand stops it (still holding it)')
    click_at_world(PHW)
    ok(wait('RV.phone._debug().live'), 'clicking it again plays it from the start')
    ok(PH()['t'] < 3, 'from the start')
    # other media starting stops the phone
    ev('RV.voiceNote._debug.play()')
    ok(wait('!RV.phone._debug().live && RV.phone._debug().lastStop === "other media"'), 'the voice note screen starting stops the phone')
    ev('RV.voiceNote._debug.pause("test")'); frames(3)
    # the record player: starting the phone lifts the needle; the record starting stops the phone
    ev('RV.media._debug.startRecord()'); frames(5)
    ok(ev('RV.media._debug.rp.on'), '(record playing)')
    ev('RV.phone.play()'); frames(5)
    ok(not ev('RV.media._debug.rp.on'), 'starting the phone stops the record player')
    wait('RV.phone._debug().live'); pg.wait_for_timeout(600)
    ev('RV.media._debug.startRecord()')
    ok(wait('!RV.phone._debug().live && RV.phone._debug().lastStop === "other media"'), 'the record starting stops the phone')
    ev('RV.media._debug.stopRecord("test")'); frames(3)

    # ---- put it back: click the open drawer
    ev('RV.phone.play()'); wait('RV.phone._debug().live')
    click_at_world('RV.drawers.inHit.getWorldPosition(new THREE.Vector3())'); settle()
    d = PH()
    ok(d['state'] == 'drawer' and d['parent'] == 'deskDrawer', 'click the open drawer: it goes back in its spot')
    ok(d['live'], 'Miles keeps talking while it lies in the drawer')
    # pick it up again while it plays -> stops
    click_at_world(PHW); frames(5)
    ok(PH()['state'] == 'held' and not PH()['live'] and ev('RV.phone.audio.paused'), 'picking it up again while it plays stops it')
    # on the desk
    look(-1.55, -0.6, -1.6, 0.74, -1.55)
    click_at_world('new THREE.Vector3(-1.62, 0.745, -1.72)'); settle()
    d = PH(); print('  desk', d['state'], d['x'], d['y'], d['z'])
    ok(d['state'] == 'rest' and 0.74 < d['y'] < 0.8, 'click the desk: it lies on the desk')
    click_at_world(PHW); frames(5)
    ok(PH()['state'] == 'held' and wait('RV.phone._debug().live'), 'click it on the desk: in your hand again and playing (it was quiet)')
    # on the floor
    look(-0.5, 0.5, -0.3, 0.0, -0.3)
    click_at_world('new THREE.Vector3(-0.3, 0.0, -0.3)'); settle(); pg.wait_for_timeout(600)
    d = PH(); print('  floor', d['state'], d['x'], d['y'], d['z'])
    ok(d['state'] == 'rest' and d['y'] < 0.02 and math.dist([d['x'], d['z']], [-0.3, -0.3]) < 0.1, 'click the floor: it lies on the floor')
    ev('RV.phone.stop("test")')

    # ---- VR: trigger carries it, letting go over the open drawer puts it back
    fp = ev(PHW + '.toArray()')
    ctrl_at(fp[0] + 0.3, 1.0, fp[2] + 0.5, fp[0], fp[1], fp[2])
    ok(ev('() => { ' + ctrl_ray() + ' return RV.media.selectStart(window.__fc, o, d); }'), 'VR trigger at the phone on the floor is taken')
    ok(PH()['state'] == 'held' and PH()['by'] == 'controller' and wait('RV.phone._debug().live'), 'it is in your hand and Miles plays')
    dp = ev('RV.drawers.inHit.getWorldPosition(new THREE.Vector3()).toArray()')
    ctrl_at(dp[0], dp[1] + 0.25, dp[2] + 0.12, dp[0], dp[1], dp[2] - 0.2); frames(8)
    hp = PH(); hc = ev('window.__fc.position.toArray()')
    ok(math.dist([hp['x'], hp['y'], hp['z']], hc) < 0.12, 'it follows the controller')
    ev('() => { ' + ctrl_ray() + ' return RV.media.selectEnd(window.__fc, o, d); }'); settle()
    ok(PH()['state'] == 'drawer', 'trigger released over the open drawer: back in the drawer')
    # VR grip next to it: grab; drawers.js does not also take a floppy
    fp = ev(PHW + '.toArray()'); ctrl_at(fp[0], fp[1] + 0.05, fp[2] + 0.02)
    ok(ev('RV.phone.squeezeStart(window.__fc)'), 'grip with your hand next to it picks it up')
    ev('RV.drawers.squeezeStart(window.__fc)')
    ok(not any(f['state'] == 'held' for f in DR()['floppies']) and ev('RV.drawers.amount()') == 1, 'the same grip does not also grab a floppy or shut the drawer')
    ok(PH()['via'] == 'squeeze' and not PH()['live'], 'second grab while it played: stopped')
    # trigger on the holding hand: replay / stop
    ev('() => { ' + ctrl_ray() + ' return RV.media.selectStart(window.__fc, o, d); }')
    ok(wait('RV.phone._debug().live'), 'trigger while holding it: plays')
    ev('() => { ' + ctrl_ray() + ' return RV.media.selectEnd(window.__fc, o, d); }')
    ok(PH()['state'] == 'held', 'letting go of the trigger keeps it in the gripping hand')
    ev('() => { ' + ctrl_ray() + ' return RV.media.selectStart(window.__fc, o, d); }'); frames(3)
    ok(not PH()['live'], 'trigger again: stops')
    ev('() => { ' + ctrl_ray() + ' return RV.media.selectEnd(window.__fc, o, d); }')
    # drop it in the room: falls onto the bed / floor
    ctrl_at(0.5, 1.3, 0.2); frames(8)
    ev('RV.phone.squeezeEnd(window.__fc)'); pg.wait_for_timeout(1200); frames(3)
    d = PH(); print('  dropped', d['state'], d['x'], d['y'], d['z'])
    ok(d['state'] == 'rest' and d['y'] < 0.9 and abs(d['x'] - 0.5) < 0.05, 'let go in the room: it drops onto whatever is below')

    # ---- a floppy put in the drawer never lands on the phone's spot
    ev('RV.phone.toDrawer()'); settle()
    for k in ('games', 'roomba'):
        ev(f'() => {{ const f = RV.drawers.floppies.find(f => f.id === "{k}"); RV.drawers.toDrawer(f); }}'); frames(40)
    sl = [f['slot'] for f in DR()['floppies'] if f['state'] == 'drawer']
    ok(len(sl) == 4 and not (set(sl) & {2, 5}), f'floppies fill the other slots ({sl})')
    ev('localStorage.removeItem("rv.floppies.v1")')

    # ---- card out: drawer stays as it is; shut, it's locked again
    look(-1.55, -0.6, -1.6, 0.74, -1.55)
    click_at_world('RV.desk.card.getWorldPosition(new THREE.Vector3())'); wait('RV.desk._debug().cardState === "rest"')
    ok(DR()['locked'] and DR()['led'] == 'red' and ev('RV.drawers.amount()') == 1, 'card out: LED red, an open drawer is not slammed shut')
    ev('RV.drawers.close()'); settle()
    ok(ev('RV.drawers.amount()') == 0, 'shutting it still works')
    ev('RV.drawers.open()'); frames(10)
    ok(ev('RV.drawers.amount()') == 0, 'shut without the card: locked again')

    errs = [l for l in logs if l[0] == 'pageerror' or (l[0] == 'error' and 'Failed to load resource' not in l[1])]
    for e in errs[:8]: print('  ', e)
    ok(not errs, f'no page errors ({len(errs)})')
    ok(not bad404, f'no missing files {bad404[:3]}')
    b.close()

print('\nFAILS:', len(fails))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
