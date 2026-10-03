import { Link, useLocation } from 'react-router'
import { IconFriends, IconSettings, IconStats } from './icons'
import './TabBar.css'

const TABS = [
  { to: '/', label: 'Friends', Icon: IconFriends, matches: (path: string) => path === '/' || path.startsWith('/friends') },
  { to: '/stats', label: 'Stats', Icon: IconStats, matches: (path: string) => path.startsWith('/stats') },
  { to: '/settings', label: 'Settings', Icon: IconSettings, matches: (path: string) => path.startsWith('/settings') },
]

export function TabBar() {
  const { pathname } = useLocation()
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ to, label, Icon, matches }) => {
        const active = matches(pathname)
        return (
          <Link key={to} to={to} className="tabbar__item" aria-current={active ? 'page' : undefined}>
            <Icon size={26} strokeWidth={active ? 2.2 : 1.8} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
