import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useProfiles, useCurrentProfile } from './store/hooks'
import { useSession } from './store/session'
import { useAuth } from './cloud/auth'
import { initSync, clearSync, useSyncStatus } from './cloud/sync'
import { Auth } from './ui/Auth'
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
  const offline = useSession((s) => s.offline)
  const setOffline = useSession((s) => s.setOffline)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { session, ready, cloudEnabled } = useAuth()
  const syncStatus = useSyncStatus()

  // Start/stop cloud sync with the auth session.
  const userId = session?.user?.id
  useEffect(() => {
    if (userId) void initSync(userId)
    else clearSync()
  }, [userId])

  // Auto-select a profile if none is chosen but some exist (e.g. after delete).
  useEffect(() => {
    if (profiles && profiles.length > 0 && (profile === null)) {
      setCurrent(profiles[0].id)
    }
  }, [profiles, profile, setCurrent])

  // Cloud sign-in gate: show it when cloud is configured, we're not signed in,
  // and the user hasn't chosen to continue offline.
  if (cloudEnabled && !ready) {
    return <div className="app-shell"><div className="screen muted">Summoning…</div></div>
  }
  if (cloudEnabled && !session && !offline) {
    return <div className="app-shell"><Auth onOffline={() => setOffline(true)} /></div>
  }
  // Signed in: wait for the first cloud pull so returning users don't flash the
  // onboarding screen before their data restores.
  if (cloudEnabled && session && !syncStatus.initialSyncDone) {
    return <div className="app-shell"><div className="screen muted">Restoring your progress…</div></div>
  }

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
