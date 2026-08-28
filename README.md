# ⚔ Party Quest

An RPG-themed, equipment-tailored, AI-coached personal training app for David & his wife.
It hands you a ready-to-do workout with prescribed sets, reps, rest, and **recommended weights** —
but it only knows *your* apartment-gym equipment, and it wraps the whole thing in an
adventuring-party game where PRs are level-ups.

Installable web app (PWA) for Android **and** iPhone. Local-first: each phone holds its own
self-contained profiles, works offline in the gym.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (Vitest)
npm run build      # type-check + production build
```

## How the "AI coach" works (Claude Pro only)

The app makes **no** paid API calls. Instead, the **Coach** screen builds an *Adventurer's Log*
(Markdown) summarising your training — settings, weekly volume per muscle, adherence, recent
sessions, PRs — with a coaching prompt on top. You **Share it to the Claude app** (or a Claude Code
session) for a deep, research-grounded review. Zero extra cost; it uses your Pro subscription.

---

## Architecture

| Layer | Where | What |
|---|---|---|
| **Domain** | `src/domain` | Types, profile defaults, active-workout shape |
| **Data** | `src/data` | Curated **equipment catalog** (machine modes/setup) + **exercise library** |
| **Engine** | `src/engine` | Pure, deterministic, unit-tested workout generator |
| **RPG** | `src/rpg` | XP → attributes (mapped to muscles), levels, PR detection |
| **DB** | `src/db` | Dexie (IndexedDB) + repository actions |
| **Coach** | `src/coach` | Adventurer's Log Markdown export |
| **UI** | `src/ui` | React screens (mobile-first, fantasy theme) |

### The engine (`src/engine`) — encodes the sports-medicine rules

1. **Volume** — weekly sets/muscle by experience × goal × focus (`volume.ts`, `params.ts`).
2. **Split** — full-body / upper-lower / PPL by frequency, each muscle ≥2×/week (`templates.ts`).
3. **Selection** — movement-pattern slots with week-to-week variety, mapped to available equipment.
4. **Prescription** — rep ranges & rest by goal × exercise class (`params.ts`).
5. **Ordering** — hardest → easiest.
6. **Supersets** — same-machine pairs (occupy a dual Hoist/Matrix unit once) always on;
   antagonist cross-machine pairs only when "not busy".
7. **Time-fit** — trims/*shaves* to hit the 40/60/80-minute target without starving any muscle.
8. **Weights** — double progression from history + first-time calibration, snapped to your exact
   dumbbell/stack/Smith increments (`weight.ts`).
9. **Alternatives** — every exercise carries fallbacks for when a machine is taken.

Each parameter cites the reference it came from (see comments in `params.ts` / `volume.ts`).

### Equipment (`src/data/equipment.ts`)

The tailoring core. Each machine lists its **modes/stations** and **setup notes** ("what mode to
use"), plus load increments. Two locations: `gym` (apartment gym) and `studio` (home studio).

---

## RPG layer

Six attributes map to muscle regions, so balanced training levels you evenly and a lagging muscle
shows as a weak stat:

- **Might** (push: chest/shoulders/triceps) · **Power** (pull: back/biceps) ·
  **Foundation** (legs) · **Core** · **Grit** (conditioning + volume) · **Vitality** (consistency)

A **PR** (more weight or reps than before) fires a **Level Up!** — the progressive-overload
principle as the core game reward. Character level = sum of attribute levels.

---

## Roadmap

**MVP (done):** onboarding, equipment-tailored engine, in-gym player (mode instructions, rest
timer, supersets, machine-busy swaps), history, RPG progression, coach export, installable PWA.

**Phase 2:**
- **Supabase** backend → cloud backup, logins, and **live cross-device party** (see each other's
  characters/quests from your own phones).
- Proper PNG PWA icons + store-quality install polish.
- Exercise GIFs/thumbnails (from the `hasaneyldrm/exercises-dataset`, filtered to your equipment).
- Deload automation, richer analytics, notifications.
- Coach round-trip: apply Claude's suggestions back into settings automatically.

## Deploy (Phase 2 / when ready)

Static PWA → Cloudflare Pages or Vercel (free). Add `icon-192.png` / `icon-512.png` to `public/`
first (referenced by the manifest in `vite.config.ts`). Build with `npm run build`, deploy `dist/`.
