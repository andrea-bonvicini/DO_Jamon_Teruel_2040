import type { ReactNode } from 'react'
import { Logo } from './Logo'
import { ProgressBar } from './ProgressBar'
import { STRINGS } from '../data/strings'
import './Screen.css'

interface ScreenProps {
  title: string
  subtitle?: ReactNode
  /** Omitted on welcome, audience, identification and thank-you screens. */
  progress?: { current: number; total: number; label: string }
  children?: ReactNode
  /** Back / Next. */
  actions?: ReactNode
  /** A quiet link rendered under the actions. */
  footer?: ReactNode
  /** Wider measure for the admin panel and the style guide. */
  width?: 'default' | 'wide'
  /**
   * Centres the band and the body. For the two bookend screens — the cover
   * and the thank-you — where there is no list to scan and centring reads as
   * deliberate. Question screens stay 'start': a centred list of options
   * loses the common left edge the eye uses to find each line.
   */
  align?: 'start' | 'center'
  /**
   * The partner mark on the right of the band. The cover turns it off,
   * because it already shows CIRCE full colour alongside the D.O. marks.
   */
  showPartner?: boolean
  /**
   * Lets the title run past the reading measure, on one line where it fits.
   * Only the cover uses it: there is no option list underneath to share a
   * vertical axis with, which is the reason the measure is shared elsewhere.
   */
  wideTitle?: boolean
}

/**
 * The page shell, and the only place the layout lives.
 *
 * One composition, top to bottom: a full-bleed red band carrying the brand,
 * the progress and the question, then the answer on cream, then the actions.
 * The band's inner content shares the SAME measure as the answer below it, so
 * the question and the first option sit on one vertical axis and the eye
 * reads straight down. Break that alignment and a full-bleed band splits the
 * reading again, which is the problem this layout exists to fix.
 *
 * Red stays the primary colour: `.screen__panel` redefines the semantic
 * colour tokens inside itself, so Logo, ProgressBar and the headings invert
 * without knowing anything about it.
 */
export function Screen({
  title,
  subtitle,
  progress,
  children,
  actions,
  footer,
  width = 'default',
  align = 'start',
  showPartner = true,
  wideTitle = false,
}: ScreenProps) {
  return (
    <div
      className="screen"
      data-width={width}
      data-align={align}
      data-title={wideTitle ? 'wide' : undefined}
    >
      <div className="screen__panel">
        <div className="screen__panel-inner">
          <div className="screen__brand">
            <Logo size="sm" />
            {showPartner && (
              <img
                className="screen__partner"
                src="/logo-circe-blanco.png"
                alt={STRINGS.brand.markCirceAlt}
                width={187}
                height={102}
              />
            )}
          </div>

          {progress && (
            <ProgressBar current={progress.current} total={progress.total} label={progress.label} />
          )}

          <div className="screen__heading">
            <h1 className="screen__title">{title}</h1>
            {subtitle && <div className="screen__subtitle">{subtitle}</div>}
          </div>
        </div>
      </div>

      <div className="screen__content">
        <main className="screen__main">{children}</main>

        {(actions || footer) && (
          <div className="screen__footer">
            {actions && <div className="screen__actions">{actions}</div>}
            {footer && <div className="screen__footer-extra">{footer}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
