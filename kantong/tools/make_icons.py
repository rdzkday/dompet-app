"""Ikon Kantong: kantong amber dengan dua koin (periwinkle & rose) yang mengintip — dua orang, satu kantong."""
import sys
from PIL import Image, ImageDraw

OUT = sys.argv[1]
BG = (26, 30, 46)
AMBER = (242, 181, 68)
STITCH = (35, 26, 5)
COIN_A = (143, 162, 255)
COIN_B = (242, 141, 181)


def draw(size, pad_ratio, rounded):
    S = 1024
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=230, fill=BG)
    else:
        d.rectangle([0, 0, S, S], fill=BG)
    k = 1 - 2 * pad_ratio          # skala isi
    cx = S / 2
    def sc(x, y): return (cx + (x - 512) * k, cx + (y - 512) * k)
    def r(v): return v * k
    # koin
    for (x, y, col) in [(420, 330, COIN_A), (600, 300, COIN_B)]:
        X, Y = sc(x, y); R = r(120)
        d.ellipse([X - R, Y - R, X + R, Y + R], fill=col)
    # kantong: badan dengan bawah membulat
    x0, y0 = sc(230, 400); x1, y1 = sc(794, 820)
    rad = r(200)
    d.rounded_rectangle([x0, y0, x1, y1], radius=rad, fill=AMBER)
    d.rectangle([x0, y0, x1, y0 + rad], fill=AMBER)       # atas rata
    # jahitan
    sx0, sy0 = sc(300, 470); sx1, sy1 = sc(724, 750)
    w = max(2, int(r(22)))
    dash, gap = r(46), r(30)
    x = sx0
    while x < sx1:
        d.line([x, sy0, min(x + dash, sx1), sy0], fill=STITCH, width=w)
        x += dash + gap
    return im.resize((size, size), Image.LANCZOS)


draw(192, 0.10, True).save(f'{OUT}/icon-192.png')
draw(512, 0.10, True).save(f'{OUT}/icon-512.png')
draw(512, 0.22, False).save(f'{OUT}/maskable-512.png')
draw(180, 0.12, False).convert('RGB').save(f'{OUT}/apple-touch-icon.png')

svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<rect width="1024" height="1024" rx="230" fill="#1A1E2E"/>
<g transform="translate(51.2 51.2) scale(.9)">
<circle cx="420" cy="330" r="120" fill="#8FA2FF"/><circle cx="600" cy="300" r="120" fill="#F28DB5"/>
<path d="M230 400h564v220a200 200 0 0 1-200 200H430a200 200 0 0 1-200-200z" fill="#F2B544"/>
<path d="M300 470h424" stroke="#231A05" stroke-width="22" stroke-dasharray="46 30"/>
</g></svg>'''
open(f'{OUT}/icon.svg', 'w').write(svg)
print('ok')
