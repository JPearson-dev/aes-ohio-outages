import { useId } from 'react'
import styles from './InfoTooltip.module.css'

interface InfoTooltipProps {
  text: string
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  const id = useId()

  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.icon} aria-describedby={id}>
        i
      </button>
      <span className={styles.tooltip} role="tooltip" id={id}>
        {text}
      </span>
    </span>
  )
}
