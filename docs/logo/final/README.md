# Outage plug mark

Geometry: cord 0.082 (1.71x the 0.048 prong), chisel taper from 0.35 with a
0.62 tip, Ohio offset +0.015 so its area centroid sits on the centreline.
Prong and cord entry depths are solved against the real Ohio outline.

Curve: peak x 0.355, landing x 0.680, zero 0.560, apex blend 0.070.
Rise begins at x 0.141; crosses Ohio's western border at y 0.420.
Chart is clipped to the plug; the divider borrows the background navy.

## Size tiers

The dark amber lightens as the icon shrinks. Larger sizes favour a readable
chart split; smaller sizes favour the silhouette holding against the navy.

| tier  | dark amber   | sizes            | contrast vs navy / vs amber |
|-------|--------------|------------------|-----------------------------|
| large | 150,112,36   | 128-1024         | 4.03 / 2.67                 |
| mid   | 168,126,42   | 64, 96           | 4.94 / 2.18                 |
| small | 186,140,48   | 16, 24, 32, 48   | 5.98 / 1.80                 |

Light amber against navy is 10.76 at every size.

favicon.ico contains natively rendered 16/24/32/48 frames at the small tier.

## Files

outage-plug-\<tier>.svg   vector, one per tier
favicon.ico              multi-resolution (16/24/32/48)
alt-blue-\*               navy-on-white alternates, amber or pale trace
plug-silhouette*.svg     geometry only, no chart

Raster PNGs (`outage-plug-<size>.png`, sizes 16-1024) aren't checked in —
nothing here references them and they're redundant with the SVGs and
favicon.ico. Regenerate them with `source/build.py` if a specific size is
ever needed.

`source/` holds the full reproducible build: run `python3 source/build.py`
to regenerate every asset above from the frozen geometry parameters.

## License

The build scripts in `source/` are covered by the repository's MIT license
like the rest of the codebase. The rendered mark itself — the SVG and ICO
files in this folder — is not: all rights are reserved by the project owner,
so reuse of the logo/mark as a brand asset isn't pre-authorized the way the
code is. The purpose is to preserve the option to distinguish between forks,
or other usage, if it becomes necessary. It's easier to reserve rights now
than to reclaim them later.

Contributions that change these files (or add new mark variants) are
accepted on the understanding that the contribution becomes part of the
reserved mark under these same terms, rather than the contributor retaining
separate rights to their specific change.
