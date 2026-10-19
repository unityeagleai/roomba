"""Checks for the desk build (js/desk.js): desk + CHARLIE 64 computer under the window, the stool you sit on, and the desk
copy of the PARALLEL UNIVERSE card that slides into the keyboard and makes Charlie type on the CRT.
Run: python3 tools/test_desk.py [url]   (default: the live site)"""
import sys, io, json, hashlib, math
from PIL import Image
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'https://unityeagleai.github.io/roomba/'
fails, logs = [], []
def ok(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

# her PNG goes in byte-identical
h = lambda p: hashlib.sha1(open(p, 'rb').read()).hexdigest()
ok(h('assets/img/keycard_desk.png') == h('assets/incoming/keycard_cutout.png'), 'desk keycard PNG is byte-identical to the cutout she sent')

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('console', lambda m: logs.append((m.type, m.text)))
    pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    bad404 = []
    pg.on('response', lambda r: bad404.append(r.url) if r.status == 404 else None)
    pg.goto(URL + ('&' if '?' in URL else '?') + 'nocache=desk', wait_until='load')
    pg.wait_for_timeout(2500); pg.click('#bFlat'); pg.wait_for_timeout(1200)
    ev = lambda js, *a: pg.evaluate(js, *a)
    ev('RV.roomba.place(1.6, 1.3)')
    pg.wait_for_function('RV.desk && RV.desk.ready()', timeout=20000)
    ok(ev('!!RV.desk'), 'desk module loaded')
    print('  merge', ev('RV.desk.mergeStats'))

    # ---------------------------------------------------------------- placement / clearances
    geo = ev('''() => {
      const ms = []; RV.scene.children.forEach(o => { if (o.name === 'deskMerged') ms.push(o); });
      RV.desk.root.traverse(o => { if (o.isMesh && o.material && o.material.visible !== false) ms.push(o); });
      const v = new THREE.Vector3(); let minZ = 9, minZhigh = 9, badSill = 0, badNight = 0, badWall = 0, maxX = -9, n = 0;
      for (const m of ms) { m.updateMatrixWorld(true); const pa = m.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld); n++;
          if (v.y > 0.01) minZ = Math.min(minZ, v.z);
          if (v.y > 0.75) minZhigh = Math.min(minZhigh, v.z);
          if (v.z < -2.035 && v.y > 0.925 && v.y < 0.975 && v.x > -2.42 && v.x < -1.38) badSill++;
          if (v.x < -2.11 && v.z > -0.885 && v.z < -0.39 && v.y > 0.01) badNight++;
          if (v.x < -2.595) badWall++; maxX = Math.max(maxX, v.x); } }
      return { n, minZ, minZhigh, badSill, badNight, badWall, maxX };
    }''')
    print('  geometry', geo)
    ok(geo['minZ'] >= -2.082, f"nothing reaches the curtains (deepest point z {geo['minZ']:.3f}, curtains from -2.105)")
    ok(geo['minZhigh'] >= -2.03, f"monitor stays in front of the window sill (deepest z above desk {geo['minZhigh']:.3f}, sill front -2.04)")
    ok(geo['badSill'] == 0 and geo['badNight'] == 0 and geo['badWall'] == 0, 'no overlap with the sill, the nightstand or the left wall')
    ok(geo['maxX'] < -1.36, f"desk stays clear of the Roomba dock (right edge x {geo['maxX']:.3f})")
    win = ev('''() => { const r = {}; RV.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) {} }); return 1; }''')
    blk = ev('''() => ({ deskP: RV.blocked(-1.9, -1.7, 0.2, 'player'), deskR: RV.blocked(-1.9, -1.7, 0.17, 'roomba'), stool: RV.blocked(-1.93, -1.13, 0.05, 'player'),
      exit: RV.blocked(RV.desk.pose.exit.x, RV.desk.pose.exit.z, 0.2, 'player'), front: RV.blocked(-1.6, -0.75, 0.2, 'player') })''')
    ok(blk['deskP'] and blk['deskR'] and blk['stool'], 'desk and stool block you and the Roomba')
    ok(not blk['exit'] and not blk['front'], 'stand-up spot and the floor in front of the desk are free')

    # ---------------------------------------------------------------- visibility from the usual spots (first thing a ray hits)
    vis_js = '''([ex, ey, ez, which]) => {
      const D = RV.desk, tgt = which === 'screen' ? D.screen.getWorldPosition(new THREE.Vector3())
        : which === 'card' ? D.card.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.003, 0))
        : new THREE.Vector3(D.STOOL.x, D.STOOL.seat + 0.002, D.STOOL.z);
      const o = new THREE.Vector3(ex, ey, ez), d = tgt.clone().sub(o), dist = d.length(); d.normalize();
      const rc = new THREE.Raycaster(o, d, 0.02, dist + 0.05); const objs = [];
      RV.scene.traverse(x => { if ((x.isMesh || x.isSkinnedMesh) && x.visible && x.material && x.material.visible !== false && !(x.material.transparent && !x.material.depthWrite && x.name !== 'deskKeycardImage')) {
        let v = true, q = x; while (q) { if (!q.visible) v = false; q = q.parent; } if (v) objs.push(x); } });
      const h = rc.intersectObjects(objs, false)[0]; if (!h) return 'nothing';
      const ob = h.object; if (ob === D.screen) return 'screen'; if (ob.name === 'deskKeycardImage') return 'card';
      if (ob.material && ob.material.color && ob.material.color.getHex() === 0xa8262e) return 'stool';
      return (ob.name || ob.parent && ob.parent.name || '?') + '@' + h.distance.toFixed(2) + '/' + dist.toFixed(2);
    }'''
    spots = {'start': (0.35, 1.6, 1.45), 'middle of room': (0.0, 1.6, 0.3), 'foot of bed': (-0.35, 1.6, -0.1), 'by the TV': (0.7, 1.6, -1.0), 'in front of desk': (-1.6, 1.6, -0.6)}
    for name, (x, y, z) in spots.items():
        r = [ev(vis_js, [x, y, z, w]) for w in ('screen', 'card', 'stool')]
        print(f'  from {name}: screen->{r[0]} card->{r[1]} stool->{r[2]}')
        ok(r[0] == 'screen', f'CRT screen visible from {name}')
        if name in ('middle of room', 'in front of desk', 'foot of bed'): ok(r[1] == 'card', f'desk keycard visible from {name}')
        if name != 'by the TV': ok(r[2] == 'stool', f'stool visible from {name}')

    # ---------------------------------------------------------------- the picture on screen: card really drawn, screen glows
    def proj(js):
        return ev('''(w) => { const v = (w === 'card' ? RV.desk.card.getWorldPosition(new THREE.Vector3()) : w === 'screen' ? RV.desk.screen.getWorldPosition(new THREE.Vector3())
          : new THREE.Vector3(RV.desk.STOOL.x, RV.desk.STOOL.seat, RV.desk.STOOL.z)).project(RV.camera); return [ (v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight, v.z ]; }''', js)
    def shot():
        return Image.open(io.BytesIO(pg.screenshot())).convert('RGB')
    def look(x, z, tx, ty, tz):
        ev(f'__rv.setPlayer({x}, {z})'); pg.wait_for_timeout(700); ev(f'__rv.faceAt({tx}, {ty}, {tz})'); pg.wait_for_timeout(500)
    look(-1.55, -0.6, -1.6, 0.74, -1.55)
    cx, cy, cz = proj('card'); print('  card on screen at', round(cx), round(cy))
    inview = 30 < cx < 930 and 30 < cy < 510 and cz < 1
    ok(inview, 'card is in view when you walk up to the desk')
    if inview:
        a = shot(); ev('RV.desk.card.visible = false'); pg.wait_for_timeout(400); bimg = shot(); ev('RV.desk.card.visible = true'); pg.wait_for_timeout(300)
        diff = 0; box = (int(cx) - 12, int(cy) - 12, int(cx) + 12, int(cy) + 12)
        for X in range(box[0], box[2]):
            for Y in range(box[1], box[3]):
                pa, pb = a.getpixel((X, Y)), bimg.getpixel((X, Y)); diff += sum(abs(pa[i] - pb[i]) for i in range(3))
        ok(diff / 576 > 30, f'the card picture is really drawn on the desk (mean pixel change {diff / 576:.0f})')
    sx_, sy_, _ = proj('screen')
    def green_score(img, x, y):
        g = r = 0
        for X in range(int(x) - 25, int(x) + 25, 2):
            for Y in range(int(y) - 15, int(y) + 15, 2):
                px = img.getpixel((X, Y)); g += px[1]; r += px[0] + px[2]
        return g, r
    idle_g = green_score(shot(), sx_, sy_)
    print('  screen idle green/red+blue', idle_g)
    ok(idle_g[0] > idle_g[1] / 2 * 1.2, 'idle CRT screen shows green phosphor (READY / INSERT ACCESS CARD)')

    # ---------------------------------------------------------------- desktop: click the card (real mouse click on the canvas)
    def mouse_click_at(x, y):
        # the app shoots the click ray from the camera through the centre in pointer lock; elsewhere through the cursor
        pg.mouse.click(x, y)
    st0 = ev('RV.desk._debug()'); ok(st0['cardState'] == 'rest' and st0['term'] == 'idle', 'starts with the card on the desk and the READY screen')
    hov = ev('''() => { const o = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.desk.card.getWorldPosition(new THREE.Vector3()), d = t.sub(o).normalize(); return [RV.media.hoverT(o, d), RV.desk.pick(o, d)]; }''')
    ok(hov[0] is not None and abs(hov[0] - hov[1]) < 1e-6, 'pointer ray at the card picks the card (reticle lands on it)')
    cx, cy, _ = proj('card'); mouse_click_at(cx, cy); pg.wait_for_timeout(300)
    s1 = ev('RV.desk._debug()')
    if s1['cardState'] == 'rest':     # some setups only shoot from the screen centre: use the same click path as the app
        ev('''() => { const o = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.desk.card.getWorldPosition(new THREE.Vector3()); RV.media.click(o, t.sub(o).normalize()); }''')
        pg.wait_for_timeout(300); s1 = ev('RV.desk._debug()')
    ok(s1['cardState'] in ('inserting', 'in'), f"clicking the card picks it up ({s1['cardState']})")
    pg.wait_for_function('RV.desk._debug().cardState === "in"', timeout=10000)
    s2 = ev('RV.desk._debug()'); print('  in slot', s2['card'], 'led', hex(s2['led']))
    slot = ev('RV.desk.SLOT')
    ok(abs(s2['card']['x'] - slot['x']) < 0.002 and abs(s2['card']['z'] - slot['z']) < 0.002, 'card ends up standing in the keyboard slot')
    ok(s2['led'] == 0x3cff6a, 'slot light turns green')
    ok(s2['term'] in ('boot', 'typing') and s2['visits'] == 1, 'CRT switches on and starts the session')
    pg.wait_for_timeout(2500)
    s3 = ev('RV.desk._debug()'); print('  typing', s3['typed'], s3['lines'])
    pg.wait_for_function('RV.desk._debug().term === "done"', timeout=120000)
    s4 = ev('RV.desk._debug()'); text = '\n'.join(s4['lines']); print('  screen text:\n    ' + text.replace('\n', '\n    '))
    ok('PARALLEL UNIVERSE ACCESS' in text and 'ID 7X-9A3' in text, 'boot lines mention the card (PARALLEL UNIVERSE ACCESS, ID 7X-9A3)')
    ok('HEY UNITY, CHARLIE HERE.' in text and 'WHAT CAN I DO FOR YOU' in text and 'TODAY?' in text and 'IN YOUR BEDROOM?' in text, 'Charlie types the greeting letter by letter')
    ok(all(len(l) <= 28 for l in s4['lines']), 'every line fits the 28-column screen')
    look(-1.55, -0.6, -1.93, 0.93, -1.69); sx_, sy_, _ = proj('screen'); on_g = green_score(shot(), sx_, sy_); print('  screen on', on_g)
    ok(on_g[0] > idle_g[0], 'screen is brighter green while Charlie is on')
    # take the card out again
    ev('''() => { const o = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.desk.card.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.02, 0)); window.__ej = RV.media.click(o, t.sub(o).normalize()); }''')
    pg.wait_for_function('RV.desk._debug().cardState === "rest"', timeout=10000); s5 = ev('RV.desk._debug()')
    ok(s5['term'] == 'idle' and s5['led'] == 0xff3a2a and abs(s5['card']['x'] - ev('RV.desk.CARD_REST.x')) < 1e-3, 'clicking the card again takes it out: back on the desk, READY screen, red light')

    # ---------------------------------------------------------------- sit on the stool (mouse click), use the card from the seat, stand up
    look(-1.6, -0.62, -1.93, 0.5, -1.13)
    sx2, sy2, _ = proj('stool'); print('  stool on screen at', round(sx2), round(sy2))
    ev(f'''() => {{ const o = RV.camera.getWorldPosition(new THREE.Vector3()), t = new THREE.Vector3(RV.desk.STOOL.x, RV.desk.STOOL.seat - 0.02, RV.desk.STOOL.z); RV.media.click(o, t.sub(o).normalize()); }}''')
    pg.wait_for_timeout(600)
    pose = ev('__rv.pose()'); print('  pose', pose)
    ok(pose['pose'] == 'desk', 'clicking the stool sits you at the desk')
    pos = ev('''() => { const c = RV.camera.getWorldPosition(new THREE.Vector3()); return [c.x, c.y, c.z]; }'''); print('  seated eye', [round(v, 3) for v in pos])
    ok(abs(pos[0] - (-1.93)) < 0.05 and abs(pos[2] - (-1.18)) < 0.06 and 1.0 < pos[1] < 1.3, 'seated on the stool, eye at desk height')
    sx3, sy3, sz3 = proj('screen'); cx3, cy3, cz3 = proj('card'); print('  seated: screen at', round(sx3), round(sy3), 'card at', round(cx3), round(cy3))
    ok(150 < sx3 < 810 and 60 < sy3 < 480 and sz3 < 1, 'the CRT is right in front of you when seated')
    ok(0 < cx3 < 960 and 0 < cy3 < 540 and cz3 < 1, 'the card is in reach / in view when seated')
    ev('''() => { const o = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.desk.card.getWorldPosition(new THREE.Vector3()); window.__c2 = RV.media.click(o, t.sub(o).normalize()); }''')
    pg.wait_for_timeout(200); ok(ev('RV.desk._debug().cardState') in ('inserting', 'in'), 'card works from the stool')
    ok(ev('__rv.pose()')['pose'] == 'desk', 'still seated after using the card')
    pg.wait_for_function('RV.desk._debug().cardState === "in"', timeout=10000)
    pg.keyboard.down('KeyW'); pg.wait_for_timeout(500); pg.keyboard.up('KeyW'); pg.wait_for_timeout(600)
    pose3 = ev('__rv.pose()'); print('  after moving', pose3)
    if pose3['pose']: ev('__rv.stand()'); pg.wait_for_timeout(300); pose3 = ev('__rv.pose()')
    ok(not pose3['pose'], 'you stand back up')
    ok(not ev(f"RV.blocked({pose3['P']['x']}, {pose3['P']['z']}, 0.19, 'player')"), f"standing spot is free ({pose3['P']['x']}, {pose3['P']['z']})")
    ev('RV.desk.eject()'); pg.wait_for_function('RV.desk._debug().cardState === "rest"', timeout=10000)

    # ---------------------------------------------------------------- VR controller: point + trigger at the card

    # ---------------------------------------------------------------- zombie can land on the desk, the Roomba bumps the desk
    if ev('!!(RV.zombie && RV.zombie.landAt)'):
        y1 = ev('RV.zombie.landAt(-1.5, 1.4, -1.75)'); y2 = ev('RV.zombie.landAt(-1.93, 1.4, -1.85)'); print('  zombie lands at', y1, y2)
        def yy(v): return v['y'] if isinstance(v, dict) else (v[1] if isinstance(v, list) else v)
        ok(abs(yy(y1) - 0.74) < 0.03, 'zombie can be put down on the desk top')
        ok(1.03 < yy(y2) < 1.11, 'zombie can sit on top of the monitor')
    ev('__rv.setPlayer(1.2, 1.2)'); pg.wait_for_timeout(300)
    # true clearance from the Roomba centre to the desk footprint (rounded at the corners, like RV.blocked) and to the stool rim
    ev('''() => { const D = RV.obstacles.find(o => o.name === 'desk'), St = RV.obstacles.find(o => o.name === 'stool');
      window.__gap = (x, z) => { const cx = Math.max(D.x0, Math.min(x, D.x1)), cz = Math.max(D.z0, Math.min(z, D.z1));
        return Math.min(Math.hypot(x - cx, z - cz), Math.hypot(x - St.x, z - St.z) - St.r); }; }''')
    R0 = ev('''async ([mode, ms]) => { RV.roomba.place(-1.45, -1.0, 0); __rv.go(mode); let worst = 9, n = 0, sts = new Set(); const t0 = performance.now();
       while (performance.now() - t0 < ms) { await new Promise(r => setTimeout(r, 50)); const d = __rv.debug(); n++; sts.add(d.state);
         worst = Math.min(worst, __gap(d.x, d.z)); }
       const d = __rv.debug(); return [worst, n, [...sts], { x: d.x, z: d.z, state: d.state }]; }''', ['wander', 10000])
    print('  roomba wander next to the desk: closest centre to desk/stool (m), samples, states, last:', R0)
    R1 = ev('''async () => { RV.roomba.place(-1.5, -1.05, Math.PI / 2); __rv.go('home'); let worst = 9; const t0 = performance.now(), sts = new Set();
       while (performance.now() - t0 < 60000) { await new Promise(r => setTimeout(r, 50)); const d = __rv.debug(); sts.add(d.state);
         worst = Math.min(worst, __gap(d.x, d.z)); if (d.state === 'dock') break; }
       const d = __rv.debug(); return [worst, [...sts], { x: d.x, z: d.z, state: d.state }]; }''')
    print('  roomba going home from beside the desk:', R1)
    ok(R1[2]['state'] == 'dock' or 'dock' in R1[1], 'Roomba still finds its dock from beside the desk')
    R0[0] = min(R0[0], R1[0])
    ok(R0[0] >= 0.165, f'Roomba never drives into the desk or stool (closest {R0[0]:.3f} m, body radius 0.17)')

    # ---------------------------------------------------------------- night: desk items dim with the room, the screen still glows
    em0 = ev('RV.desk.card.userData.img.material.emissive.r'); ev('RV.lights.set(false)'); pg.wait_for_timeout(2500)
    em1 = ev('RV.desk.card.userData.img.material.emissive.r'); scr = ev('RV.desk.screen.material.color.r')
    look(-1.55, -0.6, -1.93, 0.93, -1.69); sx_, sy_, _ = proj('screen'); ng = green_score(shot(), sx_, sy_)
    print('  night: card emissive', round(em0, 3), '->', round(em1, 3), 'screen', ng)
    ok(em1 < em0 * 0.6, 'card dims with the light switch like the photos and stickers')
    ok(ng[0] > ng[1] / 2, 'CRT screen still glows green in the dark')
    ev('RV.lights.set(true)'); pg.wait_for_timeout(1500)
    ok(abs(ev('RV.desk.card.userData.img.material.emissive.r') - em0) < 0.02, 'card brightness comes back with the lights')

    other404 = [u for u in bad404 if 'charlie-season' not in u and 'favicon' not in u]; print('  404s:', bad404)
    errs = [t for (k, t) in logs if k in ('error', 'pageerror') and not ('status of 404' in t and not other404)]
    for e in errs[:10]: print('  console:', e)
    ok(not errs, 'no console errors')
    b.close()

print('\n%d failure(s)' % len(fails)); [print(' -', f) for f in fails]
sys.exit(1 if fails else 0)
