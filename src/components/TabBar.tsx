import { Link, useLocation, type Location } from 'react-router'
import { useBackupDot } from '../backup/useBackupDot'
import { isDayPage } from '../lib/routes'
import type { NavState } from './Page'
import { IconFriends, IconSettings, IconStats } from './icons'
import './TabBar.css'

const TABS = [
  {
    to: '/',
    label: 'Friends',
    Icon: IconFriends,
    matches: (path: string) => path === '/' || path.startsWith('/friends') || path.startsWith('/meetups'),
  },
  { to: '/stats', label: 'Stats', Icon: IconStats, matches: (path: string) => path.startsWith('/stats') },
  { to: '/settings', label: 'Settings', Icon: IconSettings, matches: (path: string) => path.startsWith('/settings') },
]

export function TabBar() {
  const location = useLocation()
  // The day page fills the screen, so it has no tab bar (and BackupDotProvider reads nothing there).
  if (isDayPage(location.pathname)) return null
  return <TabBarItems location={location} />
}

function TabBarItems({ location }: { location: Location }) {
  const { pathname } = location
  const originTab = (location.state as NavState | null)?.tab
  // A quiet suggestion to back up: a dot on the Settings icon, and VoiceOver hears "Settings, backup suggested" (a
  // name that starts with the tab's own word, so Voice Control's "Tap Settings" still works). The answer is shared
  // with Settings through BackupDotProvider.
  const backupDot = useBackupDot() === true
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ to, label, Icon, matches }) => {
        const active = originTab ? to === originTab : matches(pathname)
        const dot = backupDot && to === '/settings'
        return (
          <Link
            key={to}
            to={to}
            className="tabbar__item"
            aria-current={active ? 'page' : undefined}
            aria-label={dot ? `${label}, backup suggested` : undefined}
          >
            <span className="tabbar__icon">
              <Icon size={26} strokeWidth={active ? 2.2 : 1.8} />
              {dot && <span className="tabbar__dot" aria-hidden="true" />}
            </span>
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
