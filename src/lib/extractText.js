/**
 * Textutvinning ur uppladdade CV-filer. Allt sker i webbläsaren – filen skickas
 * aldrig till servern. Användaren får ut ren text i textrutan och kan rätta
 * den innan analysen, vilket också speglar hur ett ATS faktiskt läser filen.
 *
 * Tunga parsers (pdf.js, mammoth) laddas först när de behövs.
 */

export const ACCEPTED_FILE_TYPES = '.txt,.md,.markdown,.pdf,.docx'
export const ACCEPTED_LABEL = '.pdf, .docx, .txt, .md'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_PDF_PAGES = 20
const SUSPICIOUSLY_SHORT = 200

export class ExtractError extends Error {}

/**
 * @returns {Promise<{ text: string, warnings: string[] }>}
 */
export async function extractTextFromFile(file) {
  if (file.size > MAX_FILE_BYTES) {
    throw new ExtractError(
      `Filen är ${formatBytes(file.size)}. Gränsen är ${formatBytes(MAX_FILE_BYTES)} – ett CV bör vara långt under det.`,
    )
  }

  const extension = (file.name.split('.').pop() || '').toLowerCase()

  switch (extension) {
    case 'txt':
    case 'md':
    case 'markdown':
      return finish(await file.text(), [])
    case 'pdf':
      return finish(...(await extractPdf(file)))
    case 'docx':
      return finish(...(await extractDocx(file)))
    case 'doc':
      throw new ExtractError('Gamla .doc-filer stöds inte. Spara om ditt CV som .docx eller PDF.')
    case 'pages':
      throw new ExtractError('Pages-filer stöds inte. Exportera till PDF eller Word först.')
    case 'rtf':
      throw new ExtractError('RTF stöds inte. Spara om ditt CV som .docx eller PDF.')
    default:
      throw new ExtractError(`Filtypen .${extension || '?'} stöds inte. Använd ${ACCEPTED_LABEL}.`)
  }
}

function finish(rawText, warnings) {
  const text = normalize(rawText)

  if (!text) {
    throw new ExtractError(
      'Ingen text kunde läsas ur filen. Är det ett inskannat dokument eller en bild? Klistra in texten manuellt istället.',
    )
  }
  if (text.length < SUSPICIOUSLY_SHORT) {
    warnings.push('Väldigt lite text hittades. Kontrollera att hela CV:t kom med innan du analyserar.')
  }
  return { text, warnings }
}

function normalize(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\t   ]/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/* -------------------------------------------------------------- PDF ----- */

let pdfjsPromise

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjs, { default: PdfWorker }] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.mjs?worker'),
      ])
      pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()
      return pdfjs
    })()
  }
  return pdfjsPromise
}

async function extractPdf(file) {
  const pdfjs = await loadPdfjs()
  const warnings = []

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() })
  let doc
  try {
    doc = await loadingTask.promise
  } catch (error) {
    if (error?.name === 'PasswordException') {
      throw new ExtractError('PDF:en är lösenordsskyddad. Ta bort skyddet eller klistra in texten manuellt.')
    }
    throw new ExtractError('PDF:en kunde inte öppnas. Den kan vara skadad – prova att spara om den.')
  }

  const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES)
  if (doc.numPages > MAX_PDF_PAGES) {
    warnings.push(`Endast de första ${MAX_PDF_PAGES} sidorna lästes in (filen har ${doc.numPages}).`)
  }

  const pages = []
  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(linesFromTextContent(content.items))
      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }

  return [pages.join('\n\n'), warnings]
}

/**
 * pdf.js ger textfragment med position, inte rader. Vi grupperar fragment på
 * samma baslinje till rader och sorterar dem uppifrån och ner.
 *
 * Vi försöker medvetet inte gissa styckesindelning utifrån radavstånd: i mätning
 * på verkliga CV-layouter ligger avståndet före en rubrik för nära avståndet
 * mellan punktlistepunkter för att gå att skilja åt pålitligt. En rad per rad är
 * förutsägbart, och användaren ser ändå texten innan analysen.
 */
function linesFromTextContent(items) {
  const rows = []

  for (const item of items) {
    if (typeof item.str !== 'string' || !item.str.trim()) continue
    const y = item.transform[5]
    const x = item.transform[4]
    const row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2)
    if (row) {
      row.parts.push({ x, width: item.width || 0, str: item.str })
    } else {
      rows.push({ y, parts: [{ x, width: item.width || 0, str: item.str }] })
    }
  }

  rows.sort((a, b) => b.y - a.y)

  return rows
    .map((row) => {
      row.parts.sort((a, b) => a.x - b.x)
      let text = ''
      let previousEnd = null
      for (const part of row.parts) {
        if (previousEnd !== null && part.x - previousEnd > 1 && !text.endsWith(' ')) text += ' '
        text += part.str
        previousEnd = part.x + part.width
      }
      return text.trim()
    })
    .join('\n')
}

/* ------------------------------------------------------------- DOCX ----- */

async function extractDocx(file) {
  const mammoth = await import('mammoth/mammoth.browser.js')
  const warnings = []

  let result
  try {
    result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  } catch {
    throw new ExtractError('Word-filen kunde inte läsas. Prova att spara om den som .docx eller PDF.')
  }

  if (result.messages?.some((message) => message.type === 'warning' || message.type === 'error')) {
    warnings.push('Delar av dokumentet kunde inte tolkas fullt ut. Läs igenom texten innan du analyserar.')
  }

  return [result.value, warnings]
}
