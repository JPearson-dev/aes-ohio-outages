import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type ChartType,
  type Plugin,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { Line } from 'react-chartjs-2'
import { fetchHeartbeat, type HeartbeatRow } from '../api/heartbeat'
import { ChartLegend, toggleLegendItem, type ChartLegendItem } from './ChartLegend'
import { InfoTooltip } from './InfoTooltip'
import styles from './HeartbeatChart.module.css'

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const SERIES: (ChartLegendItem & { yAxisID: string })[] = [
  { key: 'customers', label: 'Customers affected', color: '#E69F00', dash: 'solid', yAxisID: 'y' },
  { key: 'incidents', label: 'Incident count', color: '#0072B2', dash: 'dashed', yAxisID: 'y1' },
  { key: 'avg', label: 'Avg customers/incident', color: '#009E73', dash: 'dotted', yAxisID: 'y2' },
]

interface HeartbeatChartProps {
  // x value (see easternWallClockMs) to draw the selected-moment marker at.
  selectedMs?: number
  // Called with the clicked x value; omitted while there's nothing to select.
  onSelect?: (chartMs: number) => void
}

interface MomentMarkerOptions {
  at?: number
}

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    momentMarker?: MomentMarkerOptions
  }
}

// Draws a vertical line at options.plugins.momentMarker.at - the selected
// moment, on the same x scale as the heartbeat rows.
const momentMarker: Plugin<'line', MomentMarkerOptions> = {
  id: 'momentMarker',
  afterDatasetsDraw(chart, _args, options) {
    if (options.at === undefined) return
    const { ctx, chartArea, scales } = chart
    const x = scales.x.getPixelForValue(options.at)
    if (x < chartArea.left || x > chartArea.right) return
    ctx.save()
    ctx.strokeStyle = MARKER_COLOR
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.stroke()
    ctx.restore()
  },
}

const MARKER_COLOR = '#CC79A7'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: HeartbeatRow[] }

export function HeartbeatChart({ selectedMs, onSelect }: HeartbeatChartProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set(['avg']))

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

  function toggleSeries(key: string) {
    setHidden((prev) => toggleLegendItem(prev, key, SERIES.length))
  }

  return (
    <div className={styles.chartWrap}>
      <InfoTooltip text="Shows roughly up-to-date data (expected staleness less than 20 min)." />

      <ChartLegend items={SERIES} hidden={hidden} onToggle={toggleSeries} />

      <Line
        plugins={[momentMarker]}
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
              hidden: hidden.has('customers'),
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
              hidden: hidden.has('incidents'),
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
              hidden: hidden.has('avg'),
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          onClick: (event, _elements, chart) => {
            if (!onSelect || event.x === null) return
            const chartMs = chart.scales.x.getValueForPixel(event.x)
            if (chartMs !== undefined) onSelect(chartMs)
          },
          onHover: (_event, _elements, chart) => {
            chart.canvas.style.cursor = onSelect ? 'pointer' : ''
          },
          plugins: { legend: { display: false }, momentMarker: { at: selectedMs } },
          scales: {
            x: {
              type: 'time',
              time: { unit: 'day' },
            },
            y: {
              type: 'linear',
              position: 'left',
              beginAtZero: true,
              display: !hidden.has('customers'),
              title: { display: true, text: 'Customers affected', color: '#ce9c2d' },
              ticks: { color: '#ce9c2d' },
            },
            y1: {
              type: 'linear',
              position: 'right',
              beginAtZero: true,
              display: !hidden.has('incidents'),
              title: { display: true, text: 'Incident count', color: '#2d7daa' },
              ticks: { color: '#2d7daa' },
              grid: { drawOnChartArea: false },
            },
            y2: {
              type: 'linear',
              position: 'right',
              beginAtZero: true,
              display: !hidden.has('avg'),
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
