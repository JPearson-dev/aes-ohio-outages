import { useEffect, useMemo, useState } from 'react'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import type { Database } from 'sql.js'
import { Bar } from 'react-chartjs-2'
import { loadHistoryDb } from '../lib/historyDb'
import { linearBuckets, queryCurrentCustomersAffected, type SizeDistributionBucket } from '../lib/sizeDistribution'
import { InfoTooltip } from './InfoTooltip'
import styles from './IncidentSizeDistribution.module.css'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

function bucketLabel(bucket: SizeDistributionBucket): string {
  return bucket.start === bucket.end ? `${bucket.start}` : `${bucket.start}–${bucket.end}`
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; db: Database }

export function IncidentSizeDistribution() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

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
    () => (state.status === 'ready' ? linearBuckets(queryCurrentCustomersAffected(state.db)) : []),
    [state],
  )

  if (state.status === 'loading') {
    return <p className={styles.status}>Loading incident size data…</p>
  }

  if (state.status === 'error') {
    return <p className={styles.status}>Couldn't load incident size data: {state.message}</p>
  }

  return (
    <div className={styles.wrap}>
      <h2>Current Incident Size Distribution</h2>

      <div className={styles.chartWrap}>
        <InfoTooltip text="This chart updates roughly once a day (expected staleness less than 1 day)." />
        <Bar
          data={{
            labels: buckets.map(bucketLabel),
            datasets: [
              {
                label: 'Incidents',
                data: buckets.map((b) => b.count),
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
                    return `${bucketLabel(bucket)} ${noun} affected`
                  },
                  label: (item) => {
                    const count = item.parsed.y
                    return `${count} incident${count === 1 ? '' : 's'}`
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
                title: { display: true, text: 'Incident count' },
                // Incident counts are always whole numbers - without this,
                // Chart.js's "nice round number" tick algorithm can land on
                // fractional ticks (0.5, 1.5, ...) when the max count is low.
                ticks: { precision: 0 },
              },
            },
          }}
        />
      </div>
    </div>
  )
}
