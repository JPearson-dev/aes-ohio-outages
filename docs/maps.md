# Maps

## Layer 1: Basemap

**Decision: OpenFreeMap**, public instance, Positron-style vector tiles, rendered via MapLibre GL JS.

* No API key, no registration, no published rate limit on the public instance (`openfreemap.org`, MIT-licensed, tiles built from OpenStreetMap via the OpenMapTiles schema).
* Gives the same flat, low-color look we originally wanted from Carto Positron, without a key to manage.
* If the public instance ever becomes unreliable, OpenFreeMap publishes the same tiles as downloadable PMTiles archives for self-hosting — so switching to the "Self-hosted PMTiles" fallback below is a config change, not a new data source.
* Required attribution: `© OpenMapTiles © OpenStreetMap contributors` (must stay visible on the map in the eventual site build).
* **Implemented** in `site/src/components/IncidentMap.tsx`, style URLs in `site/src/config.ts` (`BASEMAP_STYLE_URL`). The attribution comes from the style's own source metadata, so MapLibre's attribution control shows it without the site repeating it.
* **Dark mode:** when the page is dark (`prefers-color-scheme`), the map uses OpenFreeMap's `dark` style (forked from OpenMapTiles' Dark Matter, the same family as Positron) instead of Positron, so the map doesn't sit as a bright rectangle in a dark page. Same provider, same attribution, no extra decision surface.

Rejected:

* **Carto Positron**: as of ~August 2026, Carto now requires a free API key for basemap tile requests it previously served anonymously. That reintroduces the "someone has to go get a key before their fork works" friction we ruled Google Maps out for, with no benefit over OpenFreeMap for this project.
* **Stadia Maps**: still requires an API key; no advantage over OpenFreeMap here.
* **Self-hosted PMTiles**: kept as a documented fallback, not the default. Adds ~15-20MB to the repo and a tile-build step for something OpenFreeMap already serves for free.
* **Google Maps**: ruled out previously — API key/billing management burden for anyone forking the project.

## Layer 2: Geographic Context

**Counties — Decision: US Census Bureau TIGER cartographic boundary files** (`cb_<year>_us_county_500k`), not OGRIP.

* Public domain (US government work), one national pipeline, and already generalized for small-scale thematic mapping — appropriate since this layer is for orientation, not analysis.
* OGRIP would mean a second, Ohio-specific source/schema just for boundaries this doc already calls "stable enough for any changes to be noise." Not worth the extra maintenance surface.
* **Which counties to keep — decision:** filter to the county names that actually appear in the upstream data (the `COUNTY` values seen in `current/counties.json`, ~24 names), not a spatial join against the territory polygon. This keeps Layer 2 and Layer 3 consistent by construction and avoids ambiguity over partial-county edges. Re-check this list occasionally in case AES ever reports a county that hasn't shown up yet.
* Pipeline: pull the national cartographic boundary file, filter to that county list, simplify with `mapshaper`, commit the resulting GeoJSON.
* **Not yet built.** The territory script below is the natural template: same simplify/commit flow, plus the county-name filter.

**AES service territory outline — Decision: PUCO certified service areas**, as served by ODOT's TIMS ArcGIS server (`tims.dot.state.oh.us/ags/rest/services/Boundaries/PUCO_Electric_Service_Areas/MapServer/0`, described there as "Electric service provider boundaries from the Public Utilities Commission of Ohio (PUCO). Update frequency: Annual."), filtered to AES Ohio. *Changed from the earlier choice of EIA's dataset; see the next bullet.*

* Why PUCO over EIA's Electric Retail Service Territories: in Ohio, PUCO is the body that establishes and maps each distribution utility's certified territory (ORC 4933.81-.90), so this is the primary source rather than a national compilation of it (EIA's layer is the HIFLD/ORNL dataset). The ODOT service also answers a filtered query as WGS84 GeoJSON directly, so the pipeline is one request, no national extract to download and discard.
* What it is and isn't: a *certified* territory is where AES Ohio has the right and obligation to serve, not a map of where its customers actually are. Incidents can still appear slightly outside it, since AES offsets incident locations (see the README).
* Same tool (`mapshaper`) to simplify before committing; keep only the simplified derived file in the repo, not the raw response.
* **Implemented** as `site/scripts/build-territory.mjs` (`npm run build-geo` from `site/`), run in CI by the manual **Build Map Boundaries** workflow (`.github/workflows/build-geo.yml`), which commits the result. The script fails loudly unless the query matches exactly one company and the output lands inside a sanity box around Ohio, so a renamed company or changed projection can't quietly produce a wrong outline. Simplification: `mapshaper -dissolve -simplify interval=100 keep-shapes` (100 m tolerance, well under a pixel at the map's opening zoom), coordinates rounded to 0.0001° (~11 m).
* Until that workflow has run, there is no outline file and the map simply draws without it.

**Coordinate reference system — decision:** reproject everything to WGS84 (EPSG:4326) at build time. TIGER cartographic files ship in NAD83 (EPSG:4269); MapLibre/GeoJSON expect WGS84 (the territory query asks the server for WGS84 output directly with `outSR=4326`), and it must match the plain lat/lng the incident data already uses (`mapshaper -proj wgs84` in the same pass as simplification/filtering).

**Reproducibility — decision:** capture the fetch/filter/reproject/simplify steps as a checked-in script (`site/scripts/build-territory.mjs` for the territory) rather than one-off manual commands, so refreshing these layers later doesn't depend on someone's shell history. Matches how `fetch.py`/`update-data.sh` already scripts the incident pipeline instead of hand-editing outputs.

**Simplification target — decision:** simplify aggressively (`mapshaper -simplify`) since this is a visual backdrop, not analytical geometry — indistinguishable-at-render-scale beats precise. No hard byte budget needed; "does it still look right zoomed to the service area" is the bar.

**Attribution captions — decision:** credit the boundary sources in the map UI (e.g. a small credits line) even when public-domain government data doesn't legally require it. Consistent with this project's general practice of being explicit about data provenance. **Implemented** for the territory ("Territory: PUCO") and the incidents ("Outages: AES Ohio") as GeoJSON source attributions, so they appear in MapLibre's attribution control alongside the basemap's; "US Census Bureau" joins them when the county layer is built.

**Storage for both layers:** static GeoJSON files on the `main` branch, not the `data` branch — these change rarely and aren't part of the 15-minute polling pipeline. Specifically `site/public/geo/`, served as plain static files and fetched by the map at runtime, rather than `src/assets/geo/` bundled into the JS: the map is lazy-loaded anyway, and a separate file means a boundary refresh doesn't change any script's hash.

* Update cadence is manual/occasional (e.g. yearly, or when AES's territory is reported to have changed), triggered by re-running the build script above, possibly not automated.
* The service territory outline keeps its history in normal git commits on `main` — that satisfies "AES service area should maybe retain historical versions" from the original notes without extra tooling.
* Counties don't need that: a fresh pull just replaces the file.

## Layer 3: Outage Incidents

This is the outage data; see [schema.md](schema.md)

**Implemented** as one circle per incident active at the selected moment — the same moment, and the same "active at commit C" query (`site/src/lib/incidents.ts`), as the size distribution chart, so the two can't disagree about which incidents existed.

* **Size:** circle *area* tracks customers affected (radius grows with the square root), clamped so a 1-customer incident stays visible and the largest don't swallow their neighbors. Smaller incidents draw on top of larger ones. A legend under the map shows 1 / 100 / 1,000 customers at the same scale.
* **Color:** the heartbeat chart's "Customers affected" orange; context layers (territory) stay neutral so the data is the only color on the map.
* **Location as of the moment:** `--full-versions` gives every version row its own lat/lng, so an incident that AES moved between polls is drawn where it was at the time.
* **Incidents with no usable location** (see schema.md quirk #8) are counted in the summary line above the map and explicitly called out there, but not drawn — plotting them would put real outages off the coast of Africa.
* **Not yet:** clustering/aggregation, zoom-dependent styling, or clicking an incident for its details or history.
