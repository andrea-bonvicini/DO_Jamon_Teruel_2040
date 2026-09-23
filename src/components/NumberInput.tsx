import { useId } from 'react'
import './Field.css'

interface NumberInputProps {
  label: string
  /** The raw string the respondent typed — never coerced while typing. */
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
  unit?: string
  hideLabel?: boolean
  describedBy?: string
}

/**
 * Keeps the raw string rather than a number so that a half-typed "2" in
 * "22,5" is not reformatted under the respondent's cursor. The caller parses
 * it with `parseDecimal` when it decides whether Next is enabled.
 */
export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  unit,
  hideLabel = false,
  describedBy,
}: NumberInputProps) {
  const id = useId()
  const unitId = `${id}-unit`

  return (
    <div className="field">
      <label className={hideLabel ? 'visually-hidden' : 'field__label'} htmlFor={id}>
        {label}
      </label>
      <div className="field__with-unit">
        <input
          id={id}
          className="field__control"
          // `inputMode` gives phones a numeric keypad with a comma key, which
          // `type="number"` does not on Spanish locales.
          type="text"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          autoComplete="off"
          aria-describedby={[describedBy, unit ? unitId : null].filter(Boolean).join(' ') || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {unit && (
          <span className="field__unit" id={unitId}>
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

/** Accepts both "22.5" and the Spanish "22,5". Returns null when unparseable. */
export function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.')
  if (trimmed === '') return null
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}
