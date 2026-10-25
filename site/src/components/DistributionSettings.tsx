import { useEffect, useRef, useState } from 'react'
import styles from './DistributionSettings.module.css'

export type DistributionMetric = 'incidents' | 'customers'
export type DistributionAggregation = 'bucketed' | 'cumulative'
export type DistributionXScale = 'linear' | 'log'

export interface DistributionOptions {
  metric: DistributionMetric
  aggregation: DistributionAggregation
  xScale: DistributionXScale
}

interface DistributionSettingsProps {
  options: DistributionOptions
  onChange: (options: DistributionOptions) => void
}

interface RadioGroupProps<T extends string> {
  label: string
  name: string
  value: T
  choices: { value: T; label: string }[]
  onChange: (value: T) => void
}

function RadioGroup<T extends string>({ label, name, value, choices, onChange }: RadioGroupProps<T>) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.label}>{label}</legend>
      {choices.map((choice) => (
        <label key={choice.value} className={styles.option}>
          <input
            type="radio"
            name={name}
            checked={value === choice.value}
            onChange={() => onChange(choice.value)}
          />
          {choice.label}
        </label>
      ))}
    </fieldset>
  )
}

// Either/or choices need no preview/validation/Save-Cancel step like
// BreakpointsSettings' free-text input does - picking an option applies it
// immediately, and the popover just stays open until an outside click.
export function DistributionSettings({ options, onChange }: DistributionSettingsProps) {
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
          <RadioGroup
            label="Aggregation"
            name="distribution-aggregation"
            value={options.aggregation}
            choices={[
              { value: 'bucketed', label: 'Per bucket' },
              { value: 'cumulative', label: 'Cumulative' },
            ]}
            onChange={(aggregation) => onChange({ ...options, aggregation })}
          />
          <RadioGroup
            label="X-Axis Scale"
            name="distribution-x-scale"
            value={options.xScale}
            choices={[
              { value: 'linear', label: 'Linear' },
              { value: 'log', label: 'Log' },
            ]}
            onChange={(xScale) => onChange({ ...options, xScale })}
          />
          <RadioGroup
            label="Measured Value"
            name="distribution-y-metric"
            value={options.metric}
            choices={[
              { value: 'incidents', label: 'Incident count' },
              { value: 'customers', label: 'Total customers affected' },
            ]}
            onChange={(metric) => onChange({ ...options, metric })}
          />
        </div>
      )}
    </span>
  )
}
