import { useEffect, useState } from 'react'
import CvUploader from './components/CvUploader.jsx'
import AnalysisResult from './components/AnalysisResult.jsx'
import JobAdInput from './components/JobAdInput.jsx'
import MatchResult from './components/MatchResult.jsx'
import ManualRunner from './components/ManualRunner.jsx'
import ApplicationInputs from './components/ApplicationInputs.jsx'
import ApplicationResult from './components/ApplicationResult.jsx'
import ApplicationsBoard from './components/ApplicationsBoard.jsx'
import AuthPanel from './components/AuthPanel.jsx'
import { useFeatureRun } from './hooks/useFeatureRun.js'
import { useAuth } from './hooks/useAuth.js'
import { analyzeCv, matchJob, tailorApplication } from './lib/api.js'
import { isSupabaseConfigured, supabase } from './lib/supabase.js'
import { SAMPLE_CV } from './lib/sampleCv.js'
import {
  ATS_SYSTEM_PROMPT,
  MIN_CV_CHARS,
  analysisSchema,
  buildAtsUserPrompt,
  normalizeAnalysis,
} from '../shared/atsAnalysis.js'
import {
  MATCH_SYSTEM_PROMPT,
  MIN_AD_CHARS,
  buildMatchUserPrompt,
  matchSchema,
  normalizeMatch,
} from '../shared/jobMatch.js'
import { APPLICATION_SYSTEM_PROMPT, applicationSchema, buildApplicationUserPrompt } from '../shared/application.js'
import { buildManualPrompt, parseManualResponse } from '../shared/manualMode.js'

const MODE_KEY = 'jobbio:mode'

const TABS = [
  { id: 'cv', index: '01', label: 'CV-analys' },
  { id: 'match', index: '02', label: 'Jobbmatchning' },
  { id: 'application', index: '03', label: 'Ansökan' },
  { id: 'tracker', index: '04', label: 'Ansökningar' },
]

// Modulnivå så identiteten är stabil mellan renderingar.
const atsRunner = {
  apiAction: analyzeCv,
  buildPrompt: (input) =>
    buildManualPrompt({ system: ATS_SYSTEM_PROMPT, user: buildAtsUserPrompt(input), schema: analysisSchema }),
  parseResult: (text) => {
    const result = parseManualResponse(text, analysisSchema)
    return result.ok ? { ok: true, data: { analysis: normalizeAnalysis(result.data) } } : result
  },
}

const matchRunner = {
  apiAction: matchJob,
  buildPrompt: (input) =>
    buildManualPrompt({ system: MATCH_SYSTEM_PROMPT, user: buildMatchUserPrompt(input), schema: matchSchema }),
  parseResult: (text) => {
    const result = parseManualResponse(text, matchSchema)
    return result.ok ? { ok: true, data: { match: normalizeMatch(result.data) } } : result
  },
}

const applicationRunner = {
  apiAction: tailorApplication,
  buildPrompt: (input) =>
    buildManualPrompt({
      system: APPLICATION_SYSTEM_PROMPT,
      user: buildApplicationUserPrompt(input),
      schema: applicationSchema,
    }),
  parseResult: (text) => {
    const result = parseManualResponse(text, applicationSchema)
    return result.ok ? { ok: true, data: { application: result.data } } : result
  },
}

function readStoredMode() {
  try {
    const stored = localStorage.getItem(MODE_KEY)
    return stored === 'api' || stored === 'manual' ? stored : 'manual'
  } catch {
    return 'manual'
  }
}

function Panel({ title, children, tone }) {
  return (
    <div className={`panel-message ${tone || ''}`}>
      <h3>{title}</h3>
      {children}
    </div>
  )
}

/** Fliken för ansökningsspårning kräver Supabase. Resten av appen gör det inte. */
function TrackerView({ user, loading }) {
  if (!isSupabaseConfigured) {
    return (
      <Panel title="Supabase är inte konfigurerat">
        <p>
          Ansökningsspårningen sparar dina ansökningar i en databas och behöver därför Supabase. Skapa ett projekt,
          kör <code>supabase/schema.sql</code> i SQL Editor, och lägg in <code>VITE_SUPABASE_URL</code> och{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> i <code>.env</code>. Se README för stegen.
        </p>
        <p className="dim">De tre andra flikarna fungerar utan detta.</p>
      </Panel>
    )
  }
  if (loading) return <Panel title="Kontrollerar inloggning" />
  if (!user) return <AuthPanel />
  return <ApplicationsBoard userId={user.id} />
}

export default function App() {
  const [tab, setTab] = useState('cv')
  const [mode, setMode] = useState(readStoredMode)
  const [cvText, setCvText] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [jobAdText, setJobAdText] = useState('')

  const ats = useFeatureRun(atsRunner)
  const match = useFeatureRun(matchRunner)
  const application = useFeatureRun(applicationRunner)
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      // Privat läge eller blockerad lagring – läget gäller bara den här sessionen.
    }
  }, [mode])

  const isManual = mode === 'manual'
  const cvReady = cvText.trim().length >= MIN_CV_CHARS
  const adReady = jobAdText.trim().length >= MIN_AD_CHARS
  const isTracker = tab === 'tracker'

  const startAts = () => {
    const input = { cvText, targetRole }
    return isManual ? ats.showPrompt(input) : ats.runApi(input)
  }

  const startMatch = () => {
    const input = { cvText, jobAdText }
    return isManual ? match.showPrompt(input) : match.runApi(input)
  }

  const startApplication = () => {
    const input = { cvText, jobAdText }
    return isManual ? application.showPrompt(input) : application.runApi(input)
  }

  const runner = { cv: ats, match, application }[tab]
  const restart = { cv: startAts, match: startMatch, application: startApplication }[tab]

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <span className="stripes" aria-hidden="true" />
            <span className="wordmark">Jobbio</span>
          </div>

          <nav className="tabs" aria-label="Vyer">
            {TABS.map(({ id, index, label }) => (
              <button
                key={id}
                type="button"
                className={`tab ${tab === id ? 'active' : ''}`}
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setTab(id)}
              >
                <span className="tab-index">{index}</span>
                {label}
              </button>
            ))}
          </nav>

          {isTracker && user ? (
            <div className="account">
              <span className="account-email" title={user.email}>
                {user.email}
              </span>
              <button type="button" className="ghost" onClick={() => supabase.auth.signOut()}>
                Logga ut
              </button>
            </div>
          ) : (
            !isTracker && (
              <div className="mode-switch" role="group" aria-label="Körläge">
                <button
                  type="button"
                  className={isManual ? 'active' : ''}
                  onClick={() => setMode('manual')}
                  title="Kopiera prompten och kör den i Claude.ai – ingen API-nyckel behövs"
                >
                  Manuellt
                </button>
                <button
                  type="button"
                  className={!isManual ? 'active' : ''}
                  onClick={() => setMode('api')}
                  title="Kör analysen automatiskt via din Anthropic-API-nyckel"
                >
                  API-nyckel
                </button>
              </div>
            )
          )}
        </div>
      </header>

      <main className={`layout ${isTracker ? 'single' : ''}`}>
        {isTracker ? (
          <section className="col">
            <TrackerView user={user} loading={authLoading} />
          </section>
        ) : (
          <>
            <section className="col col-input">
              {tab === 'cv' ? (
                <CvUploader
                  cvText={cvText}
                  onCvTextChange={setCvText}
                  targetRole={targetRole}
                  onTargetRoleChange={setTargetRole}
                  onAnalyze={startAts}
                  onLoadSample={() => setCvText(SAMPLE_CV)}
                  isLoading={ats.status === 'loading'}
                  submitLabel={isManual ? 'Skapa prompt' : 'Analysera CV'}
                />
              ) : tab === 'match' ? (
                <JobAdInput
                  jobAdText={jobAdText}
                  onJobAdTextChange={setJobAdText}
                  onMatch={startMatch}
                  isLoading={match.status === 'loading'}
                  cvReady={cvReady}
                  submitLabel={isManual ? 'Skapa prompt' : 'Jämför mot mitt CV'}
                />
              ) : (
                <ApplicationInputs
                  cvText={cvText}
                  jobAdText={jobAdText}
                  cvReady={cvReady}
                  adReady={adReady}
                  onGoToCv={() => setTab('cv')}
                  onGoToMatch={() => setTab('match')}
                  onGenerate={startApplication}
                  isLoading={application.status === 'loading'}
                  submitLabel={isManual ? 'Skapa prompt' : 'Skriv ansökan'}
                />
              )}
            </section>

            <section className="col col-result">
              {runner.status === 'idle' &&
                (tab === 'cv' ? (
                  <Panel title="Din analys hamnar här">
                    <p>
                      Lägg in ditt CV till vänster. Du får en ATS-poäng, genomgång sektion för sektion, konkreta
                      förbättringsförslag och de nyckelord som saknas.
                    </p>
                  </Panel>
                ) : tab === 'match' ? (
                  <Panel title="Din matchning hamnar här">
                    <p>
                      Klistra in en jobbannons eller hämta den från en länk. Du får en matchningsprocent med motivering
                      och annonsens krav uppdelade i vad du uppfyller, uppfyller delvis och saknar.
                    </p>
                  </Panel>
                ) : (
                  <Panel title="Din ansökan hamnar här">
                    <p>
                      Utifrån ditt CV och annonsen skrivs ett anpassat CV-utdrag och ett personligt brev som lyfter rätt
                      erfarenheter. Du kan redigera båda innan du kopierar eller laddar ner dem.
                    </p>
                  </Panel>
                ))}

              {runner.status === 'loading' && (
                <Panel
                  title={
                    { cv: 'Analyserar ditt CV', match: 'Jämför mot annonsen', application: 'Skriver din ansökan' }[tab]
                  }
                >
                  <div className="loader" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>Claude arbetar. Det tar normalt 20–45 sekunder.</p>
                </Panel>
              )}

              {runner.status === 'error' && (
                <Panel title="Något gick fel" tone="bad">
                  <p>{runner.error}</p>
                  <button type="button" className="primary" onClick={restart}>
                    Försök igen
                  </button>
                </Panel>
              )}

              {runner.status === 'prompt' && (
                <ManualRunner
                  prompt={runner.prompt}
                  error={runner.error}
                  onSubmit={runner.submitManual}
                  onCancel={runner.reset}
                />
              )}

              {runner.status === 'done' &&
                (tab === 'cv' ? (
                  <AnalysisResult analysis={ats.data.analysis} meta={ats.data.meta ?? { targetRole }} />
                ) : tab === 'match' ? (
                  <MatchResult match={match.data.match} />
                ) : (
                  <ApplicationResult application={application.data.application} />
                ))}
            </section>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Analyserna görs av Claude och är rådgivande. CV, annons och ansökan lagras inte – bara ansökningsspårningen
          sparar data, och då i din egen Supabase.
          {isManual && !isTracker && ' I manuellt läge lämnar texten aldrig din dator förrän du själv klistrar in den.'}
        </p>
      </footer>
    </div>
  )
}
