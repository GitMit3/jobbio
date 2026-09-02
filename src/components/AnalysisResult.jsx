import ScoreRing, { scoreTone } from './ScoreRing.jsx'

function PriorityTag({ priority }) {
  const key = { hög: 'high', medel: 'mid', låg: 'low' }[priority] || 'mid'
  return <span className={`tag prio-${key}`}>{priority}</span>
}

function Section({ section }) {
  return (
    <article className={`card section tone-${scoreTone(section.score)}`}>
      <header className="section-head">
        <div>
          <h4>{section.name}</h4>
          <p className="muted">{section.verdict}</p>
        </div>
        <div className="section-score">
          <strong>{section.score}</strong>
          <span>/100</span>
        </div>
      </header>

      {!section.present && <p className="pill missing">Saknas i CV:t</p>}

      {section.strengths.length > 0 && (
        <div className="block">
          <h5>Fungerar redan</h5>
          <ul className="checklist">
            {section.strengths.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {section.suggestions.length > 0 && (
        <div className="block">
          <h5>Förbättra</h5>
          <ol className="suggestions">
            {section.suggestions.map((suggestion, i) => (
              <li key={i}>
                <div className="suggestion-head">
                  <span>{suggestion.issue}</span>
                  <PriorityTag priority={suggestion.priority} />
                </div>
                <p className="action">{suggestion.action}</p>
                {suggestion.example && <blockquote>{suggestion.example}</blockquote>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  )
}

export default function AnalysisResult({ analysis, meta }) {
  return (
    <div className="result">
      <section className="card overview">
        <ScoreRing score={analysis.overallScore} />
        <div className="overview-text">
          <h2>Sammanfattning</h2>
          <p>{analysis.summary}</p>
          {meta?.targetRole && (
            <p className="muted small">
              Analyserat mot rollen <strong>{meta.targetRole}</strong>
            </p>
          )}
        </div>
      </section>

      {analysis.topActions.length > 0 && (
        <section className="card">
          <h3>Gör det här först</h3>
          <ol className="top-actions">
            {analysis.topActions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ol>
        </section>
      )}

      <section className="keywords">
        <div className="card">
          <h3>Saknade nyckelord</h3>
          {analysis.missingKeywords.length === 0 ? (
            <p className="muted">Inga viktiga nyckelord saknas.</p>
          ) : (
            <ul className="keyword-list">
              {analysis.missingKeywords.map((item, i) => (
                <li key={i}>
                  <div className="keyword-head">
                    <code>{item.keyword}</code>
                    <PriorityTag priority={item.priority} />
                  </div>
                  <p className="muted small">{item.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3>Nyckelord du redan har</h3>
          {analysis.presentKeywords.length === 0 ? (
            <p className="muted">Inga tydliga nyckelord hittades.</p>
          ) : (
            <div className="chips">
              {analysis.presentKeywords.map((word, i) => (
                <span className="chip" key={i}>
                  {word}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {analysis.atsRisks.length > 0 && (
        <section className="card">
          <h3>Risker vid ATS-läsning</h3>
          <ul className="risks">
            {analysis.atsRisks.map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="sections-title">Sektion för sektion</h3>
        <div className="sections">
          {analysis.sections.map((section, i) => (
            <Section key={i} section={section} />
          ))}
        </div>
      </section>
    </div>
  )
}
