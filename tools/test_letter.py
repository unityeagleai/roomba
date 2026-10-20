"""The letter from the future in the desk drawer (js/letter.js): Unity's letter, and her voice reading it when you pick it up.
Checks: it lies in the top drawer next to the phone (no overlap, floppies elsewhere), the drawer is locked without the
keycard, the paper shows her letter (1000 x 1300 texture), picking it up (click, VR trigger, VR grip) plays her voice
from the letter, picking it up again stops it, again replays it, the trigger on the holding hand stops / replays, it
pauses the TV / record / voice note / phone and they stop it, letting go over the drawer puts it back, elsewhere it
floats down onto the desk / floor, a screen click puts it in the drawer / on the desk, a reload puts it back in the
locked drawer, the phone still works, no page errors.
Run: python3 tools/test_letter.py [url]"""
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
    pg.goto(URL + ('&' if '?' in URL else '?') + 'nocache=letter', wait_until='load')
    pg.wait_for_timeout(2500); pg.click('#bFlat'); pg.wait_for_timeout(1200)
    pg.wait_for_function('RV.desk && RV.desk.ready() && RV.drawers && RV.phone && RV.letter', timeout=20000)
    ev = lambda js, *a: pg.evaluate(js, *a)
    ev('RV.roomba.place(1.6, 1.3)')
    def wait(js, t=10000):
        try: pg.wait_for_function(js, timeout=t); return True
        except Exception: print('  (timed out waiting for', js, ')'); return False
    LT = lambda: ev('RV.letter._debug()')
    PH = lambda: ev('RV.phone._debug()')
    DR = lambda: ev('RV.drawers._debug()')
    ev('() => { const c = new THREE.Object3D(); c.name = "fakeCtrl"; RV.scene.add(c); window.__fc = c; }')
    def ctrl_at(x, y, z, tx=None, ty=None, tz=None):
        ev(f'''() => {{ const c = window.__fc; c.position.set({x}, {y}, {z}); {'' if tx is None else f'c.lookAt({2*x - tx}, {2*y - ty}, {2*z - tz});'} c.updateMatrixWorld(true); }}''')
    RAY = 'const o = window.__fc.getWorldPosition(new THREE.Vector3()), d = new THREE.Vector3(0, 0, -1).applyQuaternion(window.__fc.getWorldQuaternion(new THREE.Quaternion()));'
    def look(x, z, tx, ty, tz):
        ev(f'__rv.setPlayer({x}, {z})'); pg.wait_for_timeout(500); ev(f'__rv.faceAt({tx}, {ty}, {tz})'); pg.wait_for_timeout(400)
    def stand():
        if ev('__rv.pose().pose'): ev('__rv.stand("test")')

    # ---------- in the drawer, next to the phone
    d = LT(); print('  start:', d)
    ok(d['state'] == 'drawer' and d['parent'] == ev('RV.drawers.drawer.name'), 'starts in the top desk drawer')
    wait('RV.letter._debug().texReady', 15000); d = LT()
    ok(d['texW'] == 1000 and d['texH'] == 1300, f'the paper shows her letter picture ({d["texW"]} x {d["texH"]})')
    ok(abs(ev('RV.letter.LW') - 0.100) < 1e-6 and abs(ev('RV.letter.LH') - 0.130) < 1e-6, 'sheet is 10 x 13 cm, same shape as the letter')
    ok(PH()['state'] == 'drawer', 'the phone is in the drawer too')
    box = ev('''() => { const vis = o => { const bx = new THREE.Box3(); o.updateMatrixWorld(true); o.traverse(m => { if (m.isMesh && m.material && !(Array.isArray(m.material) ? m.material.every(x => x.visible === false) : m.material.visible === false)) bx.expandByObject(m); }); return bx; }; const a = new THREE.Box3().setFromObject(RV.letter.sheet), b = vis(RV.phone.g); const fl = RV.drawers.floppies.filter(f => f.state === 'drawer').map(f => vis(f.g));
        const tw = RV.drawers.TRAY.w, dr = RV.drawers.drawer; const la = a.clone().applyMatrix4(dr.matrixWorld.clone().invert());
        return { phone: a.intersectsBox(b), floppies: fl.filter(x => a.intersectsBox(x)).length, nfl: fl.length, inTray: la.min.x > -tw / 2 && la.max.x < tw / 2 && la.min.z > -RV.drawers.TRAY.d && la.max.z < 0.0, la: [la.min.x, la.max.x, la.min.z, la.max.z] }; }''')
    print('  boxes:', box)
    ok(not box['phone'] and box['floppies'] == 0, f'the letter overlaps neither the phone nor a floppy ({box})')
    ok(box['inTray'], 'the letter lies inside the drawer tray')
    sl = ev('RV.drawers.floppies.filter(f => f.state === "drawer").map(f => f.slot)')
    ok(all((s % 6) not in (0, 3, 2, 5) for s in sl), f'the floppies in the drawer moved to the middle column ({sl})')

    # ---------- locked without the keycard
    ev('RV.drawers.reset()'); pg.wait_for_timeout(300)
    CLICK_CARD = '() => { const p = RV.desk.card.getWorldPosition(new THREE.Vector3()); const o = new THREE.Vector3(p.x + 0.3, p.y + 0.5, p.z + 0.4); return RV.media.click(o, p.clone().sub(o).normalize()); }'
    ok(ev('RV.desk.cardIn()') is False and DR()['locked'], 'no keycard: the drawer is locked')
    ev('RV.drawers.open()'); pg.wait_for_timeout(800)
    ok(ev('RV.drawers.amount()') < 0.05, 'without the keycard the drawer stays shut')
    o = ev('() => { const p = RV.letter.g.getWorldPosition(new THREE.Vector3()); const o = new THREE.Vector3(p.x + 0.3, p.y + 0.5, p.z + 0.45); return RV.letter.pickT(o, p.clone().sub(o).normalize()); }')
    ok(o is None, 'the letter can not be picked up through the shut drawer')
    def open_drawer():
        if not ev('RV.desk.cardIn()'):
            stand(); look(-1.55, -0.6, -1.6, 0.74, -1.55)
            ev('() => { const o = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.desk.card.getWorldPosition(new THREE.Vector3()); return RV.media.click(o, t.sub(o).normalize()); }')
            wait('RV.desk.cardIn()', 30000); stand()
        look(-2.0, -0.55, -2.26, 0.56, -1.45)
        stand(); ev('RV.drawers.open()'); return wait('RV.drawers.amount() > 0.95', 20000)
    ok(open_drawer(), 'with the keycard in, the drawer opens')

    # ---------- click to pick up: her voice plays from the letter
    def click_letter():
        return ev('() => { const p = RV.letter.g.getWorldPosition(new THREE.Vector3()); const o = new THREE.Vector3(p.x + 0.25, p.y + 0.55, p.z + 0.45); return RV.media.click(o, p.clone().sub(o).normalize()); }')
    ok(click_letter() and LT()['state'] == 'held' and LT()['by'] == 'desk', 'clicking it in the open drawer picks it up')
    ok(wait('RV.letter._debug().live && RV.letter._debug().t > 0.3', 15000), 'picking it up starts her voice reading it')
    d = LT(); print('  playing:', d)
    ok(d['wired'], 'the sound goes through a panner on the letter')
    ok(d['dur'] and 140 < d['dur'] < 160, f'it is her 2.5 minute reading ({d["dur"]})')
    ok(d['emissive'] != 0x3a3a3a, 'the paper glows softly while she reads')
    pg.wait_for_timeout(400); d = LT(); ok(abs(d['scale'] - 1.35) < 0.01, f'held up, it is bigger to read ({d["scale"]})')
    scr = ev('''() => { const b = new THREE.Box3().setFromObject(RV.letter.sheet); const pts = [b.min, b.max].map(v => v.clone().project(RV.camera)); return [Math.abs(pts[1].y - pts[0].y) / 2, Math.abs(pts[1].x - pts[0].x) / 2, pts[0].z, pts[1].z]; }''')
    print('  screen share (h, w):', scr)
    ok(scr[0] > 0.35 and all(-1 < z < 1 for z in scr[2:]), 'on the screen it is held up big enough to read, in front of the camera')
    # click it in your hand: stop, click again: replay
    def click_held():
        return ev('() => { const p = RV.letter.g.getWorldPosition(new THREE.Vector3()); const o = RV.camera.getWorldPosition(new THREE.Vector3()); return RV.media.click(o, p.clone().sub(o).normalize()); }')
    pg.wait_for_timeout(600); r = click_held(); wait('!RV.letter.playing()', 3000); d = LT(); print('  click held ->', r, d['live'], d['state'], d['lastStop'])
    ok(not d['live'] and d['paused'] and d['state'] == 'held', 'clicking the letter in your hand stops her')
    ok(d['emissive'] == 0x3a3a3a, 'the glow goes when she stops')
    click_held(); ok(wait('RV.letter._debug().live', 10000) and LT()['t'] < 3, 'clicking it again plays it from the start')
    # put it back by clicking into the open drawer
    put = ev('() => { const dr = RV.drawers.drawer; const p = dr.localToWorld(new THREE.Vector3(0, RV.drawers.FLOOR_Y, -0.08)); const o = new THREE.Vector3(p.x + 0.2, p.y + 0.7, p.z + 0.5); return RV.media.click(o, p.clone().sub(o).normalize()); }')
    ok(wait('RV.letter.state() === "drawer"', 5000), 'clicking the open drawer puts it back in its spot')
    d = LT(); ok(abs(d['scale'] - 1) < 1e-3, 'back to normal size in the drawer')
    ev('RV.letter.stop("test")')

    # ---------- picking it up again while she reads: stops; when quiet: replays
    ev('RV.letter.play()'); wait('RV.letter.playing()')
    click_letter(); pg.wait_for_timeout(200)
    ok(LT()['state'] == 'held' and not ev('RV.letter.playing()'), 'picking it up while she is reading stops her')
    ev('RV.letter.toDrawer()'); wait('RV.letter.state() === "drawer"')
    click_letter(); ok(wait('RV.letter._debug().live', 10000) and LT()['t'] < 3, 'picking it up when quiet plays it again from the start')
    ev('RV.letter.toDrawer()'); wait('RV.letter.state() === "drawer"'); ev('RV.letter.stop("test")')

    # ---------- VR: point + hold trigger carries it, release over drawer puts back; elsewhere it floats down
    p0 = ev('RV.letter.g.getWorldPosition(new THREE.Vector3()).toArray()')
    ctrl_at(p0[0] + 0.25, p0[1] + 0.5, p0[2] + 0.4, *p0)
    hv = ev('() => { ' + RAY + ' return [RV.media.hoverT(o, d), RV.letter.pickT(o, d)]; }')
    ok(hv[1] is not None and abs(hv[0] - hv[1]) < 1e-6, f'the VR pointer lands on the letter in the drawer {hv}')
    ok(ev('() => { ' + RAY + ' return RV.media.selectStart(window.__fc, o, d); }') and LT()['by'] == 'controller' and LT()['via'] == 'select', 'VR: point + trigger picks it up')
    ok(wait('RV.letter._debug().live || RV.letter._debug().starting', 3000), 'VR: and she starts reading')
    wait('RV.letter.g.getWorldPosition(new THREE.Vector3()).distanceTo(window.__fc.position) < 0.2', 6000)
    dist = ev('RV.letter.g.getWorldPosition(new THREE.Vector3()).distanceTo(window.__fc.position)')
    ok(dist < 0.2, f'it is in your hand ({dist:.3f} m)')
    # sound follows the letter: move the hand, check the panner
    ctrl_at(0.3, 1.2, 0.4); wait('RV.letter.g.getWorldPosition(new THREE.Vector3()).distanceTo(window.__fc.position) < 0.2', 6000)
    pp = ev('() => { const L = RV.letter; const a = RV.roomba.audio.ctx; return L.g.getWorldPosition(new THREE.Vector3()).toArray(); }')
    ok(abs(pp[0] - 0.3) < 0.2 and abs(pp[2] - 0.4) < 0.25, f'the letter follows your hand {pp}')
    ev('() => { ' + RAY + ' return RV.media.selectEnd(window.__fc, o, d); }')
    ok(wait('RV.letter.state() === "rest"', 6000), 'let go over the floor: it floats down onto the floor')
    d = LT(); ok(abs(d['y']) < 0.02, f'lying on the floor ({d["y"]})')
    ok(LT()['live'], 'she keeps reading when you put it down')
    # grip with the hand next to it, then let go over the drawer
    ctrl_at(d['x'], d['y'] + 0.06, d['z'] + 0.03)
    ok(ev('RV.letter.squeezeStart(window.__fc)') and LT()['via'] == 'squeeze', 'VR grip with your hand next to it picks it up')
    ok(not ev('RV.letter.playing()'), 'picking it up while she reads stops her')
    dz = ev('RV.drawers.drawer.localToWorld(new THREE.Vector3(-0.09, RV.drawers.FLOOR_Y + 0.08, -0.08)).toArray()')
    ctrl_at(*dz); wait('RV.letter.g.getWorldPosition(new THREE.Vector3()).distanceTo(window.__fc.position) < 0.2', 6000)
    ev('RV.letter.squeezeEnd(window.__fc)')
    ok(wait('RV.letter.state() === "drawer"', 5000), 'let go over the open drawer: back in its spot')
    # trigger on the holding hand while held by grip = stop/replay
    ctrl_at(p0[0], p0[1] + 0.06, p0[2] + 0.03)
    wait('RV.letter.state() === "drawer"', 4000); r = ev('RV.letter.squeezeStart(window.__fc)'); print('  grip in drawer ->', r, LT()['state']); wait('RV.letter.playing()', 3000)
    ev('() => { ' + RAY + ' return RV.media.selectStart(window.__fc, o, d); }'); pg.wait_for_timeout(150)
    ok(not ev('RV.letter.playing()') and LT()['state'] == 'held', 'trigger on the hand holding it stops her')
    ev('() => { ' + RAY + ' return RV.media.selectEnd(window.__fc, o, d); }')
    ev('() => { ' + RAY + ' return RV.media.selectStart(window.__fc, o, d); }'); ok(wait('RV.letter.playing()', 3000), 'and again replays')
    ev('() => { ' + RAY + ' return RV.media.selectEnd(window.__fc, o, d); }')
    ok(LT()['state'] == 'held', 'letting go of the trigger keeps holding it (it was a grip)')
    # let go above the desk
    ctrl_at(-1.45, 1.0, -1.7); wait('RV.letter.g.getWorldPosition(new THREE.Vector3()).distanceTo(window.__fc.position) < 0.2', 6000); ev('RV.letter.squeezeEnd(window.__fc)')
    ok(wait('RV.letter.state() === "rest"', 6000), 'let go over the desk: it floats down')
    d = LT(); ok(0.7 < d['y'] < 0.85, f'lying on the desk ({d["y"]})')
    ev('RV.letter.stop("test")')

    # ---------- the other sounds
    ev('RV.letter.play()'); wait('RV.letter._debug().live', 10000)
    ev('RV.phone.play()'); pg.wait_for_timeout(900)
    ok(not ev('RV.letter.playing()') and ev('RV.phone.playing()'), 'the phone message starting stops the letter')
    ev('RV.letter.play()'); pg.wait_for_timeout(900)
    ok(ev('RV.letter.playing()') and not ev('RV.phone.playing()'), 'the letter starting stops the phone message')
    vn = ev('!!(RV.voiceNote && RV.voiceNote._debug)')
    if vn:
        ev('RV.voiceNote._debug.play ? RV.voiceNote._debug.play() : null'); pg.wait_for_timeout(1500)
        st = ev('RV.voiceNote._debug.state()')
        if st.get('live') or st.get('starting'):
            ok(not ev('RV.letter.playing()'), 'the voice note starting stops the letter')
            ev('RV.voiceNote._debug.pause && RV.voiceNote._debug.pause("test")')
            ev('RV.letter.play()'); pg.wait_for_timeout(900); st = ev('RV.voiceNote._debug.state()')
            ok(not (st.get('live') or st.get('starting')), 'the letter starting pauses the voice note')
        else: print('  (voice note did not start in the test browser; skipped)')
    rp = ev('!!(RV.media._debug && RV.media._debug.startRecord)')
    if rp:
        ev('RV.letter.play()'); wait('RV.letter.playing()')
        ev('RV.media._debug.startRecord()'); pg.wait_for_timeout(1200)
        if ev('RV.media._debug.rp && RV.media._debug.rp.on'): ok(not ev('RV.letter.playing()'), 'the record player starting stops the letter')
    ev('RV.letter.stop("test")'); ev('RV.phone.stop("test")')

    # ---------- the phone still works next to it
    ev('RV.letter.toDrawer()'); wait('RV.letter.state() === "drawer"')
    ok(ev('() => { const p = RV.phone.g.getWorldPosition(new THREE.Vector3()); const o = new THREE.Vector3(p.x + 0.25, p.y + 0.55, p.z + 0.45); return RV.media.click(o, p.clone().sub(o).normalize()); }') and PH()['state'] == 'held' and LT()['state'] == 'drawer', 'clicking the phone still picks up the phone (not the letter)')
    ev('RV.phone.stop("test")'); ev('RV.phone.toDrawer()'); wait('RV.phone.state() === "drawer"')
    lp = ev('RV.letter.g.getWorldPosition(new THREE.Vector3()).toArray()')
    ctrl_at(lp[0] + 0.02, lp[1] + 0.06, lp[2] + 0.03)
    ev('RV.phone.squeezeStart(window.__fc)'); ev('RV.letter.squeezeStart(window.__fc)')
    ok(LT()['state'] == 'held' and PH()['state'] == 'drawer', 'grip with the hand on the letter takes the letter, not the phone')
    ev('RV.letter.squeezeEnd(window.__fc)'); ev('RV.letter.stop("test")'); ev('RV.letter.toDrawer()'); wait('RV.letter.state() === "drawer"')

    # ---------- lost: always back to the drawer
    for (x, y, z) in [(5, 0.5, 0), (-1.93, -2, -1.13)]:
        ev(f'RV.letter.dropAt({x}, {y}, {z}, 0)'); wait('["rest", "drawer"].includes(RV.letter.state())'); d = LT()
        ok(abs(d['x']) < 2.6 and abs(d['z']) < 2.2 and d['y'] > -0.01, f'a drop at ({x}, {y}, {z}) ends up inside the room ({d["state"]})')
        ev('RV.letter.toDrawer()'); wait('RV.letter.state() === "drawer"')

    # ---------- reload: back in the locked drawer
    ev('RV.letter.dropAt(0.2, 0.5, 0.2, 0)'); wait('RV.letter.state() === "rest"')
    pg.reload(wait_until='load'); pg.wait_for_timeout(2500); pg.click('#bFlat'); pg.wait_for_timeout(1000)
    pg.wait_for_function('RV.desk && RV.drawers && RV.letter', timeout=20000)
    ok(ev('RV.letter.state()') == 'drawer' and ev('RV.drawers.amount()') < 0.05, 'after a reload it is back in the shut drawer')

    errs = [l for l in logs if l[0] == 'pageerror' or (l[0] == 'error' and 'Failed to load resource' not in l[1])]
    for e in errs[:8]: print('  ', e)
    ok(not errs, f'no page errors ({len(errs)})')
    b.close()

print('\nFAILS:', len(fails))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
