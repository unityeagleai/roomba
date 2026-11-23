"""Desktop test for the message board (js/board.js + notes.json): it hangs on the left wall between the photo wall and the
UNITY EAGLE poster, flat on the wall and clear of everything else; notes.json loads (Charlie's welcome note + Unity's and
Miles's empty spots); a real mouse click on Charlie's note plays his voice from the board, a second click stops it; a click
on an empty spot only wiggles; a VR-style selectStart (controller ray from 1.6 m away) plays it too; the boombox starting
stops the note and a note starting pauses the boombox; with 12 temporary notes the board shows the newest 9, newest top
left (temporary test data only, put back afterwards). Usage: python3 tools/test_board.py URL OUTDIR"""
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_context(viewport={'width': 960, 'height': 540}).new_page()
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('response', lambda r: res['console'].append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(3500)
    pg.click('#bFlat'); pg.wait_for_timeout(1500)
    ev = lambda js: pg.evaluate(js)
    st = lambda: ev('RV.board._debug.state()')
    real = lambda ms: pg.wait_for_timeout(ms)
    ev('RV.help.hide()')
    res['checks']['load'] = st()
    res['checks']['geometry'] = ev('''(() => { RV.scene.updateMatrixWorld(true); const f = a => a.toArray().map(x => +x.toFixed(3));
      const mine = new Set(); RV.board.root.traverse(o => mine.add(o)); const B = new THREE.Box3().setFromObject(RV.board.root); const hits = [];
      RV.scene.traverse(o => { if (!o.isMesh || mine.has(o) || !o.visible) return; const bx = new THREE.Box3().setFromObject(o); if (bx.isEmpty()) return; const s = bx.getSize(new THREE.Vector3());
        if (s.x > 4 || s.z > 4 || s.y > 2.5) return; if (bx.intersectsBox(B)) hits.push([o.name || (o.parent && o.parent.name) || o.geometry.type, o.material && o.material.transparent ? 'transparent' : 'solid', f(bx.min), f(bx.max)]); });
      return { box: [f(B.min), f(B.max)], wallX: -RV.room.RX, hits }; })()''')
    # stand in front of the board, look at it
    ev('__rv.setPlayer(-1.4,-0.82,0)'); real(200); ev('__rv.faceAt(-2.6,1.5,-0.82)'); real(900)
    scr = lambda i: ev(f'''(() => {{ const s = RV.board.slots[{i}]; const v = s.mesh.getWorldPosition(new THREE.Vector3()).project(RV.camera);
        const r = RV.renderer.domElement.getBoundingClientRect(); return {{ x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }}; }})()''')
    pg.screenshot(path=f'{OUT}/01_board.png')
    P0 = scr(0); pg.mouse.click(P0['x'], P0['y']); real(900)
    s = st(); res['checks']['click_charlie_plays'] = s
    pg.screenshot(path=f'{OUT}/02_playing.png')
    pg.mouse.click(P0['x'], P0['y']); real(600); res['checks']['click_again_stops'] = st()
    P1 = scr(1); pg.mouse.click(P1['x'], P1['y']); real(150); res['checks']['click_placeholder_wiggles'] = st()
    real(800)
    # boombox vs note
    pg.mouse.click(P0['x'], P0['y']); real(1500)
    ev('RV.tape.insert()'); real(3500)
    res['checks']['boombox_stops_note'] = dict(st(), tape=ev('RV.tape.playing()'))
    pg.mouse.click(P0['x'], P0['y']); real(1500)
    res['checks']['note_pauses_boombox'] = dict(st(), tape=ev('RV.tape.playing()'))
    ev('RV.board._debug.stop("test")'); real(300)
    # VR-style: controller ray from 1.6 m away
    ev('__rv.setPlayer(-1.0,-0.6,0)'); real(200); ev('__rv.faceAt(-2.6,1.5,-0.82)'); real(500)
    r = ev('''(() => { const c = RV.camera.getWorldPosition(new THREE.Vector3()); c.y -= 0.35; c.x -= 0.15; const t = RV.board.slots[0].mesh.getWorldPosition(new THREE.Vector3());
        const dist = +t.distanceTo(c).toFixed(2); const d = t.clone().sub(c).normalize(); const ctl = new THREE.Object3D(); RV.scene.add(ctl);
        const hov = RV.media.hoverT(c, d); return { dist, hover: hov == null ? null : +hov.toFixed(2), handled: RV.media.selectStart(ctl, c, d) }; })()'''); real(2200)
    res['checks']['vr_select_plays'] = dict(r, **st())
    # edge of the note (8 cm off centre) still hits: tremor-friendly target
    r = ev('''(() => { RV.board._debug.stop('test'); const c = RV.camera.getWorldPosition(new THREE.Vector3()); const s = RV.board.slots[0]; const t = s.mesh.localToWorld(new THREE.Vector3(0.088, -0.088, 0));
        return RV.board._debug.pick(c, t.sub(c).normalize()); })()''')
    res['checks']['corner_pick'] = r
    ev('RV.board._debug.stop("test")'); real(300)
    # layout with 12 temporary notes (not saved anywhere)
    ev('''RV.board._debug.setNotes(Array.from({length: 12}, (_, i) => ({ author: ['unity','miles','charlie','visitor'][i % 4], date: '2026-12-' + String(i + 1).padStart(2, '0'),
        text: i % 3 ? 'Test note number ' + (i + 1) + '.' : 'Test note number ' + (i + 1) + ', a longer one to check that the text shrinks to fit and still stays inside the paper without spilling.', audio: i % 2 ? 'assets/audio/notes/charlie_welcome.mp3' : '' })))''')
    real(900)
    res['checks']['many_notes'] = ev('''(() => ({ shown: RV.board.shown, count: RV.board.slots.length, first: RV.board.slots[0].n.date, last: RV.board.slots[RV.board.slots.length - 1].n.date,
        insideCork: RV.board.slots.every(s => { const B = new THREE.Box3().setFromObject(s.mesh); const C = new THREE.Box3().setFromObject(RV.board.root.children[0]); return B.min.y >= C.min.y - 0.002 && B.max.y <= C.max.y + 0.002 && B.min.z >= C.min.z - 0.002 && B.max.z <= C.max.z + 0.002; }) }))()''')
    ev('__rv.setPlayer(-1.4,-0.82,0)'); real(200); ev('__rv.faceAt(-2.6,1.5,-0.82)'); real(900)
    pg.screenshot(path=f'{OUT}/03_many_notes.png')
    ev('RV.board.load()'); real(1200)
    res['checks']['restored'] = st()['shown']
    b.close()
print(json.dumps(res, indent=1))
