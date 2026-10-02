"""Experiment: median-cut to many colours, then merge near-duplicates, then snap. Frees slots for small details."""
import json
import sys

from PIL import Image

import png2sprite as p

RGBA = "RGBA"


def merged_palette(img, k_initial, merge_dist):
    w, h = img.size
    px = img.load()
    opaque = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] >= p.OPAQUE_ALPHA]
    strip = Image.new("RGB", (len(opaque), 1))
    strip.putdata([px[x, y][:3] for x, y in opaque])
    q = strip.quantize(colors=k_initial, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = q.getpalette()[: 3 * k_initial]
    counts = {}
    for i in q.get_flattened_data() if hasattr(q, "get_flattened_data") else q.getdata():
        counts[i] = counts.get(i, 0) + 1
    cols = [(pal[3 * i], pal[3 * i + 1], pal[3 * i + 2], counts[i]) for i in counts]
    cols.sort(key=lambda c: -c[3])
    kept = []
    for r, g, b, n in cols:
        near = next((k for k in kept if sum((a - c) ** 2 for a, c in zip(k[:3], (r, g, b))) ** 0.5 < merge_dist), None)
        if near is None:
            kept.append([r, g, b, n])
        else:  # weighted merge
            t = near[3] + n
            near[0] = (near[0] * near[3] + r * n) // t
            near[1] = (near[1] * near[3] + g * n) // t
            near[2] = (near[2] * near[3] + b * n) // t
            near[3] = t
    return {p.CHARS[i]: (c[0] << 16) | (c[1] << 8) | c[2] for i, c in enumerate(kept)}


src, size, k0, dist, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
tw, th = (int(v) for v in size.split("x"))
img = p.chroma_key(Image.open(src), p.Bg.AUTO, 120)
img = p.fit(img, tw, th, 0, Image.BOX)
pal = merged_palette(img, k0, dist)
rows, pal = p.quantize(img, 0, pal)
used = sorted({ch for r in rows for ch in r if ch != "."})
print("colours kept:", len(pal), "used:", len(used))
json.dump({"w": tw, "h": th, "rows": rows, "palette": pal}, open(out + ".json", "w"), indent=1)
p.preview(rows, pal, 16, out + ".png")
