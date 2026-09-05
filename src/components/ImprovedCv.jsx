import { useEffect, useState } from 'react'
import { copyText, countWords, downloadText } from '../lib/export.js'

/** Det omskrivna CV:t, med möjlighet att redigera och att ta det i bruk. */
export default function ImprovedCv({ improvement, onUseAsCv, onDiscard }) {
  const [text, setText] = useState(improvement.improvedCv)
  const [copied, setCopied] = useState(false)
  const [used, setUsed] = useState(false)

  useEffect(() => {
    setText(improvement.improvedCv)
    setUsed(false)
  }, [improvement])

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timer)
  }, [copied])

  const remaining = improvement.placeholders.filter((item) => text.includes(item.marker))

  return (
    <div className="result">
      <section className="panel accent">
        <div className="document-head">
          <div>
            <h3>Omskrivet CV</h3>
            <span className="counter">
              {countWords(text)} ord · {improvement.changes.length} ändringar
            </span>
          </div>
          <div className="document-actions">
            <button type="button" className="ghost" onClick={onDiscard}>
              Kasta
            </button>
            <button
              type="button"
              onClick={async () => {
                if (await copyText(text)) setCopied(true)
              }}
            >
              {copied ? 'Kopierad ✓' : 'Kopiera'}
            </button>
            <button type="button" onClick={() => downloadText('cv-omskrivet.txt', text)}>
              Ladda ner
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                onUseAsCv(text)
                setUsed(true)
              }}
            >
              {used ? 'Använt ✓' : 'Använd som mitt CV'}
            </button>
          </div>
        </div>

        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={22} spellCheck="true" />

        <p className="hint">
          <strong>Använd som mitt CV</strong> ersätter texten i rutan till vänster, så att du kan analysera om och se
          hur poängen förändras.
        </p>
      </section>

      {improvement.placeholders.length > 0 && (
        <section className={`panel placeholders ${remaining.length === 0 ? 'done' : ''}`}>
          <h3>
            Fyll i själv{' '}
            <span className="dim">
              ({improvement.placeholders.length - remaining.length} av {improvement.placeholders.length} klara)
            </span>
          </h3>
          <ul>
            {improvement.placeholders.map((item, i) => (
              <li key={i} className={remaining.includes(item) ? '' : 'done'}>
                <code>{item.marker}</code>
                <span>{item.what}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {improvement.skipped.length > 0 && (
        <section className="panel skipped">
          <h3>Gick inte att genomföra</h3>
          <p className="hint">Uppgifterna saknas i CV:t, och att gissa dem vore att hitta på.</p>
          <ul className="risks">
            {improvement.skipped.map((item, i) => (
              <li key={i}>
                <strong>{item.suggestion}</strong>
                <p className="dim small">{item.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h3>Ändringar</h3>
        <ol className="changes">
          {improvement.changes.map((item, i) => (
            <li key={i}>
              <span className="rationale-req">{item.area}</span>
              <p className="before">{item.before}</p>
              <p className="after">{item.after}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
