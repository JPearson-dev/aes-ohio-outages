import math
from PIL import Image, ImageDraw, ImageChops
from shapes import Tile, S, rect
from ohio_real import ohio as ohio_r
from vec import Rec, to_tile


# ---------------- plug geometry ----------------

def plug(prong_w=0.044, prong_gap=0.105, prong_top=0.045, prong_into=0.285,
         cord_w=0.050, cord_top=0.735, cord_bot=0.958, cord_taper=0.0,
         ohio_box=(0.185, 0.225, 0.63, 0.545), detail="coarse", cord_bend=None):
    """Bare plug: Ohio is the body, two prongs up, cord down."""
    r = Rec()
    x0 = 0.5 - prong_gap / 2 - prong_w
    x1 = 0.5 + prong_gap / 2
    r.poly(rect(x0, prong_top, prong_w, prong_into - prong_top))
    r.poly(rect(x1, prong_top, prong_w, prong_into - prong_top))
    r.poly(ohio_r(ohio_box, detail))
    if cord_bend is None:
        hw, hb = cord_w / 2, cord_w / 2 * (1 - cord_taper)
        r.poly([(0.5 - hw, cord_top), (0.5 + hw, cord_top),
                (0.5 + hb, cord_bot), (0.5 - hb, cord_bot)])
    else:
        r.poly(cord_bend)
    return r


def bent_cord(w=0.048, top=0.720, knee=0.845, out=1.06, side=1):
    """Cord that drops then runs off to one side, so it can meet the trend line."""
    h = w / 2
    return [(0.5 - h, top), (0.5 + h, top), (0.5 + h, knee - h),
            (out * side + (1 - side) * 0.5, knee - h),
            (out * side + (1 - side) * 0.5, knee + h), (0.5 - h, knee + h)]


# ---------------- trend lines ----------------

def _poly_below(pts):
    return list(pts) + [(1.08, 1.12), (-0.08, 1.12)]


def trend(kind="drop", y0=0.36, y1=0.70, n=160):
    xs = [-0.08 + 1.16 * i / n for i in range(n + 1)]
    if kind == "drop":
        f = lambda x: y0 if x < 0.40 else (y1 if x > 0.58 else
                                           y0 + (y1 - y0) * (0.5 - 0.5 * math.cos(math.pi * (x - 0.40) / 0.18)))
    elif kind == "slope":
        f = lambda x: y0 + (y1 - y0) * min(max(x, 0), 1)
    elif kind == "dip":
        f = lambda x: y0 + (y1 - y0) * math.exp(-((x - 0.5) ** 2) / 0.035)
    elif kind == "recover":
        f = lambda x: (y0 if x < 0.30 else
                       y1 if x < 0.52 else
                       y1 - (y1 - y0) * min(1.0, (x - 0.52) / 0.34))
    elif kind == "sag":
        f = lambda x: y0 + (y1 - y0) * (0.5 - 0.5 * math.cos(2 * math.pi * min(max(x, 0), 1))) * 0.5 + \
                      (y1 - y0) * 0.25
    else:
        raise ValueError(kind)
    return [(x, f(x)) for x in xs]


# ---------------- rendering ----------------

def _plate(size, radius=0.18):
    p = Image.new("L", (size * S, size * S), 0)
    ImageDraw.Draw(p).rounded_rectangle([0, 0, size * S - 1, size * S - 1],
                                        radius=int(radius * size * S), fill=255)
    return p.resize((size, size), Image.LANCZOS)


def _mask_poly(size, pts):
    t = Tile(size)
    t.poly(pts)
    return t.mask()


def _mask_line(size, pts, w):
    t = Tile(size)
    t.stroke(pts, w, closed=False)
    return t.mask()


def render_trend(rec, size, pal, tr, line_w=0.0, line_over=False, radius=0.18):
    """pal: dict(bg_hi, bg_lo, fg_hi, fg_lo, line)."""
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
    if line_w and not line_over:
        lay(pal["line"], _mask_line(size, tr, line_w))
    lay(pal["fg_hi"], ImageChops.multiply(mark, above))
    lay(pal["fg_lo"], ImageChops.multiply(mark, below))
    if line_w and line_over:
        lay(pal["line"], _mask_line(size, tr, line_w))
    return out


# ---------------- vector output ----------------

def _d(pts, n, prec=2):
    return " ".join(("M" if i == 0 else "L") + f"{x*n:.{prec}f} {y*n:.{prec}f}"
                    for i, (x, y) in enumerate(pts)) + " Z"


def _geom_d(g, n):
    from geo import path_d
    return path_d(g, n)


def svg_trend(rec, pal, tr, n=1024, radius=0.18, line_w=0.0, line_over=False,
              title="plug"):
    from geo import Geo
    gg = Geo()
    for pts, hole in rec.items:
        gg.poly(pts, hole=hole)
    mark_d = _geom_d(gg.g, n)
    below_d = _d(_poly_below(tr), n)
    hexc = lambda c: "#%02X%02X%02X" % c
    r = radius * n
    line = ""
    if line_w:
        pl = " ".join(("M" if i == 0 else "L") + f"{x*n:.2f} {y*n:.2f}"
                      for i, (x, y) in enumerate(tr))
        line = (f'<path d="{pl}" fill="none" stroke="{hexc(pal["line"])}" '
                f'stroke-width="{line_w*n:.1f}" stroke-linecap="round"/>')
    body = [
        f'<rect width="{n}" height="{n}" rx="{r:.1f}" ry="{r:.1f}" fill="{hexc(pal["bg_hi"])}"/>',
        f'<path d="{below_d}" fill="{hexc(pal["bg_lo"])}"/>',
        line if not line_over else "",
        f'<path fill-rule="evenodd" d="{mark_d}" fill="{hexc(pal["fg_hi"])}"/>',
        f'<g clip-path="url(#below)"><path fill-rule="evenodd" d="{mark_d}" '
        f'fill="{hexc(pal["fg_lo"])}"/></g>',
        line if line_over else "",
    ]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" '
            f'width="{n}" height="{n}" role="img" aria-label="{title}">'
            f'<defs><clipPath id="plate"><rect width="{n}" height="{n}" '
            f'rx="{r:.1f}" ry="{r:.1f}"/></clipPath>'
            f'<clipPath id="below"><path d="{below_d}"/></clipPath></defs>'
            f'<g clip-path="url(#plate)">' + "".join(body) + '</g></svg>')
