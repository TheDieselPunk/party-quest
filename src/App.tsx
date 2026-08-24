import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useProfiles, useCurrentProfile } from './store/hooks'
import { useSession } from './store/session'
import { Onboarding } from './ui/Onboarding'
import { Dashboard } from './ui/Dashboard'
import { WorkoutPlayer } from './ui/WorkoutPlayer'
import { History } from './ui/History'
import { CharacterScreen } from './ui/CharacterScreen'
import { Party } from './ui/Party'
import { Settings } from './ui/Settings'
import { Coach } from './ui/Coach'

const TABS = [
  { to: '/', icon: '🏰', label: 'Tavern' },
  { to: '/history', icon: '📜', label: 'Log' },
  { to: '/character', icon: '🛡️', label: 'Hero' },
  { to: '/party', icon: '⚔️', label: 'Party' },
  { to: '/coach', icon: '🧙', label: 'Coach' },
]

function TabBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button key={t.to} className="tab" aria-current={pathname === t.to} onClick={() => navigate(t.to)}>
          <span className="ico">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const profiles = useProfiles()
  const profile = useCurrentProfile()
  const setCurrent = useSession((s) => s.setCurrent)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Auto-select a profile if none is chosen but some exist (e.g. after delete).
  useEffect(() => {
    if (profiles && profiles.length > 0 && (profile === null)) {
      setCurrent(profiles[0].id)
    }
  }, [profiles, profile, setCurrent])

  if (profiles === undefined || profile === undefined) {
    return <div className="app-shell"><div className="screen muted">Summoning…</div></div>
  }

  // No profiles yet → force onboarding.
  if (profiles.length === 0) {
    return (
      <div className="app-shell">
        <Routes>
          <Route path="*" element={<Onboarding first />} />
        </Routes>
      </div>
    )
  }

  const onWorkout = pathname === '/workout'

  return (
    <div className="app-shell">
      {!onWorkout && (
        <header className="app-header">
          <div className="brand">⚔ Party Quest</div>
          <div className="row">
            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/settings')}>⚙</button>
          </div>
        </header>
      )}

      <Routes>
        <Route path="/onboarding" element={<Onboarding first={false} />} />
        {profile && <Route path="/" element={<Dashboard profile={profile} />} />}
        {profile && <Route path="/workout" element={<WorkoutPlayer profile={profile} />} />}
        {profile && <Route path="/history" element={<History profile={profile} />} />}
        {profile && <Route path="/character" element={<CharacterScreen profile={profile} />} />}
        {profile && <Route path="/party" element={<Party />} />}
        {profile && <Route path="/settings" element={<Settings profile={profile} />} />}
        {profile && <Route path="/coach" element={<Coach profile={profile} />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!onWorkout && <TabBar />}
    </div>
  )
}
