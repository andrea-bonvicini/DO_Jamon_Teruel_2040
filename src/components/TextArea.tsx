import { useId } from 'react'
import { STRINGS, format } from '../data/strings'
import './Field.css'

interface TextAreaProps {
  label: string
  value: string
  onChange: (value: string) => void
  maxLength: number
  placeholder?: string
  hideLabel?: boolean
  rows?: number
  describedBy?: string
}

export function TextArea({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  hideLabel = false,
  rows = 6,
  describedBy,
}: TextAreaProps) {
  const id = useId()
  const counterId = `${id}-counter`
  const remaining = maxLength - value.length

  return (
    <div className="field">
      <label className={hideLabel ? 'visually-hidden' : 'field__label'} htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="field__control field__control--area"
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-describedby={[describedBy, counterId].filter(Boolean).join(' ')}
        onChange={(event) => onChange(event.target.value)}
      />
      {/* Polite, so it does not interrupt on every keystroke. */}
      <p className="field__counter" id={counterId} aria-live="polite">
        {format(STRINGS.question.charactersLeft, { count: remaining })}
      </p>
    </div>
  )
}
