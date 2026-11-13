// Forks: update these to point at your own fork's data branch.
export const GITHUB_OWNER = 'JPearson-dev'
export const GITHUB_REPO = 'aes-ohio-outages'
const DATA_BRANCH = 'data'

export const DATA_BASE_URL = `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@${DATA_BRANCH}`
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`

// Root-relative base path the site is actually served from: nothing in dev,
// `/aes-ohio-outages` on GitHub Pages project sites. A fork on a custom
// domain (served from its own root) should override this to ''.
export const SITE_ROOT = import.meta.env.DEV ? '' : `/${GITHUB_REPO}`

// Map basemaps: OpenFreeMap's public instance, which needs no API key (see
// docs/maps.md). Positron is the documented choice; Dark is its dark-mode
// counterpart from the same style family, used when the page is dark too.
// Pointing these at a self-hosted style is maps.md's documented fallback.
export const BASEMAP_STYLE_URL = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}

// The map's opening view: the extent incidents have actually appeared in
// (lat 39.24-40.76, lng -84.80 to -83.17 as of Nov 2026), rounded outward.
export const MAP_INITIAL_BOUNDS: [[number, number], [number, number]] = [
  [-84.85, 39.2],
  [-83.1, 40.8],
]

// Incidents whose coordinates fall outside this box are treated as having
// no usable location - see partitionByLocation. Deliberately generous (well
// past Ohio's borders) so it only catches coordinates that are clearly
// broken, not ones that are merely surprising.
export const PLAUSIBLE_INCIDENT_BOUNDS = { west: -86.5, south: 37.5, east: -80, north: 42.5 }

// Simplified AES Ohio certified-territory outline, built by
// `npm run build-geo` (see site/scripts/build-territory.mjs) and committed.
export const TERRITORY_GEOJSON_PATH = 'geo/aes-ohio-territory.geojson'
