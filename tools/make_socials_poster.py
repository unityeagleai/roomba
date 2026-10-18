#!/usr/bin/env python3
"""Builds Unity's 'find me' poster for the bedroom wall: an 80s arcade-style card with her 8-bit Unity Eagle sprite
and where to find her. Every link on it comes from her own contact page (unityeagleai.com/contact, checked Oct 18 2026):
  X          @unityeagle        https://x.com/unityeagle
  Instagram  @unityeagle        https://instagram.com/unityeagle
  Website    unityeagleai.com   https://unityeagleai.com
Output: assets/img/poster_socials.png (1024 x 1408, drawn big so the handles stay sharp in a Quest 3)."""
from PIL import Image, ImageDraw, ImageFilter
from PIL import ImageFont

W, H = 1024, 1408
OUT = 'assets/img/poster_socials.png'
PS = 'assets/fonts/PressStart2P-Regular.ttf'
SB = '/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-ExtraBold.ttf'   # handles: a clear lowercase face, baked into the PNG
SR = '/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Bold.ttf'
INK = (16, 8, 32)
PINK = (255, 63, 209)
HOT = (255, 122, 214)
YEL = (255, 225, 74)
GRN = (92, 224, 122)
CYAN = (70, 200, 210)
WHITE = (250, 246, 236)


def font(path, size):
    return ImageFont.truetype(path, size)


def fit(path, text, max_w, start):
    s = start
    while s > 8:
        f = font(path, s)
        if f.getbbox(text)[2] - f.getbbox(text)[0] <= max_w:
            return f
        s -= 2
    return font(path, s)


def centered(d, y, text, f, fill, shadow=None, cx=W // 2):
    b = f.getbbox(text)
    x = cx - (b[2] - b[0]) // 2 - b[0]
    if shadow:
        d.text((x + 6, y + 6), text, font=f, fill=shadow)
    d.text((x, y), text, font=f, fill=fill)
    return b[3] - b[1]


# ---------- background: night-purple gradient, a pixel grid floor, scanlines ----------
im = Image.new('RGB', (W, H), INK)
d = ImageDraw.Draw(im)
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(16 + 46 * t), int(8 + 10 * t), int(32 + 62 * t)))
# retro sun behind the sprite
sun = Image.new('L', (W, H), 0)
sd = ImageDraw.Draw(sun)
sd.ellipse((W // 2 - 220, 236, W // 2 + 220, 676), fill=255)
for k, yy in enumerate(range(480, 678, 26)):
    sd.rectangle((0, yy, W, yy + 6 + k * 2), fill=0)
sunc = Image.new('RGB', (W, H), (0, 0, 0))
scd = ImageDraw.Draw(sunc)
for y in range(236, 678):
    t = (y - 236) / 440
    scd.line([(0, y), (W, y)], fill=(255, int(225 - 150 * t), int(74 + 120 * t)))
im = Image.composite(Image.blend(im, sunc, 0.55), im, sun)
d = ImageDraw.Draw(im)

# ---------- the double pixel border (pink outside, yellow inside) ----------
for i, (inset, col, w) in enumerate([(14, PINK, 14), (40, YEL, 6)]):
    d.rectangle((inset, inset, W - 1 - inset, H - 1 - inset), outline=col, width=w)
# corner studs
for cx in (40, W - 41):
    for cy in (40, H - 41):
        d.rectangle((cx - 12, cy - 12, cx + 12, cy + 12), fill=GRN)

# ---------- header ----------
y = 78
y += centered(d, y, 'FIND ME ON', font(PS, 40), YEL, shadow=INK) + 30
f_title = fit(PS, 'UNITY EAGLE', W - 150, 84)
centered(d, y, 'UNITY EAGLE', f_title, WHITE, shadow=PINK)

# ---------- Unity Eagle sprite, pixel-crisp ----------
sp = Image.open('assets/img/unity_eagle_sprite.png').convert('RGBA')
sp = sp.crop(sp.getbbox())
scale = 2.6
sp = sp.resize((round(sp.width * scale), round(sp.height * scale)), Image.NEAREST)
sx, sy = W // 2 - sp.width // 2, 268
# soft dark halo so she reads against the sun
halo = Image.new('L', (W, H), 0)
halo.paste(sp.split()[3], (sx, sy))
halo = halo.filter(ImageFilter.GaussianBlur(14))
im = Image.composite(Image.new('RGB', (W, H), INK), im, halo.point(lambda v: int(v * 0.6)))
im.paste(sp, (sx, sy), sp)
d = ImageDraw.Draw(im)
centered(d, sy + sp.height + 18, '1P  UNITY', font(PS, 26), GRN, shadow=INK)

# ---------- the three rows ----------
rows = [
    ('X', '@unityeagle', 'x.com/unityeagle', CYAN),
    ('INSTAGRAM', '@unityeagle', 'instagram.com/unityeagle', PINK),
    ('WEBSITE', 'unityeagleai.com', '', YEL),
]
f_chip = font(PS, 30)
f_url = font(SR, 34)
top = 736
row_h = 190
handle_fonts = [fit(SB, r[1], W - 200, 70) for r in rows]
hs = min(f.size for f in handle_fonts)
f_handle = font(SB, hs)            # one size for every handle, so they line up
for i, (chip, handle, url, col) in enumerate(rows):
    y0 = top + i * row_h
    # panel
    d.rectangle((70, y0, W - 71, y0 + row_h - 22), fill=(12, 6, 26), outline=col, width=5)
    # chip label, sitting on the panel's top edge
    cb = f_chip.getbbox(chip)
    cw = cb[2] - cb[0] + 34
    d.rectangle((96, y0 - 20, 96 + cw, y0 + 26), fill=col)
    d.text((96 + 17 - cb[0], y0 - 20 + (46 - (cb[3] - cb[1])) // 2 - cb[1]), chip, font=f_chip, fill=INK)
    # handle, big (placed by its visible ink, not the font's line box)
    hb = f_handle.getbbox(handle)
    ink_top = y0 + (36 if url else 52)
    hy = ink_top - hb[1]
    centered(d, hy, handle, f_handle, WHITE)
    if url:
        ub = f_url.getbbox(url)
        uy = hy + hb[3] + 14 - ub[1]
        centered(d, uy, url, f_url, col)
        assert uy + ub[3] <= y0 + row_h - 22 - 10, ('url spills out of its panel', chip, uy + ub[3], y0 + row_h - 22)

# ---------- footer ----------
centered(d, H - 110, 'PRESS START TO FOLLOW', font(PS, 28), HOT, shadow=INK)

# ---------- scanlines + a little paper wear ----------
sl = Image.new('RGB', (W, H), (0, 0, 0))
sld = ImageDraw.Draw(sl)
for yy in range(0, H, 4):
    sld.line([(0, yy), (W, yy)], fill=(40, 40, 40))
im = Image.composite(Image.new('RGB', (W, H), (0, 0, 0)), im, sl.convert('L').point(lambda v: v // 3))
im.save(OUT, optimize=True)
print(OUT, im.size, 'handle font', hs, 'sprite', (sx, sy, sp.width, sp.height), 'last panel bottom', top + 2 * row_h + row_h - 22)
