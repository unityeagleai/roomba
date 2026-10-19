"""Pack Unity's own childhood photos into one texture atlas for the photo wall above the bed (js/gallery.js).
She sent ten in chat on Mon Oct 19 2026 (two were byte-identical, so nine unique) and then the ping pong table photo:
ten unique pictures. They are only placed, never resized, recoloured or cropped; each gets an 8 px edge-extended
border so mipmaps don't bleed between photos. Writes assets/img/gallery_atlas.jpg and prints the UV rects
(u0, v0, u1, v1, pixel w, pixel h) for js/gallery.js.
Usage (from the repo root): python3 tools/make_gallery_atlas.py"""
import hashlib, json, os
from PIL import Image

SRC = '/mnt/agent/attachments/from-user'
IDS = [  # name used in gallery.js -> chat attachment id
    ('kids', '01a15172-61de-7000-9e86-a2537d669e49'),      # six kids on the sofa
    ('hospital', '01a15172-61de-7000-914a-9e18101052df'),  # carnival prince at the hospital crib
    ('street_a', '01a15172-61de-7000-ab7a-fdf28dff057d'),
    ('street_b', '01a15172-61de-7000-9f7c-ebccfcf982dd'),  # 01a15172-61de-7000-9965-c4b0e57ee494 is the same file
    ('street_c', '01a15172-61de-7000-9c9a-a24010013488'),
    ('street_d', '01a15172-61de-7000-bd33-4b7180e6f13d'),
    ('street_e', '01a15172-61de-7000-881a-80eb2aeaa064'),
    ('street_f', '01a15172-61de-7000-bb9b-a1de08c114d1'),
    ('street_g', '01a15172-61de-7000-8fd1-a3e66b890e00'),
    ('pingpong', '01a15177-bae3-7000-ad76-181146f31ad8'),  # the ping pong table
]
A, CW, CH, COLS, PAD = 2048, 682, 512, 3, 8
atlas = Image.new('RGB', (A, A), (20, 18, 16))
out, seen = {}, set()
for i, (name, aid) in enumerate(IDS):
    p = f'{SRC}/{aid}-image.jpg'
    h = hashlib.md5(open(p, 'rb').read()).hexdigest(); assert h not in seen, name; seen.add(h)
    im = Image.open(p).convert('RGB'); w, hh = im.size
    assert w + 2 * PAD <= CW and hh + 2 * PAD <= CH, (name, im.size)
    cx, cy = (i % COLS) * CW + (CW - w) // 2, (i // COLS) * CH + (CH - hh) // 2
    # edge-extend: border strips copied from the picture's own outer rows / columns, then the picture on top
    atlas.paste(im.resize((w + 2 * PAD, hh + 2 * PAD), Image.NEAREST), (cx - PAD, cy - PAD))
    atlas.paste(im.crop((0, 0, w, 1)).resize((w, PAD)), (cx, cy - PAD)); atlas.paste(im.crop((0, hh - 1, w, hh)).resize((w, PAD)), (cx, cy + hh))
    atlas.paste(im.crop((0, 0, 1, hh)).resize((PAD, hh)), (cx - PAD, cy)); atlas.paste(im.crop((w - 1, 0, w, hh)).resize((PAD, hh)), (cx + w, cy))
    atlas.paste(im, (cx, cy))
    # three.js flipY: v measured from the bottom
    out[name] = [round(cx / A, 5), round(1 - (cy + hh) / A, 5), round((cx + w) / A, 5), round(1 - cy / A, 5), w, hh]
os.makedirs('assets/img', exist_ok=True)
atlas.save('assets/img/gallery_atlas.jpg', quality=90, optimize=True)
print(json.dumps(out))
