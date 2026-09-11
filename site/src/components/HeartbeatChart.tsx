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
              borderColor: '#E69F00',
              backgroundColor: '#E69F00',
              yAxisID: 'y',
              pointRadius: 0,
              tension: 0.15,
            },
            {
              label: 'Incident count',
              data: rows.map((row) => ({ x: row.timestamp, y: row.incidentCount })),
              borderColor: '#0072B2',
              backgroundColor: '#0072B2',
              borderDash: [6, 3],
              yAxisID: 'y1',
              pointRadius: 0,
              tension: 0.15,
            },
            {
              label: 'Avg customers/incident',
              data: rows.map((row) => ({
                x: row.timestamp,
                y: row.incidentCount === 0 ? null : row.totalCustomersAffected / row.incidentCount,
              })),
              borderColor: '#009E73',
              backgroundColor: '#009E73',
              borderDash: [2, 2],
              yAxisID: 'y2',
              pointRadius: 0,
              tension: 0.15,
              hidden: true,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              onClick: (_event, legendItem, legend) => {
                const chart = legend.chart
                const index = legendItem.datasetIndex
                if (index === undefined) return

                const datasets = chart.data.datasets
                const applyScaleDisplay = (i: number, display: boolean) => {
                  const scaleId = datasets[i].yAxisID
                  const scale = scaleId && chart.options.scales?.[scaleId]
                  if (scale) scale.display = display
                }

                const hiding = chart.isDatasetVisible(index)
                const wouldHideAll =
                  hiding && !datasets.some((_, i) => i !== index && chart.isDatasetVisible(i))
                if (wouldHideAll) {
                  // Keep at least one series visible: fall back to the next dataset
                  // rather than leaving the chart with nothing plotted.
                  const neighbor = (index + 1) % datasets.length
                  chart.setDatasetVisibility(neighbor, true)
                  applyScaleDisplay(neighbor, true)
                }

                const visible = !hiding
                chart.setDatasetVisibility(index, visible)
                applyScaleDisplay(index, visible)

                // The tooltip (and the highlighted point on the line) can be left showing a
                // now-hidden series if the cursor moved from the chart straight to the legend
                // without leaving the canvas.
                chart.setActiveElements([])
                chart.tooltip?.setActiveElements([], { x: 0, y: 0 })
                chart.update()
              },
              labels: {
                usePointStyle: true,
                pointStyleWidth: 40,
                generateLabels: (chart) =>
                  chart.data.datasets.map((dataset, i) => ({
                    text: dataset.label ?? '',
                    strokeStyle: dataset.borderColor as string,
                    fillStyle: dataset.borderColor as string,
                    lineWidth: 2,
                    lineDash: (dataset as { borderDash?: number[] }).borderDash ?? [],
                    pointStyle: 'line',
                    hidden: !chart.isDatasetVisible(i),
                    datasetIndex: i,
                  })),
              },
            },
          },
          scales: {
            x: {
              type: 'time',
              time: { unit: 'day' },
            },
            y: {
              type: 'linear',
              position: 'left',
              beginAtZero: true,
              title: { display: true, text: 'Customers affected', color: '#ce9c2d' },
              ticks: { color: '#ce9c2d' },
            },
            y1: {
              type: 'linear',
              position: 'right',
              beginAtZero: true,
              title: { display: true, text: 'Incident count', color: '#2d7daa' },
              ticks: { color: '#2d7daa' },
              grid: { drawOnChartArea: false },
            },
            y2: {
              type: 'linear',
              position: 'right',
              beginAtZero: true,
              display: false,
              title: { display: true, text: 'Avg customers/incident', color: '#00785a' },
              ticks: { color: '#00785a' },
              grid: { drawOnChartArea: false },
            },
          },
        }}
      />
    </div>
  )
}
