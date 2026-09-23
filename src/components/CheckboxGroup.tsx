import { useId } from 'react'
import type { Option } from '../data/types'
import { SelectableOption } from './SelectableOption'
import './Group.css'

interface CheckboxGroupProps {
  legend: string
  options: Option[]
  value: string[]
  onChange: (optionIds: string[]) => void
  /**
   * When set, options beyond the cap are disabled rather than silently
   * dropping the respondent's earliest choice. The cap is also stated in the
   * question's help text, so the disabling confirms a rule they already read.
   */
  maxSelections?: number
  describedBy?: string
}

export function CheckboxGroup({
  legend,
  options,
  value,
  onChange,
  maxSelections,
  describedBy,
}: CheckboxGroupProps) {
  const name = useId()
  const atCap = maxSelections !== undefined && value.length >= maxSelections

  function toggle(optionId: string) {
    onChange(
      value.includes(optionId)
        ? value.filter((id) => id !== optionId)
        : // Keep the questionnaire's option order rather than click order, so
          // the stored array is comparable across respondents.
          options.filter((o) => o.id === optionId || value.includes(o.id)).map((o) => o.id),
    )
  }

  return (
    <fieldset className="group" aria-describedby={describedBy}>
      <legend className="visually-hidden">{legend}</legend>
      <div className="group__items">
        {options.map((option) => {
          const checked = value.includes(option.id)
          return (
            <SelectableOption
              key={option.id}
              control="checkbox"
              name={`${name}-${option.id}`}
              value={option.id}
              label={option.text}
              icon={option.icon}
              checked={checked}
              disabled={atCap && !checked}
              onChange={toggle}
            />
          )
        })}
      </div>
    </fieldset>
  )
}
