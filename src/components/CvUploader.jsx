import { useId, useRef, useState } from 'react'
import { ACCEPTED_FILE_TYPES, ACCEPTED_LABEL, ExtractError, extractTextFromFile } from '../lib/extractText.js'

const MIN_CHARS = 200

export default function CvUploader({
  cvText,
  onCvTextChange,
  targetRole,
  onTargetRoleChange,
  onAnalyze,
  onLoadSample,
  isLoading,
  submitLabel = 'Analysera CV',
}) {
  const cvId = useId()
  const roleId = useId()
  const fileInput = useRef(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [fileError, setFileError] = useState('')
  const [source, setSource] = useState(null) // { name, warnings }

  const busy = isLoading || isExtracting
  const tooShort = cvText.trim().length > 0 && cvText.trim().length < MIN_CHARS

  function reset() {
    setFileError('')
    setSource(null)
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // så att samma fil kan väljas igen
    if (!file) return

    reset()
    setIsExtracting(true)
    try {
      const { text, warnings } = await extractTextFromFile(file)
      onCvTextChange(text)
      setSource({ name: file.name, warnings })
    } catch (error) {
      setFileError(
        error instanceof ExtractError
          ? error.message
          : 'Filen kunde inte läsas. Klistra in texten manuellt istället.',
      )
    } finally {
      setIsExtracting(false)
    }
  }

  return (
    <form
      className="panel uploader"
      onSubmit={(event) => {
        event.preventDefault()
        onAnalyze()
      }}
    >
      <div className="field">
        <label htmlFor={roleId}>
          Målroll <span className="muted">(valfritt)</span>
        </label>
        <input
          id={roleId}
          type="text"
          placeholder="t.ex. Frontendutvecklare, HR-specialist, projektledare"
          value={targetRole}
          maxLength={200}
          onChange={(event) => onTargetRoleChange(event.target.value)}
          disabled={busy}
        />
        <p className="hint">Anges den, matchas nyckelorden mot den rollen. Annars gissar analysen utifrån CV:t.</p>
      </div>

      <div className="field">
        <div className="field-head">
          <label htmlFor={cvId}>Ditt CV</label>
          <span className={`counter ${tooShort ? 'warn' : ''}`}>{cvText.trim().length} tecken</span>
        </div>
        <textarea
          id={cvId}
          value={cvText}
          onChange={(event) => {
            onCvTextChange(event.target.value)
            if (source) setSource(null)
          }}
          placeholder={`Klistra in ditt CV som text här – eller ladda upp ${ACCEPTED_LABEL}.`}
          rows={18}
          spellCheck="false"
          disabled={busy}
        />

        {isExtracting && <p className="hint">Läser filen…</p>}
        {tooShort && <p className="hint warn">Minst {MIN_CHARS} tecken behövs för en meningsfull analys.</p>}
        {fileError && <p className="hint warn">{fileError}</p>}

        {source && (
          <div className="source-note">
            <p className="hint">
              Text hämtad från <strong>{source.name}</strong>. Läs igenom och rätta innan du analyserar – formatering
              går alltid förlorad vid textutvinning.
            </p>
            {source.warnings.map((warning, i) => (
              <p className="hint warn" key={i}>
                {warning}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="uploader-actions">
        <button type="submit" className="primary" disabled={busy || cvText.trim().length < MIN_CHARS}>
          {isLoading ? 'Analyserar…' : submitLabel}
        </button>

        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFile}
          hidden
          aria-hidden="true"
          tabIndex={-1}
        />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
          {isExtracting ? 'Läser…' : 'Ladda upp fil'}
        </button>
        <button type="button" onClick={onLoadSample} disabled={busy}>
          Exempel-CV
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            onCvTextChange('')
            reset()
          }}
          disabled={busy || !cvText}
        >
          Rensa
        </button>
      </div>

      <p className="hint muted">Stöder {ACCEPTED_LABEL}. Filen läses i webbläsaren och laddas aldrig upp.</p>
    </form>
  )
}
