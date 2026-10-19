"""Desktop test for the Roomba's robot voice (js/roomba.js + assets/audio/roomba_voice.*): the floating speech bubble
never shows (it showed through the bed); the voice sprite loads; it greets you once you're in; every line it says has a
clip; foot apologies are spoken; the playful punishment (spoken line, then Unity's song 'The Roomba Ran Away' through the
Roomba's own speaker, dancing round your feet) starts by itself when you walk over a spot it just cleaned, and a pet
cancels it with a spoken line and the song stops. Usage: python3 tools/test_roomba_voice.py URL OUTDIR"""
import sys, json, os, re
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = {'console': [], 'checks': {}, 'fail': []}
def check(name, ok, info=None):
    res['checks'][name] = {'ok': bool(ok), 'info': info}
    if not ok: res['fail'].append(name)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('response', lambda r: res['console'].append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500)
    ev = lambda js, *a: pg.evaluate(js, *a)
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(80)
    pg.click('#bFlat')
    for _ in range(60):
        if ev('!!RV.roomba.voiceReady'): break
        pg.wait_for_timeout(250)
    check('voice_loaded', ev('!!RV.roomba.voiceReady'), ev('RV.roomba.vox.map ? Object.keys(RV.roomba.vox.map).length : 0'))
    W(2500)
    sp = ev('RV.roomba.vox.spoken.slice()')
    res['spoken_after_entry'] = sp
    check('greets_on_entry', ev('RV.roomba.vox.greeted') and any(s['text'] in ('WELCOME HOME, UNITY', "HI UNITY. I CLEANED. YOU'RE WELCOME.", "OH. YOU'RE BACK. ALL HAIL ME.") for s in sp), sp)
    # bubble never visible
    bub = ev('''(() => { let n = 0, vis = 0; RV.scene.traverse(o => { if (o.isSprite && o.renderOrder === 10) { n++; if (o.visible) vis++; } }); return { n, vis }; })()''')
    check('no_floating_bubble', bub['vis'] == 0, bub)
    # every line in roomba.js has a voice clip
    src = open(os.path.join(ROOT, 'js/roomba.js')).read()
    lines = set()
    for m in re.finditer(r'\b(?:say|boopFoot)\(', src):
        i = j = m.end(); depth = 1
        while depth and j < len(src): depth += {'(': 1, ')': -1}.get(src[j], 0); j += 1
        for q in re.finditer(r"'((?:[^'\\]|\\.)*)'", src[i:j - 1]):
            t = q.group(1).replace("\\'", "'")
            if t.strip() and not (t.startswith(' ') or t.endswith(' ')) and t not in ('wall', 'bed leg', 'foot', 'silent'): lines.add(t)
    for name in ('EAT', 'REPLIES', 'GREET', 'PUNISH_LINES'):
        m = re.search(name + r'\s*=\s*([\[{].*?[\]}]);', src)
        for q in re.finditer(r"'((?:[^'\\]|\\.)*)'", m.group(1)):
            t = q.group(1).replace("\\'", "'")
            if t not in ('crumb', 'sock', 'note', 'cable', 'papers', 'cartridge'): lines.add(t)
    vmap = json.load(open(os.path.join(ROOT, 'assets/audio/roomba_voice.json')))['lines']
    missing = sorted(t for t in lines if t not in vmap)
    res['line_count'] = len(lines)
    check('every_line_has_a_clip', not missing and len(lines) > 100, missing)
    # foot apology spoken through the voice (say(), the same path the foot bump uses)
    W(4000)
    ok = ev("RV.roomba.speak('SORRY. YOUR FOOT.', true)"); W(300)
    check('foot_apology_spoken', ok and ev('RV.roomba.lastSpoken') == 'SORRY. YOUR FOOT.', ev('RV.roomba.lastSpoken'))
    W(2500)
    # natural punishment: let it clean a stretch, then walk over the fresh trail
    ev("RV.roomba.punishDebug.sure = true; RV.roomba.punishDebug.reset(); __rv.go('wander')")
    tr = []
    for _ in range(40):
        W(500); tr = ev('RV.roomba.punishDebug.trail()')
        if len(tr) >= 8: break
    res['trail_len'] = len(tr)
    check('cleaned_trail_recorded', len(tr) >= 8, len(tr))
    rb = ev('RV.roomba.debug()')
    cand = [q for q in tr if abs(q['x']) < 2.0 and abs(q['z']) < 1.7 and ((q['x'] - rb['x']) ** 2 + (q['z'] - rb['z']) ** 2) ** 0.5 > 0.8]
    pt = cand[0] if cand else tr[0]
    res['roomba_at_walk'] = rb
    st = None
    # walk across the spot: move the player in small steps so their speed is a normal walk (~0.8 m/s)
    for attempt in range(3):   # it may wander off to eat a crumb (not punishable while eating): try a few walks
      ev(f"__rv.setPlayer({pt['x'] - 0.6}, {pt['z']})"); W(700)   # stand at the edge first, then walk across at ~0.8 m/s
      if ev('RV.roomba.debug().state') not in ('wander', 'idle', 'notice', 'follow', 'circle', 'keepAway'): ev("__rv.go('wander')")
      for k in range(30):
        x = pt['x'] - 0.6 + k * 0.04
        ev(f"__rv.setPlayer({x}, {pt['z']})"); W(50)
        st = ev('RV.roomba.debug().state'); res.setdefault('walk', []).append([attempt, round(x, 2), round(ev('RV.roomba.player.speed'), 2), st, ev('[RV.roomba.punishDebug.checks, RV.roomba.punishDebug.miss, RV.roomba.player.x, RV.roomba.player.z]')])
        if st == 'punish': break
      if st == 'punish': break
      ev(f"__rv.setPlayer({pt['x'] + 1.0}, {pt['z']})"); W(800)
    res['punish_why'] = ev('RV.roomba.punishDebug.why'); res['state_after_walk'] = st
    check('walking_on_fresh_clean_spot_triggers_punishment', st == 'punish', [st, res['punish_why'], pt])
    if st != 'punish': ev('RV.roomba.punish()')
    W(400)
    check('punish_line_spoken', ev('RV.roomba.lastSpoken') == "WHERE DO YOU THINK YOU'RE GOING? I JUST CLEANED THAT SPOT. NOW I NEED TO PUNISH YOU.", ev('RV.roomba.lastSpoken'))
    for _ in range(60):
        if ev('RV.roomba.song.playing()'): break
        W(300)
    dur = ev('RV.roomba.song.buf() ? RV.roomba.song.buf().duration : 0')
    check('runaway_song_plays', ev('RV.roomba.song.playing()') and 160 < dur < 180, dur)
    W(3000); pg.screenshot(path=f'{OUT}/01_punish_dance.png')
    check('still_punishing_during_song', ev('RV.roomba.debug().state') == 'punish' and ev('RV.roomba.song.playing()'), ev('RV.roomba.debug().state'))
    ev('__rv.pet()'); W(500)
    check('pet_cancels_punishment', not ev('RV.roomba.song.playing()') and ev('RV.roomba.lastSpoken') == 'OK OK. PUNISHMENT CANCELLED.', ev('RV.roomba.lastSpoken'))
    W(3500)
    check('back_to_normal_after', ev('RV.roomba.debug().state') != 'punish', ev('RV.roomba.debug().state'))
    # not again right away (4 minute cooldown)
    ev('RV.roomba.punishDebug.sure = true')
    for k in range(30):
        ev(f"__rv.setPlayer({pt['x'] - 0.6 + k * 0.04}, {pt['z']})"); pg.wait_for_timeout(50)
    check('cooldown_no_repeat', ev('RV.roomba.debug().state') != 'punish', ev('RV.roomba.debug().state'))
    ev('RV.roomba.punishDebug.sure = false')
    res['log_tail'] = ev('__rv.log().slice(-15)')
    check('bubble_still_hidden', ev('''(() => { let vis = 0; RV.scene.traverse(o => { if (o.isSprite && o.renderOrder === 10 && o.visible) vis++; }); return vis; })()''') == 0)
    b.close()
http = [c for c in res['console'] if c.startswith('HTTP')]
errs = [c for c in res['console'] if c.startswith('PAGEERROR') or (c.startswith('HTTP') and 'episodes.json' not in c)]
res['errors'] = errs
if errs: res['fail'].append('console_errors')
json.dump(res, open(f'{OUT}/result.json', 'w'), indent=1)
print(json.dumps({'fail': res['fail'], 'errors': errs, 'failed': {k: v for k, v in res['checks'].items() if not v['ok']}}, indent=1)[:3000])
sys.exit(1 if res['fail'] else 0)
