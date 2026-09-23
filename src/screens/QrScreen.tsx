import { useMemo } from 'react'
import qrcode from 'qrcode-generator'
import { Logo } from '../components/Logo'
import { PUBLIC_URL } from '../data/publicUrl'
import { STRINGS } from '../data/strings'
import './QrScreen.css'

/**
 * A printable poster for a stand or a counter. Generated locally at render
 * time — no image service, no remote request (CLAUDE.md rule 3).
 */
export function QrScreen() {
  const { path, size } = useMemo(() => buildQrPath(PUBLIC_URL), [])

  return (
    <div className="qr">
      <div className="qr__poster">
        <Logo size="lg" />
        <h1 className="qr__title">{STRINGS.qr.title}</h1>
        <svg
          className="qr__code"
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${STRINGS.qr.subtitle} ${PUBLIC_URL}`}
          shapeRendering="crispEdges"
        >
          <rect width={size} height={size} fill="#ffffff" />
          <path d={path} fill="var(--color-wine-900)" />
        </svg>
        <p className="qr__subtitle">{STRINGS.qr.subtitle}</p>
        <p className="qr__url">{PUBLIC_URL}</p>
      </div>
    </div>
  )
}

/** One SVG path covering every dark module, plus a 4-module quiet zone. */
function buildQrPath(text: string): { path: string; size: number } {
  const code = qrcode(0, 'M')
  code.addData(text)
  code.make()

  const count = code.getModuleCount()
  const margin = 4
  const size = count + margin * 2

  let path = ''
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (code.isDark(row, col)) {
        path += `M${col + margin} ${row + margin}h1v1h-1z`
      }
    }
  }

  return { path, size }
}
