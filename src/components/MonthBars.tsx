import { MONTH_INITIALS, MONTH_NAMES } from '../lib/dates'
import './MonthBars.css'

interface MonthBarsProps {
  current: number[]
  /** The year before, month by month. Left out before the first meetup: the chart is then this year alone. */
  previous?: number[]
  year: number
}

export function MonthBars({ current, previous, year }: MonthBarsProps) {
  const max = Math.max(1, ...current, ...(previous ?? []))
  const description = MONTH_NAMES.map((month, i) =>
    previous ? `${month}: ${current[i]} in ${year}, ${previous[i]} in ${year - 1}` : `${month}: ${current[i]} in ${year}`,
  ).join('. ')
  return (
    <div className="month-bars">
      <div className="month-bars__legend" aria-hidden="true">
        {previous && <span className="month-bars__key month-bars__key--previous">{year - 1}</span>}
        <span className="month-bars__key month-bars__key--current">{year}</span>
      </div>
      <div className="month-bars__chart" role="img" aria-label={`Meetups per month. ${description}.`}>
        {current.map((count, i) => (
          <div key={MONTH_NAMES[i]} className="month-bars__month">
            <div className="month-bars__pair">
              {previous && (
                <span
                  className="month-bars__bar month-bars__bar--previous"
                  style={{ height: `${(previous[i] / max) * 100}%` }}
                />
              )}
              <span className="month-bars__bar month-bars__bar--current" style={{ height: `${(count / max) * 100}%` }} />
            </div>
            <span className="month-bars__label" aria-hidden="true">
              {MONTH_INITIALS[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
