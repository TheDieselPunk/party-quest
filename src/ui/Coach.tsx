import { useMemo, useState } from 'react'
import type { Profile } from '../domain/types'
import { useCharacter, useSessions } from '../store/hooks'
import { emptyCharacter } from '../rpg/character'
import { buildCoachExport, buildProjectInstructions } from '../coach/export'
import { Screen } from './common'

export function Coach({ profile }: { profile: Profile }) {
  const character = useCharacter(profile.id)
  const sessions = useSessions(profile.id)
  const [copied, setCopied] = useState(false)
  const [copiedSetup, setCopiedSetup] = useState(false)

  const markdown = useMemo(() => {
    if (!sessions) return ''
    return buildCoachExport(profile, character ?? emptyCharacter(profile.id), sessions)
  }, [profile, character, sessions])
  const projectInstructions = useMemo(() => buildProjectInstructions(), [])

  async function copyText(text: string, mark: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text)
      mark(true)
      setTimeout(() => mark(false), 2000)
    } catch { /* clipboard unavailable */ }
  }
  const copy = () => copyText(markdown, setCopied)
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Adventurer’s Log', text: markdown }) } catch { /* cancelled */ }
    } else {
      copy()
    }
  }

  return (
    <Screen eyebrow="The Sage" title="Ask the Coach">
      <div className="card-parchment" style={{ marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 14, color: '#3a2d18' }}>
          This builds an <b>Adventurer’s Log</b> — a full snapshot of your training and this week’s
          plan. Paste it to <b>Claude</b> for a research-grounded review (progression, volume,
          imbalances, and what to change). It runs on your Claude subscription — no extra cost, and
          nothing leaves your phone until you share it.
        </p>
        <ol style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, color: '#4b3c1e' }}>
          <li><b>Once:</b> set up a <b>Claude Project</b> (below) so every review is consistent.</li>
          <li><b>Each week:</b> tap <b>Share to Claude</b> and paste the log into that Project.</li>
          <li>Apply its suggestions here in <b>Settings</b>.</li>
        </ol>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={share}>📤 Share to Claude</button>
        <button className="btn" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>

      <details className="card" style={{ marginBottom: 12 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
          🧭 One-time setup: create a Claude Project
        </summary>
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          A <b>Project</b> remembers the coaching brief and the exact settings this app can change, so
          each weekly review stays consistent, its advice maps to real buttons, and your weekly paste
          stays short.
        </p>
        <ol style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 13 }}>
          <li>In the Claude app, create a new <b>Project</b> (e.g. “Party Quest Coach”).</li>
          <li>Open its <b>custom instructions</b> and paste the text below.</li>
          <li>From then on, start each weekly review inside that Project.</li>
        </ol>
        <button className="btn btn-sm" onClick={() => copyText(projectInstructions, setCopiedSetup)}>
          {copiedSetup ? 'Copied ✓' : 'Copy Project instructions'}
        </button>
        <textarea readOnly value={projectInstructions}
          style={{ height: 200, marginTop: 10, fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5 }} />
      </details>

      <div className="card">
        <div className="eyebrow">This week’s log (preview)</div>
        <textarea readOnly value={markdown} style={{ height: 320, fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5 }} />
      </div>
    </Screen>
  )
}
