import { Component, type ReactNode } from 'react'
import { EmptyState } from './EmptyState'
import './ErrorBoundary.css'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  failed: boolean
}

/** Last resort: if rendering throws (e.g. iOS drops the IndexedDB connection), offer a reload instead of a blank screen. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="error-boundary">
        <EmptyState
          title="Something went wrong."
          message="Your data is safe on this iPhone. Reload to try again."
          action={
            <button type="button" className="button button--primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          }
        />
      </div>
    )
  }
}
