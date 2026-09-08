import { HeartbeatChart } from './components/HeartbeatChart'
import styles from './App.module.css'

function App() {
  return (
    <main className={styles.app}>
      <h1>AES Ohio Outage Tracker</h1>
      <HeartbeatChart />
    </main>
  )
}

export default App
