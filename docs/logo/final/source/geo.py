"""Mirror of the Tile painter API that accumulates real geometry, so any
design built for raster can be emitted as true vector."""
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union


class Geo:
    def __init__(self):
        self.g = Polygon()

    def _apply(self, p, hole):
        p = p.buffer(0)
        self.g = self.g.difference(p) if hole else self.g.union(p)

    def poly(self, pts, hole=False):
        self._apply(Polygon(pts), hole)

    def polys(self, lst, hole=False):
        for p in lst:
            self.poly(p, hole=hole)

    def circle(self, cx, cy, r, hole=False):
        self._apply(Point(cx, cy).buffer(r, quad_segs=64), hole)

    def ring(self, cx, cy, r, w, hole=False):
        a = Point(cx, cy).buffer(r, quad_segs=64)
        b = Point(cx, cy).buffer(max(r - w, 0), quad_segs=64)
        self._apply(a.difference(b), hole)

    def stroke(self, pts, w, hole=False, closed=True):
        p = list(pts) + ([pts[0]] if closed else [])
        self._apply(LineString(p).buffer(w / 2, quad_segs=32), hole)


def _sub(ring, n, prec=2):
    out = []
    for i, (x, y) in enumerate(ring):
        out.append(("M" if i == 0 else "L") + f"{x*n:.{prec}f} {y*n:.{prec}f}")
    return " ".join(out) + " Z"


def path_d(g, n=1024):
    geoms = list(g.geoms) if g.geom_type == "MultiPolygon" else [g]
    parts = []
    for poly in geoms:
        if poly.is_empty:
            continue
        parts.append(_sub(list(poly.exterior.coords)[:-1], n))
        for h in poly.interiors:
            parts.append(_sub(list(h.coords)[:-1], n))
    return "".join(parts)


def svg(g, fg="#FABD2F", bg="#0F1522", n=1024, radius=0.18, transparent=False,
        title="mark", gradient=None):
    d = path_d(g, n)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" '
           f'width="{n}" height="{n}" role="img" aria-label="{title}">']
    fill = fg
    if gradient:
        cl, cd = gradient
        out.append(f'<defs><linearGradient id="g" x1="0.78" y1="0" x2="0.22" y2="1">'
                   f'<stop offset="0.5" stop-color="{cl}"/>'
                   f'<stop offset="0.5" stop-color="{cd}"/></linearGradient></defs>')
        fill = "url(#g)"
    if not transparent:
        out.append(f'<rect width="{n}" height="{n}" rx="{radius*n:.1f}" '
                   f'ry="{radius*n:.1f}" fill="{bg}"/>')
    out.append(f'<path fill-rule="evenodd" fill="{fill}" d="{d}"/>')
    out.append('</svg>')
    return "\n".join(out)


def replay_to_tile(g, size):
    """Draw the resolved geometry back through the raster path, to verify."""
    from shapes import Tile
    t = Tile(size)
    geoms = list(g.geoms) if g.geom_type == "MultiPolygon" else [g]
    for poly in geoms:
        if poly.is_empty:
            continue
        t.poly(list(poly.exterior.coords)[:-1])
        for h in poly.interiors:
            t.poly(list(h.coords)[:-1], hole=True)
    return t
