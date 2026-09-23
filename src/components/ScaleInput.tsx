import { useId } from 'react'
import './ScaleInput.css'

interface ScaleInputProps {
  legend: string
  min: number
  max: number
  minLabel?: string
  maxLabel?: string
  value: number | null
  onChange: (value: number) => void
  describedBy?: string
}

/**
 * A row of numbered radio buttons. Handles both a 1–5 importance scale and a
 * 0–10 NPS scale; the latter wraps onto two rows on a narrow screen.
 */
export function ScaleInput({
  legend,
  min,
  max,
  minLabel,
  maxLabel,
  value,
  onChange,
  describedBy,
}: ScaleInputProps) {
  const name = useId()
  const points = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  return (
    <fieldset className="scale" aria-describedby={describedBy}>
      <legend className="visually-hidden">{legend}</legend>

      <div className="scale__points" data-count={points.length}>
        {points.map((point) => (
          <label className="scale__point" key={point} data-checked={value === point || undefined}>
            <input
              className="scale__input"
              type="radio"
              name={name}
              value={point}
              checked={value === point}
              onChange={() => onChange(point)}
            />
            <span className="scale__number">{point}</span>
          </label>
        ))}
      </div>

      {(minLabel || maxLabel) && (
        <div className="scale__labels">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </fieldset>
  )
}
