import type { ReactNode } from 'react'
import './Chip.css'

interface ChipProps {
  selected?: boolean
  /** Looks selected without being announced as a pressed toggle. */
  active?: boolean
  /** Lets long, user-entered text wrap inside the chip. */
  wrap?: boolean
  /**
   * Keeps the chip within its row: the label (put it in a `.chip__label` span) ends in "…", and avatars and icons
   * always show. The accessible name should say it in full (`ariaLabel`).
   */
  truncate?: boolean
  onClick?: () => void
  ariaLabel?: string
  children: ReactNode
}

export function Chip({ selected, active, wrap, truncate, onClick, ariaLabel, children }: ChipProps) {
  return (
    <button
      type="button"
      className={['chip', wrap && 'chip--wrap', truncate && 'chip--truncate'].filter(Boolean).join(' ')}
      aria-pressed={selected}
      aria-label={ariaLabel}
      data-selected={active || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
