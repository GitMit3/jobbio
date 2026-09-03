import { useEffect, useState } from 'react'

/**
 * Tre steg: kopiera prompten, kör den i Claude, klistra tillbaka svaret.
 * Samma modell som API-läget använder – skillnaden är bara vem som skickar.
 */
export default function ManualRunner({ prompt, error, onSubmit, onCancel }) {
  const [response, setResponse] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timer)
  }, [copied])

  async function copyPrompt() {
    setCopyFailed(false)
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <div className="panel manual">
      <div className="manual-head">
        <h3>Kör prompten i Claude</h3>
        <button type="button" className="ghost" onClick={onCancel}>
          Avbryt
        </button>
      </div>

      <ol className="manual-steps">
        <li>
          <div className="step-row">
            <span>Kopiera prompten.</span>
            <button type="button" className="primary" onClick={copyPrompt}>
              {copied ? 'Kopierad ✓' : 'Kopiera prompt'}
            </button>
          </div>
          {copyFailed && (
            <p className="hint warn">
              Webbläsaren nekade kopiering. Markera texten nedan och kopiera med Ctrl+C i stället.
            </p>
          )}
          <details>
            <summary>Visa prompten ({prompt.length.toLocaleString('sv-SE')} tecken)</summary>
            <textarea className="prompt-preview" value={prompt} readOnly rows={10} spellCheck="false" />
          </details>
        </li>

        <li>
          Klistra in den i{' '}
          <a href="https://claude.ai/new" target="_blank" rel="noreferrer">
            Claude.ai
          </a>{' '}
          eller Claude Code och skicka. Svaret ska vara ett JSON-objekt.
        </li>

        <li>
          Kopiera hela svaret och klistra in det här:
          <textarea
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            placeholder={'{\n  "overallScore": …\n}'}
            rows={6}
            spellCheck="false"
          />
        </li>
      </ol>

      {error && <p className="hint warn">{error}</p>}

      <button type="button" className="primary" disabled={!response.trim()} onClick={() => onSubmit(response)}>
        Visa resultatet
      </button>
    </div>
  )
}
