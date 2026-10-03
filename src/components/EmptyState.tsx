import type { ReactNode } from 'react'
import './EmptyState.css'

interface EmptyStateProps {
  title: string
  message?: string
  action?: ReactNode
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <svg className="empty-state__art" viewBox="0 0 120 80" aria-hidden="true">
        <circle cx="48" cy="40" r="28" className="empty-state__circle-a" />
        <circle cx="72" cy="40" r="28" className="empty-state__circle-b" />
      </svg>
      <p className="empty-state__title">{title}</p>
      {message && <p className="empty-state__message">{message}</p>}
      {action}
    </div>
  )
}
