import { useId, useState } from 'react'
import { fetchJobAd } from '../lib/api.js'

const MIN_CHARS = 100

export default function JobAdInput({
  jobAdText,
  onJobAdTextChange,
  onMatch,
  isLoading,
  cvReady,
  submitLabel = 'Jämför mot mitt CV',
}) {
  const adId = useId()
  const urlId = useId()
  const [url, setUrl] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [source, setSource] = useState(null) // { title, finalUrl, warning }

  const busy = isLoading || isFetching
  const tooShort = jobAdText.trim().length > 0 && jobAdText.trim().length < MIN_CHARS

  async function handleFetch() {
    if (!url.trim()) return
    setFetchError('')
    setSource(null)
    setIsFetching(true)
    try {
      const result = await fetchJobAd(url.trim())
      onJobAdTextChange(result.text)
      setSource({ title: result.title, finalUrl: result.finalUrl, warning: result.warning })
    } catch (error) {
      setFetchError(error.message)
    } finally {
      setIsFetching(false)
    }
  }

  return (
    <form
      className="panel uploader"
      onSubmit={(event) => {
        event.preventDefault()
        onMatch()
      }}
    >
      <div className="field">
        <label htmlFor={urlId}>Länk till annonsen</label>
        <div className="input-row">
          <input
            id={urlId}
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleFetch()
              }
            }}
            disabled={busy}
          />
          <button type="button" onClick={handleFetch} disabled={busy || !url.trim()}>
            {isFetching ? 'Hämtar…' : 'Hämta'}
          </button>
        </div>
        <p className="hint">
          Fungerar på många jobbsajter, men inte alla – sidor som kräver inloggning eller JavaScript måste klistras in
          för hand.
        </p>
        {fetchError && <p className="hint warn">{fetchError}</p>}
      </div>

      <div className="field">
        <div className="field-head">
          <label htmlFor={adId}>Jobbannonsen</label>
          <span className={`counter ${tooShort ? 'warn' : ''}`}>{jobAdText.trim().length} tecken</span>
        </div>
        <textarea
          id={adId}
          value={jobAdText}
          onChange={(event) => {
            onJobAdTextChange(event.target.value)
            if (source) setSource(null)
          }}
          placeholder="Klistra in hela jobbannonsen här – eller hämta den från en länk ovan."
          rows={16}
          spellCheck="false"
          disabled={busy}
        />

        {tooShort && <p className="hint warn">Minst {MIN_CHARS} tecken behövs för en jämförelse.</p>}

        {source && (
          <div className="source-note">
            <p className="hint">
              Hämtad från <strong>{source.title || source.finalUrl}</strong>. Läs igenom och rensa bort det som inte
              hör till annonsen.
            </p>
            {source.warning && <p className="hint warn">{source.warning}</p>}
          </div>
        )}
      </div>

      <div className="uploader-actions">
        <button type="submit" className="primary" disabled={busy || !cvReady || jobAdText.trim().length < MIN_CHARS}>
          {isLoading ? 'Jämför…' : submitLabel}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            onJobAdTextChange('')
            setSource(null)
            setFetchError('')
          }}
          disabled={busy || !jobAdText}
        >
          Rensa
        </button>
      </div>

      {!cvReady && <p className="hint warn">Lägg in ditt CV under CV-analys först – jämförelsen utgår från det.</p>}
    </form>
  )
}
