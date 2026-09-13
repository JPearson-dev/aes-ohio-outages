import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { Line } from 'react-chartjs-2'
import { loadHistoryDb } from '../lib/historyDb'
import { querySizeBuckets, DEFAULT_BREAKPOINTS, bucketNamesFor, type SizeBucketRow } from '../lib/sizeBuckets'
import styles from './SizeBucketCharts.module.css'

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

// Okabe-Ito colorblind-safe palette, ordered cool -> warm so bigger buckets
// read as more severe.
const BUCKET_COLORS = ['#56B4E9', '#009E73', '#E69F00', '#D55E00']

const BREAKPOINTS = DEFAULT_BREAKPOINTS
const BUCKET_NAMES = bucketNamesFor(BREAKPOINTS)
const BUCKET_LABELS = [...BREAKPOINTS.map((bp) => `≤${bp}`), `>${BREAKPOINTS[BREAKPOINTS.length - 1]}`]

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: SizeBucketRow[] }

export function SizeBucketCharts() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    loadHistoryDb()
      .then((db) => {
        if (!cancelled) setState({ status: 'ready', rows: querySizeBuckets(db, BREAKPOINTS) })
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

  if (state.status === 'loading') {
    return <p className={styles.status}>Loading incident size data…</p>
  }

  if (state.status === 'error') {
    return <p className={styles.status}>Couldn't load incident size data: {state.message}</p>
  }

  const { rows } = state

  function toggleBucket(name: string) {
    setHidden((prev) => {
      const wouldHideAll = !prev.has(name) && prev.size === BUCKET_NAMES.length - 1
      if (wouldHideAll) return prev // keep at least one bucket visible on both charts

      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const datasetsFor = (field: 'counts' | 'customers') =>
    BUCKET_NAMES.map((name, i) => ({
      label: BUCKET_LABELS[i],
      data: rows.map((row) => ({ x: row.timestamp, y: row[field][name] })),
      borderColor: BUCKET_COLORS[i],
      backgroundColor: BUCKET_COLORS[i],
      pointRadius: 0,
      tension: 0.15,
      hidden: hidden.has(name),
    }))

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      x: { type: 'time' as const, time: { unit: 'day' as const } },
      y: { type: 'linear' as const, beginAtZero: true },
    },
  }

  return (
    <div className={styles.wrap}>
      <h2>Incidents Grouped By Customers Affected</h2>

      <p className={styles.legendTitle}>Customers affected per incident:</p>
      <ul className={styles.legend}>
        {BUCKET_NAMES.map((name, i) => (
          <li key={name}>
            <button
              type="button"
              className={styles.legendItem}
              data-hidden={hidden.has(name)}
              onClick={() => toggleBucket(name)}
            >
              <span className={styles.swatch} style={{ backgroundColor: BUCKET_COLORS[i] }} />
              {BUCKET_LABELS[i]}
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.chartWrap}>
        <h3>Customers affected</h3>
        <Line data={{ datasets: datasetsFor('customers') }} options={commonOptions} />
      </div>

      <div className={styles.chartWrap}>
        <h3>Incident count</h3>
        <Line data={{ datasets: datasetsFor('counts') }} options={commonOptions} />
      </div>
    </div>
  )
}
