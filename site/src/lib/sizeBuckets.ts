import type { Database } from 'sql.js'

// Default breakpoints (upper bound of each bucket, last one open-ended).
// Adjustable via a future settings modal - the query below is parameterized
// by this array precisely so that adjustment is "run the query again," not
// a rebuild or a bespoke recomputation path.
export const DEFAULT_BREAKPOINTS = [10, 50, 200]

export interface SizeBucketRow {
  timestamp: string
  counts: Record<string, number>
  customers: Record<string, number>
}

export function bucketNamesFor(breakpoints: number[]): string[] {
  return [...breakpoints.map((bp) => `le${bp}`), `gt${breakpoints[breakpoints.length - 1]}`]
}

// "As of commit C, what is item X's customers_affected?" and "was item X
// active at commit C?" are both questions the enriched db (see
// build_history_db.py's --full-versions + _first_seen_commit/
// _last_seen_commit) can answer directly in SQL - no separate JS-side
// traversal reimplementing what the query already expresses:
//
//   - `versions`: each item_version's value is valid from its own commit up
//     to (but not including) the next version's commit, or through the
//     item's _last_seen_commit if it's the item's final recorded version.
//   - joining `commits` against that range (a non-equi BETWEEN join) expands
//     each version into one row per commit it was the current value for -
//     i.e. exactly the set of (commit, item, value-as-of-that-commit)
//     triples, computed by the database rather than walked by hand.
function buildQuery(breakpoints: number[]): string {
  const bucketCases = breakpoints.map((bp) => `WHEN v.customers_affected <= ${bp} THEN 'le${bp}'`).join('\n        ')
  const lastBucket = `gt${breakpoints[breakpoints.length - 1]}`

  return `
    WITH versions AS (
      SELECT
        _item,
        _commit AS valid_from,
        COALESCE(
          LEAD(_commit) OVER (PARTITION BY _item ORDER BY _commit) - 1,
          (SELECT _last_seen_commit FROM item WHERE item._id = item_version._item)
        ) AS valid_to,
        customers_affected
      FROM item_version
    )
    SELECT
      c.id AS commit_id,
      c.commit_at,
      CASE
        ${bucketCases}
        ELSE '${lastBucket}'
      END AS bucket,
      COUNT(*) AS count,
      SUM(v.customers_affected) AS customers
    FROM commits c
    JOIN versions v ON c.id BETWEEN v.valid_from AND v.valid_to
    GROUP BY c.id, bucket
    ORDER BY c.id
  `
}

export function querySizeBuckets(db: Database, breakpoints: number[] = DEFAULT_BREAKPOINTS): SizeBucketRow[] {
  if (!breakpoints.every((bp, i) => Number.isInteger(bp) && bp > 0 && (i === 0 || bp > breakpoints[i - 1]))) {
    throw new Error('breakpoints must be positive integers in ascending order')
  }

  const bucketNames = bucketNamesFor(breakpoints)
  const zeroed = () => Object.fromEntries(bucketNames.map((name) => [name, 0]))

  const byCommit = new Map<number, SizeBucketRow>()
  for (const [id, commit_at] of db.exec('SELECT id, commit_at FROM commits ORDER BY id')[0]?.values ?? []) {
    byCommit.set(id as number, { timestamp: commit_at as string, counts: zeroed(), customers: zeroed() })
  }

  const result = db.exec(buildQuery(breakpoints))[0]
  for (const [commitId, , bucket, count, customers] of result?.values ?? []) {
    const row = byCommit.get(commitId as number)
    if (!row) continue
    row.counts[bucket as string] = count as number
    row.customers[bucket as string] = customers as number
  }

  return [...byCommit.values()]
}
