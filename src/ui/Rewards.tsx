import { ATTRIBUTE_LABEL } from '../domain/types'
import type { SessionRewards } from '../rpg/character'

export function RewardsModal({ rewards, onClose }: { rewards: SessionRewards; onClose: () => void }) {
  const { prs, levelUps, totalXp } = rewards
  return (
    <div className="toast-wrap" style={{ background: '#0009', pointerEvents: 'auto' }}>
      <div className="levelup" style={{ maxWidth: 380, width: '100%' }}>
        <div style={{ fontSize: 40 }}>🏆</div>
        <h2 style={{ margin: '4px 0 2px', color: 'var(--gold-soft)' }}>Quest Complete!</h2>
        <div className="muted" style={{ fontSize: 13 }}>+{totalXp} XP earned</div>

        {levelUps.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="eyebrow">Level Up</div>
            {levelUps.map((lu) => (
              <div key={lu.attribute} style={{ fontSize: 15, fontWeight: 700 }}>
                {ATTRIBUTE_LABEL[lu.attribute]} → Lv {lu.to} <span style={{ color: 'var(--moss)' }}>▲</span>
              </div>
            ))}
          </div>
        )}

        {prs.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="eyebrow">New Records</div>
            {prs.map((pr) => (
              <div key={pr.exerciseId} style={{ fontSize: 14 }}>
                ⭐ {pr.name} <span className="muted">(est. 1RM {Math.round(pr.prevEst)} → {Math.round(pr.newEst)})</span>
              </div>
            ))}
          </div>
        )}

        {levelUps.length === 0 && prs.length === 0 && (
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Solid work — every logged set builds your legend.</p>
        )}

        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} onClick={onClose}>Claim rewards</button>
      </div>
    </div>
  )
}
