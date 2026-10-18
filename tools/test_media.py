"""Desktop test for the bedroom media: cartridges -> CRT, BIG SCREEN / BACK TO TV, the record player, the Xanadu poster,
console errors, and that the Roomba still changes state. Uses real mouse clicks on the canvas where it can.
Usage: python3 tools/test_media.py URL OUTDIR"""
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}}
VW, VH = 960, 540
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': VW, 'height': VH})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500)
    pg.click('#bFlat'); pg.wait_for_timeout(1200)
    ev = lambda js: pg.evaluate(js)
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(80)
    def click_world(x, y, z):
        ev(f'__rv.faceAt({x},{y},{z})'); W(150)
        s = ev(f'__rv.projectPt({x},{y},{z})')
        pg.mouse.click(s['x'], s['y']); W(250)
        return s
    def wpos(expr):
        return ev(f'(() => {{ const v = new THREE.Vector3(); ({expr}).getWorldPosition(v); return [v.x, v.y, v.z]; }})()')
    states0 = len(ev('__rv.log()'))

    # ---- poster
    ev('__rv.setPlayer(0.6, -0.9, 0)'); W(200)
    pp = wpos('__rv.media().poster')
    ev(f'__rv.faceAt({pp[0]},{pp[1]},{pp[2]})'); W(400)
    res['checks']['poster'] = ev('(() => { const m = __rv.media().poster; const im = m.material.map && m.material.map.image; return { visible: m.visible, inScene: !!m.parent, w: im && (im.naturalWidth || im.width), h: im && (im.naturalHeight || im.height) }; })()')
    pg.screenshot(path=f'{OUT}/01_poster.png')

    # ---- seven cartridges, each with real clicks: click it on the shelf, then click the console slot
    eps = []
    slot = ev('[RV.consoleSlot.x, RV.consoleSlot.y, RV.consoleSlot.z]')
    for i in range(7):
        ev('__rv.setPlayer(-0.75, 1.3, 0)'); W(150)
        cp = wpos(f'__rv.media().carts[{i}].g')
        click_world(*cp)
        held = ev(f'__rv.media().carts[{i}].state')
        ev('__rv.setPlayer(0.66, -1.05, 0)'); W(150)
        click_world(slot[0], slot[1], slot[2] + 0.005)
        W(2600)
        r = ev(f'''(() => {{ const d = __rv.media(), v = d.video; return {{ cart: {i}, held_after_click: '{held}', state: d.carts[{i}].state, ep: d.playing.ep && String(d.playing.ep.number), src: v.src.split('/').pop(), paused: v.paused, t: +v.currentTime.toFixed(2), vw: v.videoWidth, err: v.error && v.error.code }}; }})()''')
        eps.append(r)
        if i in (0, 6): pg.screenshot(path=f'{OUT}/02_tv_ep{i+1}.png')
    res['checks']['cartridges'] = eps

    # ---- BIG SCREEN (3D button on the TV) and BACK TO TV (3D button on the big screen), then the HTML button and F key
    bb = wpos('__rv.media().bigBtn')
    ev('__rv.setPlayer(0.66, -1.05, 0)'); W(150)
    click_world(*bb); W(400)
    big1 = ev('__rv.media().bigOn()')
    pg.screenshot(path=f'{OUT}/03_big.png')
    bk = wpos('__rv.media().backBtn')
    s = ev(f'__rv.projectPt({bk[0]},{bk[1]},{bk[2]})'); pg.mouse.click(s['x'], s['y']); W(400)
    back1 = ev('__rv.media().bigOn()')
    pg.click('#bBig'); W(300); big2 = ev('__rv.media().bigOn()'); lbl = pg.inner_text('#bBig')
    pg.click('#bBig'); W(300); back2 = ev('__rv.media().bigOn()')
    pg.keyboard.press('KeyF'); W(300); big3 = ev('__rv.media().bigOn()'); pg.keyboard.press('Escape'); W(300); back3 = ev('__rv.media().bigOn()')
    res['checks']['bigscreen'] = {'3d_big': big1, '3d_back_closed': not back1, 'html_big': big2, 'html_label_when_big': lbl, 'html_back_closed': not back2, 'F_big': big3, 'Esc_back_closed': not back3,
                                  'still_playing': ev('!__rv.media().video.paused')}
    pg.screenshot(path=f'{OUT}/04_back_to_tv.png')

    # ---- VR trigger logic with a stand-in controller: grab cartridge 3 on selectstart, release at the console on selectend
    ev('__rv.setPlayer(-0.75, 1.3, 0)'); W(150)
    res['checks']['vr_trigger'] = ev('''(() => { const M = __rv.media2(), d = __rv.media(), c = new THREE.Object3D(); RV.scene.add(c); window.__ctl = c;
        const cam = new THREE.Vector3(); RV.camera.getWorldPosition(cam); c.position.copy(cam); c.updateMatrixWorld();
        const tp = new THREE.Vector3(); d.carts[2].g.getWorldPosition(tp); const dir = tp.clone().sub(cam).normalize();
        const grabbed = M.selectStart(c, cam.clone(), dir); return { grabbed, stateAfterStart: d.carts[2].state }; })()''')
    # walk over to the TV holding it (the stand-in hand follows the head), aim at the slot, let go
    ev('__rv.setPlayer(0.66, -1.05, 0)'); W(300)
    res['checks']['vr_trigger'].update(ev('''(() => { const M = __rv.media2(), d = __rv.media(), c = window.__ctl;
        const cam = new THREE.Vector3(); RV.camera.getWorldPosition(cam); c.position.copy(cam); c.updateMatrixWorld(); const held = d.carts[2].state;
        const s = RV.consoleSlot, to = new THREE.Vector3(s.x, s.y, s.z + 0.005), d2 = to.clone().sub(cam).normalize();
        const rel = M.selectEnd(c, cam.clone(), d2); return { stateWhileWalking: held, released: rel, stateAfterEnd: d.carts[2].state }; })()'''))
    W(2500)
    res['checks']['vr_trigger']['ep_after'] = ev('__rv.media().playing.ep && String(__rv.media().playing.ep.number)')
    res['checks']['vr_trigger']['playing'] = ev('!__rv.media().video.paused')

    # ---- record player: real click on it, check the clip plays, positional panner at the deck, then stop with the HTML button
    ev('__rv.setPlayer(1.2, -0.6, 0)'); W(150)
    pl = wpos('__rv.media().plHit')
    click_world(*pl); W(3000)
    res['checks']['record'] = ev('''(() => { const d = __rv.media(), a = d.recAudio, pn = d.rPan(); return { on: d.rp.on, paused: a.paused, t: +a.currentTime.toFixed(2), dur: +a.duration.toFixed(2),
        panner: !!pn, model: pn && pn.panningModel, pannerAt: pn && [pn.positionX.value, pn.positionY.value, pn.positionZ.value].map(v => +v.toFixed(2)), deck: [d.RP_POS.x, d.RP_POS.y, d.RP_POS.z].map(v => +v.toFixed(2)),
        episodePausedByRecord: d.video.paused, btn: document.getElementById('bRec').textContent }; })()''')
    pg.screenshot(path=f'{OUT}/05_record.png')
    pg.click('#bRec'); W(400)
    res['checks']['record_stop'] = ev('({ on: __rv.media().rp.on, paused: __rv.media().recAudio.paused, btn: document.getElementById("bRec").textContent })')

    # ---- the Roomba still behaves
    ev('__rv.go("wander")'); W(300)
    res['checks']['roomba_toss'] = ev('__rv.toss(0.2,-0.3)')
    seen = set()
    for _ in range(40):
        seen.add(ev('__rv.debug().state')); W(250)
    ev('__rv.pet()'); W(500); seen.add(ev('__rv.debug().state'))
    log = ev('__rv.log().filter(e => e.state).map(e => e.state)')
    res['checks']['roomba'] = {'states_seen_last_10s': sorted(seen), 'state_changes_total': len(log), 'distinct_in_log': sorted(set(log))}
    res['checks']['debug'] = ev('__rv.debug()')
    pg.screenshot(path=f'{OUT}/06_end.png')
    b.close()
res['errors'] = [c for c in res['console'] if c.startswith(('error', 'PAGEERROR'))]
print(json.dumps(res, indent=1, default=str))
