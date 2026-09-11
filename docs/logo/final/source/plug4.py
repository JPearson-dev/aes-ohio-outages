import math
from ohio_real import ohio as ohio_r
from vec import Rec
from plug2 import prong

OHIO_BOX = (0.150, 0.205, 0.70, 0.585)


def _edge(pts, x, top=True):
    hits = []
    n = len(pts)
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        if (x0 - x) * (x1 - x) <= 0 and x0 != x1:
            hits.append(y0 + (y1 - y0) * (x - x0) / (x1 - x0))
    if not hits:
        return None
    return min(hits) if top else max(hits)


def plug4(prong_w=0.048, prong_gap=0.130, prong_top=0.038, taper_start=0.35,
          tip_frac=0.62, cord_w=0.066, cord_bot=0.960, ohio_dx=0.015,
          detail="coarse", prong_bite=0.030, cord_bite=0.034):
    """Prongs and cord sit on the tile centreline; Ohio can shift independently.
    Entry depths are solved against the real outline so both merge cleanly."""
    box = (OHIO_BOX[0] + ohio_dx, OHIO_BOX[1], OHIO_BOX[2], OHIO_BOX[3])
    oh = ohio_r(box, detail)

    def sample(x0, x1, top):
        vals = [_edge(oh, x0 + (x1 - x0) * i / 24, top) for i in range(25)]
        vals = [v for v in vals if v is not None]
        return (max(vals) if top else min(vals)) if vals else None

    xa = 0.5 - prong_gap / 2 - prong_w
    xb = 0.5 + prong_gap / 2
    top_edge = max(sample(xa, xa + prong_w, True), sample(xb, xb + prong_w, True))
    prong_into = top_edge + prong_bite
    h = cord_w / 2
    bot_edge = sample(0.5 - h, 0.5 + h, False)
    cord_top = bot_edge - cord_bite

    r = Rec()
    r.poly(prong(xa, prong_w, prong_top, prong_into, taper_start, tip_frac))
    r.poly(prong(xb, prong_w, prong_top, prong_into, taper_start, tip_frac))
    r.poly(oh)
    r.poly([(0.5 - h, cord_top), (0.5 + h, cord_top),
            (0.5 + h, cord_bot), (0.5 - h, cord_bot)])
    return r


def curve(f0=0.50, y_peak=0.320, y_zero=0.720, x_pk=0.400, x_land=0.880,
          x_l=-0.08, x_r=1.08, n=240):
    """Enters already high, rises to a rounded cap, falls, lands flat on zero.
    Zero slope at the cap and at the landing, so both read as curves not corners."""
    pts = []
    for i in range(n + 1):
        x = x_l + (x_r - x_l) * i / n
        if x <= x_pk:
            t = (x - x_l) / (x_pk - x_l)
            f = f0 + (1 - f0) * (0.5 - 0.5 * math.cos(math.pi * t))
        elif x < x_land:
            t = (x - x_pk) / (x_land - x_pk)
            f = 0.5 + 0.5 * math.cos(math.pi * t)
        else:
            f = 0.0
        pts.append((x, y_zero - f * (y_zero - y_peak)))
    return pts, y_zero
