import ScoreMeter from './ScoreMeter.jsx'

const GROUPS = [
  { status: 'uppfylls', title: 'Krav du uppfyller', short: 'uppfylls' },
  { status: 'delvis', title: 'Krav du uppfyller delvis', short: 'delvis' },
  { status: 'saknas', title: 'Krav som saknas', short: 'saknas' },
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
          <span className="evidence-label">Ur ditt CV</span>
          {item.evidence}
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
      <section className="panel overview">
        <ScoreMeter score={match.matchPercent} label="Matchning" />
        <div className="overview-text">
          <span className={`verdict verdict-${match.verdict.split(' ')[0]}`}>{match.verdict}</span>
          <h2>
            {match.roleTitle || 'Tjänsten'}
            {match.company && <span className="dim"> · {match.company}</span>}
          </h2>
          <p>{match.motivation}</p>
        </div>
      </section>

      <section className="panel match-summary">
        {GROUPS.map(({ status, short }) => (
          <div key={status} className={`summary-cell status-${status}`}>
            <strong>{counts[status]}</strong>
            <span>{short}</span>
          </div>
        ))}
      </section>

      {GROUPS.map(({ status, title }) => {
        const items = match.requirements.filter((item) => item.status === status)
        if (!items.length) return null
        return (
          <section className={`panel requirement-group status-${status}`} key={status}>
            <h3>
              {title} <span className="dim">({items.length})</span>
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
