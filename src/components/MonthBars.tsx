import { MONTH_INITIALS, MONTH_NAMES } from '../lib/dates'
import './MonthBars.css'

interface MonthBarsProps {
  current: number[]
  previous: number[]
  year: number
}

export function MonthBars({ current, previous, year }: MonthBarsProps) {
  const max = Math.max(1, ...current, ...previous)
  const description = MONTH_NAMES.map(
    (month, i) => `${month}: ${current[i]} in ${year}, ${previous[i]} in ${year - 1}`,
  ).join('. ')
  return (
    <figure className="month-bars">
      <figcaption className="month-bars__legend">
        <span className="month-bars__key month-bars__key--previous">{year - 1}</span>
        <span className="month-bars__key month-bars__key--current">{year}</span>
      </figcaption>
      <div className="month-bars__chart" role="img" aria-label={`Meetups per month. ${description}.`}>
        {current.map((count, i) => (
          <div key={MONTH_NAMES[i]} className="month-bars__month">
            <div className="month-bars__pair">
              <span
                className="month-bars__bar month-bars__bar--previous"
                style={{ height: `${(previous[i] / max) * 100}%` }}
              />
              <span className="month-bars__bar month-bars__bar--current" style={{ height: `${(count / max) * 100}%` }} />
            </div>
            <span className="month-bars__label" aria-hidden="true">
              {MONTH_INITIALS[i]}
            </span>
          </div>
        ))}
      </div>
    </figure>
  )
}
