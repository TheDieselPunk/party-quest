import type { Character, CompletedSession, Profile } from '../domain/types'
import { ALL_MUSCLES, MUSCLE_LABEL, ALL_ATTRIBUTES, ATTRIBUTE_LABEL } from '../domain/types'
import { weeklyVolumeTargets, volumeFromSessions, recentSessions, planWeek, runPhase, ruckPhase } from '../engine'
import { levelFromXp, characterLevel } from '../rpg/character'
import { splitDays } from '../engine'
import { enabledObjectives, weeksUntil, effectiveTargetDate, OBJECTIVE_META } from '../domain/objectives'
import { EXERCISES_BY_ID } from '../data/exercises'

// ---------------------------------------------------------------------------
// Builds the "Adventurer's Log": a structured Markdown summary the user hands
// to Claude (phone app or a Claude Code session) for a deep, research-grounded
// review — no in-app API calls, so it stays within the Pro subscription.
// ---------------------------------------------------------------------------

const GOAL_LABEL: Record<string, string> = {
  strength: 'Gain Strength', muscle: 'Build Muscle', fatloss: 'Fat Loss', other: 'Other',
}

function fmtSet(reps: number, load: number | null, rir: number | null): string {
  const w = load == null ? 'BW' : `${load}`
  const r = rir == null ? '' : ` @${rir}RIR`
  return `${w}×${reps}${r}`
}

function dateStr(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

export function buildCoachExport(
  profile: Profile,
  character: Character,
  sessions: CompletedSession[],
  now = Date.now(),
): string {
  const targets = weeklyVolumeTargets(profile)
  const last7 = recentSessions(sessions, 7, now)
  const actual = volumeFromSessions(last7)
  const days = splitDays(profile)
  const nextDay = days[((profile.dayIndex % days.length) + days.length) % days.length]

  const lines: string[] = []

  lines.push('# Adventurer\'s Log — Coaching Review Request', '')
  lines.push(
    '> **For Claude:** Act as a strength & conditioning coach grounded in current sports-medicine ' +
    'research (training volume, weekly frequency, progressive overload, exercise selection/variety, ' +
    'exercise order, rep ranges, and rest). Review the log below and give specific, actionable ' +
    'adjustments: is weekly volume per muscle in a productive range for the goal and experience? Is ' +
    'each muscle trained often enough? Are the lifts progressing (or stalling)? Any imbalances, ' +
    'recovery red flags, or exercise swaps you\'d recommend? Also weigh in on the **Objectives** below ' +
    '(posture, running, load-carriage): is the concurrent training sensibly balanced, are the runs and ' +
    'loaded walks progressing appropriately toward their dates, and is anything over- or under-cooked? ' +
    'Keep it concrete.', '',
  )

  // --- Profile -------------------------------------------------------------
  lines.push('## Profile', '')
  lines.push(`- **Adventurer:** ${profile.name} (${profile.characterName}) — Character Level ${characterLevel(character)}`)
  lines.push(`- **Goal:** ${GOAL_LABEL[profile.goal]}${profile.goal === 'other' && profile.goalOther ? ` — ${profile.goalOther}` : ''}`)
  lines.push(`- **Experience:** ${profile.experience}`)
  lines.push(`- **Frequency:** ${profile.frequency}×/week · **Session length:** ${profile.sessionMinutes} min`)
  lines.push(`- **Focus:** ${profile.focus ?? 'balanced'} · **Location:** ${profile.location}`)
  lines.push(`- **Effort target:** ~${profile.rirTarget} reps in reserve · **Deload:** every ${profile.deloadWeeks || '—'} weeks`)
  if (profile.avoidMuscles.length) lines.push(`- **Avoiding:** ${profile.avoidMuscles.join(', ')}`)
  lines.push('')

  // --- Weekly volume -------------------------------------------------------
  lines.push('## Weekly volume per muscle (last 7 days)', '')
  lines.push('Sets counted as primary = 1, secondary = 0.5.', '')
  lines.push('| Muscle | Actual | Target |', '|---|---|---|')
  for (const m of ALL_MUSCLES) {
    if (targets[m] === 0 && actual[m] === 0) continue
    lines.push(`| ${MUSCLE_LABEL[m]} | ${actual[m]} | ${targets[m]} |`)
  }
  lines.push('')

  // --- Adherence -----------------------------------------------------------
  lines.push('## Adherence', '')
  lines.push(`- Sessions in last 7 days: **${last7.length}** (target ${profile.frequency})`)
  lines.push(`- Total sessions logged: **${character.totalSessions}** · Current streak: **${character.streak}**`)
  lines.push(`- Next scheduled day: **${nextDay.label}**`)
  lines.push('')

  // --- Objectives & weekly plan --------------------------------------------
  const objectives = enabledObjectives(profile)
  if (objectives.length) {
    lines.push('## Objectives (concurrent goals)', '')
    for (const o of objectives) {
      const meta = OBJECTIVE_META[o.kind]
      if (o.kind === 'posture') {
        lines.push(`- ${meta.icon} **Posture** — daily Desk Reset ${o.dailyReset ? 'on' : 'off'}; gym sessions biased toward pulling, rotator-cuff and thoracic work.`)
      } else if (o.kind === 'run-event') {
        const w = weeksUntil(o.targetDate, now)
        lines.push(`- ${meta.icon} **${o.distanceKm}K run** — ${dateStr(o.targetDate)} (${w} weeks out) · phase **${runPhase(o, now)}** · can jog ~${o.baselineRunMinutes} min non-stop now · ${o.daysPerWeek} run days/wk.`)
      } else if (o.kind === 'load-carriage') {
        const td = effectiveTargetDate(o, now)
        const w = weeksUntil(td, now)
        lines.push(`- ${meta.icon} **${o.eventName}** (load carriage) — ${dateStr(td)} (${w} weeks out) · phase **${ruckPhase(o, now)}** · target pack ${o.packLoadLb} lb · ${o.daysOnFeet} days on feet${o.recurringAnnual ? ' · annual' : ''}.`)
      }
    }
    lines.push('')

    const week = planWeek(profile, now)
    lines.push('## This week’s plan', '')
    for (const d of week.days) {
      const label = d.isToday ? 'Today' : d.weekday
      const items = d.sessions
        .map((s) => `${s.title}${s.kind !== 'gym' && s.kind !== 'rest' ? ` (${s.estMinutes}m)` : ''}`)
        .join(', ')
      lines.push(`- **${label}:** ${items}`)
    }
    lines.push('')
  }

  // --- Attributes ----------------------------------------------------------
  lines.push('## Character attributes (muscle-region development)', '')
  lines.push('| Attribute | Level |', '|---|---|')
  for (const a of ALL_ATTRIBUTES) {
    lines.push(`| ${ATTRIBUTE_LABEL[a]} | ${levelFromXp(character.xp[a])} |`)
  }
  lines.push('')

  // --- Recent sessions -----------------------------------------------------
  lines.push('## Recent sessions', '')
  const recent = [...sessions].sort((a, b) => b.date - a.date).slice(0, 6)
  if (!recent.length) lines.push('_No sessions logged yet._', '')
  for (const s of recent) {
    lines.push(`### ${dateStr(s.date)} — ${s.title}`)
    if (s.type && s.type !== 'gym') {
      lines.push(`- _${s.type} session · ${Math.round((s.durationSeconds ?? 0) / 60)} min_`)
      lines.push('')
      continue
    }
    for (const ex of s.exercises) {
      const working = ex.sets.filter((set) => set.done && !set.warmup)
      if (!working.length) continue
      const setStr = working.map((set) => fmtSet(set.reps, set.load, set.rir)).join(', ')
      lines.push(`- **${ex.name}:** ${setStr}`)
    }
    lines.push('')
  }

  // --- Personal records ----------------------------------------------------
  const bests = Object.entries(character.bests)
  if (bests.length) {
    lines.push('## Best estimated 1RMs', '')
    lines.push('| Exercise | Best (load×reps) | est. 1RM |', '|---|---|---|')
    for (const [exId, b] of bests.sort((a, c) => c[1].est1rm - a[1].est1rm).slice(0, 12)) {
      const name = EXERCISES_BY_ID[exId]?.name ?? exId
      lines.push(`| ${name} | ${b.load}×${b.reps} | ${Math.round(b.est1rm)} |`)
    }
    lines.push('')
  }

  lines.push('---', `_Generated by Party Quest on ${dateStr(now)} · units: ${profile.units}_`)
  return lines.join('\n')
}
