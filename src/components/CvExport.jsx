import { useMemo, useState } from 'react'
import { findPlaceholders, parseCv } from '../../shared/cvDocument.js'
import { DEFAULT_TEMPLATE, TEMPLATES } from '../lib/cvTemplates.js'
import { cvFileName, cvToDocxBlob, downloadBlob } from '../lib/docxExport.js'
import { downloadText } from '../lib/export.js'
import CvPreview from './CvPreview.jsx'

const TEMPLATE_KEY = 'jobbio:template'

function readStoredTemplate() {
  try {
    const stored = localStorage.getItem(TEMPLATE_KEY)
    return TEMPLATES.some((t) => t.id === stored) ? stored : DEFAULT_TEMPLATE
  } catch {
    return DEFAULT_TEMPLATE
  }
}

export default function CvExport({ text }) {
  const [template, setTemplate] = useState(readStoredTemplate)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const doc = useMemo(() => parseCv(text), [text])
  const placeholders = useMemo(() => findPlaceholders(text), [text])
  const chosen = TEMPLATES.find((t) => t.id === template) ?? TEMPLATES[0]

  function pick(id) {
    setTemplate(id)
    try {
      localStorage.setItem(TEMPLATE_KEY, id)
    } catch {
      // Blockerad lagring – valet gäller den här sessionen.
    }
  }

  async function saveWord() {
    setBusy(true)
    setError('')
    try {
      downloadBlob(cvFileName(doc, 'docx'), await cvToDocxBlob(doc, template))
    } catch {
      setError('Word-filen kunde inte skapas. Ladda ner som text så länge.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel export">
      <div className="document-head">
        <div>
          <h3>Ladda ner</h3>
          <span className="counter">Mall: {chosen.name}</span>
        </div>
        <div className="document-actions">
          <button type="button" onClick={() => downloadText(cvFileName(doc, 'txt'), text)}>
            Text
          </button>
          <button type="button" onClick={saveWord} disabled={busy}>
            {busy ? 'Skapar…' : 'Word'}
          </button>
          <button type="button" className="primary" onClick={() => window.print()}>
            PDF
          </button>
        </div>
      </div>

      <div className="template-picker" role="group" aria-label="Mall">
        {TEMPLATES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`template ${template === item.id ? 'active' : ''}`}
            onClick={() => pick(item.id)}
            aria-pressed={template === item.id}
          >
            <span className={`template-thumb tpl-${item.id}`} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            <strong>{item.name}</strong>
            <span className="template-note">{item.description}</span>
          </button>
        ))}
      </div>

      <p className="hint">
        <strong>PDF</strong> öppnar utskriftsdialogen – välj <em>Spara som PDF</em> som skrivare. Det ger ett riktigt
        textlager, vilket ett ATS kan läsa. Alla mallar är enspaltiga utan tabeller av samma skäl.
      </p>

      {placeholders.length > 0 && (
        <p className="hint warn">
          Texten innehåller {placeholders.length} platshållare som följer med i filen:{' '}
          {placeholders.join(' ')}. Fyll i eller ta bort dem först.
        </p>
      )}
      {error && <p className="hint warn">{error}</p>}

      <div className="preview-frame">
        <CvPreview doc={doc} template={template} />
      </div>
    </section>
  )
}
