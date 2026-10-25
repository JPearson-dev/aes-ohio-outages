import type { Database } from 'sql.js'

export interface SizeDistributionBucket {
  start: number
  end: number
  count: number
  customersTotal: number
}

// Reads each incident's customers_affected value as it stood at a given
// moment - the commit whose commit_at is closest to targetTimestamp - among
// incidents active at that moment ("active" meaning _first_seen_commit and
// _last_seen_commit straddle that commit). "As it stood" means the
// item_version row with the greatest _commit not after that commit (its
// most recent recorded snapshot as of then, whether or not that commit
// itself introduced a new version row). This is the moment-in-time
// distribution chart from the README notes; a future scrubber would drive
// targetTimestamp from a UI control instead of a fixed value.
export function queryCustomersAffectedAsOf(db: Database, targetTimestamp: string): number[] {
  const result = db.exec(`
    WITH target_commit AS (
      SELECT id
      FROM commits
      ORDER BY ABS(strftime('%s', commit_at) - strftime('%s', '${targetTimestamp}'))
      LIMIT 1
    ),
    latest_version AS (
      SELECT
        _item,
        customers_affected,
        ROW_NUMBER() OVER (PARTITION BY _item ORDER BY _commit DESC) AS rn
      FROM item_version
      WHERE _commit <= (SELECT id FROM target_commit)
    )
    SELECT lv.customers_affected
    FROM latest_version lv
    JOIN item i ON i._id = lv._item
    WHERE lv.rn = 1
      AND i._first_seen_commit <= (SELECT id FROM target_commit)
      AND i._last_seen_commit >= (SELECT id FROM target_commit)
  `)[0]

  return (result?.values ?? []).map(([customers]) => customers as number)
}

// Splits [min(values), max(values)] into equal-width integer ranges and
// counts how many values fall in each - the linear-width counterpart to
// logBuckets.
//
// Bucket width is rounded up to a whole number (values are integers, so a
// fractional width would just be a linear width that under-covers the
// range), and the bucket count is capped at both maxBuckets and the number
// of distinct integers in range - a range of 3 values should make 3
// buckets, not maxBuckets worth of mostly-empty ones.
export function linearBuckets(values: number[], maxBuckets = 50): SizeDistributionBucket[] {
  if (values.length === 0) return []

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min + 1
  const bucketCount = Math.min(maxBuckets, range)
  const width = Math.ceil(range / bucketCount)

  const buckets: SizeDistributionBucket[] = []
  for (let start = min; start <= max; start += width) {
    buckets.push({ start, end: Math.min(start + width - 1, max), count: 0, customersTotal: 0 })
  }

  for (const value of values) {
    const index = Math.min(buckets.length - 1, Math.floor((value - min) / width))
    buckets[index].count++
    buckets[index].customersTotal += value
  }

  return buckets
}

// Splits [min(values), max(values)] into geometrically growing integer
// ranges - narrow at the small end, where most incidents are, and wide at
// the large end - so a log-scale x axis still shows equal-width bars.
//
// Geometric edges are rounded up to integers, so near the small end several
// edges can round to the same integer and leave a bucket with no integers
// in it. Those are dropped, and the bucket count k is raised until just
// before the surviving buckets would exceed maxBuckets, so the chart keeps
// close to maxBuckets bars instead of losing the dropped ones. A range with
// no more than maxBuckets integers has nothing to compress, so it falls
// back to linearBuckets' one-bucket-per-integer.
export function logBuckets(values: number[], maxBuckets = 50): SizeDistributionBucket[] {
  if (values.length === 0) return []

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min + 1
  // A geometric series can't start from 0 or below. customers_affected is
  // always at least 1 in practice, so this is only a guard.
  if (min < 1 || range <= maxBuckets) return linearBuckets(values, maxBuckets)

  let ranges = geometricRanges(min, max, maxBuckets)
  for (let k = maxBuckets + 1; k <= range; k++) {
    const next = geometricRanges(min, max, k)
    if (next.length > maxBuckets) break
    ranges = next
  }

  const buckets = ranges.map((r) => ({ ...r, count: 0, customersTotal: 0 }))
  for (const value of values) {
    const bucket = buckets[findBucketIndex(buckets, value)]
    bucket.count++
    bucket.customersTotal += value
  }
  return buckets
}

// The k geometric ranges covering [min, max], minus any that contain no
// integers. Edge j is min * ((max + 1) / min)^(j / k), so edge 0 is min and
// edge k is max + 1, and range j holds the integers in [edge j, edge j+1).
function geometricRanges(min: number, max: number, k: number): { start: number; end: number }[] {
  const ratio = (max + 1) / min
  const ranges: { start: number; end: number }[] = []
  let start = min
  for (let j = 1; j <= k; j++) {
    // The epsilon keeps floating-point error (an edge meant to be exactly 10
    // computing as 10.000000000002) from pushing ceil up a whole integer.
    const end = j === k ? max : Math.ceil(min * ratio ** (j / k) - 1e-9) - 1
    if (end >= start) {
      ranges.push({ start, end })
      start = end + 1
    }
  }
  return ranges
}

// Binary search for the last bucket starting at or below value. Buckets are
// contiguous and sorted, so that's the one containing it.
function findBucketIndex(buckets: SizeDistributionBucket[], value: number): number {
  let lo = 0
  let hi = buckets.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (buckets[mid].start <= value) lo = mid
    else hi = mid - 1
  }
  return lo
}

export interface CumulativePoint {
  value: number
  // Incidents with customers_affected <= value, and those incidents'
  // customers_affected summed.
  count: number
  customersTotal: number
}

// The exact cumulative distribution: one point per distinct value, instead
// of per bucket. A cumulative chart doesn't need bucketing to be readable,
// and skipping it means the line is exact at every step.
export function cumulativePoints(values: number[]): CumulativePoint[] {
  const points: CumulativePoint[] = []
  let count = 0
  let customersTotal = 0
  for (const value of values.toSorted((a, b) => a - b)) {
    count++
    customersTotal += value
    const last = points.at(-1)
    if (last?.value === value) {
      last.count = count
      last.customersTotal = customersTotal
    } else {
      points.push({ value, count, customersTotal })
    }
  }
  return points
}
