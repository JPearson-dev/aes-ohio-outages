import { HeartbeatChart } from './components/HeartbeatChart'
import { Footer } from './components/Footer'
import styles from './App.module.css'

function App() {
  return (
    <main className={styles.app}>
      <div className={styles.header}>
        <img src="favicon.svg" alt="" className={styles.logo} />
        <h1>AES Ohio Outage Tracker</h1>
      </div>
      <HeartbeatChart />
      <Footer />
    </main>
  )
}

export default App
