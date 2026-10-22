import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { IconChevronLeft } from './icons'
import './Page.css'

/** Router location state used for back labels and the origin tab. */
export interface NavState {
  backLabel?: string
  tab?: string
  /** On the day page: it was opened by "Save and write about the day", just after the meetup was logged. */
  logged?: boolean
  /**
   * With `logged`: the meetup was logged empty (no words for the day, no photos, no activities), so the Logged note
   * offers Undo. Without it the note shows with no Undo, so one tap can't delete what was written or added.
   */
  undoable?: boolean
}

interface PageProps {
  title: string
  /** Back button label and where to go if there's no history (e.g. opened from a link). */
  back?: { label: string; fallback: string }
  actions?: ReactNode
  /** Replaces the large title, e.g. a friend's avatar and name. Must contain its own h1. */
  hero?: ReactNode
  /** Slide in from the right, like a pushed iOS screen. */
  pushed?: boolean
  children: ReactNode
}

export function Page({ title, back, actions, hero, pushed = false, children }: PageProps) {
  const topRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const [compact, setCompact] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    document.title = `${title} · Friend Tracker`
  }, [title])

  useEffect(() => {
    const element = topRef.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), {
      rootMargin: `-${headerRef.current?.offsetHeight ?? 44}px 0px 0px 0px`,
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function goBack() {
    if (!back) return
    if (location.key === 'default') navigate(back.fallback, { replace: true })
    else navigate(-1)
  }

  return (
    <div className={pushed ? 'page page--pushed' : 'page'}>
      <header ref={headerRef} className="navbar" data-compact={compact}>
        <div className="navbar__side">
          {back && (
            <button type="button" className="text-button navbar__back" onClick={goBack}>
              <IconChevronLeft size={26} strokeWidth={2.4} />
              <span className="navbar__back-label">{(location.state as NavState | null)?.backLabel ?? back.label}</span>
            </button>
          )}
        </div>
        <div className="navbar__title" aria-hidden="true">
          {title}
        </div>
        <div className="navbar__side navbar__side--end">{actions}</div>
      </header>
      <div ref={topRef}>
        {hero ? <div className="page__hero">{hero}</div> : <h1 className="page__title">{title}</h1>}
      </div>
      <div className="page__body">{children}</div>
    </div>
  )
}
