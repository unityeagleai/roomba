#!/usr/bin/env python3
"""Builds the original stylised Xanadu roller-disco poster for the bedroom wall.
Background: a generated illustration with no text (tools/src/xanadu_bg.jpg).
Title: hand-built art-deco chrome letters with a neon glow, drawn here."""
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

W, H = 640, 960
SRC = 'tools/src/xanadu_bg.jpg'
OUT = 'assets/img/poster_xanadu.jpg'

bg = Image.open(SRC).convert('RGB')
bw, bh = bg.size
bg = bg.crop((38, 38, bw - 38, bh - 38)).resize((W, H), Image.LANCZOS)

# darken the top a touch more so the title pops
shade = Image.new('L', (W, H), 0)
sd = ImageDraw.Draw(shade)
for y in range(int(H * 0.36)):
    sd.line([(0, y), (W, y)], fill=int(110 * (1 - y / (H * 0.36))))
bg = Image.composite(Image.new('RGB', (W, H), (10, 4, 26)), bg, shade)

# ---------- stroke letters (unit box: w ~1, h 1.4) ----------
def arc(cx, cy, r, a0, a1, n=24):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

L = {
    'X': [[(0, 0), (1, 1.4)], [(1, 0), (0, 1.4)]],
    'A': [[(0, 1.4), (0.5, 0), (1, 1.4)], [(0.2, 0.9), (0.8, 0.9)]],
    'N': [[(0, 1.4), (0, 0), (1, 1.4), (1, 0)]],
    'D': [[(0, 0), (0, 1.4)], [(0, 0), (0.3, 0)] + arc(0.3, 0.7, 0.7, -90, 90) + [(0, 1.4)]],
}
# U arc must go through the bottom (y grows downward): angles 180 -> 0 via 90
L['U'] = [[(0, 0), (0, 0.9)] + [(0.5 + 0.5 * math.cos(math.radians(180 - 180 * i / 24)), 0.9 + 0.5 * math.sin(math.radians(180 - 180 * i / 24))) for i in range(25)] + [(1, 0)]]

def title_mask(text, x0, y0, scale, gap, width):
    m = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(m)
    x = x0
    for ch in text:
        for poly in L[ch]:
            pts = [(x + px * scale, y0 + py * scale) for px, py in poly]
            d.line(pts, fill=255, width=width, joint='curve')
            for p in (pts[0], pts[-1]):
                d.ellipse([p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2], fill=255)
        x += (1.1 if ch == 'D' else 1.0) * scale + gap
    return m

text = 'XANADU'
scale, gap, width = 74, 22, 17
total = sum((1.1 if c == 'D' else 1.0) * scale for c in text) + gap * (len(text) - 1)
x0 = (W - total) / 2
y0 = 70
mask = title_mask(text, x0, y0, scale, gap, width)

def glow(mask, color, radius, strength=1.0):
    g = mask.filter(ImageFilter.GaussianBlur(radius))
    g = g.point(lambda v: min(255, int(v * strength)))
    layer = Image.new('RGB', (W, H), color)
    return layer, g

out = bg.copy()
for col, rad, st in [((255, 40, 170), 26, 1.6), ((255, 70, 200), 12, 1.8), ((120, 220, 255), 5, 1.2)]:
    layer, g = glow(mask, col, rad, st)
    out = Image.composite(layer, out, g)

# chrome gradient fill
chrome = Image.new('RGB', (W, H))
cd = ImageDraw.Draw(chrome)
stops = [(0.0, (255, 255, 255)), (0.35, (150, 230, 255)), (0.5, (60, 40, 120)), (0.55, (255, 120, 210)), (0.8, (255, 220, 140)), (1.0, (255, 255, 230))]
ty0, ty1 = y0 - width, y0 + 1.4 * scale + width
for y in range(H):
    t = min(1, max(0, (y - ty0) / (ty1 - ty0)))
    for i in range(len(stops) - 1):
        if stops[i][0] <= t <= stops[i + 1][0]:
            a, b = stops[i], stops[i + 1]
            k = (t - a[0]) / (b[0] - a[0])
            c = tuple(int(a[1][j] + (b[1][j] - a[1][j]) * k) for j in range(3))
            break
    cd.line([(0, y), (W, y)], fill=c)
edge = mask.filter(ImageFilter.MaxFilter(5))
out = Image.composite(Image.new('RGB', (W, H), (40, 0, 60)), out, edge)
out = Image.composite(chrome, out, mask)
# white neon core line
core = title_mask(text, x0, y0, scale, gap, 3)
out = Image.composite(Image.new('RGB', (W, H), (255, 255, 255)), out, core.filter(ImageFilter.GaussianBlur(0.8)))

# ---------- names ----------
d = ImageDraw.Draw(out)
def spaced(txt, font, y, fill, glowcol, spacing):
    widths = [d.textlength(c, font=font) for c in txt]
    tw = sum(widths) + spacing * (len(txt) - 1)
    m = Image.new('L', (W, H), 0)
    md = ImageDraw.Draw(m)
    x = (W - tw) / 2
    for c, w in zip(txt, widths):
        md.text((x, y), c, font=font, fill=255)
        x += w + spacing
    global out
    for rad, st in [(10, 1.8), (4, 1.6)]:
        layer, g = glow(m, glowcol, rad, st)
        out = Image.composite(layer, out, g)
    out = Image.composite(Image.new('RGB', (W, H), fill), out, m)

fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
fs = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 17)
spaced('OLIVIA NEWTON-JOHN', fb, int(y0 + 1.4 * scale + 34), (235, 255, 255), (40, 200, 255), 4)
spaced('\u2605  ROLLER DISCO  \u2022  1980  \u2605', fs, H - 52, (255, 235, 245), (255, 60, 180), 3)

# thin poster-paper border
final = Image.new('RGB', (W + 24, H + 24), (238, 226, 200))
final.paste(out, (12, 12))
final = final.resize((512, int(512 * (H + 24) / (W + 24))), Image.LANCZOS)
final.save(OUT, quality=86)
print(OUT, final.size)
