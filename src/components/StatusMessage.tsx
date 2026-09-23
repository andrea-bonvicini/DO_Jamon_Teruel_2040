import type { ReactNode } from 'react'
import './StatusMessage.css'

interface StatusMessageProps {
  tone: 'info' | 'success' | 'error'
  children: ReactNode
  /** Errors and successes announce themselves; static info does not. */
  live?: boolean
}

export function StatusMessage({ tone, children, live = true }: StatusMessageProps) {
  return (
    <div
      className={`status status--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={live ? (tone === 'error' ? 'assertive' : 'polite') : 'off'}
    >
      {children}
    </div>
  )
}
