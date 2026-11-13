import { formatMoment, type Moment } from '../lib/moments'
import styles from './MomentStepper.module.css'

interface MomentStepperProps {
  moments: Moment[]
  // Index into moments of the moment shown.
  selectedIndex: number
  onSelectIndex: (index: number) => void
}

// Previous / next / latest controls for the shared selected moment. Every
// view of "one moment" (the size distribution chart, the map) renders one,
// all driving the same App-level selection, so stepping in one moves both.
export function MomentStepper({ moments, selectedIndex, onSelectIndex }: MomentStepperProps) {
  const moment = moments[selectedIndex] as Moment | undefined
  if (!moment) return null
  const latestIndex = moments.length - 1

  return (
    <div className={styles.stepper}>
      <button
        type="button"
        aria-label="Previous moment"
        disabled={selectedIndex === 0}
        onClick={() => onSelectIndex(selectedIndex - 1)}
      >
        ◀
      </button>
      <span className={styles.momentLabel}>{formatMoment(moment)}</span>
      <button
        type="button"
        aria-label="Next moment"
        disabled={selectedIndex === latestIndex}
        onClick={() => onSelectIndex(selectedIndex + 1)}
      >
        ▶
      </button>
      <button type="button" disabled={selectedIndex === latestIndex} onClick={() => onSelectIndex(latestIndex)}>
        Latest
      </button>
    </div>
  )
}
