import { useId } from 'react'
import type { Option } from '../data/types'
import { STRINGS } from '../data/strings'
import './Field.css'

interface SelectProps {
  label: string
  options: Option[]
  value: string | null
  onChange: (optionId: string) => void
  hideLabel?: boolean
  describedBy?: string
}

export function Select({
  label,
  options,
  value,
  onChange,
  hideLabel = false,
  describedBy,
}: SelectProps) {
  const id = useId()

  return (
    <div className="field">
      <label className={hideLabel ? 'visually-hidden' : 'field__label'} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="field__control field__control--select"
        value={value ?? ''}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          {STRINGS.question.selectPlaceholder}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.text}
          </option>
        ))}
      </select>
    </div>
  )
}
