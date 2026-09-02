import { useRef, useState } from 'react'
import CvUploader from './components/CvUploader.jsx'
import AnalysisResult from './components/AnalysisResult.jsx'
import { analyzeCv } from './lib/api.js'
import { SAMPLE_CV } from './lib/sampleCv.js'

export default function App() {
  const [cvText, setCvText] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const abortRef = useRef(null)

  async function handleAnalyze() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')
    setError('')

    try {
      const payload = await analyzeCv({ cvText, targetRole, signal: controller.signal })
      setResult(payload)
      setStatus('done')
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="logo">JB</span>
          <div>
            <h1>Jobbio</h1>
            <p>CV-analys mot ATS-krav</p>
          </div>
        </div>
      </header>

      <main className="layout">
        <div className="col">
          <CvUploader
            cvText={cvText}
            onCvTextChange={setCvText}
            targetRole={targetRole}
            onTargetRoleChange={setTargetRole}
            onAnalyze={handleAnalyze}
            onLoadSample={() => setCvText(SAMPLE_CV)}
            isLoading={status === 'loading'}
          />
        </div>

        <div className="col">
          {status === 'loading' && (
            <div className="card placeholder">
              <div className="spinner" aria-hidden="true" />
              <h3>Analyserar ditt CV…</h3>
              <p className="muted">Claude går igenom sektion för sektion. Det tar normalt 20–45 sekunder.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="card placeholder error">
              <h3>Något gick fel</h3>
              <p>{error}</p>
              <button type="button" className="primary" onClick={handleAnalyze}>
                Försök igen
              </button>
            </div>
          )}

          {status === 'idle' && (
            <div className="card placeholder">
              <h3>Din analys hamnar här</h3>
              <p className="muted">
                Klistra in ditt CV till vänster och tryck på <strong>Analysera CV</strong>. Du får en ATS-poäng,
                genomgång sektion för sektion, konkreta förbättringsförslag och de nyckelord som saknas.
              </p>
            </div>
          )}

          {status === 'done' && result && <AnalysisResult analysis={result.analysis} meta={result.meta} />}
        </div>
      </main>

      <footer className="app-footer">
        <p className="muted small">
          Analysen görs av Claude och är rådgivande. Ditt CV lagras inte – det skickas bara vidare för analysen.
        </p>
      </footer>
    </div>
  )
}
