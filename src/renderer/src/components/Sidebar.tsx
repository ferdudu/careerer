import { NavLink } from 'react-router-dom'
import { useProfile } from '../hooks'

const icon = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
}

export function Sidebar(): JSX.Element {
  const { profile } = useProfile()
  const name = profile?.parsed?.name
  const headline = profile?.parsed?.headline
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand">Careerer</div>
      <div className="navlist">
        <NavLink to="/" end className="nav">
          <svg {...icon}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          New application
        </NavLink>
        <NavLink to="/library" className="nav">
          <svg {...icon}>
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
          Library
        </NavLink>
        <NavLink to="/profile" className="nav">
          <svg {...icon}>
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c1.2-3.5 3.8-5 7-5s5.8 1.5 7 5" />
          </svg>
          Profile
        </NavLink>
      </div>
      <div className="sidebar-foot">
        <div className="who">
          <div className="who-name">{name ?? (profile ? 'Your profile' : 'No profile yet')}</div>
          {headline && <div className="who-sub">{headline}</div>}
        </div>
        <NavLink to="/settings" className="nav gear" aria-label="Settings">
          <svg {...icon}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
          Settings
        </NavLink>
      </div>
    </nav>
  )
}
