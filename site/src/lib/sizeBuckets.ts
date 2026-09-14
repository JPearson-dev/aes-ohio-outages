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

export type ParseBreakpointsResult = { ok: true; breakpoints: number[] } | { ok: false; error: string }

// Parses the settings field's comma-delimited text into breakpoints, or an
// error describing the first problem found. Whole numbers only for now - a
// "10k" style suffix could be a future enhancement, so that specific case
// gets its own hint rather than the generic "not a whole number" message.
export function parseBreakpoints(raw: string): ParseBreakpointsResult {
  // Comma and whitespace are interchangeable delimiters, and runs of either
  // collapse to one break - so "10, 50 200" and "10,,50,200" both parse the
  // same as "10,50,200" rather than producing a stray empty token.
  const tokens = raw.split(/[\s,]+/).filter((token) => token.length > 0)

  if (tokens.length === 0) {
    return { ok: false, error: 'Enter at least one number.' }
  }

  const numbers: number[] = []
  for (const token of tokens) {
    if (!/^\d+$/.test(token)) {
      if (/^\d+k$/i.test(token)) {
        return {
          ok: false,
          error: `"${token}" isn't supported yet - write out the full number instead of using a "k" suffix.`,
        }
      }
      return { ok: false, error: `"${token}" isn't a whole number.` }
    }
    numbers.push(Number(token))
  }

  const sorted = [...numbers].sort((a, b) => a - b)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) {
      return { ok: false, error: `"${sorted[i]}" is listed more than once.` }
    }
  }
  if (sorted[0] <= 0) {
    return { ok: false, error: 'Numbers must be greater than zero.' }
  }

  return { ok: true, breakpoints: sorted }
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
