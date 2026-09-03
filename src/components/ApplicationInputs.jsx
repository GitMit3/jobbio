const CHECK = '✓'

function Source({ label, ready, detail, missingHint, onGoFix }) {
  return (
    <li className={`source ${ready ? 'ready' : 'missing'}`}>
      <span className="source-mark" aria-hidden="true">
        {ready ? CHECK : '!'}
      </span>
      <div>
        <span className="source-label">{label}</span>
        <p className="hint">{ready ? detail : missingHint}</p>
        {!ready && (
          <button type="button" className="ghost" onClick={onGoFix}>
            Gå dit
          </button>
        )}
      </div>
    </li>
  )
}

export default function ApplicationInputs({
  cvText,
  jobAdText,
  cvReady,
  adReady,
  onGoToCv,
  onGoToMatch,
  onGenerate,
  isLoading,
  submitLabel = 'Skriv ansökan',
}) {
  return (
    <form
      className="panel uploader"
      onSubmit={(event) => {
        event.preventDefault()
        onGenerate()
      }}
    >
      <div className="field">
        <label>Underlag</label>
        <p className="hint">
          Ansökan skrivs utifrån ditt CV och annonsen du redan lagt in. Ändrar du något i dem, skriv om ansökan.
        </p>
      </div>

      <ul className="sources">
        <Source
          label="Ditt CV"
          ready={cvReady}
          detail={`${cvText.trim().length} tecken`}
          missingHint="Saknas. Lägg in ditt CV under CV-analys."
          onGoFix={onGoToCv}
        />
        <Source
          label="Jobbannonsen"
          ready={adReady}
          detail={`${jobAdText.trim().length} tecken`}
          missingHint="Saknas. Klistra in eller hämta annonsen under Jobbmatchning."
          onGoFix={onGoToMatch}
        />
      </ul>

      <div className="uploader-actions">
        <button type="submit" className="primary" disabled={isLoading || !cvReady || !adReady}>
          {isLoading ? 'Skriver…' : submitLabel}
        </button>
      </div>

      <p className="hint muted">
        Inget hittas på. Saknas en siffra som skulle göra texten starkare sätts en platshållare i hakparenteser som du
        fyller i själv.
      </p>
    </form>
  )
}
