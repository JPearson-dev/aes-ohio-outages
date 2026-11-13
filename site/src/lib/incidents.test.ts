import initSqlJs, { type Database } from 'sql.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { incidentFeatures, partitionByLocation, queryIncidentsAt, type IncidentAt } from './incidents'
import { queryCustomersAffectedAt } from './sizeDistribution'

// Just the columns queryIncidentsAt reads, in the shape git-history plus
// build_history_db.py's presence pass produce (see docs/schema.md).
const SCHEMA = `
  CREATE TABLE item (
    _id INTEGER PRIMARY KEY,
    id INTEGER,
    _first_seen_commit INTEGER,
    _last_seen_commit INTEGER
  );
  CREATE TABLE item_version (
    _id INTEGER PRIMARY KEY,
    _item INTEGER,
    _commit INTEGER,
    lat REAL,
    lng REAL,
    customers_affected INTEGER
  );
`

let SQL: Awaited<ReturnType<typeof initSqlJs>>

beforeAll(async () => {
  SQL = await initSqlJs()
})

function makeDb(): Database {
  const db = new SQL.Database()
  db.run(SCHEMA)
  // Incident 100: seen commits 1-5, grew from 10 to 40 customers at commit
  // 3, and moved at commit 4.
  db.run('INSERT INTO item VALUES (1, 100, 1, 5)')
  db.run('INSERT INTO item_version VALUES (1, 1, 1, 39.75, -84.19, 10)')
  db.run('INSERT INTO item_version VALUES (2, 1, 3, 39.75, -84.19, 40)')
  db.run('INSERT INTO item_version VALUES (3, 1, 4, 39.76, -84.20, 40)')
  // Incident 200: seen commits 2-2 only.
  db.run('INSERT INTO item VALUES (2, 200, 2, 2)')
  db.run('INSERT INTO item_version VALUES (4, 2, 2, 39.90, -84.00, 3)')
  // Incident 300: first seen at commit 4.
  db.run('INSERT INTO item VALUES (3, 300, 4, 6)')
  db.run('INSERT INTO item_version VALUES (5, 3, 4, 40.10, -84.50, 1200)')
  return db
}

describe('queryIncidentsAt', () => {
  it('returns only incidents active at the commit', () => {
    const db = makeDb()
    expect(queryIncidentsAt(db, 1).map((i) => i.id)).toEqual([100])
    expect(queryIncidentsAt(db, 2).map((i) => i.id)).toEqual([100, 200])
    expect(queryIncidentsAt(db, 3).map((i) => i.id)).toEqual([100])
    expect(queryIncidentsAt(db, 4).map((i) => i.id)).toEqual([100, 300])
    expect(queryIncidentsAt(db, 6).map((i) => i.id)).toEqual([300])
    expect(queryIncidentsAt(db, 7)).toEqual([])
  })

  it('carries an earlier version forward through commits that added no new version', () => {
    // Commit 2 added no version row for incident 100, so its commit-1 state applies.
    expect(queryIncidentsAt(makeDb(), 2)[0]).toEqual({ id: 100, lat: 39.75, lng: -84.19, customersAffected: 10 })
  })

  it('uses the version as of the commit, not a later one', () => {
    const db = makeDb()
    expect(queryIncidentsAt(db, 3)[0]).toEqual({ id: 100, lat: 39.75, lng: -84.19, customersAffected: 40 })
    // Moved at commit 4: drawn where it was then, not where it ended up.
    expect(queryIncidentsAt(db, 4)[0]).toEqual({ id: 100, lat: 39.76, lng: -84.2, customersAffected: 40 })
  })

  it('agrees with queryCustomersAffectedAt, which reads through it', () => {
    const db = makeDb()
    for (const commit of [1, 2, 3, 4, 5, 6, 7]) {
      expect(queryCustomersAffectedAt(db, commit)).toEqual(queryIncidentsAt(db, commit).map((i) => i.customersAffected))
    }
  })
})

describe('partitionByLocation', () => {
  const box = { west: -86.5, south: 37.5, east: -80, north: 42.5 }
  const dayton: IncidentAt = { id: 1, lat: 39.76, lng: -84.19, customersAffected: 5 }
  // Shape seen in the real feed: lat == lng, a hundredth of a degree off (0, 0).
  const nearNullIsland: IncidentAt = { id: 2, lat: 0.0119082, lng: 0.0119082, customersAffected: 4 }
  const swapped: IncidentAt = { id: 3, lat: -84.19, lng: 39.76, customersAffected: 1 }

  it('keeps incidents inside the box and sets aside the rest, without dropping any', () => {
    expect(partitionByLocation([dayton, nearNullIsland, swapped], box)).toEqual({
      located: [dayton],
      unlocated: [nearNullIsland, swapped],
    })
  })

  it('treats the box edges as inside', () => {
    const corner: IncidentAt = { id: 4, lat: 37.5, lng: -80, customersAffected: 1 }
    expect(partitionByLocation([corner], box).located).toEqual([corner])
  })
})

describe('incidentFeatures', () => {
  it('emits GeoJSON points in [lng, lat] order with id and customer count', () => {
    expect(incidentFeatures([{ id: 7, lat: 39.76, lng: -84.19, customersAffected: 12 }])).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-84.19, 39.76] },
          properties: { id: 7, customers: 12 },
        },
      ],
    })
  })
})
