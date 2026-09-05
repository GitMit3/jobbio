import ScoreMeter, { scoreLabel, scoreTone } from './ScoreMeter.jsx'
import { selectableItems, suggestionId } from '../lib/suggestions.js'

/** Kryssruta för ett förslag. Utan urvalsstöd renderas bara innehållet. */
function Selectable({ id, selected, onToggle, children }) {
  if (!onToggle) return children
  return (
    <label className={`selectable ${selected.has(id) ? 'picked' : ''}`}>
      <input type="checkbox" checked={selected.has(id)} onChange={() => onToggle(id)} />
      <span className="selectable-body">{children}</span>
    </label>
  )
}

function PriorityTag({ priority }) {
  const key = { hög: 'high', medel: 'mid', låg: 'low' }[priority] || 'mid'
  return <span className={`tag prio-${key}`}>{priority}</span>
}

function Section({ section, number, sectionIndex, selected, onToggle }) {
  return (
    <article className={`panel section tone-${scoreTone(section.score)}`}>
      <header className="section-head">
        <div className="section-title">
          <span className="section-index">{String(number).padStart(2, '0')}</span>
          <div>
            <h4>{section.name}</h4>
            <p className="dim">{section.verdict}</p>
          </div>
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
                <Selectable id={suggestionId('fix', sectionIndex, i)} selected={selected} onToggle={onToggle}>
                  <div className="suggestion-head">
                    <span>{suggestion.issue}</span>
                    <PriorityTag priority={suggestion.priority} />
                  </div>
                  <p className="action">{suggestion.action}</p>
                  {suggestion.example && <blockquote>{suggestion.example}</blockquote>}
                </Selectable>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  )
}

export default function AnalysisResult({ analysis, meta, selected, onToggle, onToggleAll, onImprove, isImproving }) {
  const canSelect = Boolean(onToggle)
  const total = canSelect ? selectableItems(analysis).length : 0
  const picked = canSelect ? selected.size : 0

  return (
    <div className="result">
      {canSelect && (
        <section className="panel improve-bar">
          <div>
            <h3>Åtgärda förslagen</h3>
            <p className="hint">
              Kryssa i det du vill genomföra, så skrivs CV:t om. Inget hittas på – saknas en uppgift sätts en
              platshållare.
            </p>
          </div>
          <div className="improve-actions">
            <span className="counter">
              {picked} av {total} valda
            </span>
            <button type="button" className="ghost" onClick={onToggleAll} disabled={isImproving}>
              {picked === total ? 'Avmarkera alla' : 'Välj alla'}
            </button>
            <button type="button" className="primary" onClick={onImprove} disabled={isImproving || picked === 0}>
              {isImproving ? 'Skriver om…' : `Åtgärda ${picked || ''}`.trim()}
            </button>
          </div>
        </section>
      )}
      <section className="panel overview">
        <ScoreMeter
          score={analysis.overallScore}
          label="ATS-poäng"
          caption={meta?.targetRole ? `mot ${meta.targetRole}` : ''}
        />
        <div className="overview-text">
          <span className={`verdict tone-${scoreTone(analysis.overallScore)}`}>{scoreLabel(analysis.overallScore)}</span>
          <h2>Sammanfattning</h2>
          <p>{analysis.summary}</p>
        </div>
      </section>

      {analysis.topActions.length > 0 && (
        <section className="panel accent">
          <h3>Gör det här först</h3>
          <ol className="top-actions">
            {analysis.topActions.map((action, i) => (
              <li key={i}>
                <Selectable id={suggestionId('action', i)} selected={selected} onToggle={onToggle}>
                  {action}
                </Selectable>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="keywords">
        <div className="panel">
          <h3>Saknade nyckelord</h3>
          {analysis.missingKeywords.length === 0 ? (
            <p className="dim">Inga viktiga nyckelord saknas.</p>
          ) : (
            <ul className="keyword-list">
              {analysis.missingKeywords.map((item, i) => (
                <li key={i}>
                  <Selectable id={suggestionId('keyword', i)} selected={selected} onToggle={onToggle}>
                    <div className="keyword-head">
                      <code>{item.keyword}</code>
                      <PriorityTag priority={item.priority} />
                    </div>
                    <p className="dim small">{item.reason}</p>
                  </Selectable>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <h3>Nyckelord du redan har</h3>
          {analysis.presentKeywords.length === 0 ? (
            <p className="dim">Inga tydliga nyckelord hittades.</p>
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
        <section className="panel">
          <h3>Risker vid ATS-läsning</h3>
          <ul className="risks">
            {analysis.atsRisks.map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="group-title">Sektion för sektion</h3>
        <div className="sections">
          {analysis.sections.map((section, i) => (
            <Section
              section={section}
              number={i + 1}
              sectionIndex={i}
              selected={selected}
              onToggle={onToggle}
              key={i}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
