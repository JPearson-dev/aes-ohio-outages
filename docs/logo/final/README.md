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

outage-plug-\<size>.png   raster at the tier for that size
outage-plug-\<tier>.svg   vector, one per tier
favicon.ico              multi-resolution
alt-blue-\*               navy-on-white alternates, amber or pale trace
plug-silhouette*.svg     geometry only, no chart
