#!/usr/bin/env node
// Builds site/public/geo/aes-ohio-territory.geojson: AES Ohio's certified
// electric service territory, from the Public Utilities Commission of
// Ohio's service-area polygons (served by ODOT's TIMS ArcGIS server),
// simplified with mapshaper for use as a map backdrop. See docs/maps.md for
// why this source and why the output is committed rather than fetched at
// build time.
//
//   node site/scripts/build-territory.mjs                 # fetch live, write output
//   node site/scripts/build-territory.mjs --input raw.geojson   # skip the fetch
//   node site/scripts/build-territory.mjs --raw-out raw.geojson # also keep the unsimplified response
//
// Only Node built-ins plus mapshaper, run via npx at a pinned version so the
// site's own dependencies (and every deploy's `npm ci`) don't carry it.

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const LAYER_URL = 'https://tims.dot.state.oh.us/ags/rest/services/Boundaries/PUCO_Electric_Service_Areas/MapServer/0'
// Matches both the current name and the former Dayton Power & Light one, since we don't control
// when PUCO's data catches up with a rename. The script fails unless this
// resolves to exactly one company, so a too-loose pattern can't slip through.
const DEFAULT_WHERE = "UPPER(COMPANY_NAME) LIKE '%AES%' OR UPPER(COMPANY_NAME) LIKE '%DAYTON POWER%'"
const MAPSHAPER = 'mapshaper@0.7.101'
// Simplification tolerance in meters. At the zoom the map opens at, a pixel
// is a few hundred meters, so this is well below anything visible there
// while still dropping most of the source's survey-grade vertices.
const SIMPLIFY_METERS = 100
// ~11 m. Matches the simplification: more digits would be false precision.
const COORDINATE_PRECISION = 0.0001
// Generous sanity box (same idea as the site's PLAUSIBLE_INCIDENT_BOUNDS):
// if the output's bbox isn't inside this, something upstream changed.
const SANITY_BOX = { west: -86.5, south: 37.5, east: -80, north: 42.5 }

const here = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_OUT = path.resolve(here, '../public/geo/aes-ohio-territory.geojson')

const { values: args } = parseArgs({
  options: {
    input: { type: 'string' },
    'raw-out': { type: 'string' },
    out: { type: 'string', default: DEFAULT_OUT },
    where: { type: 'string', default: DEFAULT_WHERE },
  },
})

function fail(message) {
  console.error(`build-territory: ${message}`)
  process.exit(1)
}

async function fetchTerritory(where) {
  const params = new URLSearchParams({
    where,
    outFields: 'COMPANY_CD,COMPANY_TYPE,COMPANY_NAME',
    returnGeometry: 'true',
    // Have the server reproject from its Web Mercator storage to WGS84, which
    // is what GeoJSON and MapLibre expect.
    outSR: '4326',
    f: 'geojson',
  })
  const url = `${LAYER_URL}/query?${params}`
  console.log(`Fetching ${url}`)
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok) fail(`HTTP ${response.status} ${response.statusText} from ${LAYER_URL}`)
  const body = await response.json()
  // ArcGIS reports query errors with a 200 and an `error` object.
  if (body.error) fail(`ArcGIS error: ${JSON.stringify(body.error)}`)
  if (body.exceededTransferLimit || body.properties?.exceededTransferLimit) {
    fail('response was truncated (exceededTransferLimit); narrow --where')
  }
  return body
}

function checkSource(collection) {
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    fail('response is not a GeoJSON FeatureCollection')
  }
  if (collection.features.length === 0) fail(`no features matched: ${args.where}`)
  const companies = new Map()
  for (const feature of collection.features) {
    const { COMPANY_CD: code, COMPANY_NAME: name, COMPANY_TYPE: type } = feature.properties ?? {}
    companies.set(code, `${name} (${type}, code ${code})`)
  }
  console.log(`Matched ${collection.features.length} feature(s) from: ${[...companies.values()].join('; ')}`)
  if (companies.size !== 1) fail(`expected exactly one company, got ${companies.size}; tighten --where`)
}

function bboxOf(collection) {
  const box = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity }
  let vertices = 0
  const visit = (coords) => {
    if (typeof coords[0] === 'number') {
      vertices++
      box.west = Math.min(box.west, coords[0])
      box.east = Math.max(box.east, coords[0])
      box.south = Math.min(box.south, coords[1])
      box.north = Math.max(box.north, coords[1])
    } else {
      coords.forEach(visit)
    }
  }
  for (const feature of collection.features) visit(feature.geometry.coordinates)
  return { box, vertices }
}

function checkOutput(collection) {
  if (collection?.type !== 'FeatureCollection' || collection.features.length !== 1) {
    fail('simplified output should be a FeatureCollection with exactly one (dissolved) feature')
  }
  const geometryType = collection.features[0].geometry?.type
  if (geometryType !== 'Polygon' && geometryType !== 'MultiPolygon') fail(`unexpected geometry type ${geometryType}`)
  const { box, vertices } = bboxOf(collection)
  const inside =
    box.west >= SANITY_BOX.west && box.east <= SANITY_BOX.east && box.south >= SANITY_BOX.south && box.north <= SANITY_BOX.north
  if (!inside) fail(`output bbox ${JSON.stringify(box)} falls outside the expected region - check the source's projection`)
  return { box, vertices }
}

const source = args.input ? JSON.parse(readFileSync(args.input, 'utf-8')) : await fetchTerritory(args.where)
checkSource(source)

const work = mkdtempSync(path.join(tmpdir(), 'build-territory-'))
const rawPath = path.join(work, 'raw.geojson')
const simplifiedPath = path.join(work, 'simplified.geojson')
writeFileSync(rawPath, JSON.stringify(source))
if (args['raw-out']) writeFileSync(args['raw-out'], JSON.stringify(source))

execFileSync(
  'npx',
  [
    '--yes',
    MAPSHAPER,
    rawPath,
    // Merge however many polygons PUCO stores for the company into one
    // feature, keeping the identifying fields.
    '-dissolve',
    'COMPANY_CD',
    'copy-fields=COMPANY_NAME,COMPANY_TYPE',
    '-simplify',
    `interval=${SIMPLIFY_METERS}`,
    'keep-shapes',
    '-clean',
    '-o',
    simplifiedPath,
    'format=geojson',
    `precision=${COORDINATE_PRECISION}`,
  ],
  { stdio: 'inherit' },
)

const simplified = JSON.parse(readFileSync(simplifiedPath, 'utf-8'))
const { box, vertices } = checkOutput(simplified)
const feature = simplified.features[0]
feature.properties = {
  company_cd: feature.properties.COMPANY_CD,
  company_name: feature.properties.COMPANY_NAME,
  company_type: feature.properties.COMPANY_TYPE,
  source: 'Public Utilities Commission of Ohio, via ODOT TIMS',
  source_url: LAYER_URL,
}

mkdirSync(path.dirname(args.out), { recursive: true })
const output = `${JSON.stringify(simplified)}\n`
writeFileSync(args.out, output)
const rawVertices = bboxOf(source).vertices
console.log(
  `Wrote ${path.relative(process.cwd(), args.out)}: ${vertices} vertices (from ${rawVertices}), ` +
    `${(output.length / 1024).toFixed(1)} KiB, bbox ` +
    `[${[box.west, box.south, box.east, box.north].map((n) => n.toFixed(3)).join(', ')}]`,
)
