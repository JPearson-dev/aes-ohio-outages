import math
from PIL import Image, ImageDraw

S = 6          # supersample factor
TILE = 480     # logical tile size

# ---------- geometry helpers ----------

def fit(pts, box, flipy=False, keep_aspect=True):
    """Fit normalized/raw points into box=(x,y,w,h) in 0..1 tile space."""
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    minx, maxx = min(xs), max(xs); miny, maxy = min(ys), max(ys)
    sw = maxx - minx or 1e-9; sh = maxy - miny or 1e-9
    bx, by, bw, bh = box
    if keep_aspect:
        s = min(bw / sw, bh / sh)
        sx = sy = s
    else:
        sx, sy = bw / sw, bh / sh
    ow = sw * sx; oh = sh * sy
    ox = bx + (bw - ow) / 2.0
    oy = by + (bh - oh) / 2.0
    out = []
    for x, y in pts:
        nx = ox + (x - minx) * sx
        ny = oy + ((maxy - y) if flipy else (y - miny)) * sy
        out.append((nx, ny))
    return out


def xform(pts, cx=0.5, cy=0.5, rot=0.0, sx=1.0, sy=1.0, dx=0.0, dy=0.0):
    r = math.radians(rot); c, s = math.cos(r), math.sin(r)
    out = []
    for x, y in pts:
        x0, y0 = (x - cx) * sx, (y - cy) * sy
        out.append((cx + x0 * c - y0 * s + dx, cy + x0 * s + y0 * c + dy))
    return out


def mirror_x(pts, axis=0.5):
    return [(2 * axis - x, y) for x, y in pts][::-1]


def rect(x, y, w, h):
    return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]


def taper_rect(x, y, w, h, taper=0.0):
    """Rect whose right end narrows by `taper` fraction of h."""
    t = h * taper / 2
    return [(x, y), (x + w, y + t), (x + w, y + h - t), (x, y + h)]

# ---------- the bolt ----------

def bolt(style="tapered"):
    """Lightning bolt in unit square, y down, nose/head at top, sharp tip at bottom."""
    if style == "tapered":
        return [
            (0.50, 0.00), (0.02, 0.56), (0.36, 0.545),
            (0.10, 1.00), (0.98, 0.36), (0.56, 0.375), (0.95, 0.00),
        ]
    if style == "slim":
        return [
            (0.56, 0.00), (0.06, 0.54), (0.36, 0.53),
            (0.14, 1.00), (0.94, 0.40), (0.60, 0.41), (0.92, 0.00),
        ]
    if style == "fat":
        return [
            (0.44, 0.00), (0.00, 0.58), (0.40, 0.565),
            (0.14, 1.00), (1.00, 0.34), (0.56, 0.355), (1.00, 0.00),
        ]
    raise ValueError(style)


def bolt_in(box, style="tapered", rot=0.0, keep_aspect=False):
    pts = fit(bolt(style), box, keep_aspect=keep_aspect)
    if rot:
        bx, by, bw, bh = box
        pts = xform(pts, cx=bx + bw / 2, cy=by + bh / 2, rot=rot)
    return pts

# ---------- Ohio ----------

_OHIO_LL = [
    (-84.80, 41.70), (-83.42, 41.73), (-83.28, 41.62), (-83.06, 41.60),
    (-82.85, 41.55), (-82.72, 41.49), (-82.60, 41.55), (-82.45, 41.47),
    (-82.10, 41.45), (-81.75, 41.49), (-81.40, 41.60), (-81.05, 41.75),
    (-80.72, 41.90), (-80.52, 41.98), (-80.52, 40.90), (-80.52, 40.64),
    (-80.61, 40.55), (-80.70, 40.30), (-80.82, 40.18), (-80.68, 40.03),
    (-80.87, 39.90), (-81.03, 39.70), (-81.25, 39.55), (-81.45, 39.42),
    (-81.68, 39.27), (-81.80, 39.08), (-82.02, 38.94), (-82.19, 38.80),
    (-82.32, 38.58), (-82.55, 38.42), (-82.80, 38.55), (-82.99, 38.73),
    (-83.28, 38.63), (-83.65, 38.62), (-83.95, 38.77), (-84.23, 39.02),
    (-84.42, 39.08), (-84.82, 39.10),
]


def ohio(box):
    k = math.cos(math.radians(40.0))
    pts = [(lon * k, lat) for lon, lat in _OHIO_LL]
    return fit(pts, box, flipy=True, keep_aspect=True)

# ---------- rendering ----------

class Tile:
    """Single mask, painted in call order: fills add, holes subtract."""

    def __init__(self, size=TILE):
        self.size = size
        self.img = Image.new("L", (size * S, size * S), 0)
        self.d = ImageDraw.Draw(self.img)

    def _sc(self, pts):
        n = self.size * S
        return [(x * n, y * n) for x, y in pts]

    def poly(self, pts, hole=False):
        self.d.polygon(self._sc(pts), fill=0 if hole else 255)

    def polys(self, list_of_pts, hole=False):
        for p in list_of_pts:
            self.poly(p, hole=hole)

    def circle(self, cx, cy, r, hole=False):
        n = self.size * S
        self.d.ellipse([(cx - r) * n, (cy - r) * n, (cx + r) * n, (cy + r) * n],
                       fill=0 if hole else 255)

    def ring(self, cx, cy, r, w, hole=False):
        n = self.size * S
        self.d.ellipse([(cx - r) * n, (cy - r) * n, (cx + r) * n, (cy + r) * n],
                       outline=0 if hole else 255, width=max(1, int(w * n)))

    def stroke(self, pts, w, hole=False, closed=True):
        p = self._sc(pts)
        if closed:
            p = p + [p[0]]
        self.d.line(p, fill=0 if hole else 255,
                    width=max(1, int(w * self.size * S)), joint="curve")

    def mask(self):
        return self.img.resize((self.size, self.size), Image.LANCZOS)


def render(tile, fg, bg, radius=0.18, transparent=False):
    n = tile.size
    m = tile.mask()
    if transparent:
        out = Image.new("RGBA", (n, n), (0, 0, 0, 0))
        fgimg = Image.new("RGBA", (n, n), fg + (255,))
        out.paste(fgimg, (0, 0), m)
        return out
    plate = Image.new("L", (n * S, n * S), 0)
    ImageDraw.Draw(plate).rounded_rectangle([0, 0, n * S - 1, n * S - 1],
                                            radius=int(radius * n * S), fill=255)
    plate = plate.resize((n, n), Image.LANCZOS)
    out = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    bgimg = Image.new("RGBA", (n, n), bg + (255,))
    out.paste(bgimg, (0, 0), plate)
    fgimg = Image.new("RGBA", (n, n), fg + (255,))
    out.paste(fgimg, (0, 0), Image.composite(m, Image.new("L", (n, n), 0), plate))
    return out
