# Maps

## Layer 1: Basemap

**Decision: OpenFreeMap**, public instance, Positron-style vector tiles, rendered via MapLibre GL JS.

* No API key, no registration, no published rate limit on the public instance (`openfreemap.org`, MIT-licensed, tiles built from OpenStreetMap via the OpenMapTiles schema).
* Gives the same flat, low-color look we originally wanted from Carto Positron, without a key to manage.
* If the public instance ever becomes unreliable, OpenFreeMap publishes the same tiles as downloadable PMTiles archives for self-hosting — so switching to the "Self-hosted PMTiles" fallback below is a config change, not a new data source.
* Required attribution: `© OpenMapTiles © OpenStreetMap contributors` (must stay visible on the map in the eventual site build).

Rejected:

* **Carto Positron**: as of ~August 2026, Carto now requires a free API key for basemap tile requests it previously served anonymously. That reintroduces the "someone has to go get a key before their fork works" friction we ruled Google Maps out for, with no benefit over OpenFreeMap for this project.
* **Stadia Maps**: still requires an API key; no advantage over OpenFreeMap here.
* **Self-hosted PMTiles**: kept as a documented fallback, not the default. Adds ~15-20MB to the repo and a tile-build step for something OpenFreeMap already serves for free.
* **Google Maps**: ruled out previously — API key/billing management burden for anyone forking the project.

## Layer 2: Geographic Context

**Counties — Decision: US Census Bureau TIGER cartographic boundary files** (`cb_<year>_us_county_500k`), not OGRIP.

* Public domain (US government work), one national pipeline, and already generalized for small-scale thematic mapping — appropriate since this layer is for orientation, not analysis.
* OGRIP would mean a second, Ohio-specific source/schema just for boundaries this doc already calls "stable enough for any changes to be noise." Not worth the extra maintenance surface.
* **Which counties to keep — decision:** filter to the county names that actually appear in the upstream data (the `COUNTY` values seen in `current/counties.json`, ~24 names), not a spatial join against the EIA territory polygon. This keeps Layer 2 and Layer 3 consistent by construction and avoids ambiguity over partial-county edges. Re-check this list occasionally in case AES ever reports a county that hasn't shown up yet.
* Pipeline: pull the national cartographic boundary file, filter to that county list, simplify with `mapshaper`, commit the resulting GeoJSON.

**AES service territory outline — Decision: EIA Electric Retail Service Territories** dataset (downloadable directly as GeoJSON from `atlas.eia.gov`), filtered to AES Ohio / Dayton Power & Light.

* Same tool (`mapshaper`) to simplify before committing; keep only the simplified derived file in the repo, not the raw national extract.

**Coordinate reference system — decision:** reproject everything to WGS84 (EPSG:4326) at build time. TIGER cartographic files ship in NAD83 (EPSG:4269); the EIA territory file and MapLibre/GeoJSON both expect WGS84, and it must match the plain lat/lng the incident data already uses (`mapshaper -proj wgs84` in the same pass as simplification/filtering).

**Reproducibility — decision:** capture the fetch/filter/reproject/simplify steps as a checked-in script (e.g. `scripts/build-geo.sh`) rather than one-off manual commands, so refreshing these layers later doesn't depend on someone's shell history. Matches how `fetch.py`/`update-data.sh` already scripts the incident pipeline instead of hand-editing outputs.

**Simplification target — decision:** simplify aggressively (`mapshaper -simplify`) since this is a visual backdrop, not analytical geometry — indistinguishable-at-render-scale beats precise. No hard byte budget needed; "does it still look right zoomed to the service area" is the bar.

**Attribution captions — decision:** credit "US Census Bureau" and "US Energy Information Administration" in the map UI (e.g. a small credits line) even though public-domain government data doesn't legally require it. Consistent with this project's general practice of being explicit about data provenance.

**Storage for both layers:** static GeoJSON files on the `main` branch (e.g. `src/assets/geo/`), not the `data` branch — these change rarely and aren't part of the 15-minute polling pipeline.

* Update cadence is manual/occasional (e.g. yearly, or when AES's territory is reported to have changed), triggered by re-running the build script above, possibly not automated.
* The service territory outline keeps its history in normal git commits on `main` — that satisfies "AES service area should maybe retain historical versions" from the original notes without extra tooling.
* Counties don't need that: a fresh pull just replaces the file.

## Layer 3: Outage Incidents

This is the outage data; see [schema.md](schema.md)
