export function scoreTone(score) {
  if (score >= 80) return 'good'
  if (score >= 60) return 'ok'
  if (score >= 40) return 'weak'
  return 'bad'
}

export default function ScoreRing({ score, size = 132, label = 'ATS-poäng' }) {
  const stroke = size / 11
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100)

  return (
    <div className={`ring tone-${scoreTone(score)}`} style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${score} av 100`}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-label">
        <strong>{score}</strong>
        <span>/ 100</span>
      </div>
    </div>
  )
}
