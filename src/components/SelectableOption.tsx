import { useId } from 'react'
import { Icon } from './Icon'
import type { OptionIcon } from '../data/types'
import './SelectableOption.css'

interface SelectableOptionProps {
  /** Shared across a radio group; unique per checkbox. */
  name: string
  value: string
  label: string
  checked: boolean
  onChange: (value: string) => void
  control: 'radio' | 'checkbox'
  disabled?: boolean
  /** Declared by the option in `src/data/`; presentation only. */
  icon?: OptionIcon
}

/**
 * A real <input> inside a <label>, styled as a card. Keyboard and screen
 * reader behaviour is the browser's, not ours.
 */
export function SelectableOption({
  name,
  value,
  label,
  checked,
  onChange,
  control,
  disabled = false,
  icon,
}: SelectableOptionProps) {
  const id = useId()

  return (
    <label
      className="option"
      htmlFor={id}
      data-checked={checked || undefined}
      data-disabled={disabled || undefined}
    >
      <input
        id={id}
        className="option__input"
        type={control}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
      />
      {icon && (
        <span className="option__icon" aria-hidden="true">
          <Icon name={icon} />
        </span>
      )}
      <span className="option__label">{label}</span>
      <span className={`option__marker option__marker--${control}`} aria-hidden="true" />
    </label>
  )
}
