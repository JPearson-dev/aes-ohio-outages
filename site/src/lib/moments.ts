import type { Database } from 'sql.js'

// A moment the history db can show: one commit to the data branch. Only
// commits that changed current/incidents.json are in the db, so these are
// roughly every 15 minutes during outages and sparser when nothing changes.
export interface Moment {
  commitId: number
  at: Date
  // `at` as heartbeat-chart x value - see easternWallClockMs.
  chartMs: number
}

export function queryMoments(db: Database): Moment[] {
  const result = db.exec('SELECT id, commit_at FROM commits ORDER BY id')[0]
  return (result?.values ?? []).map(([id, commitAt]) => {
    const at = new Date(commitAt as string)
    return { commitId: id as number, at, chartMs: easternWallClockMs(at) }
  })
}

const EASTERN_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
})

// heartbeat.csv timestamps are the feed's own naive Eastern wall-clock times
// (no offset), which Chart.js parses as the viewer's local time. To place a
// real instant on that same axis, take its Eastern wall-clock reading and
// parse that as local time too - so a commit at 20:08 UTC lands at "16:08"
// on the chart, next to the 16:05 heartbeat row it belongs with, whatever
// the viewer's own timezone.
export function easternWallClockMs(instant: Date): number {
  const parts = Object.fromEntries(EASTERN_PARTS.formatToParts(instant).map((p) => [p.type, Number(p.value)]))
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second).getTime()
}

// Index of the moment whose chartMs is closest to chartMs. Moments are in
// commit order, which is chronological, so this is a binary search for the
// first one at or after chartMs, then a check of its neighbor before it.
export function nearestMomentIndex(moments: Moment[], chartMs: number): number {
  let lo = 0
  let hi = moments.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (moments[mid].chartMs < chartMs) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && chartMs - moments[lo - 1].chartMs <= moments[lo].chartMs - chartMs) return lo - 1
  return lo
}

const EASTERN_DISPLAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
})

// e.g. "Sep 20, 2026, 4:08 PM EDT" - always Eastern, matching the heartbeat
// chart's axis, rather than the viewer's local time.
export function formatMoment(moment: Moment): string {
  return EASTERN_DISPLAY.format(moment.at)
}
