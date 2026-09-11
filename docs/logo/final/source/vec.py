"""Recorder + SVG/PNG emitters. Nested subpaths use even-odd, so holes need no flag."""
import os
from PIL import Image, ImageDraw
from shapes import Tile, render, S


class Rec:
    def __init__(self):
        self.items = []

    def poly(self, pts, hole=False):
        self.items.append((list(pts), hole))
        return self


def to_tile(rec, size):
    t = Tile(size)
    for pts, hole in rec.items:
        t.poly(pts, hole=hole)
    return t


def to_png(rec, size, fg, bg, **kw):
    return render(to_tile(rec, size), fg, bg, **kw)


def to_png_split(rec, size, cl, cd, bg, split, **kw):
    from duotone import render_split
    return render_split(to_tile(rec, size), cl, cd, bg, split, **kw)


def _d(pts, n):
    out = []
    for i, (x, y) in enumerate(pts):
        out.append(("M" if i == 0 else "L") + f"{x*n:.2f} {y*n:.2f}")
    return " ".join(out) + " Z"


def to_svg(rec, fg="#FABD2F", bg="#0F1522", n=512, radius=0.18,
           transparent=False, title="mark"):
    body = "".join(_d(p, n) for p, _ in rec.items)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" '
             f'width="{n}" height="{n}" role="img" aria-label="{title}">']
    if not transparent:
        parts.append(f'<rect x="0" y="0" width="{n}" height="{n}" '
                     f'rx="{radius*n:.1f}" ry="{radius*n:.1f}" fill="{bg}"/>')
        parts.append(f'<g clip-path="url(#c)"><clipPath id="c">'
                     f'<rect x="0" y="0" width="{n}" height="{n}" '
                     f'rx="{radius*n:.1f}" ry="{radius*n:.1f}"/></clipPath>')
    parts.append(f'<path fill-rule="evenodd" fill="{fg}" d="{body}"/>')
    if not transparent:
        parts.append('</g>')
    parts.append('</svg>')
    return "\n".join(parts)


def save_svg(rec, path, **kw):
    with open(path, "w") as f:
        f.write(to_svg(rec, **kw))
    return path


def to_svg_split(rec, cl="#FDCE5A", cd="#DE8616", bg="#0F1522", n=512,
                 radius=0.18, transparent=False, title="mark",
                 x1=0.78, y1=0.0, x2=0.22, y2=1.0):
    """Two-tone via a hard-stop linear gradient along the split axis."""
    body = "".join(_d(p, n) for p, _ in rec.items)
    g = (f'<linearGradient id="g" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">'
         f'<stop offset="0.5" stop-color="{cl}"/>'
         f'<stop offset="0.5" stop-color="{cd}"/></linearGradient>')
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" '
             f'width="{n}" height="{n}" role="img" aria-label="{title}">',
             f'<defs>{g}</defs>']
    if not transparent:
        parts.append(f'<rect width="{n}" height="{n}" rx="{radius*n:.1f}" '
                     f'ry="{radius*n:.1f}" fill="{bg}"/>')
    parts.append(f'<path fill-rule="evenodd" fill="url(#g)" d="{body}"/>')
    parts.append('</svg>')
    return "\n".join(parts)
