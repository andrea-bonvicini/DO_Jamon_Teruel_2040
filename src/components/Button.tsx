import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet'
  fullWidth?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = ['button', `button--${variant}`]
  if (fullWidth) classes.push('button--full')
  if (className) classes.push(className)

  return (
    // eslint-disable-next-line react/button-has-type
    <button type={type} className={classes.join(' ')} {...rest}>
      {children}
    </button>
  )
}
