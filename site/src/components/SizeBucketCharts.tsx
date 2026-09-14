import { useEffect, useMemo, useState } from 'react'
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
import type { Database } from 'sql.js'
import { Line } from 'react-chartjs-2'
import { loadHistoryDb } from '../lib/historyDb'
import { querySizeBuckets, DEFAULT_BREAKPOINTS, bucketNamesFor } from '../lib/sizeBuckets'
import { ChartLegend, toggleLegendItem } from './ChartLegend'
import { InfoTooltip } from './InfoTooltip'
import { BreakpointsSettings } from './BreakpointsSettings'
import styles from './SizeBucketCharts.module.css'

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

// Okabe-Ito colorblind-safe palette, ordered cool -> warm so bigger buckets
// read as more severe. Cycles (via modulo below) if a custom breakpoint list
// produces more than 8 buckets - an edge case rare enough not to warrant a
// larger palette, just a repeated color.
const BUCKET_COLORS = [
  '#56B4E9',
  '#0072B2',
  '#009E73',
  '#F0E442',
  '#E69F00',
  '#D55E00',
  '#CC79A7',
  '#000000',
]

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; db: Database }

export function SizeBucketCharts() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [breakpoints, setBreakpoints] = useState<number[]>(DEFAULT_BREAKPOINTS)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())

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

  const bucketNames = useMemo(() => bucketNamesFor(breakpoints), [breakpoints])
  const bucketLabels = useMemo(
    () => [...breakpoints.map((bp) => `≤${bp}`), `>${breakpoints[breakpoints.length - 1]}`],
    [breakpoints],
  )
  const rows = useMemo(
    () => (state.status === 'ready' ? querySizeBuckets(state.db, breakpoints) : []),
    [state, breakpoints],
  )

  if (state.status === 'loading') {
    return <p className={styles.status}>Loading incident size data…</p>
  }

  if (state.status === 'error') {
    return <p className={styles.status}>Couldn't load incident size data: {state.message}</p>
  }

  function toggleBucket(name: string) {
    setHidden((prev) => toggleLegendItem(prev, name, bucketNames.length))
  }

  function applyBreakpoints(next: number[]) {
    setBreakpoints(next)
    setHidden(new Set())
  }

  const datasetsFor = (field: 'counts' | 'customers') =>
    bucketNames.map((name, i) => ({
      label: bucketLabels[i],
      data: rows.map((row) => ({ x: row.timestamp, y: row[field][name] })),
      borderColor: BUCKET_COLORS[i % BUCKET_COLORS.length],
      backgroundColor: BUCKET_COLORS[i % BUCKET_COLORS.length],
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
      <div className={styles.heading}>
        <h2>Incidents Grouped By Customers Affected</h2>
        <BreakpointsSettings breakpoints={breakpoints} onApply={applyBreakpoints} />
      </div>

      <p className={styles.legendTitle}>Customers affected per incident:</p>
      <ChartLegend
        items={bucketNames.map((name, i) => ({
          key: name,
          label: bucketLabels[i],
          color: BUCKET_COLORS[i % BUCKET_COLORS.length],
        }))}
        hidden={hidden}
        onToggle={toggleBucket}
      />

      <div className={styles.chartWrap}>
        <h3>Customers affected</h3>
        <InfoTooltip text="This chart updates roughly once a day (expected staleness less than 1 day)." />
        <Line data={{ datasets: datasetsFor('customers') }} options={commonOptions} />
      </div>

      <div className={styles.chartWrap}>
        <h3>Incident count</h3>
        <InfoTooltip text="This chart updates roughly once a day (expected staleness less than 1 day)." />
        <Line data={{ datasets: datasetsFor('counts') }} options={commonOptions} />
      </div>
    </div>
  )
}
