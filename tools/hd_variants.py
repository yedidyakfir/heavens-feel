"""Turn generated expression PNGs into HD overlays: the masked diff against the quantized base."""
import json
import sys

from PIL import Image

import png2sprite as p

KEEP = "."
ERASE = "#"
FACE = (14, 34, 8, 40)
WIDE = (6, 34, 0, 47)
WINDOWS = {"talk": FACE, "happy": FACE, "ouch": WIDE}
MAX_CHANGED_SHARE = 0.35
EXPRESSION_COLORS = {"B": 0x8FD3F4, "P": 0xF29AA8}


def overlay(base_rows, palette, src, window):
    w, h = len(base_rows[0]), len(base_rows)
    img = p.chroma_key(Image.open(src), p.Bg.AUTO, 120)
    img = p.fit(img, w, h, 0, Image.BOX)
    rows, _ = p.quantize(img, 0, palette)
    y0, y1, x0, x1 = window
    out = [[KEEP] * w for _ in range(h)]
    changed = 0
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if base_rows[y][x] != rows[y][x]:
                out[y][x] = ERASE if rows[y][x] == KEEP else rows[y][x]
                changed += 1
    opaque = sum(ch != KEEP for r in base_rows for ch in r)
    return ["".join(r) for r in out], changed / opaque, rows


def main():
    base = json.load(open(sys.argv[1]))
    palette = {k: int(v) for k, v in base["palette"].items()} | EXPRESSION_COLORS
    result = {}
    for name in sys.argv[2:]:
        rows, share, full = overlay(base["rows"], palette, f"{name}.png", WINDOWS[name])
        print(f"{name}: {share:.1%} of opaque pixels changed", file=sys.stderr)
        if share > MAX_CHANGED_SHARE:
            print(f"{name}: rejected, the model redrew the figure", file=sys.stderr)
            continue
        result[name] = rows
        p.preview(full, palette, 8, f"preview_{name}.png")
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
