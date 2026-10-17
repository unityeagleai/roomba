"""Desktop browser test: loads the page, walks in on screen, drives the Roomba through its behaviours with the test hooks
and screenshots. Usage: python3 tools/test.py URL OUTDIR"""
import sys, json, time, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': int(os.environ.get('VW', 960)), 'height': int(os.environ.get('VH', 540))})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500)
    pg.screenshot(path=f'{OUT}/00_intro.png')
    pg.click('#bFlat'); pg.wait_for_timeout(1500)
    ev = lambda js: pg.evaluate(js)
    def dbg(): return ev('__rv.debug()')
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(100)
    def wait_state(names, sec):
        t = ev('__rv.time()')
        while ev('__rv.time()') - t < sec:
            s = dbg()['state']
            if s in names: return s
            pg.wait_for_timeout(100)
        return dbg()['state']
    res['checks']['start'] = dbg()
    pg.screenshot(path=f'{OUT}/01_docked.png')
    # it wakes, undocks and notices Unity standing nearby
    ev('__rv.setPlayer(-0.6,-0.9,0.9)'); W(500)
    res['checks']['woke'] = wait_state(['notice', 'follow', 'circle', 'keepAway', 'wander', 'nudge'], 12)
    W(1200); pg.screenshot(path=f'{OUT}/02_noticed.png')
    # toss a crumb -> eat
    ev('__rv.go("wander")'); W(300)
    res['checks']['toss'] = ev('__rv.toss(0.2,-0.3)')
    res['checks']['eat_state'] = wait_state(['eat'], 3)
    t0 = dbg()['eaten']
    for _ in range(60):
        if dbg()['eaten'] > t0: break
        W(250)
    res['checks']['ate'] = dbg()['eaten'] > t0
    pg.screenshot(path=f'{OUT}/03_ate.png')
    # talking from across the room -> it comes over / converses
    ev('__rv.setPlayer(1.0,1.2,0.4)'); ev('__rv.go("wander")'); W(400)
    ev('__rv.talk(1.5,-30)')
    res['checks']['talk'] = wait_state(['come', 'converse'], 3)
    res['checks']['talk_reached'] = wait_state(['converse'], 14)
    ev('__rv.talk(1.2,-30)'); W(2600)
    pg.screenshot(path=f'{OUT}/04_talk.png')
    # loud -> startled or excited
    ev('__rv.mood({affection:0.3})'); ev('__rv.go("wander")'); W(300)
    ev('__rv.loud()')
    res['checks']['loud'] = wait_state(['startled', 'excited'], 2)
    W(500); pg.screenshot(path=f'{OUT}/05_startled.png')
    # offended -> sulk -> backs into a corner
    W(1500); ev('__rv.mood({offended:0.9})'); ev('__rv.go("sulk")')
    W(9000)
    res['checks']['sulk'] = dbg()
    pg.screenshot(path=f'{OUT}/06_sulk.png')
    ev('__rv.talk(2.5,-30)'); W(2600)
    res['checks']['sulk_talk_said'] = dbg()['said']
    # bribe
    st = dbg(); ev(f'__rv.toss({st["x"]*0.8},{st["z"]*0.8})'); W(300)
    res['checks']['bribe'] = [dbg()['state'], dbg()['said']]
    W(5000)
    # pet
    ev('__rv.go("wander")'); W(200); res['checks']['pet'] = ev('__rv.pet()'); W(400)
    res['checks']['pet_state'] = dbg()['state']; pg.screenshot(path=f'{OUT}/07_pet.png')
    # follow / circle / nudge: stand still near it
    st = dbg(); ev(f'__rv.setPlayer({st["x"]+0.0},{st["z"]+0.9 if st["z"]<1.0 else st["z"]-0.9})'); ev('__rv.go("follow")')
    seen = set()
    for _ in range(80):
        seen.add(dbg()['state']); W(250)
    res['checks']['social_states'] = sorted(seen)
    # low battery -> goes home and docks
    ev('__rv.mood({energy:0.05})'); ev('__rv.go("home")')
    res['checks']['docked_again'] = wait_state(['dock'], 30)
    pg.screenshot(path=f'{OUT}/08_home.png')
    # a free-running minute: let it live
    ev('__rv.mood({energy:1})'); ev('__rv.go("wander")'); ev('__rv.setPlayer(0.3,1.2,0)')
    seen = set()
    for i in range(120):
        seen.add(dbg()['state']); W(500)
        if i == 60: pg.screenshot(path=f'{OUT}/09_free.png')
    res['checks']['free_states'] = sorted(seen)
    # view from above the bed / overview
    ev('__rv.setPlayer(0.6,1.9,0)'); W(800); pg.screenshot(path=f'{OUT}/10_room.png')
    res['final'] = dbg(); res['info'] = ev('__rv.info()')
    log = ev('__rv.log()'); res['said'] = [l['say'] for l in log if 'say' in l][-40:]
    res['states'] = [l['state'] for l in log if 'state' in l][-60:]
    b.close()
print(json.dumps(res, indent=1))
