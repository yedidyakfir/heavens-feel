"""Convert generated pose PNGs (and their second frames) into 48x64 sprite rows on Sakura's HD palette."""
import json
import os
import sys

from PIL import Image

import png2sprite as p
from hd_variants import EXPRESSION_COLORS

POSE_COLORS = {"G": 0xE8C35A, "V": 0xB070FF, "W": 0xF4F0FF, "C": 0x7FD8E8}
SIZE = (48, 64)
MAX_CHANGED_SHARE = 0.4


def relative_box(img):
    """The figure's bounding box as fractions of the canvas, so a frame on another canvas size crops alike."""
    x0, y0, x1, y1 = img.getbbox()
    w, h = img.size
    return x0 / w, y0 / h, x1 / w, y1 / h


def fit_to_box(img, box):
    w, h = img.size
    x0, y0, x1, y1 = box
    cropped = img.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))
    return p.fit(cropped, *SIZE, 0, Image.BOX)


def changed_share(a, b):
    opaque = sum(ch != "." for row in a for ch in row)
    changed = sum(x != y for ra, rb in zip(a, b) for x, y in zip(ra, rb))
    return changed / max(1, opaque)


def main():
    base = json.load(open(sys.argv[1]))
    palette = {k: int(v) for k, v in base["palette"].items()} | EXPRESSION_COLORS | POSE_COLORS
    out = {}
    for name in sys.argv[2:]:
        first = p.chroma_key(Image.open(f"pose_{name}.png"), p.Bg.AUTO, 120)
        box = relative_box(first)
        frames = [p.quantize(fit_to_box(first, box), 0, palette)[0]]
        if os.path.exists(f"pose_{name}2.png"):
            second = p.chroma_key(Image.open(f"pose_{name}2.png"), p.Bg.AUTO, 120)
            rows = p.quantize(fit_to_box(second, box), 0, palette)[0]
            share = changed_share(frames[0], rows)
            print(f"{name}: second frame changes {share:.0%}", file=sys.stderr)
            if share <= MAX_CHANGED_SHARE:
                frames.append(rows)
        out[name] = frames
        for i, rows in enumerate(frames):
            p.preview(rows, palette, 8, f"preview_pose_{name}{i + 1}.png")
    json.dump({"palette": palette, "poses": out}, sys.stdout)


if __name__ == "__main__":
    main()
