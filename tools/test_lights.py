"""Desktop test for the light switch (js/nightlight.js): the switch is on the front wall right of the door, clear of the
door frame and the big wall screen; a ray click on it (the same path a Quest trigger uses: RV.media.selectStart, and the
desktop RV.media.click) flips the big light off and on again. Off: the ceiling lamp light goes to 0, room fill and
moonlight drop, grey self-light on prints is dimmed, the ceiling fitting goes dark, the locator LED glows. Stays on:
the lava lamp light + glow, the ceiling stars' green glow, the fairy lights over the Xanadu poster, the Xanadu poster,
the Xanadu mirror image + pink neon, the Parallel Universe keycard poster. Screens: the room really gets darker, the lava
lamp and stars still glow. Usage: python3 tools/test_lights.py URL OUTDIR"""
import sys, json, os
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat
URL = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
res = {'console': [], 'checks': {}, 'fail': []}
def check(name, ok, info=None):
    res['checks'][name] = {'ok': bool(ok), 'info': info}
    if not ok: res['fail'].append(name)
def lum(path, box=None):
    im = Image.open(path).convert('L')
    if box: im = im.crop(box)
    return round(ImageStat.Stat(im).mean[0], 1)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('console', lambda m: res['console'].append(f'{m.type}: {m.text}'))
    pg.on('response', lambda r: res['console'].append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)
    pg.on('pageerror', lambda e: res['console'].append(f'PAGEERROR: {e}'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(3000)
    pg.click('#bFlat'); pg.wait_for_timeout(1500)
    ev = lambda js, *a: pg.evaluate(js, *a)
    def W(ms):
        t0 = ev('__rv.time()')
        while ev('__rv.time()') - t0 < ms / 1000: pg.wait_for_timeout(80)
    snap = '''(() => { const L = RV.lights, D = L._debug, out = {};
      out.on = L.on(); out.level = L.level(); out.hemi = +D.hemi.intensity.toFixed(3); out.moon = +D.moon.intensity.toFixed(3); out.lamp = +D.lamp.intensity.toFixed(3);
      out.dome = D && L.dome.material.color.getHexString();
      let lava = null; RV.scene.traverse(o => { if (o.isPointLight && o !== D.lamp && o.color.getHex() !== 0x7ab4ff && o.position.y < 1.5 && lava === null) lava = o; });
      out.lavaLight = lava ? { i: +lava.intensity.toFixed(3), c: lava.color.getHexString(), y: +lava.position.y.toFixed(2), vis: lava.visible } : null;
      const stars = []; RV.scene.traverse(o => { if (o.isMesh && o.material && o.material.emissive && o.material.emissive.getHex() === 0x9fffc0) stars.push(o.name || 'mesh'); });
      out.stars = stars.length;
      const md = RV.media._debug; out.xanadu = md.poster.material.emissive.getHexString(); out.xanaduVis = md.poster.visible;
      const bulbs = [], bc = ['ffd27a', 'ff7ad6', '7ae8ff']; RV.scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial && o.material.toneMapped === false && bc.includes(o.material.color.getHexString())) { let v = true; o.traverseAncestors(a => { if (!a.visible) v = false; }); bulbs.push([o.name, v && o.visible, o.material.type]); } });
      out.fairy = bulbs.length; out.fairyVisible = bulbs.every(b => b[1]); out.fairyTypes = [...new Set(bulbs.map(b => b[2]))];
      out.photoEm = RV.gallery.photos.material.emissive.getHexString();
      const vp = RV.vposter && RV.vposter._debug; out.vposter = RV.vposter ? !!RV.vposter.root || true : null;
      return out; })()'''
    s0 = ev(snap); res['day'] = s0
    sw = ev('''(() => { const L = RV.lights; L.switchObj.updateMatrixWorld(true); const v = new THREE.Vector3(); L.switchObj.getWorldPosition(v);
      return { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3), RZ: RV.room.RZ, WALL: RV.media._debug.WALL ? JSON.stringify(RV.media._debug.WALL) : null }; })()''')
    res['switch'] = sw
    check('switch_on_front_wall_right_of_door', abs(sw['z'] - sw['RZ']) < 0.02 and -0.9 < sw['x'] < -0.74 and 1.0 < sw['y'] < 1.4, sw)
    check('day_defaults', s0['on'] and s0['lamp'] > 0.4 and s0['hemi'] > 0.6, s0)
    # flip with a desktop-style click, aimed from the middle of the room at the switch
    ev('__rv.setPlayer(-0.6, 0.9, 0)'); W(150); ev('__rv.faceAt(-0.80, 1.22, 2.2)'); W(400)
    pg.screenshot(path=f'{OUT}/00_switch_day.png')
    ray = '''(() => { const o = new THREE.Vector3(-0.6, 1.6, 0.9), t = new THREE.Vector3(-0.80, 1.22, RV.room.RZ); return [o.toArray(), t.sub(o).normalize().toArray()]; })()'''
    o, d = ev(ray)
    ht = ev('([o, d]) => RV.media.hoverT(new THREE.Vector3(...o), new THREE.Vector3(...d))', [o, d])
    check('switch_hoverable', ht is not None and ht < 2, ht)
    ev('__rv.setPlayer(0.3, -0.6, 0)'); W(150); ev('__rv.faceAt(-2.0, 1.5, -0.6)'); W(500); pg.screenshot(path=f'{OUT}/01_day_room.png')
    ev('__rv.setPlayer(0.6, 0.6, 0)'); W(150); ev('__rv.faceAt(0.3, 2.6, -0.5)'); W(500); pg.screenshot(path=f'{OUT}/02_day_ceiling.png')
    ev('__rv.setPlayer(-0.6, 0.9, 0)'); W(150)
    r = ev('([o, d]) => RV.media.selectStart(null, new THREE.Vector3(...o), new THREE.Vector3(...d))', [o, d])
    W(700); s1 = ev(snap); res['night'] = s1
    check('trigger_turns_big_light_off', r and not s1['on'] and s1['level'] == 0, [r, s1['on'], s1['level']])
    check('ceiling_lamp_off', s1['lamp'] == 0, s1['lamp'])
    check('room_fill_dropped', s1['hemi'] < 0.15 and s1['moon'] < s0['moon'], [s1['hemi'], s1['moon']])
    check('ceiling_fitting_dark', s1['dome'] != s0['dome'], [s0['dome'], s1['dome']])
    check('photos_selflight_dimmed', s1['photoEm'] != s0['photoEm'], [s0['photoEm'], s1['photoEm']])
    check('lava_lamp_stays_on', s1['lavaLight'] and s1['lavaLight']['i'] > 0.2 and s1['lavaLight']['vis'], [s0['lavaLight'], s1['lavaLight']])
    check('stars_stay_glowing', s1['stars'] >= 1, s1['stars'])
    check('fairy_lights_stay_on', s1['fairy'] >= 1 and s1['fairyVisible'] and s1['fairyTypes'] == ['MeshBasicMaterial'], [s1['fairy'], s1['fairyTypes']])
    check('xanadu_poster_lit_at_night', s1['xanaduVis'] and int(s1['xanadu'][:2], 16) > int(s0['xanadu'][:2], 16), [s0['xanadu'], s1['xanadu']])
    # unlit glows untouched: mirror image + neon, keycard poster image/glow, lava glow, fairy bulbs -> all MeshBasic / shader
    keep = ev('''(() => { const out = {}; const names = []; RV.scene.traverse(o => { if (o.isMesh && o.visible && /mirror|neon|xanadu|keycard|vposter|lava|bulb|fairy/i.test(o.name)) names.push([o.name, o.material.type, o.material.emissive ? o.material.emissive.getHexString() : null]); }); return names; })()''')
    res['kept'] = keep
    ev('__rv.setPlayer(0.3, -0.6, 0)'); W(150); ev('__rv.faceAt(-2.0, 1.5, -0.6)'); W(500); pg.screenshot(path=f'{OUT}/03_night_room.png')
    ev('__rv.setPlayer(0.6, 0.6, 0)'); W(150); ev('__rv.faceAt(0.3, 2.6, -0.5)'); W(500); pg.screenshot(path=f'{OUT}/04_night_ceiling.png')
    ev('__rv.setPlayer(0.0, 0.0, 0)'); W(150); ev('__rv.faceAt(2.6, 1.6, -0.6)'); W(500); pg.screenshot(path=f'{OUT}/05_night_right_wall.png')
    ev('__rv.setPlayer(-0.6, 0.9, 0)'); W(150); ev('__rv.faceAt(-0.80, 1.22, 2.2)'); W(400); pg.screenshot(path=f'{OUT}/06_switch_night.png')
    ld, ln = lum(f'{OUT}/01_day_room.png'), lum(f'{OUT}/03_night_room.png')
    cd, cn = lum(f'{OUT}/02_day_ceiling.png'), lum(f'{OUT}/04_night_ceiling.png')
    res['lum'] = {'room_day': ld, 'room_night': ln, 'ceiling_day': cd, 'ceiling_night': cn}
    check('room_really_darker', ln < ld * 0.7, res['lum'])
    # stars: bright greenish pixels still on the night ceiling
    im = Image.open(f'{OUT}/04_night_ceiling.png').convert('RGB'); px = im.load(); W_, H_ = im.size
    green = sum(1 for x in range(0, W_, 2) for y in range(0, H_, 2) if px[x, y][1] > 110 and px[x, y][1] > px[x, y][0] + 15 and px[x, y][1] > px[x, y][2] - 10)
    res['star_pixels'] = green
    check('stars_visible_at_night', green > 30, green)
    # flip back with a desktop click
    r2 = ev('([o, d]) => RV.media.click(new THREE.Vector3(...o), new THREE.Vector3(...d))', [o, d]); W(700); s2 = ev(snap)
    check('click_turns_big_light_back_on', r2 and s2['on'] and s2['lamp'] == s0['lamp'] and s2['hemi'] == s0['hemi'] and s2['moon'] == s0['moon'] and s2['photoEm'] == s0['photoEm'] and s2['xanadu'] == s0['xanadu'], s2)
    # a ray that misses the switch does not flip it
    o2, d2 = ev('''(() => { const o = new THREE.Vector3(-0.6, 1.6, 0.9), t = new THREE.Vector3(0.6, 0.5, -RV.room.RZ); return [o.toArray(), t.sub(o).normalize().toArray()]; })()''')
    ev('([o, d]) => RV.media.click(new THREE.Vector3(...o), new THREE.Vector3(...d))', [o2, d2]); W(300)
    check('miss_does_not_flip', ev('RV.lights.on()'), None)
    res['draws'] = ev('RV.renderer.info.render.calls')
    b.close()
http = [c for c in res['console'] if c.startswith('HTTP')]
only_eps = all('episodes.json' in c for c in http)
errs = [c for c in res['console'] if c.startswith('PAGEERROR') or (c.startswith('HTTP') and 'episodes.json' not in c)
        or (c.startswith('error') and not (only_eps and 'Failed to load resource' in c))]
res['errors'] = errs
if errs: res['fail'].append('console_errors')
json.dump(res, open(f'{OUT}/result.json', 'w'), indent=1)
print(json.dumps({'fail': res['fail'], 'errors': errs, 'lum': res.get('lum'), 'stars': res.get('star_pixels'), 'failed': {k: v for k, v in res['checks'].items() if not v['ok']}}, indent=1))
sys.exit(1 if res['fail'] else 0)
