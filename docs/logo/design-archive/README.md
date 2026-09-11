# Design archive

Each design below is provided as SVG (five colourways). SVG paths use `fill-rule="evenodd"`; geometry was resolved with real boolean ops, so each mark is a single path.

| ID | File stem | Description |
| --- | --- | --- |
| A1 | `A1-bolt-in-ohio` | Lightning bolt knocked out of Ohio. |
| A4 | `A4-bolt-in-ohio-in-circle` | A1 set inside a filled roundel. |
| N10 | `N10-push-pin-bolt-needle` | Ball-and-needle push pin; bolt as the needle, Ohio in the ball. |
| V1 | `V1-propeller-tight-arc` | Two bolt blades, Ohio hub, single tapered motion arc. |
| V4 | `V4-propeller-tight-arc-big-hub` | As V1 with a larger Ohio hub. |
| W1 | `W1-map-pin-plug-tapered-cord` | Map pin, Ohio as the plug body, prongs up, tapered cord. |
| W2 | `W2-map-pin-plug-full-cord` | As W1, cord running the full length of the pin. |
| W3 | `W3-ohio-as-plug` | No pin: Ohio is the plug body, with prongs and cord. |
| T1 | `T1-pull-tab-ohio-aperture` | Pull tab at 45 deg CCW; Ohio as the ring interior, bolt as the rivet. |
| T12 | `T12-pull-tab-fine-ohio` | T1 with a higher-detail Ohio outline. |
| T3 | `T3-pull-tab-ohio-tilted` | T1 with Ohio tilted 12 deg independently of the tab. |
| T6 | `T6-pull-tab-ohio-inner-and-outer` | Ohio as both inner and outer ring edge (the key-blank result). |
| M10 | `M10-pull-tab-outline-round-pip` | Outline tab at 45 deg with a round pip and Ohio inside. |

## with-real-ohio-outline/

The designs below predate the switch to a real Ohio boundary and originally used a hand-drawn outline. This folder re-renders them with the 60-vertex simplified boundary used from T1 onward. Everything else is unchanged.

Included: A1, A4, N10, V1, V4, W1, W2, W3

Ohio boundary: glynnbird/usstatesgeojson, simplified with Douglas-Peucker. Equirectangular, x scaled by cos(40.2 deg).
