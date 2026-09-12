import { HeartbeatChart } from './components/HeartbeatChart'
import { Footer } from './components/Footer'
import styles from './App.module.css'

function App() {
  return (
    <main className={styles.app}>
      <h1>AES Ohio Outage Tracker</h1>
      <HeartbeatChart />
      <Footer />
    </main>
  )
}

export default App
