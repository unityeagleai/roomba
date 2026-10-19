"""Checks for the desk drawer + floppy discs (js/drawers.js): the top drawer of the desk opens and shuts, the floppies can be
picked up (screen click, VR trigger, VR grip), put into the open drawer, taken out again, left on the desk or dropped.
Run: python3 tools/test_drawers.py [url]   (default: the live site)"""
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
    def boot(tag):
        pg.goto(URL + ('&' if '?' in URL else '?') + 'nocache=' + tag, wait_until='load')
        pg.wait_for_timeout(2500); pg.click('#bFlat'); pg.wait_for_timeout(1200)
        pg.evaluate('RV.roomba.place(1.6, 1.3)')
        pg.wait_for_function('RV.desk && RV.desk.ready() && RV.drawers', timeout=20000)
    boot('drawers1')
    ev = lambda js, *a: pg.evaluate(js, *a)
    def wait(js, t=20000):
        try: pg.wait_for_function(js, timeout=t); return True
        except Exception: print('  (timed out waiting for', js, ')'); return False
    SET = lambda k: f"RV.drawers._debug().floppies.find(f => f.id === '{k}').state"
    def frames(n=5): ev('(n) => new Promise(r => { let k = 0; const f = () => ++k >= n ? r() : requestAnimationFrame(f); requestAnimationFrame(f); })', n)
    def pause():
        frames(3); wait(settled + ' && RV.drawers.amount() === (RV.drawers.isOpen() ? 1 : 0)'); frames(3)
    settled = 'RV.drawers._debug().floppies.every(f => f.state !== "fly" && f.state !== "fall")'
    ev('RV.drawers.reset()')
    ok(ev('!!RV.drawers'), 'drawers module loaded')
    dbg = lambda: ev('RV.drawers._debug()')
    st = lambda: {f['id']: f for f in dbg()['floppies']}
    s0 = st()
    ok(len(s0) == 4, f'four floppies ({list(s0)})')
    ok(s0['games']['state'] == 'desk' and s0['roomba']['state'] == 'desk', 'GAMES 2 and roomba.bas lie on the desk where they were')
    ok(abs(s0['games']['x'] + 2.33) < 0.002 and abs(s0['games']['z'] + 1.62) < 0.002 and abs(s0['roomba']['x'] + 2.318) < 0.002, 'same spot as before (desk.js)')
    ok(s0['roomba']['y'] > s0['games']['y'] + 0.003, 'roomba.bas lies on top of GAMES 2')
    ok(s0['diary']['state'] == 'drawer' and s0['zombie']['state'] == 'drawer', 'DIARY and zombie.exe start inside the drawer')
    ok(all(s0[k]['z'] < ev('RV.drawers.PED.z1') for k in ('diary', 'zombie')), 'closed drawer: the two inside are hidden in the desk')

    # the front is where desk.js had its top drawer front; the desk merge no longer has one there
    geo = ev('''() => { const d = RV.drawers, P = d.PED, v = new THREE.Vector3(); d.drawer.updateMatrixWorld(true);
      const fp = d.front.getWorldPosition(new THREE.Vector3()); let stray = 0;
      RV.scene.children.forEach(m => { if (m.name !== 'deskMerged') return; m.updateMatrixWorld(true); const pa = m.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld);
          if (v.x > P.x0 + 0.01 && v.x < P.x1 - 0.01 && v.y > 0.495 && v.y < 0.675 && v.z > P.z1 + 0.002 && v.z < P.z1 + 0.03) stray++; } });
      return { fp: [fp.x, fp.y, fp.z], z1: P.z1, stray, s: [d.front.scale.x, d.front.scale.y, d.front.scale.z] }; }''')
    print('  front', geo)
    ok(abs(geo['fp'][0] + 2.26) < 0.002 and abs(geo['fp'][1] - 0.585) < 0.002 and abs(geo['fp'][2] - (geo['z1'] + 0.007)) < 0.002, 'drawer front sits exactly where the old top drawer front was')
    ok(geo['stray'] == 0, f'the desk itself no longer draws a fixed top drawer front ({geo["stray"]} stray vertices)')
    ok(abs(geo['s'][0] - 0.35) < 0.001 and abs(geo['s'][1] - 0.19) < 0.001, 'same size as the other two drawer fronts')

    def shot(): return Image.open(io.BytesIO(pg.screenshot())).convert('RGB')
    def look(x, z, tx, ty, tz):
        ev(f'__rv.setPlayer({x}, {z})'); pg.wait_for_timeout(600); ev(f'__rv.faceAt({tx}, {ty}, {tz})'); pg.wait_for_timeout(500)
    def proj_obj(js):
        return ev('(js) => { const v = eval(js).project(RV.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight, v.z]; }', js)
    def click_at_world(js):   # the click path the app uses: ray from the camera towards a world point
        return ev('(js) => { const o = RV.camera.getWorldPosition(new THREE.Vector3()), t = eval(js); return RV.media.click(o, t.sub(o).normalize()); }', js)
    def hover_is_mine(js):
        return ev('(js) => { const o = RV.camera.getWorldPosition(new THREE.Vector3()), t = eval(js), d = t.sub(o).normalize(); const a = RV.media.hoverT(o, d), b = RV.drawers.pick(o, d, false); return !!b && a != null && Math.abs(a - b.t) < 1e-6 ? b.kind : null; }', js)

    look(-2.0, -0.55, -2.26, 0.56, -1.45)
    PULLW = 'RV.drawers.pull.getWorldPosition(new THREE.Vector3())'
    ok(hover_is_mine(PULLW) == 'front', 'pointer ray at the drawer pull lands on the drawer')
    closed = shot()
    # a real mouse click on the drawer
    px, py, _ = proj_obj(PULLW); pg.mouse.click(px, py); pause()
    if not ev('RV.drawers.isOpen()'): click_at_world(PULLW); print('  (mouse click did not reach the drawer: used the app click path)')
    pause()
    d1 = dbg(); print('  open', d1['open'])
    ok(ev('RV.drawers.isOpen()') and d1['open'] == 1, 'clicking the drawer opens it')
    dz = ev('RV.drawers.drawer.position.z - RV.drawers.PED.z1')
    ok(abs(dz - 0.19) < 0.001, f'it slides out 19 cm ({dz:.3f})')
    ob = ev('RV.drawers.obst'); ok(abs(ob['z1'] - (ev('RV.drawers.PED.z1') + 0.014 + 0.19)) < 0.002 and ob['who'] == 'player', 'while open you bump into it (the Roomba drives under)')
    ok(ev('RV.blocked(-2.26, -1.30, 0.05, "player")') and not ev('RV.blocked(-2.26, -1.30, 0.05, "roomba")'), 'blocked check sees the open drawer for you only')
    opened = shot()
    diff = sum(1 for X in range(0, 960, 4) for Y in range(0, 540, 4) if sum(abs(a - b) for a, b in zip(closed.getpixel((X, Y)), opened.getpixel((X, Y)))) > 40)
    ok(diff > 150, f'you can see it open ({diff} sample pixels changed)')
    pg.screenshot(path='/tmp/drawer_open.png')
    # clear of the stool
    clr = ev('''() => { const d = RV.drawers, S = RV.desk.STOOL, bb = new THREE.Box3(); d.drawer.updateMatrixWorld(true);
      d.drawer.traverse(o => { if (o.isMesh && o.material.visible !== false) bb.expandByObject(o); });
      const cx = Math.max(bb.min.x, Math.min(S.x, bb.max.x)), cz = Math.max(bb.min.z, Math.min(S.z, bb.max.z));
      return { gap: Math.hypot(S.x - cx, S.z - cz) - S.r, maxX: bb.max.x, maxZ: bb.max.z, minY: bb.min.y, seat: S.seat }; }''')
    print('  stool clearance', clr)
    ok(clr['gap'] > 0.01, f'open drawer stays clear of the stool seat (gap {clr["gap"]*100:.1f} cm)')
    s1 = st(); ok(all(s1[k]['z'] > ev('RV.drawers.PED.z1') for k in ('diary', 'zombie')), 'the two floppies inside come out with the drawer')

    # take DIARY out of the drawer and put it on the desk (screen clicks)
    FL = lambda k: f"RV.drawers.floppies.find(f => f.id === '{k}').g.getWorldPosition(new THREE.Vector3())"
    look(-2.0, -0.95, -2.26, 0.5, -1.3)
    ok(hover_is_mine(FL('diary')) == 'floppy', 'pointer ray at a floppy in the open drawer lands on it')
    click_at_world(FL('diary')); pause()
    ok(st()['diary']['state'] == 'held', 'clicking DIARY in the drawer picks it up')
    pg.screenshot(path='/tmp/drawer_holding.png')
    click_at_world('new THREE.Vector3(-1.55, RV.desk.DESK.top, -1.75)'); pause()
    s2 = st()['diary']; print('  diary', s2)
    ok(s2['state'] == 'desk' and abs(s2['x'] + 1.55) < 0.03 and abs(s2['z'] + 1.75) < 0.03, 'clicking the desk lays it there')
    ok(abs(s2['y'] - (ev('RV.desk.DESK.top') + 0.0017)) < 0.001, 'flat on the desk top')

    # take GAMES 2 (bottom of the pile) and put it into the drawer: roomba.bas drops down onto the desk
    look(-2.0, -0.95, -2.3, 0.74, -1.62)
    click_at_world(FL('roomba')); pause()
    ok(st()['roomba']['state'] == 'held', 'clicking the top of the pile picks up roomba.bas')
    look(-2.0, -0.95, -2.26, 0.5, -1.3)
    click_at_world('RV.drawers.inHit.getWorldPosition(new THREE.Vector3())'); pause()
    s3 = st(); print('  roomba', s3['roomba'])
    ok(s3['roomba']['state'] == 'drawer' and s3['roomba']['parent'] == 'deskDrawer', 'clicking into the open drawer puts roomba.bas in it')
    ok(len({v['slot'] for v in s3.values() if v['state'] == 'drawer'}) == sum(1 for v in s3.values() if v['state'] == 'drawer'), 'each floppy in the drawer gets its own spot')
    fy = ev('RV.drawers.FLOOR_Y'); ok(all(abs(v['y'] - (fy + 0.0019)) < 0.001 for v in s3.values() if v['state'] == 'drawer'), 'they lie flat on the bottom of the drawer')

    # close: everything inside goes in with it and can't be picked
    click_at_world(PULLW); pause()
    s4 = st(); z1 = ev('RV.drawers.PED.z1')
    ok(not ev('RV.drawers.isOpen()') and dbg()['open'] == 0, 'clicking it again shuts it')
    ok(all(v['z'] < z1 for v in s4.values() if v['state'] == 'drawer'), 'the floppies inside are shut in the desk')
    ok(ev(f'''() => {{ const f = RV.drawers.floppies.find(f => f.id === 'zombie'), o = RV.camera.getWorldPosition(new THREE.Vector3()), t = f.g.getWorldPosition(new THREE.Vector3()); const p = RV.drawers.pick(o, t.sub(o).normalize(), false); return !p || p.kind !== 'floppy'; }}'''), 'a floppy in the shut drawer cannot be picked through the desk')

    # holding one on screen and clicking the shut drawer opens it (keeps holding), the next click puts it in
    look(-2.0, -0.95, -2.3, 0.74, -1.62)
    click_at_world(FL('games')); pause()
    look(-2.0, -0.95, -2.26, 0.5, -1.3)
    click_at_world(PULLW); pause()
    ok(ev('RV.drawers.isOpen()') and st()['games']['state'] == 'held', 'holding a floppy, clicking the shut drawer opens it and you keep holding')
    click_at_world(PULLW); pause()
    ok(st()['games']['state'] == 'drawer', 'and clicking the open drawer puts it in')

    # VR: a stand-in controller grabs with the trigger, lets go over the open drawer / over the desk / in the room
    ev('''() => { const c = new THREE.Object3D(); c.name = 'fakeCtrl'; RV.scene.add(c); window.__fc = c; }''')
    def ctrl_at(x, y, z, tx=None, ty=None, tz=None):
        ev(f'''() => {{ const c = window.__fc; c.position.set({x}, {y}, {z}); {'' if tx is None else f'c.lookAt({2*x - tx}, {2*y - ty}, {2*z - tz});'} c.updateMatrixWorld(true); }}''')
    def ctrl_ray(): return 'const o = window.__fc.getWorldPosition(new THREE.Vector3()), d = new THREE.Vector3(0, 0, -1).applyQuaternion(window.__fc.getWorldQuaternion(new THREE.Quaternion()));'
    zp = ev(FL('zombie') + '.toArray()')
    ctrl_at(-2.1, 1.1, -0.9, zp[0], zp[1], zp[2])
    ok(ev('() => { ' + ctrl_ray() + ' return RV.media.selectStart(window.__fc, o, d); }'), 'VR trigger at zombie.exe in the drawer is taken')
    ok(st()['zombie']['state'] == 'held', 'zombie.exe is in your hand')
    ctrl_at(-1.95, 1.0, -1.2, -1.9, 0.6, -1.9); pause()
    hp = st()['zombie']; hc = ev('window.__fc.position.toArray()')
    ok(math.dist([hp['x'], hp['y'], hp['z']], hc) < 0.1, 'it follows the controller')
    ctrl_at(-1.55, 0.95, -1.62, -1.55, 0.7, -1.62); pause()   # hand over the right side of the desk
    ev('() => { ' + ctrl_ray() + ' return RV.media.selectEnd(window.__fc, o, d); }'); pause()
    sz = st()['zombie']; print('  vr desk', sz)
    ok(sz['state'] == 'desk' and math.dist([sz['x'], sz['z']], [-1.55, -1.62]) < 0.2, 'let go of the trigger over the desk: it lies down on the desk, there (next to the keycard)')
    # grip with the hand right next to it, let go over the open drawer
    ctrl_at(sz['x'], sz['y'] + 0.05, sz['z'] + 0.02, sz['x'], 0, sz['z'] - 0.3)
    ok(ev('RV.drawers.squeezeStart(window.__fc)') and st()['zombie']['state'] == 'held', 'squeezing the grip with your hand next to it picks it up')
    ctrl_at(-2.24, 0.62, -1.30, -2.24, 0.3, -1.6); pause()
    ev('RV.drawers.squeezeEnd(window.__fc)'); pause()
    ok(st()['zombie']['state'] == 'drawer', 'letting go of the grip over the open drawer drops it in')
    # trigger again: take it out and drop it in the middle of the room -> it falls to the floor, then hops back to the desk
    zp = ev(FL('zombie') + '.toArray()'); ctrl_at(-2.1, 1.1, -0.9, zp[0], zp[1], zp[2])
    ev('() => { ' + ctrl_ray() + ' return RV.media.selectStart(window.__fc, o, d); }')
    ctrl_at(0.3, 1.0, -0.2, 0.3, 0, -0.6); pause()
    ev('() => { ' + ctrl_ray() + ' return RV.media.selectEnd(window.__fc, o, d); }'); pause()
    sf = st()['zombie']; print('  floor', sf)
    ok(sf['state'] == 'floor' and sf['y'] < 0.01, 'let go in the room: it drops flat on the floor')
    ev("RV.drawers.floppies.find(f => f.id === 'zombie').back = 0"); pause()
    sb = st()['zombie']; ok(sb['state'] == 'desk', 'after a while it hops back onto the desk')
    # grip at the brass pull opens / shuts it
    pw = ev(PULLW + '.toArray()'); ctrl_at(pw[0], pw[1], pw[2] + 0.04)
    was = ev('RV.drawers.isOpen()'); ev('RV.drawers.squeezeStart(window.__fc)'); pause()
    ok(ev('RV.drawers.isOpen()') != was, 'squeezing the grip at the brass pull opens/shuts the drawer')
    if not ev('RV.drawers.isOpen()'): ev('RV.drawers.open()'); pause()
    ev('window.__fc.parent.remove(window.__fc)')

    # remembered on this device
    before = {k: (v['state'], v['slot']) for k, v in st().items()}
    print('  before reload', before)
    boot('drawers2')
    after = {k: (v['state'], v['slot']) for k, v in st().items()}
    print('  after reload', after)
    ok(after == before, 'where the floppies are is remembered after reloading')
    ok(not ev('RV.drawers.isOpen()'), 'the drawer starts shut')
    ev('RV.drawers.reset()')
    sr = st(); ok(sr['diary']['state'] == 'drawer' and sr['games']['state'] == 'desk', 'reset puts them back where they started')
    ev('localStorage.removeItem("rv.floppies.v1")')

    # the rest of the desk still works: card -> CRT
    look(-1.55, -0.6, -1.6, 0.74, -1.55)
    ev('''() => { const o = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.desk.card.getWorldPosition(new THREE.Vector3()); RV.media.click(o, t.sub(o).normalize()); }''')
    wait('RV.desk._debug().cardState === "in"')
    ok(ev('RV.desk._debug().cardState') == 'in', 'desk keycard still goes into the keyboard')

    errs = [l for l in logs if l[0] == 'pageerror' or (l[0] == 'error' and 'Failed to load resource' not in l[1])]
    for e in errs[:8]: print('  ', e)
    ok(not errs, f'no page errors ({len(errs)})')
    ok(not bad404, f'no missing files {bad404[:3]}')
    b.close()

print('\nFAILS:', len(fails))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
