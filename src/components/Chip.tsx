import type { ReactNode } from 'react'
import './Chip.css'

interface ChipProps {
  selected?: boolean
  /** Looks selected without being announced as a pressed toggle. */
  active?: boolean
  /** Lets long, user-entered text wrap inside the chip. */
  wrap?: boolean
  onClick?: () => void
  ariaLabel?: string
  children: ReactNode
}

export function Chip({ selected, active, wrap, onClick, ariaLabel, children }: ChipProps) {
  return (
    <button
      type="button"
      className={wrap ? 'chip chip--wrap' : 'chip'}
      aria-pressed={selected}
      aria-label={ariaLabel}
      data-selected={active || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
