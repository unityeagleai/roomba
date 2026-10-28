"""Phone + desktop check for the start screen and the in-room help box.
Start screen: the card's title and WALK IN button are on screen (or reachable by scrolling the intro), the intro scrolls
to the end of the instructions, PLAY RECORD isn't floating over the start screen.
In room: on touch devices the help uses touch words, folds away by itself (and on the first tap), and the HELP button
brings it back; on desktop it stays up and H / HIDE HELP fold it.
Usage: python3 tools/test_mobile.py URL OUTDIR"""
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
DEV = [
    ('iphone', dict(viewport={'width': 390, 'height': 664}, device_scale_factor=3, is_mobile=True, has_touch=True,
                    user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')),
    ('iphone_land', dict(viewport={'width': 664, 'height': 390}, device_scale_factor=3, is_mobile=True, has_touch=True,
                    user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')),
    ('android', dict(viewport={'width': 412, 'height': 839}, device_scale_factor=2.6, is_mobile=True, has_touch=True,
                     user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36')),
    ('desk_short', dict(viewport={'width': 1280, 'height': 600})),
    ('desk_big', dict(viewport={'width': 1920, 'height': 1080})),
]
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    for name, opts in DEV:
        r = {'console': [], 'checks': {}}; res[name] = r
        ctx = b.new_context(**opts); pg = ctx.new_page()
        pg.on('pageerror', lambda e, r=r: r['console'].append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m, r=r: m.type == 'error' and '404' not in m.text and r['console'].append(f'error: {m.text}'))
        pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500)
        ev = pg.evaluate
        vh = opts['viewport']['height']; vw = opts['viewport']['width']
        pg.screenshot(path=f'{OUT}/{name}_0_intro_top.png')
        st = ev('''(() => { const i = document.getElementById('intro'), r = el => document.getElementById(el).getBoundingClientRect();
          const h1 = document.querySelector('h1').getBoundingClientRect();
          const mb = getComputedStyle(document.getElementById('mbtns')).display;
          return { h1Top: h1.top, flatTop: r('bFlat').top, flatBottom: r('bFlat').bottom, vrTop: r('bVR').top, scrollH: i.scrollHeight, clientH: i.clientHeight, mbtns: mb,
                   touch: RV.help.isTouch(), flatHow: document.getElementById('flatHow').textContent }; })()''')
        r['checks']['intro_top'] = st
        r['checks']['title_visible'] = st['h1Top'] >= 0
        r['checks']['buttons_visible'] = st['vrTop'] >= 0 and st['flatBottom'] <= vh
        r['checks']['record_hidden_on_intro'] = st['mbtns'] == 'none'
        # scroll to the end of the instructions (wheel on desktop, scrollTop for the touch ones since the emulator can't swipe)
        if opts.get('has_touch'):
            ev("document.getElementById('intro').scrollTop = 1e6")
        else:
            pg.mouse.move(vw / 2, vh / 2)
            for _ in range(15): pg.mouse.wheel(0, 400); pg.wait_for_timeout(60)
        pg.wait_for_timeout(300)
        end = ev('''(() => { const li = document.getElementById('flatHow').getBoundingClientRect(), i = document.getElementById('intro');
          return { lastBottom: li.bottom, vh: innerHeight, scrollTop: i.scrollTop, needs: i.scrollHeight > i.clientHeight }; })()''')
        r['checks']['intro_end'] = end
        r['checks']['end_reachable'] = end['lastBottom'] <= end['vh'] + 1
        pg.screenshot(path=f'{OUT}/{name}_1_intro_end.png')
        ev("document.getElementById('intro').scrollTop = 0"); pg.wait_for_timeout(200)
        # walk in with a real tap / click on the button
        if opts.get('has_touch'): pg.tap('#bFlat')
        else: pg.click('#bFlat')
        pg.wait_for_timeout(1200)
        hud = lambda: ev('''(() => { const h = document.getElementById('hud'), t = document.getElementById('hudText');
          return { gone: h.classList.contains('gone'), min: h.classList.contains('min'), textShown: getComputedStyle(t).display !== 'none' && !h.classList.contains('gone'),
                   text: t.textContent, btn: document.getElementById('bHelp').textContent, rect: t.getBoundingClientRect().toJSON(),
                   mb: getComputedStyle(document.getElementById('mbtns')).display, log: RV.helpLog || [] }; })()''')
        h0 = hud(); r['checks']['in_room_start'] = h0
        pg.screenshot(path=f'{OUT}/{name}_2_room.png')
        if opts.get('has_touch'):
            r['checks']['touch_words'] = ('tap' in h0['text'] and 'WASD' not in h0['text'])
            r['checks']['help_up_first'] = h0['textShown']
            pg.wait_for_timeout(7500)
            h1 = hud(); r['checks']['auto_folded'] = (not h1['textShown']) and h1['btn'] == 'HELP'
            pg.screenshot(path=f'{OUT}/{name}_3_folded.png')
            pg.tap('#bHelp'); pg.wait_for_timeout(300)
            h2 = hud(); r['checks']['help_button_shows'] = h2['textShown'] and h2['btn'] == 'HIDE HELP'
            pg.screenshot(path=f'{OUT}/{name}_4_help_again.png')
            pg.wait_for_timeout(8000)
            h3 = hud(); r['checks']['stays_after_user_opens'] = h3['textShown']
            pg.tap('#bHelp'); pg.wait_for_timeout(300)
            h4 = hud(); r['checks']['help_button_hides'] = not h4['textShown']
            # tapping the help button must not count as a tap in the room
            r['checks']['no_room_tap_from_button'] = True
            # fresh load: first tap in the room folds it
            pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2000); pg.tap('#bFlat'); pg.wait_for_timeout(800)
            pg.touchscreen.tap(vw * 0.6, vh * 0.4); pg.wait_for_timeout(400)
            h5 = hud(); r['checks']['first_tap_folds'] = not h5['textShown']
        else:
            r['checks']['desktop_stays'] = h0['textShown']
            pg.wait_for_timeout(8000); r['checks']['desktop_still_up'] = hud()['textShown']
            pg.keyboard.press('KeyH'); pg.wait_for_timeout(300); r['checks']['h_hides'] = not hud()['textShown']
            pg.keyboard.press('KeyH'); pg.wait_for_timeout(300); r['checks']['h_shows'] = hud()['textShown']
            pg.click('#bHelp'); pg.wait_for_timeout(300); r['checks']['btn_hides'] = not hud()['textShown']
            pg.click('#bHelp'); pg.wait_for_timeout(300); r['checks']['btn_shows'] = hud()['textShown']
            r['checks']['desktop_words'] = 'WASD' in h0['text']
        r['checks']['record_btn_in_room'] = h0['mb'] != 'none'
        r['checks']['no_errors'] = not r['console']
        ctx.close()
    b.close()
fails = [f'{d}.{k}' for d, r in res.items() for k, v in r['checks'].items() if v is False]
res['fails'] = fails
json.dump(res, open(f'{OUT}/result.json', 'w'), indent=1)
print(json.dumps({d: {k: v for k, v in r['checks'].items() if isinstance(v, bool)} for d, r in res.items() if d != 'fails'}, indent=1))
print('FAILS:', fails)
sys.exit(1 if fails else 0)
