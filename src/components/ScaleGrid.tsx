import { useId } from 'react'
import type { CSSProperties } from 'react'
import type { ScaleRow } from '../data/types'
import './ScaleGrid.css'

interface ScaleGridProps {
  legend: string
  rows: ScaleRow[]
  min: number
  max: number
  minLabel?: string
  maxLabel?: string
  value: Record<string, number>
  onChange: (rowId: string, rating: number) => void
  describedBy?: string
}

/**
 * Several rows sharing one rating range — see DECISIONS.md.
 *
 * Every row is its own radio group with a real, visible label. The numeric
 * column headers are decorative on wide screens (each input carries its own
 * accessible name), and the layout collapses to one labelled row of buttons
 * per item below 40rem.
 */
export function ScaleGrid({
  legend,
  rows,
  min,
  max,
  minLabel,
  maxLabel,
  value,
  onChange,
  describedBy,
}: ScaleGridProps) {
  const name = useId()
  const points = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  return (
    <fieldset className="grid-scale" aria-describedby={describedBy}>
      <legend className="visually-hidden">{legend}</legend>

      {(minLabel || maxLabel) && (
        <p className="grid-scale__key">
          {minLabel && (
            <span>
              {min} = {minLabel}
            </span>
          )}
          {maxLabel && (
            <span>
              {max} = {maxLabel}
            </span>
          )}
        </p>
      )}

      <div className="grid-scale__head" aria-hidden="true">
        <span />
        <div className="grid-scale__points" style={{ '--points': points.length } as CSSProperties}>
          {points.map((point) => (
            <span className="grid-scale__head-number" key={point}>
              {point}
            </span>
          ))}
        </div>
      </div>

      <ul className="grid-scale__rows">
        {rows.map((row) => (
          <li className="grid-scale__row" key={row.id} data-answered={row.id in value || undefined}>
            <span className="grid-scale__row-label" id={`${name}-${row.id}-label`}>
              {row.text}
            </span>
            <div
              className="grid-scale__points"
              role="radiogroup"
              aria-labelledby={`${name}-${row.id}-label`}
              style={{ '--points': points.length } as CSSProperties}
            >
              {points.map((point) => (
                <label
                  className="grid-scale__point"
                  key={point}
                  data-checked={value[row.id] === point || undefined}
                >
                  <input
                    className="grid-scale__input"
                    type="radio"
                    name={`${name}-${row.id}`}
                    value={point}
                    checked={value[row.id] === point}
                    onChange={() => onChange(row.id, point)}
                  />
                  <span className="grid-scale__number">{point}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
