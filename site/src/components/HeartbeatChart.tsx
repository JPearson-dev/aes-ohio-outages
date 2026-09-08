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
import { fetchHeartbeat, type HeartbeatRow } from '../api/heartbeat'
import styles from './HeartbeatChart.module.css'

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: HeartbeatRow[] }

export function HeartbeatChart() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    fetchHeartbeat()
      .then((rows) => {
        if (!cancelled) setState({ status: 'ready', rows })
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
    return <p className={styles.status}>Loading heartbeat data…</p>
  }

  if (state.status === 'error') {
    return <p className={styles.status}>Couldn't load heartbeat data: {state.message}</p>
  }

  const { rows } = state

  return (
    <div className={styles.chartWrap}>
      <Line
        data={{
          datasets: [
            {
              label: 'Customers affected',
              data: rows.map((row) => ({ x: row.timestamp, y: row.totalCustomersAffected })),
              borderColor: '#e0722f',
              backgroundColor: '#e0722f',
              yAxisID: 'y',
              pointRadius: 0,
              tension: 0.15,
            },
            {
              label: 'Incident count',
              data: rows.map((row) => ({ x: row.timestamp, y: row.incidentCount })),
              borderColor: '#3b7ea1',
              backgroundColor: '#3b7ea1',
              yAxisID: 'y1',
              pointRadius: 0,
              tension: 0.15,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              type: 'time',
              time: { unit: 'day' },
              title: { display: true, text: 'Time' },
            },
            y: {
              type: 'linear',
              position: 'left',
              beginAtZero: true,
              title: { display: true, text: 'Customers affected' },
            },
            y1: {
              type: 'linear',
              position: 'right',
              beginAtZero: true,
              title: { display: true, text: 'Incident count' },
              grid: { drawOnChartArea: false },
            },
          },
        }}
      />
    </div>
  )
}
