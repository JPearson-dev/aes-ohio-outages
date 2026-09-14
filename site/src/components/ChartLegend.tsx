import styles from './ChartLegend.module.css'

export interface ChartLegendItem {
  key: string
  label: string
  color: string
  dash?: 'solid' | 'dashed' | 'dotted'
}

interface ChartLegendProps {
  items: ChartLegendItem[]
  hidden: ReadonlySet<string>
  onToggle: (key: string) => void
}

export function ChartLegend({ items, hidden, onToggle }: ChartLegendProps) {
  const isLastVisible = (key: string) => !hidden.has(key) && hidden.size === items.length - 1

  return (
    <ul className={styles.legend}>
      {items.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            className={styles.legendItem}
            data-hidden={hidden.has(item.key)}
            data-locked={isLastVisible(item.key)}
            onClick={() => onToggle(item.key)}
          >
            <span
              className={styles.swatch}
              data-dash={item.dash ?? 'solid'}
              style={{ borderColor: item.color }}
            />
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  )
}

// Toggles `key` in `hidden`, refusing to hide the last visible item out of
// `totalCount` so a chart can never end up with nothing plotted.
export function toggleLegendItem(
  hidden: ReadonlySet<string>,
  key: string,
  totalCount: number,
): ReadonlySet<string> {
  const wouldHideAll = !hidden.has(key) && hidden.size === totalCount - 1
  if (wouldHideAll) return hidden

  const next = new Set(hidden)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  return next
}
