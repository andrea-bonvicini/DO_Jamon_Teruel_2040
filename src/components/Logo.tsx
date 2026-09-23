import { STRINGS } from '../data/strings'
import './Logo.css'

/**
 * The wordmark that rides the red band on every screen.
 *
 * The Consejo Regulador's real marks are red and pink on transparent, so they
 * cannot go here: on the maroon band they would all but disappear. They are
 * shown where they read properly — the cover, on cream, in `WelcomeScreen`.
 *
 * If a reversed (white) version of the official mark ever arrives, point
 * LOGO_SRC at it and drop the file in `public/`.
 */
const LOGO_SRC: string | null = null

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ size = 'md' }: LogoProps) {
  if (LOGO_SRC) {
    return <img className={`logo logo--${size}`} src={LOGO_SRC} alt={STRINGS.brand.logoAlt} />
  }

  return (
    <span className={`logo logo--${size} logo--wordmark`}>
      <span className="logo__prefix">D.O.</span>
      <span className="logo__name">Jamón de Teruel</span>
    </span>
  )
}
