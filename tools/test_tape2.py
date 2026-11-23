"""Desktop test for the second cassette ('Signal & Static ep.1') next to the silver boombox: both cassettes on the shelf,
clear of other props and standing on the shelf board; click the podcast cassette, then the boombox: it slides in and the
podcast plays; clicking the Roomba cassette while the podcast is in the deck sends the podcast home and picks up the
Roomba one; it plays the Roomba song; swapping back resumes the podcast where it was; EJECT / PLAY still work; a VR-style
selectStart on a cassette grabs it. Usage: python3 tools/test_tape2.py URL OUTDIR"""
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
    st = lambda: ev('RV.tape._debug()')
    real = lambda ms: pg.wait_for_timeout(ms)
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(80)
    res['checks']['load'] = st()
    res['checks']['geometry'] = ev('''(() => { RV.scene.updateMatrixWorld(true); const f = a => a.toArray().map(x => +x.toFixed(3)); const out = {};
      const mine = new Set(); for (const T of RV.tape.TAPES) T.cs.traverse(o => mine.add(o)); RV.tape.bb.traverse(o => mine.add(o));
      for (const T of RV.tape.TAPES) { const B = new THREE.Box3().setFromObject(T.cs.children[0]); const hits = [];
        RV.scene.traverse(o => { if (!o.isMesh || mine.has(o) || !o.visible) return; const bx = new THREE.Box3().setFromObject(o); if (bx.isEmpty()) return; const s = bx.getSize(new THREE.Vector3()); if (s.x > 4 || s.z > 4 || s.y > 2.5) return; if (bx.intersectsBox(B)) hits.push([o.name || (o.parent && o.parent.name) || o.geometry.type, f(bx.min), f(bx.max)]); });
        // what is under its centre / its two bottom corners
        const rc = new THREE.Raycaster(); rc.camera = RV.camera; const under = [];
        for (const dx of [-0.045, 0, 0.045]) { const o = T.cs.localToWorld(new THREE.Vector3(dx, 0, 0)); rc.set(o, new THREE.Vector3(0, -1, 0)); rc.far = 0.2;
          const h = rc.intersectObjects(RV.scene.children, true).filter(i => !mine.has(i.object) && i.object.visible && !(i.object.material && i.object.material.visible === false))[0];
          under.push(h ? [h.object.name || (h.object.parent && h.object.parent.name) || h.object.geometry.type, +(o.y - h.point.y).toFixed(3)] : null); }
        out[T.id] = { box: [f(B.min), f(B.max)], overlaps: hits, under }; }
      const a = new THREE.Box3().setFromObject(RV.tape.TAPES[0].cs.children[0]), c = new THREE.Box3().setFromObject(RV.tape.TAPES[1].cs.children[0]); out.tapesOverlap = a.intersectsBox(c);
      return out; })()''')
    # look at the middle of the boombox + cassette row, wherever it stands (moved to the lower board on Nov 23)
    C = ev('(() => { const b = RV.tape.bb.position, t = RV.tape.TAPES[0].HOME_P; return [(b.x + t.x) / 2, b.y + 0.11, b.z]; })()')
    FACE = f'__rv.faceAt({C[0]:.3f}, {C[1]:.3f}, {C[2]:.3f})'
    for i, (x, z, tag) in enumerate([(1.6, -0.9, 'close'), (0.35, 1.45, 'from_start'), (2.1, -1.35, 'very_close')]):
        ev(f'__rv.setPlayer({x}, {z}, 0)'); W(150); ev(FACE); W(500); pg.screenshot(path=f'{OUT}/0{i}_{tag}.png')
    ev('__rv.setPlayer(2.0, -1.1, 0)'); W(150); ev(FACE); W(400)
    def at(js):
        return ev('(() => { const c = new THREE.Vector3(); (' + js + ').getWorldPosition(c); return __rv.projectPt(c.x, c.y, c.z); })()')
    P_pod = at('RV.tape.TAPES[1].cs'); P_rm = at('RV.tape.TAPES[0].cs')
    P_box = ev('(() => { const c = RV.tape.bb.localToWorld(new THREE.Vector3(0.15, 0.09, 0.06)); return __rv.projectPt(c.x, c.y, c.z); })()')
    res['checks']['screen_pts'] = [P_pod, P_rm, P_box]
    pg.mouse.click(P_pod['x'], P_pod['y']); real(700); res['checks']['click_podcast'] = st(); pg.screenshot(path=f'{OUT}/03_holding_podcast.png')
    pg.mouse.click(P_box['x'], P_box['y']); real(3500); s = st(); res['checks']['podcast_playing'] = dict(s, src=ev('RV.tape.audio.currentSrc'))
    pg.screenshot(path=f'{OUT}/04_podcast_in_deck.png')
    real(2500); res['checks']['podcast_advancing'] = st()
    # the Roomba cassette while the podcast is in the deck
    pg.mouse.click(P_rm['x'], P_rm['y']); real(900); res['checks']['click_roomba_swap'] = dict(st(), podPos=ev('RV.tape.TAPES[1].pos'), podAtHome=ev('RV.tape.TAPES[1].cs.position.distanceTo(RV.tape.TAPES[1].HOME_P) < 0.002'))
    W(1200); res['checks']['pod_home_after_swap'] = ev('({ d: +RV.tape.TAPES[1].cs.position.distanceTo(RV.tape.TAPES[1].HOME_P).toFixed(4), homing: RV.tape._debug().homing })')
    pg.mouse.click(P_box['x'], P_box['y']); real(3500); res['checks']['roomba_playing'] = dict(st(), src=ev('RV.tape.audio.currentSrc'))
    # eject + play still fine
    ev('RV.tape.press("eject")'); real(600); res['checks']['eject'] = st()
    ev('RV.tape.press("play")'); real(1500); res['checks']['play_after_eject'] = st()
    # VR-style select on the podcast cassette: grabs it, Roomba goes home
    r = ev('''(() => { const c = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.tape.TAPES[1].cs.getWorldPosition(new THREE.Vector3()); const d = t.sub(c).normalize(); const ctl = new THREE.Object3D(); RV.scene.add(ctl); window.__ctl = ctl;
        return { handled: RV.media.selectStart(ctl, c, d) }; })()'''); real(900)
    res['checks']['vr_select_podcast'] = dict(r, **st(), rmAtHome=ev('RV.tape.TAPES[0].cs.position.distanceTo(RV.tape.TAPES[0].HOME_P) < 0.002'))
    W(1200); res['checks']['rm_home_after_grab'] = ev('({ d: +RV.tape.TAPES[0].cs.position.distanceTo(RV.tape.TAPES[0].HOME_P).toFixed(4), homing: RV.tape._debug().homing })')
    # release at the boombox (ray pointed at it): goes in and resumes where it was
    ev('''(() => { const c = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.tape.bb.localToWorld(new THREE.Vector3(0.15, 0.09, 0.06)); RV.media.selectEnd(window.__ctl, c, t.sub(c).normalize()); })()'''); W(1500); real(2500)
    res['checks']['vr_release_resume'] = dict(st(), src=ev('RV.tape.audio.currentSrc'))
    pg.screenshot(path=f'{OUT}/05_end.png')
    res['checks']['labels'] = ev('RV.tape.TAPES.map(T => T.label.titleA)')
    b.close()
print(json.dumps(res, indent=1))
