import { useId, useRef, useState } from 'react'

const ACCEPTED = '.txt,.md,.markdown,text/plain'
const MIN_CHARS = 200

export default function CvUploader({
  cvText,
  onCvTextChange,
  targetRole,
  onTargetRoleChange,
  onAnalyze,
  onLoadSample,
  isLoading,
}) {
  const cvId = useId()
  const roleId = useId()
  const fileInput = useRef(null)
  const [fileError, setFileError] = useState('')

  const tooShort = cvText.trim().length > 0 && cvText.trim().length < MIN_CHARS

  async function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setFileError('')
    try {
      const text = await file.text()
      if (!text.trim()) {
        setFileError('Filen verkar vara tom.')
        return
      }
      onCvTextChange(text)
    } catch {
      setFileError('Kunde inte läsa filen. Prova att klistra in texten istället.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <form
      className="card uploader"
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
          disabled={isLoading}
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
          onChange={(event) => onCvTextChange(event.target.value)}
          placeholder="Klistra in hela ditt CV som text här…"
          rows={18}
          spellCheck="false"
          disabled={isLoading}
        />
        {tooShort && <p className="hint warn">Minst {MIN_CHARS} tecken behövs för en meningsfull analys.</p>}
        {fileError && <p className="hint warn">{fileError}</p>}
      </div>

      <div className="uploader-actions">
        <button type="submit" className="primary" disabled={isLoading || cvText.trim().length < MIN_CHARS}>
          {isLoading ? 'Analyserar…' : 'Analysera CV'}
        </button>

        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED}
          onChange={handleFile}
          hidden
          aria-hidden="true"
          tabIndex={-1}
        />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={isLoading}>
          Ladda upp .txt
        </button>
        <button type="button" onClick={onLoadSample} disabled={isLoading}>
          Exempel-CV
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => onCvTextChange('')}
          disabled={isLoading || !cvText}
        >
          Rensa
        </button>
      </div>
    </form>
  )
}
