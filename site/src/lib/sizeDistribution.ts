import type { Database } from 'sql.js'

export interface SizeDistributionBucket {
  start: number
  end: number
  count: number
}

// Reads each currently-active incident's most recent customers_affected
// value - "currently active" meaning its _last_seen_commit matches the db's
// latest commit, "most recent" meaning the item_version row with the
// greatest _commit for that item (its latest recorded snapshot, whether or
// not that commit itself introduced a new version row). This is the
// "initially, just use the latest time" slice of the moment-in-time
// distribution chart - a future scrubber would parameterize the commit
// instead of always using MAX(id).
export function queryCurrentCustomersAffected(db: Database): number[] {
  const result = db.exec(`
    WITH latest_version AS (
      SELECT
        _item,
        customers_affected,
        ROW_NUMBER() OVER (PARTITION BY _item ORDER BY _commit DESC) AS rn
      FROM item_version
    )
    SELECT lv.customers_affected
    FROM latest_version lv
    JOIN item i ON i._id = lv._item
    WHERE lv.rn = 1
      AND i._last_seen_commit = (SELECT MAX(id) FROM commits)
  `)[0]

  return (result?.values ?? []).map(([customers]) => customers as number)
}

// Splits [min(values), max(values)] into equal-width integer ranges and
// counts how many values fall in each - the "initial, linear-width" version
// of the distribution chart from the README notes; log-width buckets are a
// later, separate step.
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
    buckets.push({ start, end: Math.min(start + width - 1, max), count: 0 })
  }

  for (const value of values) {
    const index = Math.min(buckets.length - 1, Math.floor((value - min) / width))
    buckets[index].count++
  }

  return buckets
}
