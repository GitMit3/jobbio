import { useState } from 'react'
import CvUploader from './components/CvUploader.jsx'
import AnalysisResult from './components/AnalysisResult.jsx'
import JobAdInput from './components/JobAdInput.jsx'
import MatchResult from './components/MatchResult.jsx'
import { useAsyncAction } from './hooks/useAsyncAction.js'
import { analyzeCv, matchJob } from './lib/api.js'
import { SAMPLE_CV } from './lib/sampleCv.js'

const MIN_CV_CHARS = 200

const TABS = [
  { id: 'cv', label: 'CV-analys' },
  { id: 'match', label: 'Jobbmatchning' },
]

function Placeholder({ children, title }) {
  return (
    <div className="card placeholder">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

function Pending({ title, children }) {
  return (
    <div className="card placeholder">
      <div className="spinner" aria-hidden="true" />
      <h3>{title}</h3>
      <p className="muted">{children}</p>
    </div>
  )
}

function Failed({ error, onRetry }) {
  return (
    <div className="card placeholder error">
      <h3>Något gick fel</h3>
      <p>{error}</p>
      <button type="button" className="primary" onClick={onRetry}>
        Försök igen
      </button>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('cv')
  const [cvText, setCvText] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [jobAdText, setJobAdText] = useState('')

  const analysis = useAsyncAction(analyzeCv)
  const match = useAsyncAction(matchJob)

  const cvReady = cvText.trim().length >= MIN_CV_CHARS

  const runAnalysis = () => analysis.run({ cvText, targetRole })
  const runMatch = () => match.run({ cvText, jobAdText })

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="logo">JB</span>
          <div>
            <h1>Jobbio</h1>
            <p>CV-analys och jobbmatchning</p>
          </div>
        </div>

        <nav className="tabs" aria-label="Vyer">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`tab ${tab === id ? 'active' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="layout">
        <div className="col">
          {tab === 'cv' ? (
            <CvUploader
              cvText={cvText}
              onCvTextChange={setCvText}
              targetRole={targetRole}
              onTargetRoleChange={setTargetRole}
              onAnalyze={runAnalysis}
              onLoadSample={() => setCvText(SAMPLE_CV)}
              isLoading={analysis.status === 'loading'}
            />
          ) : (
            <JobAdInput
              jobAdText={jobAdText}
              onJobAdTextChange={setJobAdText}
              onMatch={runMatch}
              isLoading={match.status === 'loading'}
              cvReady={cvReady}
            />
          )}
        </div>

        <div className="col">
          {tab === 'cv' && (
            <>
              {analysis.status === 'idle' && (
                <Placeholder title="Din analys hamnar här">
                  <p className="muted">
                    Klistra in eller ladda upp ditt CV till vänster och tryck på <strong>Analysera CV</strong>. Du får
                    en ATS-poäng, genomgång sektion för sektion, konkreta förbättringsförslag och de nyckelord som
                    saknas.
                  </p>
                </Placeholder>
              )}
              {analysis.status === 'loading' && (
                <Pending title="Analyserar ditt CV…">
                  Claude går igenom sektion för sektion. Det tar normalt 20–45 sekunder.
                </Pending>
              )}
              {analysis.status === 'error' && <Failed error={analysis.error} onRetry={runAnalysis} />}
              {analysis.status === 'done' && (
                <AnalysisResult analysis={analysis.data.analysis} meta={analysis.data.meta} />
              )}
            </>
          )}

          {tab === 'match' && (
            <>
              {match.status === 'idle' && (
                <Placeholder title="Din matchning hamnar här">
                  <p className="muted">
                    Klistra in en jobbannons eller hämta den från en länk, och tryck på{' '}
                    <strong>Jämför mot mitt CV</strong>. Du får en matchningsprocent med motivering och en genomgång av
                    annonsens krav – vilka du uppfyller, uppfyller delvis och saknar.
                  </p>
                </Placeholder>
              )}
              {match.status === 'loading' && (
                <Pending title="Jämför CV mot annonsen…">
                  Claude läser ut annonsens krav och stämmer av dem mot ditt CV. Det tar normalt 20–45 sekunder.
                </Pending>
              )}
              {match.status === 'error' && <Failed error={match.error} onRetry={runMatch} />}
              {match.status === 'done' && <MatchResult match={match.data.match} />}
            </>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p className="muted small">
          Analyserna görs av Claude och är rådgivande. Inget sparas – ditt CV och annonsen skickas bara vidare för
          analysen.
        </p>
      </footer>
    </div>
  )
}
