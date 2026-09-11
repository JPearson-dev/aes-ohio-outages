import math
from curve4 import solve_flat, X_L, X_R, X_ENTRY


def _smoothstep(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def curve5(y_start=0.500, y_peak=0.335, x_pk=0.330, y_zero=0.575, x_land=0.645,
           y_entry=0.420, blend=0.060, n=320):
    """Four-phase curve, but the apex is a blend of the rise and fall curves
    over a window, so the second derivative doesn't jump at the peak."""
    x_flat = solve_flat(y_start, y_peak, x_pk, y_entry)
    sr, sf = x_pk - x_flat, x_land - x_pk

    def rise(x):
        t = (x - x_flat) / sr
        if t <= 0:
            return y_start
        t = min(t, 2.0)
        return y_start + (y_peak - y_start) * (0.5 - 0.5 * math.cos(math.pi * t))

    def fall(x):
        u = (x - x_pk) / sf
        if u >= 1:
            return y_zero
        u = max(u, -1.0)
        return y_zero + (y_peak - y_zero) * (0.5 + 0.5 * math.cos(math.pi * u))

    a, b = x_pk - blend, x_pk + blend
    pts = []
    for i in range(n + 1):
        x = X_L + (X_R - X_L) * i / n
        if blend <= 0:
            y = rise(x) if x <= x_pk else fall(x)
        elif x < a:
            y = rise(x)
        elif x > b:
            y = fall(x)
        else:
            w = _smoothstep((x - a) / (2 * blend))
            y = (1 - w) * rise(x) + w * fall(x)
        pts.append((x, y))
    return pts, y_zero, x_flat


def apex_report(pts, x_pk, h=0.02):
    """Curvature just before and after the apex, as a smoothness check."""
    def y_at(x):
        return min(pts, key=lambda p: abs(p[0] - x))[1]
    def k(x):
        return (y_at(x - h) - 2 * y_at(x) + y_at(x + h)) / (h * h)
    return k(x_pk - 2 * h), k(x_pk + 2 * h)
