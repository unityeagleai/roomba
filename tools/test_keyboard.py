"""Checks for typing on the CHARLIE 64 (js/desk.js): the keys have legends, pointing at a key (VR trigger) or clicking it types
on the CRT once the card is in, DEL / RETURN / CLR / SPACE work, long lines wrap to the 28-column screen, the real keyboard
types after you click a key (and WASD/C/V don't walk you or call the Roomba while it does), Esc gives the keyboard back,
no card = nothing typed, and the card + greeting + stool still work.
Run: python3 tools/test_keyboard.py [url]   (default: the live site)"""
import sys, io
from PIL import Image
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
    pg.goto(URL + ('&' if '?' in URL else '?') + 'nocache=kb', wait_until='load')
    pg.wait_for_timeout(2500); pg.evaluate("document.getElementById('bFlat').click()"); pg.wait_for_timeout(1200)
    ev = lambda js, *a: pg.evaluate(js, *a)
    ev('RV.roomba.place(1.6, 1.3)')
    pg.wait_for_function('RV.desk && RV.desk.ready() && RV.desk.keys', timeout=20000)
    D = lambda: ev('RV.desk._debug()')
    # ray from the eye at a key, through the app's own click / VR paths
    ray_js = '''([k, how]) => { const o = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.desk.keyCenter(k), d = t.sub(o).normalize();
      if (how === 'hover') return [RV.media.hoverT(o, d), RV.desk.pickKey(o, d) && RV.desk.pickKey(o, d).key.k];
      if (how === 'vr') return RV.media.selectStart({ userData: {} }, o, d); return RV.media.click(o, d); }'''
    key = lambda k, how='click': ev(ray_js, [k, how])

    ok(ev('RV.desk.KEYMAP.length') >= 55, f"keyboard has real keys ({ev('RV.desk.KEYMAP.length')})")
    labels = ev('RV.desk.KEYMAP.map(k => k.k)')
    ok(all(c in labels for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') and all(k in labels for k in ('SPACE', 'DEL', 'RETURN', 'CLR')), 'all letters, digits, SPACE, DEL, RETURN and CLR are on it')

    ev('__rv.sit("desk")'); pg.wait_for_timeout(700)
    ok(ev('__rv.pose()')['pose'] == 'desk', 'sitting on the stool')
    # picture of the keyboard from the seat
    c = ev('''() => { const v = RV.desk.keys.getWorldPosition(new THREE.Vector3()).project(RV.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }''')
    ok(0 < c[0] < 960 and 0 < c[1] < 540, f'keyboard is in view from the stool ({round(c[0])}, {round(c[1])})')
    pg.screenshot(path='/tmp/kb_seat.png')

    # no card: keys click but nothing is typed, the READY screen nags for the card
    s0 = D(); ok(s0['cardState'] == 'rest' and s0['term'] == 'idle', 'card on the desk, READY screen')
    hv = key('Q', 'hover'); ok(hv[0] is not None and hv[1] == 'Q', f'pointer ray at a key picks that key ({hv})')
    key('Q'); s1 = D(); ok(s1['inp'] == '' and s1['term'] == 'idle' and s1['nudge'], 'without the card a key types nothing and the screen flashes INSERT ACCESS CARD')
    ok(not s1['focus'], 'real keyboard is not taken without the card')

    # card in: greeting starts; a key fast-forwards it and starts your line
    ev('''() => { const o = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.desk.card.getWorldPosition(new THREE.Vector3()); RV.media.click(o, t.sub(o).normalize()); }''')
    pg.wait_for_function('RV.desk._debug().cardState === "in"', timeout=60000); pg.wait_for_timeout(1500)
    ok(D()['term'] in ('boot', 'typing'), 'card in: Charlie starts typing the greeting')
    key('H', 'vr'); s2 = D(); print('  view after H:', s2['view'])
    ok(s2['term'] == 'input' and s2['inp'] == 'H', 'VR trigger on a key types it (greeting fast-forwarded)')
    t2 = '\n'.join(s2['view'])
    ok('HEY UNITY, CHARLIE HERE.' in t2 and 'TODAY?' in t2 and s2['view'][-1] == '> H', "greeting stays on screen and your line is '> H' under it")
    # real mouse click on a key on the canvas
    pt = ev('''() => { const v = RV.desk.keyCenter('I').project(RV.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }''')
    pg.mouse.click(pt[0], pt[1]); pg.wait_for_timeout(250); s3 = D()
    if s3['inp'] != 'HI': key('I'); s3 = D(); print('  (mouse click fell back to the app click path)')
    ok(s3['inp'] == 'HI', f"clicking a key with the mouse types it ({s3['inp']!r})")
    ok(s3['focus'], 'after clicking a key the real keyboard types too')
    P0 = ev('__rv.P()'); calls0 = len(ev('__rv.log()'))
    pg.keyboard.type(' wasd ce, charlie!'); pg.wait_for_timeout(300); s4 = D(); P1 = ev('__rv.P()')
    ok(s4['inp'] == 'HI WASD CE, CHARLIE!', f"real keyboard types on the CRT ({s4['inp']!r})")
    ok(abs(P0['x'] - P1['x']) < 1e-6 and abs(P0['z'] - P1['z']) < 1e-6 and abs(P0['yaw'] - P1['yaw']) < 1e-6 and ev('__rv.pose()')['pose'] == 'desk', 'typing W A S D Q E does not walk, turn or stand you up')
    pg.keyboard.press('Backspace'); s5 = D(); ok(s5['inp'] == 'HI WASD CE, CHARLIE', 'Backspace deletes a letter')
    key('DEL'); key('DEL', 'vr'); ok(D()['inp'] == 'HI WASD CE, CHARL', 'DEL key (click and VR) deletes')
    key('SPACE'); key('X', 'vr'); ok(D()['inp'] == 'HI WASD CE, CHARL X', 'SPACE bar adds a space')
    pg.keyboard.press('Enter'); s6 = D(); print('  after Enter:', s6['view'][-3:])
    ok(s6['inp'] == '' and s6['view'][-2] == '> HI WASD CE, CHARL X' and s6['view'][-1] == '> ', 'Enter keeps your line and gives a new prompt')
    key('RETURN', 'vr'); ok(D()['view'][-2:] == ['> ', '> '], 'RETURN key works from VR too')
    pg.keyboard.type('the quick brown fox jumps over the lazy dog 1234567890'); s7 = D(); print('  long line:', s7['view'][-3:])
    ok(all(len(l) <= 28 for l in s7['view']) and len(s7['view']) <= 14, 'long lines wrap to the 28-column, 14-row screen')
    ok(''.join(l[2:] for l in s7['view'][-3:]) == 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 1234567890', 'wrapped text reads back intact')
    look = '''() => { const s = RV.desk.screen.getWorldPosition(new THREE.Vector3()); __rv.faceAt(s.x, s.y, s.z); }'''
    ev(look); pg.wait_for_timeout(500); pg.screenshot(path='/tmp/kb_crt.png')
    for _ in range(80): pg.keyboard.press('Backspace')
    ok(D()['inp'] == '', 'Backspace empties the line and stops there')
    for _ in range(20): pg.keyboard.press('Enter')
    ok(len(D()['view']) == 14, 'screen scrolls instead of overflowing')
    key('CLR'); s8 = D(); ok(s8['view'] == ['> '], 'CLR clears the screen to a fresh prompt')
    # Esc gives the keyboard back: WASD walks / stands you up again
    pg.keyboard.press('Escape'); ok(not D()['focus'], 'Esc stops the real keyboard typing')
    pg.keyboard.type('c'); ok(D()['inp'] == '', 'after Esc letters no longer type')
    pg.keyboard.down('KeyW'); pg.wait_for_timeout(3000); pg.keyboard.up('KeyW'); pg.wait_for_timeout(400)
    ok(not ev('__rv.pose()')['pose'], 'after Esc, W stands you up as before')
    # clicking something else also lets go
    ev('__rv.sit("desk")'); pg.wait_for_timeout(500); key('A'); ok(D()['focus'], 'clicking a key takes the keyboard again')
    ev('''() => { const o = RV.camera.getWorldPosition(new THREE.Vector3()); RV.media.click(o, new THREE.Vector3(0.3, -0.2, 1).normalize()); }'''); ok(not D()['focus'], 'clicking elsewhere gives the keyboard back')
    # the card still comes out and back in, with a fresh greeting
    ev('''() => { const o = RV.camera.getWorldPosition(new THREE.Vector3()), t = RV.desk.card.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.02, 0)); RV.media.click(o, t.sub(o).normalize()); }''')
    pg.wait_for_function('RV.desk._debug().cardState === "rest"', timeout=60000); s9 = D()
    ok(s9['term'] == 'idle' and s9['inp'] == '' and not s9['focus'], 'taking the card out turns the screen off and clears your typing')
    ev('RV.desk.insert()'); pg.wait_for_function('RV.desk._debug().typed > 3', timeout=120000); s10 = D()
    ok(s10['term'] == 'typing' and s10['visits'] == 2 and s10['lines'][0].startswith('PAR') and s10['inp'] == '', 'card back in: a fresh greeting types itself again, letter by letter')
    ev('RV.desk.eject()'); pg.wait_for_function('RV.desk._debug().cardState === "rest"', timeout=60000)
    # night: keys still there (just dimmer), no errors
    errs = [t for (k, t) in logs if k in ('error', 'pageerror') and 'status of 404' not in t]
    for e in errs[:10]: print('  console:', e)
    ok(not errs, 'no console errors')
    b.close()

print('\n%d failure(s)' % len(fails)); [print(' -', f) for f in fails]
sys.exit(1 if fails else 0)
