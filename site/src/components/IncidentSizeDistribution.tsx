import { useEffect, useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  LogarithmicScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import type { Database } from 'sql.js'
import { Bar, Line } from 'react-chartjs-2'
import { loadHistoryDb } from '../lib/historyDb'
import {
  cumulativePoints,
  linearBuckets,
  logBuckets,
  queryCustomersAffectedAsOf,
  type CumulativePoint,
  type SizeDistributionBucket,
} from '../lib/sizeDistribution'
import { InfoTooltip } from './InfoTooltip'
import { DistributionSettings, type DistributionMetric, type DistributionOptions } from './DistributionSettings'
import styles from './IncidentSizeDistribution.module.css'

ChartJS.register(BarElement, CategoryScale, LinearScale, LineElement, LogarithmicScale, PointElement, Tooltip)

const COLOR = '#0072B2'

// Temporary: pin the chart to a fixed moment instead of always-latest data,
// until the moment-in-time scrubber described in the README exists. This is
// 2026-09-16 8:05 PM America/New_York (EDT, UTC-4, so 00:05 the next day in
// UTC) - commit_at is stored as UTC, so the offset is applied here rather
// than left implicit.
const PINNED_MOMENT = '2026-09-17T00:05:00Z'

function bucketLabel(bucket: SizeDistributionBucket): string {
  return bucket.start === bucket.end ? `${bucket.start}` : `${bucket.start}–${bucket.end}`
}

function customersNoun(count: number): string {
  return count === 1 ? 'customer' : 'customers'
}

function metricLabel(metric: DistributionMetric, value: number): string {
  return metric === 'incidents'
    ? `${value} incident${value === 1 ? '' : 's'}`
    : `${value} total ${customersNoun(value)} affected`
}

function yAxisTitle(metric: DistributionMetric): string {
  return metric === 'incidents' ? 'Incident count' : 'Total customers affected'
}

const yAxis = (metric: DistributionMetric) =>
  ({
    type: 'linear',
    beginAtZero: true,
    title: { display: true, text: yAxisTitle(metric) },
    // Both metrics are always whole numbers - without this, Chart.js's "nice
    // round number" tick algorithm can land on fractional ticks (0.5, 1.5,
    // ...) when the max value is low.
    ticks: { precision: 0 },
  }) as const

const X_AXIS_TITLE = { display: true, text: 'Customers affected per incident' }

// Chart.js's default rotates labels up to 50deg to cram all of them in -
// forcing 0 instead makes it fall back to skipping labels (autoSkip, on by
// default) once they no longer fit horizontally, rather than ever slanting
// them.
const FLAT_TICKS = { maxRotation: 0, minRotation: 0 }

// For the bar chart, a log x axis means log-width buckets (see logBuckets) shown as
// equal-width bars on a category axis, not a numeric log scale - bars on a
// numeric log axis would just be very thin at the large end.
function BarDistribution({ buckets, metric }: { buckets: SizeDistributionBucket[]; metric: DistributionMetric }) {
  return (
    <Bar
      data={{
        labels: buckets.map(bucketLabel),
        datasets: [
          {
            label: metric === 'incidents' ? 'Incidents' : 'Customers affected',
            data: buckets.map((b) => (metric === 'incidents' ? b.count : b.customersTotal)),
            backgroundColor: COLOR,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              // Default title/label ("50" / "Incidents: 1") reads like a
              // count of something called "50", not a customer-count bucket
              // - spell out what the number and count mean.
              title: (items) => {
                const bucket = buckets[items[0].dataIndex]
                return `${bucketLabel(bucket)} ${customersNoun(bucket.end)} affected per incident`
              },
              label: (item) => metricLabel(metric, item.parsed.y ?? 0),
            },
          },
        },
        scales: {
          x: { title: X_AXIS_TITLE, ticks: FLAT_TICKS },
          y: yAxis(metric),
        },
      }}
    />
  )
}

function CumulativeDistribution({
  points,
  metric,
  logX,
}: {
  points: CumulativePoint[]
  metric: DistributionMetric
  logX: boolean
}) {
  const total = points.at(-1)?.[metric === 'incidents' ? 'count' : 'customersTotal'] ?? 0

  return (
    <Line
      data={{
        datasets: [
          {
            label: metric === 'incidents' ? 'Incidents' : 'Customers affected',
            data: points.map((p) => ({ x: p.value, y: metric === 'incidents' ? p.count : p.customersTotal })),
            borderColor: COLOR,
            backgroundColor: COLOR,
            // Each point's y holds until the next distinct value, then
            // jumps - 'before' draws the horizontal run first, then the
            // vertical step up at the next point.
            stepped: 'before',
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        // The line has a point only at each distinct value, so hovering
        // anywhere should snap to the nearest one along x rather than
        // requiring the cursor to sit on the line.
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const value = items[0].parsed.x ?? 0
                return `≤ ${value} ${customersNoun(value)} affected per incident`
              },
              label: (item) => {
                const value = item.parsed.y ?? 0
                const percent = total > 0 ? ` (${((value / total) * 100).toFixed(1)}%)` : ''
                return `${metricLabel(metric, value)}${percent}`
              },
            },
          },
        },
        scales: {
          x: {
            type: logX ? 'logarithmic' : 'linear',
            title: X_AXIS_TITLE,
            ticks: FLAT_TICKS,
            // Without bounds Chart.js pads out to the next "nice" tick
            // (e.g. 0 or 10,000), leaving empty space past the data.
            min: points[0]?.value,
            max: points.at(-1)?.value,
          },
          y: yAxis(metric),
        },
      }}
    />
  )
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; db: Database }

export function IncidentSizeDistribution() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [options, setOptions] = useState<DistributionOptions>({
    metric: 'incidents',
    aggregation: 'bucketed',
    xScale: 'linear',
  })

  useEffect(() => {
    let cancelled = false

    loadHistoryDb()
      .then((db) => {
        if (!cancelled) setState({ status: 'ready', db })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const values = useMemo(
    () => (state.status === 'ready' ? queryCustomersAffectedAsOf(state.db, PINNED_MOMENT) : []),
    [state],
  )
  const buckets = useMemo(
    () => (options.xScale === 'log' ? logBuckets(values) : linearBuckets(values)),
    [values, options.xScale],
  )
  const points = useMemo(() => cumulativePoints(values), [values])

  if (state.status === 'loading') {
    return <p className={styles.status}>Loading incident size data…</p>
  }

  if (state.status === 'error') {
    return <p className={styles.status}>Couldn't load incident size data: {state.message}</p>
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.heading}>
        <h2>Incident Size Distribution</h2>
        <DistributionSettings options={options} onChange={setOptions} />
      </div>

      <div className={styles.chartWrap}>
        <InfoTooltip text="This chart is temporarily pinned to a single moment (Sep 16, 2026, 8:05 PM Eastern) while the moment-in-time scrubber is built." />
        {options.aggregation === 'bucketed' ? (
          <BarDistribution buckets={buckets} metric={options.metric} />
        ) : (
          <CumulativeDistribution points={points} metric={options.metric} logX={options.xScale === 'log'} />
        )}
      </div>
    </div>
  )
}
