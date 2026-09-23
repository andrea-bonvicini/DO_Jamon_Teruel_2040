import { useId } from 'react'
import type { Option } from '../data/types'
import { SelectableOption } from './SelectableOption'
import './Group.css'

interface RadioGroupProps {
  legend: string
  options: Option[]
  value: string | null
  onChange: (optionId: string) => void
  describedBy?: string
}

export function RadioGroup({ legend, options, value, onChange, describedBy }: RadioGroupProps) {
  const name = useId()

  return (
    <fieldset className="group" aria-describedby={describedBy}>
      <legend className="visually-hidden">{legend}</legend>
      <div className="group__items">
        {options.map((option) => (
          <SelectableOption
            key={option.id}
            control="radio"
            name={name}
            value={option.id}
            label={option.text}
            icon={option.icon}
            checked={value === option.id}
            onChange={onChange}
          />
        ))}
      </div>
    </fieldset>
  )
}
