import './HBarList.css'

export interface HBarItem {
  key: string
  label: string
  count: number
  previousCount: number
}

/** Horizontal bars: the selected year (peach) over the previous year (gray), with numbers. */
export function HBarList({ items, previousYear }: { items: HBarItem[]; previousYear: number }) {
  const max = Math.max(1, ...items.flatMap((item) => [item.count, item.previousCount]))
  return (
    <ul className="hbars">
      {items.map((item) => (
        <li key={item.key} className="hbars__item">
          <div className="hbars__head">
            <span className="hbars__label">{item.label}</span>
            <span className="hbars__values">
              <span className="numeric hbars__count">{item.count}</span>
              <span>
                {' '}
                · {previousYear}: {item.previousCount}
              </span>
            </span>
          </div>
          <div className="hbars__track" aria-hidden="true">
            <span className="hbars__bar hbars__bar--current" style={{ width: `${(item.count / max) * 100}%` }} />
            <span
              className="hbars__bar hbars__bar--previous"
              style={{ width: `${(item.previousCount / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
