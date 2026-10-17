"""Crops the four posters out of the charlie-season bedroom (img/room.png, drawn 4x from a 400x225 canvas)
so the 3D room wears the same posters as the arcade site. Run from the repo root: python3 tools/make_assets.py"""
from PIL import Image
SRC = '/home/sprite/charlie-season/img/room.png'
room = Image.open(SRC).convert('RGB')
S = 4
POSTERS = {
    'poster_roomba_king': (68, 12, 107, 63),
    'poster_the_papers': (112, 20, 147, 71),
    'poster_liminal': (226, 10, 275, 49),
    'poster_no_push': (308, 10, 389, 53),
}
for name, (x0, y0, x1, y1) in POSTERS.items():
    im = room.crop((x0 * S, y0 * S, x1 * S, y1 * S))
    im.save(f'assets/img/{name}.png', optimize=True)
    print(name, im.size)
