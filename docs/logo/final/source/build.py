"""Final-assembly driver: produces every checked-in asset for the outage plug mark.

    python3 build.py [outdir]

Requires: pillow, shapely. Reads ohio_rings.json (see fetch_ohio.py).
"""
import os, sys
from PIL import Image
from plug4 import plug4
from plug3 import render3, svg3
from curve5 import curve5
from geo import Geo, svg as geo_svg

# ---- the two frozen parameter sets that define the mark -------------------

MARK_KW = dict(prong_w=0.048, prong_gap=0.130, prong_top=0.038,
               taper_start=0.35, tip_frac=0.62, cord_w=0.082,
               cord_bot=0.960, ohio_dx=0.015, detail="coarse",
               prong_bite=0.030, cord_bite=0.034)

CURVE_KW = dict(y_start=0.500, y_peak=0.335, x_pk=0.355, y_zero=0.560,
                x_land=0.680, y_entry=0.420, blend=0.070)

NAVY = (15, 21, 34)
AMBER = (250, 189, 47)
WHITE = (244, 246, 249)
LINE_W = 0.013

TIERS = [("large", (150, 112, 36), [128, 180, 256, 512, 1024]),
         ("mid",   (168, 126, 42), [64, 96]),
         ("small", (186, 140, 48), [16, 24, 32, 48])]
ICO_SIZES = [16, 24, 32, 48]


def amber_pal(fg_lo):
    return dict(bg_hi=NAVY, bg_lo=NAVY, fg_hi=AMBER, fg_lo=fg_lo,
                line=NAVY, axis=NAVY)


def blue_pal(line):
    return dict(bg_hi=WHITE, bg_lo=WHITE, fg_hi=(20, 40, 74),
                fg_lo=(122, 144, 172), line=line, axis=WHITE)


def build(outdir="final-plug"):
    os.makedirs(outdir, exist_ok=True)
    mark = plug4(**MARK_KW)
    curve, zero, x_flat = curve5(**CURVE_KW)

    def png(size, pal):
        return render3(mark, size, pal, curve, zero, LINE_W, 0.0, "mark")

    def svg(pal, title):
        return svg3(mark, pal, curve, zero, line_w=LINE_W, axis_w=0.0,
                    line_mode="mark", title=title)

    for tier, fg_lo, sizes in TIERS:
        pal = amber_pal(fg_lo)
        for s in sizes:
            png(s, pal).save(os.path.join(outdir, f"outage-plug-{s}.png"))
        open(os.path.join(outdir, f"outage-plug-{tier}.svg"), "w").write(
            svg(pal, f"outage plug ({tier})"))

    small = dict((t[0], t[1]) for t in TIERS)["small"]
    frames = [png(s, amber_pal(small)) for s in ICO_SIZES]
    frames[-1].save(os.path.join(outdir, "favicon.ico"), format="ICO",
                    sizes=[(s, s) for s in ICO_SIZES], append_images=frames[:-1])

    for nm, line in (("alt-blue-amber-line", AMBER),
                     ("alt-blue-pale-line", (240, 243, 247))):
        pal = blue_pal(line)
        open(os.path.join(outdir, f"{nm}.svg"), "w").write(svg(pal, nm))
        for s in (32, 512):
            png(s, pal).save(os.path.join(outdir, f"{nm}-{s}.png"))

    g = Geo()
    for pts, hole in mark.items:
        g.poly(pts, hole=hole)
    for tag, kw in (("", {}), ("-transparent", {"transparent": True})):
        open(os.path.join(outdir, f"plug-silhouette{tag}.svg"), "w").write(
            geo_svg(g.g, title="plug silhouette", **kw))

    print(f"built into {outdir}/  (rise begins x={x_flat:.3f}, zero={zero})")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "final-plug")
