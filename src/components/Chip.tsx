import type { ReactNode } from 'react'
import './Chip.css'

interface ChipProps {
  selected?: boolean
  onClick?: () => void
  ariaLabel?: string
  children: ReactNode
}

export function Chip({ selected = false, onClick, ariaLabel, children }: ChipProps) {
  return (
    <button type="button" className="chip" aria-pressed={selected} aria-label={ariaLabel} onClick={onClick}>
      {children}
    </button>
  )
}
