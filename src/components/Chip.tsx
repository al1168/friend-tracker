import type { ReactNode } from 'react'
import './Chip.css'

interface ChipProps {
  selected?: boolean
  /** Looks selected without being announced as a pressed toggle. */
  active?: boolean
  onClick?: () => void
  ariaLabel?: string
  children: ReactNode
}

export function Chip({ selected, active, onClick, ariaLabel, children }: ChipProps) {
  return (
    <button type="button" className="chip" aria-pressed={selected} aria-label={ariaLabel} data-selected={active || undefined} onClick={onClick}>
      {children}
    </button>
  )
}
