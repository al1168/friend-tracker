import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { IconChevronRight } from './icons'
import './InsetGroup.css'

interface InsetGroupProps {
  title?: string
  /** Heading level for the title (3 when nested inside a Section). */
  level?: 2 | 3
  footer?: ReactNode
  children: ReactNode
}

export function InsetGroup({ title, level = 2, footer, children }: InsetGroupProps) {
  const titleId = useId()
  const Heading = level === 3 ? 'h3' : 'h2'
  return (
    <section className="inset-group" aria-labelledby={title ? titleId : undefined}>
      {title && (
        <Heading id={titleId} className="group-title">
          {title}
        </Heading>
      )}
      <div className="inset-group__body">{children}</div>
      {footer && <p className="inset-group__footer">{footer}</p>}
    </section>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId()
  return (
    <section className="section" aria-labelledby={titleId}>
      <h2 id={titleId} className="group-title">
        {title}
      </h2>
      {children}
    </section>
  )
}

interface RowProps {
  title: ReactNode
  subtitle?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  to?: string
  /** Router location state for `to` (e.g. back label and origin tab). */
  state?: unknown
  onClick?: () => void
  chevron?: boolean
  accent?: boolean
  destructive?: boolean
}

export function Row({ title, subtitle, leading, trailing, to, state, onClick, chevron, accent, destructive }: RowProps) {
  const className = [
    'row',
    (to || onClick) && 'row--interactive',
    accent && 'row--accent',
    destructive && 'row--destructive',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {leading && <span className="row__leading">{leading}</span>}
      <span className="row__main">
        <span className="row__title">{title}</span>
        {subtitle && <span className="row__subtitle">{subtitle}</span>}
      </span>
      {trailing !== undefined && <span className="row__trailing">{trailing}</span>}
      {chevron && (
        <span className="row__chevron">
          <IconChevronRight size={18} strokeWidth={2.4} />
        </span>
      )}
    </>
  )

  if (to) {
    return (
      <Link to={to} state={state} className={className}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    )
  }
  return <div className={className}>{content}</div>
}
