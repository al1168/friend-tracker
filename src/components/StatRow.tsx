import './StatRow.css'

export function StatRow({ items }: { items: { label: string; value: number }[] }) {
  return (
    <dl className="stat-row">
      {items.map((item) => (
        <div key={item.label} className="stat-row__item">
          <dt className="stat-row__label">{item.label}</dt>
          <dd className="stat-row__value numeric">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
