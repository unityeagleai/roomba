"""Desktop test for Unity's voice note screen + Vocial link card on the left wall above the cartridge shelf: placement clear of
the photo wall, cartridge shelf, socials poster and door; nothing blocks it from the usual spots; still + play icon at rest, no
autoplay; a real mouse click plays it with sound through a panner, click pauses, click resumes, the end goes back to the still;
a VR-style selectStart ray toggles it; it and the origin frame / keycard poster pause each other; the card is a plain note:
clicking it (mouse or VR ray) opens no tab, shows no overlay and leaves the video alone; the light switch dims the bezel and
card; floor clicks unchanged. Usage: python3 tools/test_voicenote.py URL OUTDIR"""
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 960, 'height': 540})
    pg = ctx.new_page()
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('response', lambda r: res['console'].append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(3500)
    pg.click('#bFlat'); pg.wait_for_timeout(1500)
    ev = lambda js: pg.evaluate(js)
    st = lambda: ev('RV.voiceNote._debug.state()')
    real = lambda ms: pg.wait_for_timeout(ms)
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(80)
    res['checks']['no_autoplay_after_load'] = st()
    res['checks']['geometry'] = ev('''(() => { const V = RV.voiceNote; RV.scene.updateMatrixWorld(true); const f = a => a.toArray().map(x => +x.toFixed(3));
        const sb = new THREE.Box3().setFromObject(V.scr), cb = new THREE.Box3().setFromObject(V.card);
        // everything else in the scene that overlaps either box (excluding my own meshes and huge room shells)
        const mine = new Set(); V.root.traverse(o => mine.add(o)); const hits = [];
        RV.scene.traverse(o => { if (!o.isMesh || mine.has(o) || !o.visible) return; const bx = new THREE.Box3().setFromObject(o); if (bx.isEmpty()) return; const s = bx.getSize(new THREE.Vector3()); if (s.x > 4 || s.z > 4 || s.y > 2.5) return;
          for (const [n, B] of [['screen', sb], ['card', cb]]) if (bx.intersectsBox(B)) hits.push([n, o.name || (o.parent && o.parent.name) || o.geometry.type, f(bx.min), f(bx.max)]); });
        return { screen: [f(sb.min), f(sb.max)], card: [f(cb.min), f(cb.max)], overlaps: hits, gapScreenCard: +(sb.min.y - cb.max.y).toFixed(3), wallX: -RV.room.RX }; })()''')
    # line of sight from the usual spots to the card and screen centres: first thing hit must be mine
    sight = {}
    for name, (x, z) in {'start': (0.35, 1.45), 'middle': (0.0, 0.2), 'foot_of_bed': (-0.9, 0.9), 'by_door': (-1.4, 1.6), 'beanbag': (1.5, 1.2), 'by_tv': (0.6, -1.2)}.items():
        ev(f'__rv.setPlayer({x}, {z}, 0)'); W(120)
        sight[name] = ev('''(() => { const V = RV.voiceNote, cam = RV.camera, h = cam.getWorldPosition(new THREE.Vector3()), out = {}; const rc = new THREE.Raycaster(); rc.camera = cam;
          for (const [n, m] of [['card', V.card], ['screen', V.img]]) { const c = m.getWorldPosition(new THREE.Vector3()); const d = c.clone().sub(h); const L = d.length(); d.normalize(); rc.set(h, d); rc.far = L + 0.05;
            const hit = rc.intersectObjects(RV.scene.children, true).filter(i => i.object.visible && !(i.object.material && i.object.material.visible === false))[0];
            let o = hit && hit.object, isMine = false; while (o) { if (o === V.root) { isMine = true; break; } o = o.parent; }
            out[n] = { clear: isMine, first: hit ? (hit.object.name || hit.object.geometry.type) : null, dist: +L.toFixed(2) }; } return out; })()''')
    res['checks']['line_of_sight'] = sight
    # screenshots
    for i, (x, z, tag) in enumerate([(-0.6, 1.0, 'close'), (0.35, 1.45, 'from_start'), (0.6, 0.0, 'from_middle'), (-1.9, 1.35, 'very_close')]):
        ev(f'__rv.setPlayer({x}, {z}, 0)'); W(150); ev('__rv.faceAt(-2.6, 1.52, 1.42)'); W(500); pg.screenshot(path=f'{OUT}/0{i}_{tag}.png')
    # click to play
    ev('__rv.setPlayer(-1.2, 1.4, 0)'); W(150); ev('__rv.faceAt(-2.6, 1.55, 1.42)'); W(400)
    pt = ev('(() => { const c = new THREE.Vector3(); RV.voiceNote.img.getWorldPosition(c); return __rv.projectPt(c.x, c.y, c.z); })()')
    pg.mouse.click(pt['x'], pt['y']); real(2500); res['checks']['after_click_2_5s'] = st(); pg.screenshot(path=f'{OUT}/05_playing.png')
    pg.mouse.click(pt['x'], pt['y']); real(800); s1 = st(); real(1200); s2 = st(); res['checks']['click_pauses'] = {'a': s1, 'b': s2, 'held': abs(s1['t'] - s2['t']) < 0.05}
    pg.mouse.click(pt['x'], pt['y']); real(1500); res['checks']['click_resumes'] = st()
    res['checks']['vr_select_pauses'] = ev('''(() => { const c = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.voiceNote.img.getWorldPosition(new THREE.Vector3()); const d = t.sub(c).normalize();
        return { handled: RV.media.selectStart({}, c, d), state: RV.voiceNote._debug.state() }; })()''')
    ev('''(() => { const c = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.voiceNote.img.getWorldPosition(new THREE.Vector3()); RV.media.selectStart({}, c, t.sub(c).normalize()); })()'''); real(1200)
    res['checks']['vr_select_resumes'] = st()
    # end -> still
    ev('RV.voiceNote.video.currentTime = RV.voiceNote.video.duration - 1.0'); real(3500); res['checks']['after_end'] = st()
    # origin frame interplay
    ev('RV.voiceNote._debug.play()'); real(1500); ev('RV.originFrame._debug.play()'); real(1500)
    res['checks']['origin_pauses_note'] = {'note': st(), 'origin': ev('RV.originFrame._debug.state()')}
    ev('RV.voiceNote._debug.play()'); real(1500)
    res['checks']['note_pauses_origin'] = {'note': st(), 'origin': ev('RV.originFrame._debug.state()')}
    ev('RV.voiceNote._debug.rest("test")'); ev('RV.originFrame._debug.rest && RV.originFrame._debug.rest("test")')
    # the card is just a note now: clicking it (mouse or VR ray) opens nothing and doesn't touch the video
    ev('__rv.faceAt(-2.6, 1.32, 1.43)'); W(400)
    cp = ev('(() => { const c = new THREE.Vector3(); RV.voiceNote.card.getWorldPosition(c); return __rv.projectPt(c.x, c.y, c.z); })()')
    pg.screenshot(path=f'{OUT}/06_card.png')
    ev('window.__opens = 0; window.__wo = window.open; window.open = function () { window.__opens++; return null; }; 0')
    pages_before = len(ctx.pages); plays_before = st()['plays']
    pg.mouse.click(cp['x'], cp['y']); real(1500)
    vr = ev('''(() => { const c = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.voiceNote.card.getWorldPosition(new THREE.Vector3()); const d = t.sub(c).normalize();
        const r = RV.media.selectStart({}, c, d); return { handled: !!r }; })()'''); real(500)
    s2 = st()
    res['checks']['card_is_inert'] = {'window_open_calls': ev('window.__opens'), 'new_pages': len(ctx.pages) - pages_before, 'overlay': ev('!!document.getElementById("vocialCard")'),
        'plays_unchanged': s2['plays'] == plays_before, 'live': s2['live'], 'vr_select': vr, 'xr_session': ev('!!(RV.renderer.xr.getSession && RV.renderer.xr.getSession())'),
        'ok': ev('window.__opens') == 0 and len(ctx.pages) == pages_before and not ev('!!document.getElementById("vocialCard")') and s2['plays'] == plays_before and not s2['live']}
    ev('window.open = window.__wo')
    # light switch dims bezel + card
    before = ev('(() => { const m = RV.voiceNote._debug.mats; return [m.bezelM.emissive.getHex(), m.cardM.emissive.getHex(), m.labelM.emissive.getHex()]; })()')
    ok = False
    if ok: ev('RV.nightlight._debug.toggle()')
    else: ev('RV.lights.toggle()')
    W(2500)
    after = ev('(() => { const m = RV.voiceNote._debug.mats; return [m.bezelM.emissive.getHex(), m.cardM.emissive.getHex(), m.labelM.emissive.getHex()]; })()')
    ev('__rv.setPlayer(0.35, 1.45, 0)'); W(150); ev('__rv.faceAt(-2.6, 1.52, 1.42)'); W(400); pg.screenshot(path=f'{OUT}/08_lights_off.png')
    res['checks']['dims'] = {'before': before, 'after': after, 'dimmed': all(a < b for a, b in zip(after, before))}
    if ok: ev('RV.nightlight._debug.toggle()')
    else: ev('RV.lights.toggle()')
    W(2000)
    # floor click untouched
    ev('__rv.setPlayer(0.6, 0.6, 0)'); W(150); ev('__rv.faceAt(0.6, 0, -0.6)'); W(300)
    fp = ev('__rv.projectPt(0.6, 0, -0.6)'); before = st()['plays']; pg.mouse.click(fp['x'], fp['y']); W(400); res['checks']['floor_click_plays_unchanged'] = st()['plays'] == before
    b.close()
res['console'] = [l for l in res['console'] if 'error' in l.lower() or 'warn' in l.lower() or 'HTTP' in l]
print(json.dumps(res, indent=1))
