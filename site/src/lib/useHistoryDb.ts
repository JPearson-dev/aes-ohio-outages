import { useEffect, useState } from 'react'
import type { Database } from 'sql.js'
import { loadHistoryDb } from './historyDb'

export type HistoryDbState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; db: Database }

export function useHistoryDb(): HistoryDbState {
  const [state, setState] = useState<HistoryDbState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    loadHistoryDb()
      .then((db) => {
        if (!cancelled) setState({ status: 'ready', db })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
