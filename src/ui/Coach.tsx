import { useMemo, useState } from 'react'
import type { Profile } from '../domain/types'
import { useCharacter, useSessions } from '../store/hooks'
import { emptyCharacter } from '../rpg/character'
import { buildCoachExport } from '../coach/export'
import { Screen } from './common'

export function Coach({ profile }: { profile: Profile }) {
  const character = useCharacter(profile.id)
  const sessions = useSessions(profile.id)
  const [copied, setCopied] = useState(false)

  const markdown = useMemo(() => {
    if (!sessions) return ''
    return buildCoachExport(profile, character ?? emptyCharacter(profile.id), sessions)
  }, [profile, character, sessions])

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }
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
          This builds an <b>Adventurer’s Log</b> — a full summary of your training. Send it to the
          <b> Claude app</b> for a deep, research-grounded review (progression, volume, imbalances,
          what to change). It uses your Claude subscription — no extra cost, no data leaves your phone
          until you share it.
        </p>
        <ol style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, color: '#4b3c1e' }}>
          <li>Tap <b>Share to Claude</b> (or Copy).</li>
          <li>Paste into a new chat with Claude.</li>
          <li>Apply its suggestions here in Settings.</li>
        </ol>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={share}>📤 Share to Claude</button>
        <button className="btn" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>

      <div className="card">
        <div className="eyebrow">Preview</div>
        <textarea readOnly value={markdown} style={{ height: 320, fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5 }} />
      </div>
    </Screen>
  )
}
