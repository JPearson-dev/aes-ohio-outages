import json, math, os
from shapes import fit

_R = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ohio_rings.json')))


def _dp(pts, eps):
    """Douglas-Peucker."""
    if len(pts) < 3:
        return pts
    x0, y0 = pts[0]
    x1, y1 = pts[-1]
    dx, dy = x1 - x0, y1 - y0
    n = math.hypot(dx, dy)
    best, bi = -1.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = (abs(dy * px - dx * py + x1 * y0 - y1 * x0) / n) if n else math.hypot(px - x0, py - y0)
        if d > best:
            best, bi = d, i
    if best <= eps:
        return [pts[0], pts[-1]]
    return _dp(pts[:bi + 1], eps)[:-1] + _dp(pts[bi:], eps)


def ring(detail="med", source="hi"):
    """Ohio boundary, equirectangular-corrected, simplified to a vertex budget."""
    raw = [(lon * math.cos(math.radians(40.2)), lat) for lon, lat in _R[source]]
    eps = {"fine": 0.0035, "med": 0.009, "coarse": 0.020, "flat": 0.038}[detail]
    s = _dp(raw, eps)
    if s[0] == s[-1]:
        s = s[:-1]
    return s


def ohio(box, detail="med", source="hi"):
    return fit(ring(detail, source), box, flipy=True, keep_aspect=True)


if __name__ == "__main__":
    for d in ("fine", "med", "coarse", "flat"):
        print(d, len(ring(d)))
