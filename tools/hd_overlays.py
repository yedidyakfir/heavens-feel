"""Derive HD overlays: dark-form red irises (from eye windows) and a masked blink diff (if the blink PNG exists)."""
import json
import os
import sys

from PIL import Image

import png2sprite as p

KEEP = "."
ERASE = "#"
base = json.load(open("p_v2_48x64_merged.json"))
rows = base["rows"]
pal = {k: int(v) for k, v in base["palette"].items()}
w, h = base["w"], base["h"]
blank = KEEP * w

# eye windows (rows, cols) read off the 16x preview; darkest palette char is the outline/iris
dark_char = min(pal, key=lambda c: sum(((pal[c] >> s) & 255) for s in (16, 8, 0)))
windows = [(20, 27, 11, 20), (20, 27, 27, 36)]
eye = [list(blank) for _ in range(h)]
for y0, y1, x0, x1 in windows:
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if rows[y][x] == dark_char:
                # keep the top lash row dark; redden the rest of the cluster
                if y > y0 and rows[y - 1][x] == dark_char:
                    eye[y][x] = "X"
print("DARK_EYES overlay rows (non-blank):")
for y, r in enumerate(eye):
    r = "".join(r)
    if r != blank:
        print(f"    {y}: '{r}',")

if os.path.exists(sys.argv[1] if len(sys.argv) > 1 else "sakura_v2_blink.png"):
    src = sys.argv[1] if len(sys.argv) > 1 else "sakura_v2_blink.png"
    img = p.chroma_key(Image.open(src), p.Bg.AUTO, 120)
    img = p.fit(img, w, h, 0, Image.BOX)
    vrows, _ = p.quantize(img, 0, pal)
    face = (16, 30, 9, 38)  # rows, cols window for eye deltas
    out = [list(blank) for _ in range(h)]
    n = 0
    for y in range(face[0], face[1] + 1):
        for x in range(face[2], face[3] + 1):
            a, b = rows[y][x], vrows[y][x]
            if a != b:
                out[y][x] = ERASE if b == KEEP else b
                n += 1
    print(f"BLINK overlay from {src}: {n} differing pixels in face window")
    for y, r in enumerate(out):
        r = "".join(r)
        if r != blank:
            print(f"    {y}: '{r}',")
    p.preview(vrows, pal, 16, "p_v2_blink_48x64.png")
