import './StatRow.css'

export interface StatItem {
  label: string
  value: number
  /** A small line under the label: "3 by Oct 22" under "Last year". */
  note?: string
}

/**
 * Numbers over their labels, three across. In the DOM each is its label, its value, then its note, so VoiceOver
 * reads "Last year, 9, 3 by Oct 22"; the value shows above the label.
 */
export function StatRow({ items }: { items: StatItem[] }) {
  return (
    <dl className="stat-row">
      {items.map((item) => (
        <div key={item.label} className="stat-row__item">
          <dt className="stat-row__label">{item.label}</dt>
          <dd className="stat-row__value numeric">{item.value}</dd>
          {item.note && <dd className="stat-row__note">{item.note}</dd>}
        </div>
      ))}
    </dl>
  )
}
