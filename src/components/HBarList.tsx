import './HBarList.css'

export interface HBarItem {
  key: string
  label: string
  count: number
  previousCount: number
}

interface HBarListProps {
  items: HBarItem[]
  year: number
  /** The year compared with. Left out before the first meetup: each row is then its count and one bar. */
  previousYear?: number
}

/** Horizontal bars: the selected year (peach) over the previous year (gray), with numbers. */
export function HBarList({ items, year, previousYear }: HBarListProps) {
  const compares = previousYear !== undefined
  const max = Math.max(1, ...items.flatMap((item) => (compares ? [item.count, item.previousCount] : [item.count])))
  return (
    <ul className="hbars" role="list">
      {items.map((item) => (
        <li key={item.key} className="hbars__item">
          <div className="hbars__head">
            <span className="hbars__label">{item.label}</span>
            <span className="hbars__values">
              <span className="numeric hbars__count">
                <span className="visually-hidden">{year}: </span>
                {item.count}
              </span>
              {compares && (
                <span>
                  {' '}
                  <span aria-hidden="true">· </span>
                  {previousYear}: {item.previousCount}
                </span>
              )}
            </span>
          </div>
          <div className="hbars__track" aria-hidden="true">
            <span className="hbars__bar hbars__bar--current" style={{ width: `${(item.count / max) * 100}%` }} />
            {compares && (
              <span
                className="hbars__bar hbars__bar--previous"
                style={{ width: `${(item.previousCount / max) * 100}%` }}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
