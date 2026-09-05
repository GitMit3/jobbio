import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { MAX_CV_CHARS, MIN_CV_CHARS } from '../shared/atsAnalysis.js'
import { IMPROVE_SYSTEM_PROMPT, buildImproveUserPrompt, improvementSchema } from '../shared/improveCv.js'
import { EFFORT, MODEL, getClient, toHttpError } from './_lib/claude.js'
import { HttpError, readJsonBody, sendJson } from './_lib/http.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Endast POST stöds.')

    const body = await readJsonBody(req)
    const cvText = typeof body.cvText === 'string' ? body.cvText.trim() : ''
    const targetRole = typeof body.targetRole === 'string' ? body.targetRole.trim().slice(0, 200) : ''
    const selections = Array.isArray(body.selections)
      ? body.selections.filter((item) => typeof item === 'string' && item.trim()).slice(0, 40)
      : []

    if (cvText.length < MIN_CV_CHARS) throw new HttpError(400, `CV-texten är för kort (minst ${MIN_CV_CHARS} tecken).`)
    if (cvText.length > MAX_CV_CHARS) {
      throw new HttpError(413, `CV-texten är ${cvText.length} tecken, gränsen är ${MAX_CV_CHARS}.`)
    }
    if (!selections.length) throw new HttpError(400, 'Inga förbättringar valda.')

    const message = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: EFFORT, format: zodOutputFormat(improvementSchema) },
      system: IMPROVE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildImproveUserPrompt({ cvText, targetRole, selections }) }],
    })

    if (message.stop_reason === 'refusal') {
      throw new HttpError(422, 'Modellen kunde inte skriva om det här CV:t.')
    }
    if (message.stop_reason === 'max_tokens') {
      throw new HttpError(502, 'Omskrivningen blev avklippt. Välj färre förbättringar åt gången.')
    }
    if (!message.parsed_output) {
      throw new HttpError(502, 'Svaret kom tillbaka i ett format vi inte kunde tolka. Försök igen.')
    }

    sendJson(res, 200, {
      improvement: message.parsed_output,
      meta: { model: message.model, improvedAt: new Date().toISOString(), applied: selections.length },
    })
  } catch (error) {
    const httpError = toHttpError(error)
    if (httpError.status >= 500) console.error('[improve-cv]', error)
    sendJson(res, httpError.status, { error: httpError.message })
  }
}
