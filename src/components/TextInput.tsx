import { useId } from 'react'
import './Field.css'

interface TextInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
  placeholder?: string
  /** Hides the label visually when the question text already carries it. */
  hideLabel?: boolean
  autoComplete?: string
  type?: 'text' | 'password'
  describedBy?: string
}

export function TextInput({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  hideLabel = false,
  autoComplete = 'off',
  type = 'text',
  describedBy,
}: TextInputProps) {
  const id = useId()

  return (
    <div className="field">
      <label className={hideLabel ? 'visually-hidden' : 'field__label'} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field__control"
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
