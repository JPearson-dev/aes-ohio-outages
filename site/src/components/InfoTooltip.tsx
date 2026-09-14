import { useId } from 'react'
import styles from './InfoTooltip.module.css'

interface InfoTooltipProps {
  text: string
}

// Slight italic slant on the stem/serifs, computed rather than eyeballed:
// skewX(-a) maps (x,y) -> (x - y*tan(a), y), so at the glyph's vertical
// center (y=12) it drifts left by 12*tan(a) - SKEW_SHIFT translates back by
// exactly that so the skewed glyph's centroid still lands on x=12.
const SKEW_DEG = 10
const SKEW_SHIFT = 12 * Math.tan((SKEW_DEG * Math.PI) / 180)

export function InfoTooltip({ text }: InfoTooltipProps) {
  const id = useId()

  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.icon} aria-describedby={id}>
        {/* Hand-built, not a font glyph: dot, stem, and serif feet are
            placed by coordinates chosen so their combined extent is
            centered on the 24x24 viewBox, with a computed (not eyeballed)
            italic skew - see SKEW_DEG/SKEW_SHIFT above. */}
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <circle cx="12" cy="6.8" r="1.7" fill="currentColor" />
          <g transform={`translate(${SKEW_SHIFT.toFixed(3)} 0) skewX(-${SKEW_DEG})`}>
            <rect x="9.9" y="9.6" width="4.2" height="1.1" rx="0.4" fill="currentColor" />
            <rect x="10.8" y="10.4" width="2.4" height="7.4" fill="currentColor" />
            <rect x="9.6" y="17.8" width="4.8" height="1.4" rx="0.5" fill="currentColor" />
          </g>
        </svg>
      </button>
      <span className={styles.tooltip} role="tooltip" id={id}>
        {text}
      </span>
    </span>
  )
}
