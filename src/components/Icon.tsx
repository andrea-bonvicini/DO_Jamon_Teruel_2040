import type { ReactElement } from 'react'
import './Icon.css'

/**
 * Authored line icons, one consistent 24-grid and 1.5 stroke. No icon
 * library and no emoji: every glyph here is drawn.
 *
 * The questionnaire names an icon by id in `src/data/`, so adding or changing
 * one on a question never touches a component — see CLAUDE.md rule 4.
 */
export type IconName =
  | 'ganaderia'
  | 'matadero'
  | 'secadero'
  | 'mixta'
  | 'otra'
  | 'empresa'
  | 'consumidor'
  | 'escudo'
  | 'check'

interface IconProps {
  name: IconName
  className?: string
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      className={['icon', className].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}

const PATHS: Record<IconName, ReactElement> = {
  ganaderia: (
    <>
      <path d="M4.8 11.2c0-2.3 2.3-4 5.2-4h4c2.9 0 5.2 1.7 5.2 4v2.4c0 2.3-2.3 4-5.2 4h-4c-2.9 0-5.2-1.7-5.2-4z" />
      <path d="M4.9 9.2 3.4 6.9a.7.7 0 0 1 .7-1.1l2.9.6M19.1 9.2l1.5-2.3a.7.7 0 0 0-.7-1.1l-2.9.6" />
      <ellipse cx="12" cy="13.4" rx="2.7" ry="2" />
      <path d="M11 13.2v.4M13 13.2v.4M8 17.6v2.6M16 17.6v2.6" />
    </>
  ),
  matadero: (
    <>
      <path d="M3 20.5h18" />
      <path d="M4.5 20.5V9.8a1 1 0 0 1 .5-.9l6.5-3.6a1 1 0 0 1 1 0l6.5 3.6a1 1 0 0 1 .5.9v10.7" />
      <path d="M9 20.5v-4.7h6v4.7M9.2 11.4h5.6" />
    </>
  ),
  secadero: (
    <>
      <path d="M3 5.5h18" />
      <path d="M7.2 5.5v2.2M12 5.5v2.2M16.8 5.5v2.2" />
      <path d="M5.2 10.4c0-1.4.9-2.4 2-2.4s2 1 2 2.4v4.3c0 2.1-.9 3.6-2 3.6s-2-1.5-2-3.6z" />
      <path d="M10 10.4c0-1.4.9-2.4 2-2.4s2 1 2 2.4v5.6c0 2.4-.9 4.1-2 4.1s-2-1.7-2-4.1z" />
      <path d="M14.8 10.4c0-1.4.9-2.4 2-2.4s2 1 2 2.4v4.3c0 2.1-.9 3.6-2 3.6s-2-1.5-2-3.6z" />
    </>
  ),
  mixta: (
    <>
      <circle cx="8.6" cy="8.6" r="4.6" />
      <circle cx="15.4" cy="15.4" r="4.6" />
      <path d="M11.9 11.9 8.6 8.6M15.4 15.4l-3.5-3.5" />
    </>
  ),
  otra: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="8.4" cy="12" r=".9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="12" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  empresa: (
    <>
      <path d="M3 20.5h18" />
      <path d="M5 20.5V5.6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v14.9" />
      <path d="M14 20.5v-9.4h4a1 1 0 0 1 1 1v8.4" />
      <path d="M8 8.2h3M8 11.6h3M8 15h3M16.4 14.4h.8M16.4 17.4h.8" />
    </>
  ),
  consumidor: (
    <>
      <circle cx="12" cy="7.8" r="3.8" />
      <path d="M4.8 20.4c0-3.6 3.2-6.5 7.2-6.5s7.2 2.9 7.2 6.5" />
    </>
  ),
  escudo: (
    <>
      <path d="M12 3.2 5 6v5.6c0 4.3 2.9 7.9 7 9.2 4.1-1.3 7-4.9 7-9.2V6z" />
      <path d="m9.3 12 1.9 1.9 3.6-3.7" />
    </>
  ),
  check: <path d="m5 12.6 4.6 4.6L19 7.8" strokeWidth="3.2" />,
}
