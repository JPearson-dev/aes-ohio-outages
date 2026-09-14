import { useEffect, useRef, useState } from 'react'
import { parseBreakpoints } from '../lib/sizeBuckets'
import styles from './BreakpointsSettings.module.css'

interface BreakpointsSettingsProps {
  breakpoints: number[]
  onApply: (breakpoints: number[]) => void
}

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
