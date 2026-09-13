import initSqlJs, { type Database } from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { SITE_ROOT } from '../config'

// Each site build publishes history.db under its own immutable name plus a
// pointer naming the current one - see docs/site.md's "version-swap" section
// and publish_history_db.py. Any feature querying the db (the /datasette/
// page, this) resolves the pointer itself rather than assuming a fixed name,
// so an already-open tab keeps talking to the file it started with even
// after a later build replaces it.
interface HistoryDbPointer {
  file: string
}

let dbPromise: Promise<Database> | null = null

async function resolvePointer(): Promise<HistoryDbPointer> {
  const response = await fetch(`${SITE_ROOT}/history-latest.json`)
  if (!response.ok) {
    throw new Error(`Failed to fetch history-latest.json: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

// Loads the whole db into memory (via sql.js, not sql.js-httpvfs) rather
// than range-fetching pages of it. Queries here (bucketing by incident size)
// scan nearly all of item_version regardless, so partial-fetch wouldn't
// meaningfully reduce the bytes transferred - unlike a future point-in-time
// scrubber query, which is the case docs/site.md's httpvfs decision is
// actually aimed at.
export function loadHistoryDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const [SQL, pointer] = await Promise.all([
        initSqlJs({ locateFile: () => sqlWasmUrl }),
        resolvePointer(),
      ])
      const response = await fetch(`${SITE_ROOT}/${pointer.file}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch ${pointer.file}: ${response.status} ${response.statusText}`)
      }
      const bytes = new Uint8Array(await response.arrayBuffer())
      return new SQL.Database(bytes)
    })()
  }
  return dbPromise
}
