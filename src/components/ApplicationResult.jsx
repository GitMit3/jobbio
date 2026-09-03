import { useEffect, useState } from 'react'
import { applicationFileName, renderCoverLetter, renderCvExcerpt } from '../../shared/application.js'
import { copyText, countWords, downloadText } from '../lib/export.js'

function initialDocs(application) {
  return { cv: renderCvExcerpt(application), letter: renderCoverLetter(application) }
}

function Document({ title, value, original, filename, rows, onChange, onReset }) {
  const [copied, setCopied] = useState(false)
  const edited = value !== original

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <section className="panel document">
      <header className="document-head">
        <div>
          <h3>{title}</h3>
          <span className="counter">
            {countWords(value)} ord{edited ? ' · redigerad' : ''}
          </span>
        </div>
        <div className="document-actions">
          {edited && (
            <button type="button" className="ghost" onClick={onReset}>
              Återställ
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              if (await copyText(value)) setCopied(true)
            }}
          >
            {copied ? 'Kopierad ✓' : 'Kopiera'}
          </button>
          <button type="button" onClick={() => downloadText(filename, value)}>
            Ladda ner
          </button>
        </div>
      </header>

      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} spellCheck="true" />
    </section>
  )
}

export default function ApplicationResult({ application }) {
  const [docs, setDocs] = useState(() => initialDocs(application))
  const original = initialDocs(application)

  // Ny ansökan → börja om från den genererade texten.
  useEffect(() => setDocs(initialDocs(application)), [application])

  const remaining = application.placeholders.filter(
    (item) => docs.cv.includes(item.marker) || docs.letter.includes(item.marker),
  )

  return (
    <div className="result">
      <section className="panel accent application-head">
        <div>
          <h2>
            {application.roleTitle || 'Ansökan'}
            {application.company && <span className="dim"> · {application.company}</span>}
          </h2>
          <p className="dim">
            Läs igenom och redigera innan du skickar. Texterna bygger bara på det som står i ditt CV.
          </p>
        </div>
      </section>

      {application.placeholders.length > 0 && (
        <section className={`panel placeholders ${remaining.length === 0 ? 'done' : ''}`}>
          <h3>
            Fyll i själv{' '}
            <span className="dim">
              ({application.placeholders.length - remaining.length} av {application.placeholders.length} klara)
            </span>
          </h3>
          <ul>
            {application.placeholders.map((item, i) => {
              const isDone = !remaining.includes(item)
              return (
                <li key={i} className={isDone ? 'done' : ''}>
                  <code>{item.marker}</code>
                  <span>{item.what}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <Document
        title="Anpassat CV-utdrag"
        value={docs.cv}
        original={original.cv}
        filename={applicationFileName(application, 'cv-utdrag')}
        rows={14}
        onChange={(cv) => setDocs((previous) => ({ ...previous, cv }))}
        onReset={() => setDocs((previous) => ({ ...previous, cv: original.cv }))}
      />

      <Document
        title="Personligt brev"
        value={docs.letter}
        original={original.letter}
        filename={applicationFileName(application, 'personligt-brev')}
        rows={18}
        onChange={(letter) => setDocs((previous) => ({ ...previous, letter }))}
        onReset={() => setDocs((previous) => ({ ...previous, letter: original.letter }))}
      />

      <section className="panel">
        <h3>Så här är den anpassad</h3>
        <ol className="rationale">
          {application.cvBullets.map((item, i) => (
            <li key={i}>
              <span className="rationale-req">{item.requirement}</span>
              <p className="action">{item.rewritten}</p>
              <p className="dim small">Bygger på: {item.basis}</p>
            </li>
          ))}
        </ol>

        {application.keywordsUsed.length > 0 && (
          <div className="block">
            <h5>Nyckelord ur annonsen som vävts in</h5>
            <div className="chips">
              {application.keywordsUsed.map((word, i) => (
                <span className="chip" key={i}>
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
