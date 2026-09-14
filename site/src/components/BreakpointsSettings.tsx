import { useEffect, useRef, useState } from 'react'
import { parseBreakpoints } from '../lib/sizeBuckets'
import styles from './BreakpointsSettings.module.css'

interface BreakpointsSettingsProps {
  breakpoints: number[]
  onApply: (breakpoints: number[]) => void
}

// Gear outline as one connected polygon - teeth and hub are the same shape,
// generated from the same rotation formula, so there's no way for them to
// come apart the way separately-placed elements did.
function buildGearPath(teeth: number, outerR: number, innerR: number, halfToothDeg: number): string {
  const cx = 12
  const cy = 12
  const anglePerTooth = 360 / teeth
  const point = (angleDeg: number, r: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return `${(cx + r * Math.cos(rad)).toFixed(2)},${(cy + r * Math.sin(rad)).toFixed(2)}`
  }
  const points: string[] = []
  for (let i = 0; i < teeth; i++) {
    const base = i * anglePerTooth
    points.push(point(base - halfToothDeg, outerR))
    points.push(point(base + halfToothDeg, outerR))
    points.push(point(base + anglePerTooth / 2, innerR))
  }
  return `M ${points.join(' L ')} Z`
}

const GEAR_PATH = buildGearPath(8, 9.5, 6.3, 12)
const GEAR_HOLE_R = 3.1

// Digits, comma, whitespace, and "k" (for the not-yet-supported suffix's
// error hint) - anything else, notably "-", is stripped on input so a
// negative number can't be typed in the first place, rather than needing a
// dedicated error message to distinguish it from "not a whole number".
function sanitize(value: string): string {
  return value.replace(/[^0-9,\sk]/gi, '')
}

export function BreakpointsSettings({ breakpoints, onApply }: BreakpointsSettingsProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState(breakpoints.join(', '))
  const [preview, setPreview] = useState<{ text: string; isError: boolean } | null>(null)
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

  function openPopover() {
    setInput(breakpoints.join(', '))
    setPreview(null)
    setOpen(true)
  }

  function updatePreview(value: string) {
    const result = parseBreakpoints(value)
    setPreview(
      result.ok
        ? { text: `Normalized: ${result.breakpoints.join(', ')}`, isError: false }
        : { text: result.error, isError: true },
    )
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = sanitize(e.target.value)
    setInput(value)
    updatePreview(value)
  }

  function handleSave() {
    const result = parseBreakpoints(input)
    if (!result.ok) {
      setPreview({ text: result.error, isError: true })
      return
    }
    onApply(result.breakpoints)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSave()
  }

  return (
    <span className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.gear}
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPopover())}
      >
        {/* Hand-built, not a font glyph: one polygon (teeth + hub as a
            single connected shape) generated from GEAR_PATH's rotation
            formula, with a hole punched by an overlaid circle - centering
            and connectivity both fall out of the math, not eyeballing. */}
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d={GEAR_PATH} fill="currentColor" />
          <circle cx="12" cy="12" r={GEAR_HOLE_R} fill="var(--bg)" />
        </svg>
      </button>

      {open && (
        <div className={styles.popover}>
          <label className={styles.label} htmlFor="group-size-breakpoints">
            Group Size Breakpoints
          </label>
          <input
            id="group-size-breakpoints"
            type="text"
            className={styles.input}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          {/* Always rendered (with a placeholder when empty) so this line's
              height is reserved up front - otherwise it appearing on blur
              shifts the Save/Cancel row down mid-click, and a mousedown
              aimed at Save can land past the button by the time of mouseup. */}
          <p className={preview?.isError ? styles.error : styles.preview}>{preview?.text ?? ' '}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className={styles.save} onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      )}
    </span>
  )
}
