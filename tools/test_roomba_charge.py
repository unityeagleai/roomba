"""Desktop test for the Roomba's bedtime button on its charging station (js/roombaoff.js + RV.roomba.charge/wakeUp).
Pressing it (real mouse click on screen, or the VR trigger path RV.media.selectStart) cuts what it's saying at once,
stops the punishment song, sends it home to the dock, where it sleeps and shows CHARGING (battery face, green label)
and stays asleep and silent (calls, claps, pets, time) until Unity re-enters (XR sessionstart / walking in again).
Then it wakes, undocks and greets. Usage: python3 tools/test_roomba_charge.py URL OUTDIR"""
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; QUICK = len(sys.argv) > 3 and sys.argv[3] == 'quick'; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}, 'fail': []}
def check(name, ok, info=None):
    res['checks'][name] = {'ok': bool(ok), 'info': info}
    if not ok: res['fail'].append(name)
    print(('PASS ' if ok else 'FAIL ') + name, '' if ok else info, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1100, 'height': 650})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500)
    ev = lambda js, *a: pg.evaluate(js, *a)
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(100)
    def until(js, ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000:
            if ev(js): return True
            pg.wait_for_timeout(150)
        return bool(ev(js))
    check('module_loaded', ev('!!RV.roombaCharge && !!RV.roomba.charge && !!RV.roomba.wakeUp'))
    pg.click('#bFlat')
    until('!!RV.roomba.voiceReady', 15000); W(2500)
    check('greets_normally', ev('RV.roomba.vox.greeted') and len(ev('RV.roomba.vox.spoken')) > 0, ev('RV.roomba.vox.spoken'))
    W(2500)
    if not QUICK:
        # 1) out in the room, mid-sentence: click the station's button with the real mouse
        ev("RV.roomba.place(0.9, 0.9); __rv.go('idle')")
        ev('__rv.setPlayer(-0.9, -0.9, 0)'); W(200)
        bp = ev('(() => { const v = new THREE.Vector3(); RV.roombaCharge.button.getWorldPosition(v); return [v.x, v.y, v.z]; })()')
        ev(f'__rv.faceAt({bp[0]}, {bp[1]}, {bp[2]})'); W(300)
        ok = ev('RV.roomba.say("MY LAWYER WILL HEAR ABOUT THIS", true)'); W(150)
        check('speaking_before', ok and ev('!!RV.roomba.vox.src'))
        pg.screenshot(path=os.path.join(OUT, '1_station_button.png'))
        pt = ev(f'__rv.projectPt({bp[0]}, {bp[1]}, {bp[2]})')
        pg.mouse.click(pt['x'], pt['y']); W(250)
        check('click_sends_it_to_charge', ev('RV.roomba.charging') and ev('RV.roombaCharge.last') == 'screen', {'pt': pt, 'last': ev('RV.roombaCharge.last')})
        check('speech_cut_at_once', not ev('!!RV.roomba.vox.src'))
        check('heads_home', ev('RV.roomba.state()') in ('home', 'bump'), ev('RV.roomba.state()'))
        check('going_to_charge_bubble', ev('RV.roomba.captionDebug()')['text'] == 'GOING TO CHARGE', ev('RV.roomba.captionDebug()'))
        n0 = len(ev('RV.roomba.vox.spoken'))
        docked = until("RV.roomba.state() === 'dock'", 45000)
        d = ev('RV.roomba.debug()')
        check('drives_home_and_docks', docked and abs(d['x'] + 1.0) < 0.05 and abs(d['z'] - ev('RV.dock.z')) < 0.05, d)
        W(1500)
        pg.screenshot(path=os.path.join(OUT, '2_charging.png'))
        face = ev('''(() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
            const m = RV.roomba.body.children.find(o => o.material && o.material.map && o.material.map.image && o.material.map.image.width === 128 && o.geometry.type === 'CircleGeometry');
            if (!m) return null; x.drawImage(m.material.map.image, 0, 0); const px = x.getImageData(3 * 8 + 4, 9 * 8 + 4, 1, 1).data; return [px[0], px[1], px[2]]; })()''')
        check('battery_on_face', face is not None and face[1] > 150, face)
        lab = ev('''(() => { const c = RV.roombaCharge.label.material.map.image, x = c.getContext('2d'); const d = x.getImageData(0, 0, 256, 64).data; let g = 0; for (let i = 0; i < d.length; i += 4) if (d[i+1] > 180 && d[i] < 140) g++; return g; })()''')
        check('charging_label_lit', lab > 50, lab)
    else:   # quick mode (a rerun of the later steps): start already asleep on the charger
        ev('RV.roomba.charge(); RV.roomba.place(RV.dock.x, RV.dock.z); __rv.go("dock")'); W(1500)
        ev('__rv.setPlayer(-0.9, -0.9, 0)')
        n0 = len(ev('RV.roomba.vox.spoken'))
    # 2) while charging: silent, and nothing wakes it (call, clap, pet, zombie noise, time past its normal 20 s nap)
    r = ev("RV.roomba.say('BEEP.', true)")
    ev("RV.roomba.hear('call'); RV.roomba.hear('loud'); RV.roomba.pet()"); W(400)
    check('call_clap_pet_dont_wake', ev('RV.roomba.state()') == 'dock' and ev('RV.roomba.charging'), ev('RV.roomba.state()'))
    W(6000 if QUICK else 26000)
    check('stays_asleep', ev('RV.roomba.state()') == 'dock' and ev('RV.roomba.charging'), ev('RV.roomba.state()'))
    check('silent_while_charging', not r and len(ev('RV.roomba.vox.spoken')) == n0 and not ev('RV.roomba.song.playing()'), ev('RV.roomba.vox.spoken')[n0:])
    # toggle: press again (VR trigger path) while asleep -> wakes, rolls straight back out into the room, talks again
    sel = ev('''(() => { const v = new THREE.Vector3(); RV.roombaCharge.button.getWorldPosition(v);
        const o = new THREE.Vector3(v.x + 0.4, 1.5, v.z + 1.0), d = v.clone().sub(o).normalize(); return RV.media.selectStart({ userData: {} }, o, d); })()''')
    W(300)
    check('second_press_wakes', sel and not ev('RV.roomba.charging') and ev('RV.roombaCharge.last') == 'vr' and ev('RV.roombaCharge.wokeBy') == 'button')
    check('rolls_out_on_press', ev('RV.roomba.state()') in ('undock', 'notice', 'wander'), ev('RV.roomba.state()'))
    W(2500); d2 = ev('RV.roomba.debug()')
    check('back_in_room', d2['state'] != 'dock' and d2['z'] > -1.85, d2)
    W(1500)
    ok2 = ev("RV.roomba.say('BEEP.', true)")
    check('talks_after_wake', ok2)
    # third press: back to bed
    sel3 = ev('''(() => { const v = new THREE.Vector3(); RV.roombaCharge.button.getWorldPosition(v);
        const o = new THREE.Vector3(v.x, 1.5, v.z + 1.1), d = v.clone().sub(o).normalize(); return RV.media.selectStart({ userData: {} }, o, d); })()''')
    W(300)
    check('third_press_charges_again', sel3 and ev('RV.roomba.charging') and ev('RV.roomba.state()') in ('home', 'bump'), ev('RV.roomba.state()'))
    check('docks_after_third', until("RV.roomba.state() === 'dock'", 45000), ev('RV.roomba.state()'))
    n0 = len(ev('RV.roomba.vox.spoken'))
    # 3) coming back into the room (a new headset session) wakes it: it rolls out and says hi
    ev("RV.renderer.xr.dispatchEvent({ type: 'sessionstart' }); RV.renderer.xr.dispatchEvent({ type: 'sessionend' })")   # three's renderer pauses its loop on sessionstart; the fake sessionend restarts it (no real headset here); W(300)
    check('reenter_wakes', not ev('RV.roomba.charging') and ev('RV.roombaCharge.wokeBy') == 'vr')
    left = until("RV.roomba.state() !== 'dock'", 6000)
    check('rolls_out', left, ev('RV.roomba.state()'))
    greeted = until('RV.roomba.vox.greeted', 6000); W(500)
    check('greets_again', greeted and len(ev('RV.roomba.vox.spoken')) > n0, ev('RV.roomba.vox.spoken')[n0:])
    # 4) in the middle of a punishment song: press it -> song stops at once, punishment over, off to charge
    W(2500)
    ev('RV.roomba.punish()')
    playing = until('RV.roomba.song.playing()', 20000)
    check('song_playing_before', playing)
    ev('__rv.setPlayer(-0.9, -0.9, 0)')
    sel2 = ev('''(() => { const v = new THREE.Vector3(); RV.roombaCharge.button.getWorldPosition(v);
        const o = new THREE.Vector3(v.x, 1.5, v.z + 1.1), d = v.clone().sub(o).normalize(); return RV.media.selectStart({ userData: {} }, o, d); })()''')
    W(300)
    check('press_during_punishment', sel2 and ev('RV.roomba.charging'))
    check('song_stops_at_once', not ev('RV.roomba.song.playing()'))
    check('punishment_over', ev('RV.roomba.state()') != 'punish', ev('RV.roomba.state()'))
    check('docks_again', until("RV.roomba.state() === 'dock'", 45000) and abs(ev('RV.roomba.debug()')['x'] + 1.0) < 0.05, ev('RV.roomba.debug()'))
    errs = [c for c in res['console'] if c.startswith('PAGEERROR') or (c.startswith('error') and 'favicon' not in c)]
    check('no_page_errors', not errs, errs[:5])
    b.close()
json.dump(res, open(os.path.join(OUT, 'result.json'), 'w'), indent=1)
print('FAIL', res['fail'])
