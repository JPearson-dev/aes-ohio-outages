import math
from PIL import Image, ImageChops
from shapes import Tile
from vec import to_tile
from plug import _plate, _mask_poly, _mask_line, _poly_below


def surge2(y_zero=0.930, baseline=0.34, y_peak=0.255, x_flat=0.24, x_pk=0.415,
           x_land=0.94, p=2.3, n=220):
    """Flat baseline sitting `baseline` of the way up to the peak, then a rise
    and a decay that actually reaches zero and stays there."""
    y_start = y_zero - baseline * (y_zero - y_peak)
    pts = []
    for i in range(n + 1):
        x = -0.08 + 1.16 * i / n
        if x <= x_flat:
            y = y_start
        elif x < x_pk:
            t = (x - x_flat) / (x_pk - x_flat)
            y = y_start + (y_peak - y_start) * (0.5 - 0.5 * math.cos(math.pi * t))
        elif x < x_land:
            t = (x - x_pk) / (x_land - x_pk)
            y = y_zero + (y_peak - y_zero) * (1 - t) ** p
        else:
            y = y_zero
        pts.append((x, y))
    return pts, y_zero


def axis(y, x0=-0.08, x1=1.08):
    return [(x0, y), (x1, y)]


def render3(rec, size, pal, tr, y_zero, line_w=0.012, axis_w=0.0,
            line_mode="full", radius=0.18):
    mark = to_tile(rec, size).mask()
    below = _mask_poly(size, _poly_below(tr))
    plate = _plate(size, radius)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    def lay(color, m):
        out.paste(Image.new("RGBA", (size, size), color + (255,)), (0, 0),
                  ImageChops.multiply(m, plate))

    full = Image.new("L", below.size, 255)
    lay(pal["bg_hi"], full)
    lay(pal["bg_lo"], below)
    if axis_w:
        lay(pal["axis"], _mask_line(size, axis(y_zero), axis_w))
    if line_w and line_mode == "full":
        lay(pal["line"], _mask_line(size, tr, line_w))
    lay(pal["fg_hi"], mark)
    lay(pal["fg_lo"], ImageChops.multiply(mark, below))
    if line_w and line_mode == "mark":
        lay(pal["line"], ImageChops.multiply(_mask_line(size, tr, line_w), mark))
    return out


def _d(pts, n):
    return " ".join(("M" if i == 0 else "L") + f"{x*n:.2f} {y*n:.2f}"
                    for i, (x, y) in enumerate(pts)) + " Z"


def svg3(rec, pal, tr, y_zero, n=1024, radius=0.18, line_w=0.012, axis_w=0.0,
         line_mode="full", title="plug"):
    from geo import Geo, path_d
    g = Geo()
    for pts, hole in rec.items:
        g.poly(pts, hole=hole)
    md, bd = path_d(g.g, n), _d(_poly_below(tr), n)
    hx = lambda c: "#%02X%02X%02X" % c
    r = radius * n
    pl = " ".join(("M" if i == 0 else "L") + f"{x*n:.2f} {y*n:.2f}"
                  for i, (x, y) in enumerate(tr))
    st = (f'<path d="{pl}" fill="none" stroke="{hx(pal["line"])}" '
          f'stroke-width="{line_w*n:.1f}" stroke-linecap="round"/>') if line_w else ""
    ax = (f'<line x1="{-0.08*n:.1f}" y1="{y_zero*n:.1f}" x2="{1.08*n:.1f}" '
          f'y2="{y_zero*n:.1f}" stroke="{hx(pal["axis"])}" '
          f'stroke-width="{axis_w*n:.1f}"/>') if axis_w else ""
    parts = [f'<rect width="{n}" height="{n}" rx="{r:.1f}" ry="{r:.1f}" fill="{hx(pal["bg_hi"])}"/>']
    if pal["bg_lo"] != pal["bg_hi"]:
        parts.append(f'<path d="{bd}" fill="{hx(pal["bg_lo"])}"/>')
    parts.append(ax)
    if line_mode == "full":
        parts.append(st)
    parts.append(f'<path fill-rule="evenodd" d="{md}" fill="{hx(pal["fg_hi"])}"/>')
    parts.append(f'<g clip-path="url(#below)"><path fill-rule="evenodd" d="{md}" '
                 f'fill="{hx(pal["fg_lo"])}"/></g>')
    if line_mode == "mark":
        parts.append(f'<g clip-path="url(#mark)">{st}</g>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" '
            f'width="{n}" height="{n}" role="img" aria-label="{title}">'
            f'<defs><clipPath id="plate"><rect width="{n}" height="{n}" rx="{r:.1f}" '
            f'ry="{r:.1f}"/></clipPath><clipPath id="below"><path d="{bd}"/></clipPath>'
            f'<clipPath id="mark"><path fill-rule="evenodd" d="{md}"/></clipPath></defs>'
            f'<g clip-path="url(#plate)">' + "".join(parts) + '</g></svg>')
