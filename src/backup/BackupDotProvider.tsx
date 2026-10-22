import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { isDayPage } from '../lib/routes'
import { BackupDotContext, useBackupDotQuery } from './useBackupDot'

/**
 * Runs the backup dot's live query once for the whole app, so the tab bar and Settings share one answer instead of
 * scanning twice. On the day page, which has no tab bar, it reads nothing.
 */
export function BackupDotProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const dot = useBackupDotQuery(!isDayPage(pathname))
  return <BackupDotContext.Provider value={dot}>{children}</BackupDotContext.Provider>
}
