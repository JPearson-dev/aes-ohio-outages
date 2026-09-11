import math

X_L, X_R = -0.08, 1.08
X_ENTRY = 0.246          # Ohio's left border at ohio_dx = 0.015


def solve_flat(y_start, y_peak, x_pk, y_entry=0.420, x_entry=X_ENTRY):
    """Where the rise must begin so the curve crosses Ohio's left border at y_entry."""
    f = (y_entry - y_start) / (y_peak - y_start)
    f = min(max(f, 1e-4), 1 - 1e-4)
    t = math.acos(1 - 2 * f) / math.pi
    return (x_entry - t * x_pk) / (1 - t)


def curve4(y_start=0.500, y_peak=0.335, x_pk=0.330, y_zero=0.575, x_land=0.645,
           y_entry=0.420, n=280):
    """Flat above zero, visible rise across Ohio's western border, rounded cap,
    fall, then a flat run at zero that lands inside Ohio."""
    x_flat = solve_flat(y_start, y_peak, x_pk, y_entry)
    pts = []
    for i in range(n + 1):
        x = X_L + (X_R - X_L) * i / n
        if x <= x_flat:
            y = y_start
        elif x < x_pk:
            t = (x - x_flat) / (x_pk - x_flat)
            y = y_start + (y_peak - y_start) * (0.5 - 0.5 * math.cos(math.pi * t))
        elif x < x_land:
            t = (x - x_pk) / (x_land - x_pk)
            y = y_zero + (y_peak - y_zero) * (0.5 + 0.5 * math.cos(math.pi * t))
        else:
            y = y_zero
        pts.append((x, y))
    return pts, y_zero, x_flat
