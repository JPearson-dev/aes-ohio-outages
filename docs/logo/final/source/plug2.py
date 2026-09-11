import math
from PIL import Image, ImageChops
from shapes import Tile, rect
from ohio_real import ohio as ohio_r
from vec import Rec, to_tile
from plug import _plate, _mask_poly, _mask_line, _poly_below


def prong(x, w, top, bot, taper_start=0.35, tip_frac=0.62):
    """Vertical prong, chisel-tapered over the last `taper_start` toward the tip."""
    L = bot - top
    yt = top + taper_start * L
    dx = w * (1 - tip_frac) / 2
    return [(x + dx, top), (x + w - dx, top), (x + w, yt),
            (x + w, bot), (x, bot), (x, yt)]


def plug2(prong_w=0.046, prong_gap=0.132, prong_top=0.038, prong_into=0.298,
          taper_start=0.35, tip_frac=0.62, cord_w=0.062, cord_top=0.760,
          cord_bot=0.960, ohio_box=(0.150, 0.205, 0.70, 0.585), detail="coarse"):
    r = Rec()
    x0 = 0.5 - prong_gap / 2 - prong_w
    x1 = 0.5 + prong_gap / 2
    r.poly(prong(x0, prong_w, prong_top, prong_into, taper_start, tip_frac))
    r.poly(prong(x1, prong_w, prong_top, prong_into, taper_start, tip_frac))
    r.poly(ohio_r(ohio_box, detail))
    h = cord_w / 2
    r.poly([(0.5 - h, cord_top), (0.5 + h, cord_top),
            (0.5 + h, cord_bot), (0.5 - h, cord_bot)])
    return r


def surge(y_start=0.74, y_peak=0.30, y_end=0.90, x_rise=0.16, x_pk=0.36,
          decay=0.30, n=200):
    """Sits above zero, spikes, then decays back toward zero. Fast up, slow down."""
    pts = []
    for i in range(n + 1):
        x = -0.08 + 1.16 * i / n
        if x <= x_rise:
            y = y_start
        elif x < x_pk:
            t = (x - x_rise) / (x_pk - x_rise)
            y = y_start + (y_peak - y_start) * (0.5 - 0.5 * math.cos(math.pi * t))
        else:
            y = y_end + (y_peak - y_end) * math.exp(-(x - x_pk) / decay)
        pts.append((x, y))
    return pts


def render2(rec, size, pal, tr, line_w=0.0, line_mode="full", radius=0.18):
    """line_mode: 'none' | 'full' | 'mark' (trace visible only across the plug)."""
    mark = to_tile(rec, size).mask()
    below = _mask_poly(size, _poly_below(tr))
    plate = _plate(size, radius)
    above = ImageChops.subtract(Image.new("L", below.size, 255), below)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    def lay(color, m):
        out.paste(Image.new("RGBA", (size, size), color + (255,)), (0, 0),
                  ImageChops.multiply(m, plate))

    lay(pal["bg_hi"], above)
    lay(pal["bg_lo"], below)
    if line_w and line_mode == "full":
        lay(pal["line"], _mask_line(size, tr, line_w))
    lay(pal["fg_hi"], ImageChops.multiply(mark, above))
    lay(pal["fg_lo"], ImageChops.multiply(mark, below))
    if line_w and line_mode == "mark":
        lay(pal["line"], ImageChops.multiply(_mask_line(size, tr, line_w), mark))
    return out


def _d(pts, n):
    return " ".join(("M" if i == 0 else "L") + f"{x*n:.2f} {y*n:.2f}"
                    for i, (x, y) in enumerate(pts)) + " Z"


def svg2(rec, pal, tr, n=1024, radius=0.18, line_w=0.0, line_mode="full", title="plug"):
    from geo import Geo, path_d
    g = Geo()
    for pts, hole in rec.items:
        g.poly(pts, hole=hole)
    mark_d = path_d(g.g, n)
    below_d = _d(_poly_below(tr), n)
    hx = lambda c: "#%02X%02X%02X" % c
    r = radius * n
    pl = " ".join(("M" if i == 0 else "L") + f"{x*n:.2f} {y*n:.2f}"
                  for i, (x, y) in enumerate(tr))
    stroke = (f'<path d="{pl}" fill="none" stroke="{hx(pal["line"])}" '
              f'stroke-width="{line_w*n:.1f}" stroke-linecap="round"/>') if line_w else ""
    parts = [f'<rect width="{n}" height="{n}" rx="{r:.1f}" ry="{r:.1f}" fill="{hx(pal["bg_hi"])}"/>']
    if pal["bg_lo"] != pal["bg_hi"]:
        parts.append(f'<path d="{below_d}" fill="{hx(pal["bg_lo"])}"/>')
    if line_mode == "full":
        parts.append(stroke)
    parts.append(f'<path fill-rule="evenodd" d="{mark_d}" fill="{hx(pal["fg_hi"])}"/>')
    parts.append(f'<g clip-path="url(#below)"><path fill-rule="evenodd" d="{mark_d}" '
                 f'fill="{hx(pal["fg_lo"])}"/></g>')
    if line_mode == "mark":
        parts.append(f'<g clip-path="url(#mark)">{stroke}</g>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" '
            f'width="{n}" height="{n}" role="img" aria-label="{title}">'
            f'<defs><clipPath id="plate"><rect width="{n}" height="{n}" '
            f'rx="{r:.1f}" ry="{r:.1f}"/></clipPath>'
            f'<clipPath id="below"><path d="{below_d}"/></clipPath>'
            f'<clipPath id="mark"><path fill-rule="evenodd" d="{mark_d}"/></clipPath></defs>'
            f'<g clip-path="url(#plate)">' + "".join(parts) + '</g></svg>')
