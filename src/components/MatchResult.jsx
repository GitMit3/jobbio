import ScoreRing from './ScoreRing.jsx'

const GROUPS = [
  { status: 'uppfylls', title: 'Krav du uppfyller' },
  { status: 'delvis', title: 'Krav du uppfyller delvis' },
  { status: 'saknas', title: 'Krav som saknas' },
]

function Requirement({ item }) {
  return (
    <li className={`requirement status-${item.status}`}>
      <div className="requirement-head">
        <span className="requirement-text">{item.requirement}</span>
        <span className={`tag type-${item.type === 'skallkrav' ? 'must' : 'nice'}`}>{item.type}</span>
      </div>
      {item.evidence && (
        <p className="evidence">
          <span className="muted small">Från ditt CV:</span> {item.evidence}
        </p>
      )}
      {item.comment && <p className="action">{item.comment}</p>}
    </li>
  )
}

export default function MatchResult({ match }) {
  const counts = Object.fromEntries(
    GROUPS.map(({ status }) => [status, match.requirements.filter((item) => item.status === status).length]),
  )

  return (
    <div className="result">
      <section className="card overview">
        <ScoreRing score={match.matchPercent} label="Matchning" />
        <div className="overview-text">
          <h2>
            {match.roleTitle || 'Tjänsten'}
            {match.company && <span className="muted"> · {match.company}</span>}
          </h2>
          <p className={`verdict verdict-${match.verdict.split(' ')[0]}`}>{match.verdict}</p>
          <p>{match.motivation}</p>
        </div>
      </section>

      <section className="card">
        <div className="match-summary">
          {GROUPS.map(({ status, title }) => (
            <div key={status} className={`summary-cell status-${status}`}>
              <strong>{counts[status]}</strong>
              <span>{title.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </section>

      {GROUPS.map(({ status, title }) => {
        const items = match.requirements.filter((item) => item.status === status)
        if (!items.length) return null
        return (
          <section className="card" key={status}>
            <h3>
              {title} <span className="muted">({items.length})</span>
            </h3>
            <ul className="requirements">
              {items.map((item, i) => (
                <Requirement item={item} key={i} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
