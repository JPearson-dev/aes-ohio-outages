/**
 * Map of the incidents active at the selected moment.
 *
 * * Basemap: OpenFreeMap (no key), light or dark to match the page
 * * Context: AES Ohio's certified-territory outline, if built (see
 *   docs/maps.md); the map works without it
 * * Data: one circle per incident, area proportional to customers affected,
 *   at the moment shared with the size distribution chart
 * * Deliberately not here (yet): clustering/aggregation, zoom-dependent
 *   styling, clicking an incident for details
 *
 * Default-exported and lazy-loaded from App, so MapLibre (by far the largest
 * dependency) doesn't hold up the charts above it.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Layer, Map, Source, type LayerProps } from '@vis.gl/react-maplibre'
import { setWorkerUrl, type ExpressionSpecification } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection } from 'geojson'
import {
  BASEMAP_STYLE_URL,
  MAP_INITIAL_BOUNDS,
  PLAUSIBLE_INCIDENT_BOUNDS,
  SITE_ROOT,
  TERRITORY_GEOJSON_PATH,
} from '../config'
import { incidentFeatures, partitionByLocation, queryIncidentsAt } from '../lib/incidents'
import type { Moment } from '../lib/moments'
import type { HistoryDbState } from '../lib/useHistoryDb'
import { InfoTooltip } from './InfoTooltip'
import { MomentStepper } from './MomentStepper'
import styles from './IncidentMap.module.css'

// MapLibre's ESM build looks for its worker next to its own module URL,
// which stops being true once Vite bundles it into a chunk. Vite's
// `?worker&url` emits the worker as its own asset and gives back its URL.
setWorkerUrl(maplibreWorkerUrl)

// Same orange as "Customers affected" on the heartbeat chart: these circles
// are that quantity, split out per incident.
const INCIDENT_COLOR = '#E69F00'

const PALETTE = {
  light: { territory: '#3b4a5a', incidentStroke: '#7a4f00' },
  dark: { territory: '#a9bccf', incidentStroke: '#1b1b1b' },
}

// Circle radius grows with sqrt(customers), so circle *area* tracks
// customers affected. Clamped at both ends: a 1-customer incident stays
// visible, and the largest ones (a few thousand customers) don't swallow
// their neighbors.
const RADIUS_MIN_PX = 3
const RADIUS_MAX_PX = 24
const SQRT_CUSTOMERS_AT_MAX = 70 // ~4,900 customers

function radiusFor(customers: number): number {
  const s = Math.min(Math.max(Math.sqrt(customers), 1), SQRT_CUSTOMERS_AT_MAX)
  return RADIUS_MIN_PX + ((s - 1) * (RADIUS_MAX_PX - RADIUS_MIN_PX)) / (SQRT_CUSTOMERS_AT_MAX - 1)
}

// The same scale as radiusFor, as a MapLibre expression (interpolate clamps
// outside its stops, matching radiusFor's clamping).
const RADIUS_EXPRESSION: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['sqrt', ['get', 'customers']],
  1,
  RADIUS_MIN_PX,
  SQRT_CUSTOMERS_AT_MAX,
  RADIUS_MAX_PX,
]

const LEGEND_SIZES = [1, 100, 1000]

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribeToColorScheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribeToColorScheme, () => window.matchMedia(DARK_QUERY).matches)
}

type TerritoryState = { status: 'loading' } | { status: 'unavailable' } | { status: 'ready'; data: FeatureCollection }

// The outline is a committed static file that may not have been built yet
// (see docs/maps.md), so a missing file just means no outline, not an error.
function useTerritory(): TerritoryState {
  const [state, setState] = useState<TerritoryState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch(`${SITE_ROOT}/${TERRITORY_GEOJSON_PATH}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: FeatureCollection | null) => {
        if (!cancelled) setState(data ? { status: 'ready', data } : { status: 'unavailable' })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

const numberFormat = new Intl.NumberFormat('en-US')

function plural(count: number, noun: string): string {
  return `${numberFormat.format(count)} ${noun}${count === 1 ? '' : 's'}`
}

interface IncidentMapProps {
  dbState: HistoryDbState
  moments: Moment[]
  // Index into moments of the moment to show.
  selectedIndex: number
  onSelectIndex: (index: number) => void
}

export default function IncidentMap({ dbState, moments, selectedIndex, onSelectIndex }: IncidentMapProps) {
  const dark = usePrefersDark()
  const palette = dark ? PALETTE.dark : PALETTE.light
  const territory = useTerritory()

  const moment = moments[selectedIndex] as Moment | undefined
  const incidents = useMemo(
    () => (dbState.status === 'ready' && moment ? queryIncidentsAt(dbState.db, moment.commitId) : []),
    [dbState, moment],
  )
  const { located, unlocated } = useMemo(() => partitionByLocation(incidents, PLAUSIBLE_INCIDENT_BOUNDS), [incidents])
  const features = useMemo(() => incidentFeatures(located), [located])
  const customersTotal = incidents.reduce((sum, incident) => sum + incident.customersAffected, 0)

  if (dbState.status === 'loading') {
    return <p className={styles.status}>Loading incident data…</p>
  }

  if (dbState.status === 'error') {
    return <p className={styles.status}>Couldn't load incident data: {dbState.message}</p>
  }

  if (!moment) {
    return <p className={styles.status}>No incident data yet.</p>
  }

  const territoryFill: LayerProps = {
    id: 'territory-fill',
    type: 'fill',
    paint: { 'fill-color': palette.territory, 'fill-opacity': 0.06 },
  }
  const territoryLine: LayerProps = {
    id: 'territory-line',
    type: 'line',
    paint: { 'line-color': palette.territory, 'line-width': 1.5, 'line-opacity': 0.8 },
  }
  const incidentCircles: LayerProps = {
    id: 'incidents',
    type: 'circle',
    // Higher sort keys draw on top: negating customers puts small incidents
    // over large ones, so a big circle can't hide a small one beneath it.
    layout: { 'circle-sort-key': ['-', ['get', 'customers']] },
    paint: {
      'circle-radius': RADIUS_EXPRESSION,
      'circle-color': INCIDENT_COLOR,
      'circle-opacity': 0.75,
      'circle-stroke-color': palette.incidentStroke,
      'circle-stroke-width': 1,
      'circle-stroke-opacity': 0.8,
    },
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.heading}>
        <h2>Incident Map</h2>
        <InfoTooltip text="Each circle is one incident as of the selected moment, sized by customers affected. Locations are approximate: AES Ohio offsets them on its own map. Click the heartbeat chart or use the arrows to change the moment; the outline is AES Ohio's certified service territory." />
      </div>

      <MomentStepper moments={moments} selectedIndex={selectedIndex} onSelectIndex={onSelectIndex} />

      <p className={styles.summary}>
        {plural(incidents.length, 'incident')}, {plural(customersTotal, 'customer')} affected
        {unlocated.length > 0 && (
          <>
            {' '}
            · {plural(unlocated.length, 'incident')} without a usable location {unlocated.length === 1 ? 'is' : 'are'}{' '}
            counted but not shown
          </>
        )}
      </p>

      <div className={styles.mapWrap}>
        <Map
          initialViewState={{ bounds: MAP_INITIAL_BOUNDS, fitBoundsOptions: { padding: 12 } }}
          mapStyle={dark ? BASEMAP_STYLE_URL.dark : BASEMAP_STYLE_URL.light}
          // The map sits in a scrolling page: plain scroll/one-finger drag
          // scroll the page, ctrl/cmd+scroll or two fingers move the map.
          cooperativeGestures
          attributionControl={{ compact: true }}
          style={{ width: '100%', height: '100%' }}
        >
          {territory.status === 'ready' && (
            <Source
              id="territory"
              type="geojson"
              data={territory.data}
              attribution='Territory: <a href="https://puco.ohio.gov/">PUCO</a>'
            >
              <Layer {...territoryFill} />
              <Layer {...territoryLine} />
            </Source>
          )}
          <Source id="incidents" type="geojson" data={features} attribution="Outages: AES Ohio">
            <Layer {...incidentCircles} />
          </Source>
        </Map>
      </div>

      <div className={styles.legend} aria-label="Circle size legend">
        <span>Customers affected per incident:</span>
        {LEGEND_SIZES.map((customers) => {
          const r = radiusFor(customers)
          return (
            <span key={customers} className={styles.legendItem}>
              <svg width={r * 2 + 2} height={r * 2 + 2} aria-hidden="true">
                <circle
                  cx={r + 1}
                  cy={r + 1}
                  r={r}
                  fill={INCIDENT_COLOR}
                  fillOpacity={0.75}
                  stroke={palette.incidentStroke}
                  strokeOpacity={0.8}
                />
              </svg>
              {numberFormat.format(customers)}
            </span>
          )
        })}
      </div>
    </div>
  )
}
