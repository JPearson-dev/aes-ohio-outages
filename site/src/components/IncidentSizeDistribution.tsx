import { useEffect, useMemo, useState } from 'react'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import type { Database } from 'sql.js'
import { Bar } from 'react-chartjs-2'
import { loadHistoryDb } from '../lib/historyDb'
import { linearBuckets, queryCustomersAffectedAsOf, type SizeDistributionBucket } from '../lib/sizeDistribution'
import { InfoTooltip } from './InfoTooltip'
import { DistributionSettings, type DistributionMetric } from './DistributionSettings'
import styles from './IncidentSizeDistribution.module.css'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

// Temporary: pin the chart to a fixed moment instead of always-latest data,
// until the moment-in-time scrubber described in the README exists. This is
// 2026-09-16 8:05 PM America/New_York (EDT, UTC-4, so 00:05 the next day in
// UTC) - commit_at is stored as UTC, so the offset is applied here rather
// than left implicit.
const PINNED_MOMENT = '2026-09-17T00:05:00Z'

function bucketLabel(bucket: SizeDistributionBucket): string {
  return bucket.start === bucket.end ? `${bucket.start}` : `${bucket.start}–${bucket.end}`
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; db: Database }

export function IncidentSizeDistribution() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [metric, setMetric] = useState<DistributionMetric>('incidents')

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

  const buckets = useMemo(
    () => (state.status === 'ready' ? linearBuckets(queryCustomersAffectedAsOf(state.db, PINNED_MOMENT)) : []),
    [state],
  )

  if (state.status === 'loading') {
    return <p className={styles.status}>Loading incident size data…</p>
  }

  if (state.status === 'error') {
    return <p className={styles.status}>Couldn't load incident size data: {state.message}</p>
  }

  const values = buckets.map((b) => (metric === 'incidents' ? b.count : b.customersTotal))

  return (
    <div className={styles.wrap}>
      <div className={styles.heading}>
        <h2>Incident Size Distribution</h2>
        <DistributionSettings metric={metric} onChange={setMetric} />
      </div>

      <div className={styles.chartWrap}>
        <InfoTooltip text="This chart is temporarily pinned to a single moment (Sep 16, 2026, 8:05 PM Eastern) while the moment-in-time scrubber is built." />
        <Bar
          data={{
            labels: buckets.map(bucketLabel),
            datasets: [
              {
                label: metric === 'incidents' ? 'Incidents' : 'Customers affected',
                data: values,
                backgroundColor: '#0072B2',
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
                  // count of something called "50", not a customer-count
                  // bucket - spell out what the number and count mean.
                  title: (items) => {
                    const bucket = buckets[items[0].dataIndex]
                    const noun = bucket.start === bucket.end && bucket.start === 1 ? 'customer' : 'customers'
                    return `${bucketLabel(bucket)} ${noun} affected per incident`
                  },
                  label: (item) => {
                    const value = item.parsed.y
                    return metric === 'incidents'
                      ? `${value} incident${value === 1 ? '' : 's'}`
                      : `${value} total customer${value === 1 ? '' : 's'} affected`
                  },
                },
              },
            },
            scales: {
              x: {
                title: { display: true, text: 'Customers affected per incident' },
                // Chart.js's default rotates labels up to 50deg to cram all
                // of them in - forcing 0 instead makes it fall back to
                // skipping labels (autoSkip, on by default) once they no
                // longer fit horizontally, rather than ever slanting them.
                ticks: { maxRotation: 0, minRotation: 0 },
              },
              y: {
                type: 'linear',
                beginAtZero: true,
                title: { display: true, text: metric === 'incidents' ? 'Incident count' : 'Total customers affected' },
                // Both metrics are always whole numbers - without this,
                // Chart.js's "nice round number" tick algorithm can land on
                // fractional ticks (0.5, 1.5, ...) when the max value is low.
                ticks: { precision: 0 },
              },
            },
          }}
        />
      </div>
    </div>
  )
}
