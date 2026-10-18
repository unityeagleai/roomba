"""Desktop test for the wall big screen: BIG SCREEN on the TV projects onto the front wall right across from the TV,
'look behind you' cue appears in front of the viewer, hides when they turn round, BACK TO TV / PAUSE work on the wall,
geometry stays inside the room and clear of the door, the picture rail and the skirting, sound moves to the wall,
VR-style trigger (stand-in controller) works on the wall buttons, desktop FULL SCREEN / F still fill the view.
Usage: python3 tools/test_wall.py URL OUTDIR"""
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500)
    pg.click('#bFlat'); pg.wait_for_timeout(1200)
    ev = lambda js: pg.evaluate(js)
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(80)
    def wpos(expr):
        return ev(f'(() => {{ const v = new THREE.Vector3(); ({expr}).getWorldPosition(v); return [v.x, v.y, v.z]; }})()')
    def click_world(x, y, z):
        ev(f'__rv.faceAt({x},{y},{z})'); W(150)
        s = ev(f'__rv.projectPt({x},{y},{z})'); pg.mouse.click(s['x'], s['y']); W(300); return s
    # play episode 7 from the shelf
    slot = ev('[RV.consoleSlot.x, RV.consoleSlot.y, RV.consoleSlot.z]')
    ev('__rv.setPlayer(-0.75, 1.3, 0)'); W(150)
    click_world(*wpos('__rv.media().carts[6].g'))
    ev('__rv.setPlayer(0.66, -1.05, 0)'); W(150)
    click_world(slot[0], slot[1], slot[2] + 0.005); W(3000)
    res['checks']['playing'] = ev('(() => { const d = __rv.media(); return { ep: d.playing.ep && d.playing.ep.number, paused: d.video.paused, t: d.video.currentTime }; })()')
    # BIG SCREEN with a real click on the TV button, standing at the TV facing it
    click_world(*wpos('__rv.media().bigBtn')); W(500)
    res['checks']['open'] = ev('''(() => { const d = __rv.media(), g = d.big; g.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(g); const n = new THREE.Vector3(0, 0, 1).applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion()));
        const tvx = RV.tv.sx; const room = RV.room;
        return { bigOn: d.bigOn(), mode: d.bigMode(), parentIsScene: g.parent === RV.scene, pos: g.position.toArray().map(v => +v.toFixed(3)), scale: g.scale.x,
          normal: n.toArray().map(v => +v.toFixed(3)), box: { min: box.min.toArray().map(v => +v.toFixed(3)), max: box.max.toArray().map(v => +v.toFixed(3)) },
          tvX: tvx, centredOnTv: Math.abs(g.position.x - tvx) < 1e-6, gapToWall: +(room.RZ - box.max.z).toFixed(3),
          clearOfDoorFrame: box.min.x > -0.915, insideRightWall: box.max.x < room.RX, belowPictureRail: box.max.y < room.RH - 0.14, aboveSkirting: box.min.y > 0.12,
          depthTested: d.big.children[0].material.depthTest,
          cueVisible: d.cue.visible, cueName: d.cue.name, angleToScreenDeg: +d.screenAngle().toFixed(1) }; })()''')
    # where is the cue relative to the head?
    res['checks']['cue'] = ev('''(() => { const d = __rv.media(), c = d.cue, cam = RV.camera; const h = new THREE.Vector3(), q = new THREE.Quaternion(); cam.getWorldPosition(h); cam.getWorldQuaternion(q);
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q); const to = c.position.clone().sub(h); const dist = to.length();
        return { dist: +dist.toFixed(2), inFront: +(to.normalize().dot(f)).toFixed(3), onTop: !c.material.depthTest, img: c.material.map.image.width + 'x' + c.material.map.image.height }; })()''')
    pg.screenshot(path=f'{OUT}/01_cue_facing_tv.png')
    # the panner moved to the wall
    res['checks']['sound_at_wall'] = ev('(() => { const v = __rv.media().vPan(); if (!v) return "panner not wired"; return [v.positionX.value, v.positionY.value, v.positionZ.value].map(x => +x.toFixed(3)); })()')
    # turn round to face the wall screen: cue goes away
    w = ev('[__rv.media().WALL.x, __rv.media().WALL.y, __rv.media().WALL.z]')
    ev('__rv.setPlayer(0.66, -1.05, 0)'); W(150); ev(f'__rv.faceAt({w[0]},{w[1]},{w[2]})'); W(800)
    res['checks']['after_turn'] = ev('({ cueVisible: __rv.media().cue.visible, angle: +__rv.media().screenAngle().toFixed(1), bigOn: __rv.media().bigOn(), playing: !__rv.media().video.paused })')
    pg.screenshot(path=f'{OUT}/02_wall_from_tv.png')
    # a wider look from the middle of the room, and from by the bed
    ev('__rv.setPlayer(0.3, 0.2, 0)'); W(150); ev(f'__rv.faceAt({w[0]},{w[1]},{w[2]})'); W(400); pg.screenshot(path=f'{OUT}/03_wall_mid.png')
    ev('__rv.setPlayer(-0.2, -1.6, 0)'); W(150); ev(f'__rv.faceAt({w[0]+0.3},{w[1]},{w[2]})'); W(400); pg.screenshot(path=f'{OUT}/04_wall_far_left.png')
    # PAUSE and BACK TO TV with real clicks on the wall buttons
    ev('__rv.setPlayer(0.66, -1.05, 0)'); W(150)
    PB = '__rv.media().big.children.find(m => m.userData && m.userData.btn === "pause" && m.geometry.parameters.width < 1)'
    click_world(*wpos(PB)); W(300)
    paused = ev('__rv.media().video.paused')
    click_world(*wpos(PB)); W(300)
    resumed = not ev('__rv.media().video.paused')
    click_world(*wpos('__rv.media().backBtn')); W(400)
    res['checks']['wall_buttons'] = {'pause_click_paused': paused, 'second_click_resumed': resumed, 'back_to_tv_closed': not ev('__rv.media().bigOn()'), 'cue_hidden': not ev('__rv.media().cue.visible'), 'tv_picture_visible_again': ev('__rv.media().playing.ep != null')}
    # VR trigger with a stand-in controller: open from the TV button, then trigger at BACK TO TV on the wall
    ev('__rv.setPlayer(0.66, -1.05, 0)'); W(150); ev('__rv.faceAt(0.66, 1.0, -2.0)'); W(200)
    res['checks']['vr_trigger'] = ev('''(() => { const M = __rv.media2(), d = __rv.media(), c = new THREE.Object3D(); RV.scene.add(c);
        const cam = new THREE.Vector3(); RV.camera.getWorldPosition(cam); c.position.copy(cam); c.updateMatrixWorld();
        const bp = new THREE.Vector3(); d.bigBtn.getWorldPosition(bp);
        M.selectStart(c, cam.clone(), bp.clone().sub(cam).normalize()); M.selectEnd(c, cam.clone(), bp.clone().sub(cam).normalize());
        const opened = d.bigOn(), cue = d.cue.visible;
        const kp = new THREE.Vector3(); d.backBtn.getWorldPosition(kp);
        M.selectStart(c, cam.clone(), kp.clone().sub(cam).normalize()); M.selectEnd(c, cam.clone(), kp.clone().sub(cam).normalize());
        return { opened, cueShown: cue, closedByTriggerOnWallButton: !d.bigOn() }; })()''')
    # desktop FULL SCREEN button and F still fill the view
    pg.click('#bBig'); W(300)
    res['checks']['html_fullscreen'] = ev('({ on: __rv.media().bigOn(), mode: __rv.media().bigMode(), onCamera: __rv.media().big.parent === RV.camera, cue: __rv.media().cue.visible })')
    pg.screenshot(path=f'{OUT}/05_html_fullscreen.png')
    pg.click('#bBig'); W(300); res['checks']['html_back'] = not ev('__rv.media().bigOn()')
    pg.keyboard.press('KeyF'); W(300); f_on = ev('[__rv.media().bigOn(), __rv.media().bigMode()]'); pg.keyboard.press('Escape'); W(300)
    res['checks']['F_key'] = {'on': f_on, 'esc_closed': not ev('__rv.media().bigOn()')}
    # reopen on the wall after view mode: back in the room, depth tested again
    click_world(*wpos('__rv.media().bigBtn')); W(300)
    res['checks']['reopen_wall'] = ev('({ mode: __rv.media().bigMode(), parentIsScene: __rv.media().big.parent === RV.scene, z: __rv.media().big.position.z, depth: __rv.media().big.children[0].material.depthTest })')
    res['checks']['still_playing'] = ev('!__rv.media().video.paused')
    res['errors'] = [l for l in res['console'] if 'rror' in l]
    b.close()
print(json.dumps(res, indent=1, default=str))
