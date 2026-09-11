"""Regenerate ohio_rings.json from public sources.

Only the `hi` ring is used by the build; `lo` is kept as a low-detail fallback.
Run this only if ohio_rings.json is missing -- the checked-in file is identical.
"""
import json, urllib.request

HI = "https://raw.githubusercontent.com/glynnbird/usstatesgeojson/master/ohio.geojson"
LO = "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"


def _rings(geom):
    if geom["type"] == "Polygon":
        return geom["coordinates"]
    return [r for poly in geom["coordinates"] for r in poly]


def main(out="ohio_rings.json"):
    hi = json.load(urllib.request.urlopen(HI))
    hi_ring = sorted(_rings(hi["geometry"]), key=len, reverse=True)[0]

    lo = json.load(urllib.request.urlopen(LO))
    feat = [f for f in lo["features"] if f["properties"]["name"] == "Ohio"][0]
    lo_ring = sorted(_rings(feat["geometry"]), key=len, reverse=True)[0]

    json.dump({"hi": hi_ring, "lo": lo_ring}, open(out, "w"))
    print(f"wrote {out}: hi={len(hi_ring)} lo={len(lo_ring)} vertices")


if __name__ == "__main__":
    main()
