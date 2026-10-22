import { useId, type ReactNode, type Ref } from 'react'
import { Link } from 'react-router'
import { IconChevronRight } from './icons'
import type { NavState } from './Page'
import './InsetGroup.css'

interface InsetGroupProps {
  title?: string
  /** Heading level for the title (3 when nested inside a Section). */
  level?: 2 | 3
  /** One text link at the end of the title's line ("See all"), with the `group-action` class. */
  action?: ReactNode
  footer?: ReactNode
  /** An id for the footer, so a row can point at it with `describedBy`. */
  footerId?: string
  /** Makes the title focusable from code (not by tab), for moving focus here after a control is replaced. */
  titleRef?: Ref<HTMLHeadingElement>
  children: ReactNode
}

export function InsetGroup({ title, level = 2, action, footer, footerId, titleRef, children }: InsetGroupProps) {
  const titleId = useId()
  const Heading = level === 3 ? 'h3' : 'h2'
  const heading = title && (
    <Heading id={titleId} className="group-title" ref={titleRef} tabIndex={titleRef ? -1 : undefined}>
      {title}
    </Heading>
  )
  return (
    <section className="inset-group" aria-labelledby={title && level !== 3 ? titleId : undefined}>
      {/* The action comes after the heading and before the rows, in the DOM as on screen. */}
      {heading && action ? (
        <div className="group-header">
          {heading}
          {action}
        </div>
      ) : (
        heading
      )}
      <div className="inset-group__body">{children}</div>
      {footer && (
        <p id={footerId} className="inset-group__footer">
          {footer}
        </p>
      )}
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
  state?: NavState
  onClick?: () => void
  /** Makes the row an on/off switch (a button with role "switch") showing a switch on the right. */
  switchOn?: boolean
  /** Dims a button row and makes it unpressable (the group's footer says why). */
  disabled?: boolean
  /** The id of text that describes this button row (for a disabled one: why it is). */
  describedBy?: string
  chevron?: boolean
  accent?: boolean
  destructive?: boolean
  /** The link, for moving focus to it from code (a `to` row only). */
  ref?: Ref<HTMLAnchorElement>
}

export function Row({
  title,
  subtitle,
  leading,
  trailing,
  to,
  state,
  onClick,
  switchOn,
  disabled,
  describedBy,
  chevron,
  accent,
  destructive,
  ref,
}: RowProps) {
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
      {switchOn !== undefined && <span className="switch" data-on={switchOn} aria-hidden="true" />}
      {chevron && (
        <span className="row__chevron">
          <IconChevronRight size={18} strokeWidth={2.4} />
        </span>
      )}
    </>
  )

  if (to) {
    return (
      <Link ref={ref} to={to} state={state} className={className}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={disabled}
        aria-describedby={describedBy}
        role={switchOn === undefined ? undefined : 'switch'}
        aria-checked={switchOn}
      >
        {content}
      </button>
    )
  }
  return <div className={className}>{content}</div>
}
