import { useEffect, useState } from 'react'
import { todayISO, type ISODate } from '../lib/dates'

/** Today's local date. Updates when the app returns to the foreground or the day rolls over. */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const update = () => setToday(todayISO())
    document.addEventListener('visibilitychange', update)
    const timer = window.setInterval(update, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', update)
      window.clearInterval(timer)
    }
  }, [])
  return today
}
