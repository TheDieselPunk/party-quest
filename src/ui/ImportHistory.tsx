import { useState, type ChangeEvent } from 'react'
import type { Profile } from '../domain/types'
import { importFromCsv, type ImportResult } from '../importer/import'
import { importSessions } from '../db/repo'
import { characterLevel } from '../rpg/character'

function dateRange(res: ImportResult): string {
  const dates = res.sessions.map((s) => s.date).sort((a, b) => a - b)
  if (!dates.length) return ''
  const f = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${f(dates[0])} → ${f(dates[dates.length - 1])}`
}

export function ImportHistory({ profile }: { profile: Profile }) {
  const [parsed, setParsed] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ added: number; skipped: number; level: number; suggestsStrength: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr(null); setDone(null); setParsed(null)
    try {
      const text = await file.text()
      const res = importFromCsv(text, profile)
      if (!res.sessions.length) { setErr('No workouts found in that file.'); return }
      setParsed(res)
    } catch {
      setErr('Could not read that file.')
    }
  }

  async function doImport() {
    if (!parsed) return
    setBusy(true)
    const r = await importSessions(profile, parsed.sessions)
    setDone({ added: r.added, skipped: r.skipped, level: characterLevel(r.character), suggestsStrength: parsed.suggestsStrength })
    setParsed(null)
    setBusy(false)
  }

  return (
    <div className="card center-col" style={{ marginTop: 12 }}>
      <div className="eyebrow">Import history</div>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Coming from another workout app? Import its <b>CSV export</b> to bring your history over —
        your progression and character level carry forward.
      </p>

      <label className="btn btn-sm" style={{ alignSelf: 'flex-start' }}>
        Choose CSV file…
        <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} style={{ display: 'none' }} />
      </label>

      {err && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</div>}

      {parsed && (
        <div style={{ background: '#0000002e', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{parsed.sessions.length} workouts found</div>
          <div className="muted" style={{ fontSize: 12 }}>{dateRange(parsed)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {parsed.recognized} exercises matched to your gym
            {parsed.unrecognizedNames.length > 0 && ` · ${parsed.unrecognizedNames.length} logged as-is (${parsed.unrecognizedNames.slice(0, 4).join(', ')}${parsed.unrecognizedNames.length > 4 ? '…' : ''})`}
          </div>
          <button className="btn btn-primary btn-sm btn-block" style={{ marginTop: 10 }} disabled={busy} onClick={doImport}>
            {busy ? 'Importing…' : `Import ${parsed.sessions.length} workouts`}
          </button>
        </div>
      )}

      {done && (
        <div style={{ background: '#0000002e', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--moss)' }}>✓ Imported {done.added} workouts</div>
          {done.skipped > 0 && <div className="muted" style={{ fontSize: 12 }}>{done.skipped} already-imported skipped</div>}
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Your character is now <b>Level {done.level}</b>, and your next workout will use this history for weight recommendations.
          </div>
          {done.suggestsStrength && profile.goal !== 'strength' && (
            <div style={{ fontSize: 12, marginTop: 8, background: '#00000030', borderRadius: 8, padding: '8px 10px', borderLeft: '3px solid var(--gold)' }}>
              💡 Your logged workouts lean on <b>low-rep (≈6) compound work</b> — set your <b>Goal</b> to
              <b> Gain Strength</b> above to match that style (heavier loads, lower reps, longer rest).
            </div>
          )}
        </div>
      )}
    </div>
  )
}
