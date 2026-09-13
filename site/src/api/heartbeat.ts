import { DATA_BASE_URL } from '../config'

export interface HeartbeatRow {
  timestamp: string
  totalCustomersAffected: number
  incidentCount: number
}

// heartbeat.csv is a fixed 3-column schema with no quoted/embedded commas
// (see docs/schema.md), so a manual split is enough — no CSV library needed.
export function parseHeartbeatCsv(csv: string): HeartbeatRow[] {
  const lines = csv.trim().split('\n')
  const [, ...rows] = lines

  return rows
    .filter((line) => line.length > 0)
    .map((line) => {
      const [timestamp, totalCustomersAffected, incidentCount] = line.split(',')
      return {
        timestamp,
        totalCustomersAffected: Number(totalCustomersAffected),
        incidentCount: Number(incidentCount),
      }
    })
}

// The official dashboard (and our own poller, see fetch-data.yml's commented
// cron '8,23,38,53 * * * *') updates on a 15-minute cycle, 8 minutes past
// each quarter hour. All of those minute marks are ≡ 8 (mod 15), so adding a
// buffer for the fetch job + jsDelivr purge to finish keeps that same
// 15-minute phase — no need to special-case the hour boundary.
const POLL_INTERVAL_MS = 15 * 60 * 1000
const POLL_BUFFER_MS = 1 * 60 * 1000 // targets ~9 min past the quarter hour

function pollWindowId(date: Date): number {
  return Math.floor((date.getTime() - POLL_BUFFER_MS) / POLL_INTERVAL_MS)
}

let cache: { windowId: number; rows: Promise<HeartbeatRow[]> } | null = null

// Caches the parsed result until we expect the next poll to have landed,
// rather than on every render/mount — otherwise the browser's HTTP cache (or
// jsDelivr's edge cache for the @data branch ref) can end up serving the same
// stale heartbeat.csv for far longer than the ~15 minutes it's actually good for.
export function fetchHeartbeat(): Promise<HeartbeatRow[]> {
  const windowId = pollWindowId(new Date())
  if (cache && cache.windowId === windowId) {
    return cache.rows
  }

  const rows = fetch(`${DATA_BASE_URL}/heartbeat.csv`, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch heartbeat.csv: ${response.status} ${response.statusText}`)
      }
      return response.text()
    })
    .then(parseHeartbeatCsv)

  cache = { windowId, rows }
  rows.catch(() => {
    // Don't leave a failed fetch marked "fresh" until the next poll window.
    if (cache?.rows === rows) cache = null
  })

  return rows
}
