import { useMemo, useState } from 'react'
import { HeartbeatChart } from './components/HeartbeatChart'
import { SizeBucketCharts } from './components/SizeBucketCharts'
import { IncidentSizeDistribution } from './components/IncidentSizeDistribution'
import { Footer } from './components/Footer'
import { nearestMomentIndex, queryMoments } from './lib/moments'
import { useHistoryDb } from './lib/useHistoryDb'
import styles from './App.module.css'

// A moment worth checking the distribution chart against: 2026-09-16 8:05 PM
// EDT (2026-09-17T00:05:00Z), during a large outage, with a wide spread of
// incident sizes. Clicking near it on the heartbeat chart selects it.

function App() {
  const dbState = useHistoryDb()
  const moments = useMemo(() => (dbState.status === 'ready' ? queryMoments(dbState.db) : []), [dbState])
  // null until the viewer picks one, meaning "the latest moment".
  const [selected, setSelected] = useState<number | null>(null)
  const selectedIndex = selected ?? moments.length - 1

  return (
    <main className={styles.app}>
      <div className={styles.header}>
        <img src="favicon.svg" alt="" className={styles.logo} />
        <h1>AES Ohio Outage Tracker</h1>
      </div>
      <HeartbeatChart
        selectedMs={moments[selectedIndex]?.chartMs}
        onSelect={moments.length > 0 ? (chartMs) => setSelected(nearestMomentIndex(moments, chartMs)) : undefined}
      />
      <SizeBucketCharts />
      <IncidentSizeDistribution
        dbState={dbState}
        moments={moments}
        selectedIndex={selectedIndex}
        onSelectIndex={setSelected}
      />
      <Footer />
    </main>
  )
}

export default App
