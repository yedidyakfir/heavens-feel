"""Convert a generated chibi PNG into Sprite rows + palette (the hooks/sprites.ts format)."""
from __future__ import annotations

import argparse
import collections
from enum import StrEnum
import json
import sys

from PIL import Image

CHARS = "HhLRrSsEeWBMUuCkKOwoZXTPpVGYyAaDdFfIiJjNnQqgbcfijlmnqtvxz0123456789"
RGBA = "RGBA"
RGB = "RGB"
TRANSPARENT = "."
PREVIEW_SCALE = 16
OPAQUE_ALPHA = 128
MAGENTA = (255, 0, 255)
WHITE = (255, 255, 255)


class Filter(StrEnum):
    NEAREST = "nearest"
    BOX = "box"


FILTERS = {Filter.NEAREST: Image.NEAREST, Filter.BOX: Image.BOX}


class Bg(StrEnum):
    AUTO = "auto"
    MAGENTA = "magenta"
    WHITE = "white"
    ALPHA = "alpha"


def key_color(px, w: int, h: int, bg: Bg) -> tuple[int, int, int]:
    if bg == Bg.MAGENTA:
        return MAGENTA
    if bg == Bg.WHITE:
        return WHITE
    # auto: the colour most of the four corners share
    corners = [px[0, 0][:3], px[w - 1, 0][:3], px[0, h - 1][:3], px[w - 1, h - 1][:3]]
    return max(set(corners), key=corners.count)


def chroma_key(img: Image.Image, bg: Bg, tol: int) -> Image.Image:
    img = img.convert(RGBA)
    if bg == Bg.ALPHA:
        return img
    w, h = img.size
    px = img.load()
    key = key_color(px, w, h, bg)

    def near(c):
        return sum(abs(a - b) for a, b in zip(c[:3], key)) <= tol

    # flood-fill from the corners so key-coloured pixels inside the character survive
    seen = bytearray(w * h)
    queue = collections.deque()
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if near(px[x, y]):
            queue.append((x, y))
            seen[y * w + x] = 1
    while queue:
        x, y = queue.popleft()
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and near(px[nx, ny]):
                seen[ny * w + nx] = 1
                queue.append((nx, ny))
    return img


def fit(img: Image.Image, tw: int, th: int, pad: int, resample: int) -> Image.Image:
    bbox = img.getbbox()
    if bbox is None:
        sys.exit("image is fully transparent after background removal")
    img = img.crop(bbox)
    # letterbox into the target aspect; nearest keeps outlines crisp at 24 px
    sw, sh = img.size
    scale = min((tw - 2 * pad) / sw, (th - 2 * pad) / sh)
    nw, nh = max(1, round(sw * scale)), max(1, round(sh * scale))
    small = img.resize((nw, nh), resample)
    canvas = Image.new(RGBA, (tw, th), (0, 0, 0, 0))
    canvas.paste(small, ((tw - nw) // 2, th - pad - nh))
    return canvas


def snap_to_palette(px, opaque, w: int, h: int, fixed: dict[str, int]):
    pal = {ch: ((v >> 16) & 255, (v >> 8) & 255, v & 255) for ch, v in fixed.items()}

    def nearest(c):
        return min(pal, key=lambda ch: sum((a - b) ** 2 for a, b in zip(c[:3], pal[ch])))

    rows = [[TRANSPARENT] * w for _ in range(h)]
    for x, y in opaque:
        rows[y][x] = nearest(px[x, y])
    return ["".join(r) for r in rows], fixed


def median_cut(px, opaque, w: int, h: int, k: int):
    strip = Image.new(RGB, (len(opaque), 1))
    strip.putdata([px[x, y][:3] for x, y in opaque])
    quantized = strip.quantize(colors=k, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palette = quantized.getpalette()[: 3 * k]
    indices = list(quantized.getdata())
    used = sorted(set(indices))
    char_of = {i: CHARS[n] for n, i in enumerate(used)}
    rows = [[TRANSPARENT] * w for _ in range(h)]
    for (x, y), i in zip(opaque, indices):
        rows[y][x] = char_of[i]
    pal_out = {
        char_of[i]: (palette[3 * i] << 16) | (palette[3 * i + 1] << 8) | palette[3 * i + 2]
        for i in used
    }
    return ["".join(r) for r in rows], pal_out


def quantize(img: Image.Image, k: int, fixed: dict[str, int] | None):
    w, h = img.size
    px = img.load()
    opaque = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] >= OPAQUE_ALPHA]
    if fixed:
        return snap_to_palette(px, opaque, w, h, fixed)
    return median_cut(px, opaque, w, h, k)


def preview(rows, pal, scale: int, path: str):
    h, w = len(rows), len(rows[0])
    out = Image.new(RGBA, (w * scale, h * scale), (40, 40, 48, 255))
    px = out.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == TRANSPARENT:
                continue
            v = pal[ch]
            c = ((v >> 16) & 255, (v >> 8) & 255, v & 255, 255)
            for dy in range(scale):
                for dx in range(scale):
                    px[x * scale + dx, y * scale + dy] = c
    out.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--size", default="24x32")
    ap.add_argument("--colors", type=int, default=14)
    ap.add_argument("--bg", type=Bg, default=Bg.AUTO, choices=list(Bg))
    ap.add_argument("--tol", type=int, default=120)
    ap.add_argument("--pad", type=int, default=0)
    ap.add_argument("--filter", type=Filter, default=Filter.NEAREST, choices=list(Filter))
    ap.add_argument("--palette", help="JSON {char: 0xRRGGBB int} to snap to, for frame consistency")
    ap.add_argument("--out", default="sprite.json")
    ap.add_argument("--preview", default="preview.png")
    args = ap.parse_args()
    tw, th = (int(v) for v in args.size.lower().split("x"))
    fixed = json.load(open(args.palette)) if args.palette else None
    img = chroma_key(Image.open(args.input), args.bg, args.tol)
    img = fit(img, tw, th, args.pad, FILTERS[args.filter])
    rows, pal = quantize(img, args.colors, fixed)
    json.dump({"w": tw, "h": th, "rows": rows, "palette": pal}, open(args.out, "w"), indent=1)
    preview(rows, pal, PREVIEW_SCALE, args.preview)
    print("\n".join(rows))
    print({k: f"0x{v:06x}" for k, v in pal.items()})


if __name__ == "__main__":
    main()
