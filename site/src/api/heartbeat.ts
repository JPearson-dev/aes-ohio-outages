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

export async function fetchHeartbeat(): Promise<HeartbeatRow[]> {
  const response = await fetch(`${DATA_BASE_URL}/heartbeat.csv`)
  if (!response.ok) {
    throw new Error(`Failed to fetch heartbeat.csv: ${response.status} ${response.statusText}`)
  }
  return parseHeartbeatCsv(await response.text())
}
