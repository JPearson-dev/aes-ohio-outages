# Reproducible build — outage plug mark

    pip install pillow shapely
    python3 build.py [outdir]      # default outdir: final-plug

Verified: a clean-room run of `build.py` reproduces all 23 checked-in assets
geometrically and pixel-for-pixel, but not byte-for-byte. The SVG path data
for the prong/cord/Ohio polygons can list the same vertices starting from a
different point in the ring, and `favicon.ico` frame encoding can shift a few
bytes — both are Shapely/GEOS and Pillow version artifacts, not content
differences. No provenance metadata of any kind is embedded in these files.
Compare SVGs on their point sets rather than raw text, and PNGs on decoded
pixels rather than file bytes.

## Module graph

    build.py                 driver: frozen params, tiers, ico packing
      plug4.py               plug geometry; solves prong/cord entry depths
        plug2.py             chisel-tapered prong primitive
        ohio_real.py         Ohio boundary, Douglas-Peucker simplification
          ohio_rings.json    raw source rings (see below)
        vec.py               Rec: records polygons for both raster and vector
      curve5.py              4-phase curve with blended apex
        curve4.py            solve_flat(): inverts the rise to hold the entry
      plug3.py               render3() raster, svg3() vector
        plug.py              mask helpers (_plate, _mask_poly, _mask_line)
      geo.py                 shapely boolean resolution, single-path SVG
      shapes.py              Tile, supersampled rasterizer, fit/xform

## ohio_rings.json

Raw extracted GeoJSON rings:

  hi  773 vertices  glynnbird/usstatesgeojson/master/ohio.geojson
  lo   47 vertices  PublicaMundi/MappingAPI .../geojson/us-states.json

Only `hi` is used, via `ohio_real.ring(detail=...)`, which applies
Douglas-Peucker at one of four epsilons (fine/med/coarse/flat -> 170/107/60/41
vertices) and scales longitude by cos(40.2 deg). The final mark uses `coarse`.

Run `python3 fetch_ohio.py` to regenerate it from the public sources if lost.
Network access is only needed for that script, never for `build.py`.

## Frozen parameters

`build.py` holds the two dicts that define the mark. Everything else is
derived. Geometry: cord 0.082 (1.71x the 0.048 prong), chisel taper from 0.35
to a 0.62 tip, Ohio offset +0.015 to put its area centroid on the centreline.
Prong and cord entry depths are solved against the real outline at build time,
so changing the cord width or the Ohio offset keeps both merged into the body.

Curve: peak x 0.355, landing x 0.680, zero 0.560, apex blend 0.070. The rise
start is solved so the curve crosses Ohio's western border at y 0.420
regardless of the other parameters; it lands at x 0.141 for these values.

Size tiers lighten the dark amber as the icon shrinks — 150,112,36 at 128px
and up, 168,126,42 at 64-96, 186,140,48 at 48 and below. favicon.ico packs
natively rendered 16/24/32/48 frames rather than one downsampled image.
