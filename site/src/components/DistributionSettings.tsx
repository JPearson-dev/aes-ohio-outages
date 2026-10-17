import { useEffect, useRef, useState } from 'react'
import styles from './DistributionSettings.module.css'

export type DistributionMetric = 'incidents' | 'customers'

interface DistributionSettingsProps {
  metric: DistributionMetric
  onChange: (metric: DistributionMetric) => void
}

// A single either/or choice needs no preview/validation/Save-Cancel step
// like BreakpointsSettings' free-text input does - picking an option applies
// it immediately, and the popover just stays open until an outside click.
export function DistributionSettings({ metric, onChange }: DistributionSettingsProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return

    function handleOutsideClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  return (
    <span className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.gear}
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {/* Bootstrap Icons gear-fill, v1.13.1; license in THIRD-PARTY-NOTICES.txt. */}
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z" />
        </svg>
      </button>

      {open && (
        <div className={styles.popover}>
          <p className={styles.label}>Y Axis</p>
          <label className={styles.option}>
            <input
              type="radio"
              name="distribution-y-metric"
              checked={metric === 'incidents'}
              onChange={() => onChange('incidents')}
            />
            Incident count
          </label>
          <label className={styles.option}>
            <input
              type="radio"
              name="distribution-y-metric"
              checked={metric === 'customers'}
              onChange={() => onChange('customers')}
            />
            Total customers affected
          </label>
        </div>
      )}
    </span>
  )
}
