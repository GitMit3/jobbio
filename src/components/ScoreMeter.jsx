const SEGMENTS = 20

export function scoreTone(score) {
  if (score >= 80) return 'good'
  if (score >= 60) return 'ok'
  if (score >= 40) return 'weak'
  return 'bad'
}

export function scoreLabel(score) {
  if (score >= 80) return 'Stark'
  if (score >= 60) return 'Godkänd'
  if (score >= 40) return 'Svag'
  return 'Kritisk'
}

/**
 * Poängen som ett randmått: siffran bär värdet, ränderna gör det avläsbart på
 * en halv sekund. Varje rand är fem poäng.
 */
export default function ScoreMeter({ score, label, caption }) {
  const value = Math.max(0, Math.min(100, score))
  const filled = Math.round((value / 100) * SEGMENTS)

  return (
    <div className={`meter tone-${scoreTone(value)}`}>
      <div className="meter-value">
        <span className="meter-number">{value}</span>
        <span className="meter-max">/100</span>
      </div>

      <div className="meter-bars" role="img" aria-label={`${label}: ${value} av 100`}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className={i < filled ? 'on' : ''} />
        ))}
      </div>

      <div className="meter-foot">
        <span className="meter-label">{label}</span>
        {caption && <span className="meter-caption">{caption}</span>}
      </div>
    </div>
  )
}
