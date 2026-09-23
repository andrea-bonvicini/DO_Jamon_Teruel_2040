import './ProgressBar.css'

interface ProgressBarProps {
  /** 1-based position of the current question. */
  current: number
  /** Number of questions currently applicable — never the unfiltered count. */
  total: number
  label: string
}

export function ProgressBar({ current, total, label }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1)
  const percent = Math.min(100, Math.max(0, (current / safeTotal) * 100))

  return (
    <div className="progress">
      <div
        className="progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={current}
        aria-valuetext={label}
      >
        <div className="progress__fill" style={{ inlineSize: `${percent}%` }} />
      </div>
      <p className="progress__label">{label}</p>
    </div>
  )
}
