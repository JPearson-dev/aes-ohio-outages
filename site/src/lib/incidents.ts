import type { FeatureCollection, Point } from 'geojson'
import type { Database } from 'sql.js'

// One incident as it stood at a given commit.
export interface IncidentAt {
  id: number
  lat: number
  lng: number
  customersAffected: number
}

// Every incident active at a given commit, with its values as they stood
// then. "Active" means _first_seen_commit and _last_seen_commit straddle the
// commit. "As they stood" means the item_version row with the greatest
// _commit not after that commit - its most recent recorded snapshot as of
// then, whether or not that commit itself introduced a new version row.
// --full-versions (see docs/schema.md) is what makes every version row carry
// lat/lng, so an incident that moved is drawn where it was at the time, not
// where it ended up.
//
// This is the one definition of "what was active at commit C" - the size
// distribution chart and the map both read through it, so they can't
// disagree about which incidents existed at a moment.
export function queryIncidentsAt(db: Database, commitId: number): IncidentAt[] {
  const result = db.exec(
    `
    WITH latest_version AS (
      SELECT
        _item,
        lat,
        lng,
        customers_affected,
        ROW_NUMBER() OVER (PARTITION BY _item ORDER BY _commit DESC) AS rn
      FROM item_version
      WHERE _commit <= :commit
    )
    SELECT i.id, lv.lat, lv.lng, lv.customers_affected
    FROM latest_version lv
    JOIN item i ON i._id = lv._item
    WHERE lv.rn = 1
      AND i._first_seen_commit <= :commit
      AND i._last_seen_commit >= :commit
    ORDER BY i.id
  `,
    { ':commit': commitId },
  )[0]

  return (result?.values ?? []).map(([id, lat, lng, customers]) => ({
    id: id as number,
    lat: lat as number,
    lng: lng as number,
    customersAffected: customers as number,
  }))
}

export interface LngLatBox {
  west: number
  south: number
  east: number
  north: number
}

// Splits incidents into those with a usable location inside box and those
// without one. The upstream feed has carried incidents whose coordinates
// are a few hundredths of a degree from (0, 0) - lat and lng equal and
// jittering between polls, as if a location offset were applied to a
// missing coordinate. Plotting those would put real outages in the Gulf of
// Guinea, so they're kept out of the map but still counted, rather than
// dropped silently.
export function partitionByLocation(
  incidents: IncidentAt[],
  box: LngLatBox,
): { located: IncidentAt[]; unlocated: IncidentAt[] } {
  const located: IncidentAt[] = []
  const unlocated: IncidentAt[] = []
  for (const incident of incidents) {
    const inBox =
      incident.lng >= box.west && incident.lng <= box.east && incident.lat >= box.south && incident.lat <= box.north
    ;(inBox ? located : unlocated).push(incident)
  }
  return { located, unlocated }
}

export interface IncidentFeatureProperties {
  id: number
  customers: number
}

export function incidentFeatures(incidents: IncidentAt[]): FeatureCollection<Point, IncidentFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: incidents.map((incident) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [incident.lng, incident.lat] },
      properties: { id: incident.id, customers: incident.customersAffected },
    })),
  }
}
