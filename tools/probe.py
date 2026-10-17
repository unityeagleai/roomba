import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; script = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('pageerror', lambda e: print('PAGEERROR', e))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2000); pg.click('#bFlat'); pg.wait_for_timeout(500)
    exec(open(script).read())
    b.close()
