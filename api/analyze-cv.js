import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import {
  ATS_SYSTEM_PROMPT,
  MAX_CV_CHARS,
  MIN_CV_CHARS,
  analysisSchema,
  buildAtsUserPrompt,
  normalizeAnalysis,
} from '../shared/atsAnalysis.js'
import { EFFORT, MODEL, getClient, toHttpError } from './_lib/claude.js'
import { HttpError, readJsonBody, sendJson } from './_lib/http.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Endast POST stöds.')

    const body = await readJsonBody(req)
    const cvText = typeof body.cvText === 'string' ? body.cvText.trim() : ''
    const targetRole = typeof body.targetRole === 'string' ? body.targetRole.trim().slice(0, 200) : ''

    if (cvText.length < MIN_CV_CHARS) {
      throw new HttpError(400, `CV-texten är för kort för en meningsfull analys (minst ${MIN_CV_CHARS} tecken).`)
    }
    if (cvText.length > MAX_CV_CHARS) {
      throw new HttpError(
        413,
        `CV-texten är ${cvText.length} tecken, gränsen är ${MAX_CV_CHARS}. Klistra in enbart själva CV:t.`,
      )
    }

    const message = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: EFFORT,
        format: zodOutputFormat(analysisSchema),
      },
      system: ATS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildAtsUserPrompt({ cvText, targetRole }) }],
    })

    if (message.stop_reason === 'refusal') {
      throw new HttpError(422, 'Modellen kunde inte analysera den här texten. Prova med enbart CV-innehållet.')
    }
    if (message.stop_reason === 'max_tokens') {
      throw new HttpError(502, 'Analysen blev avklippt. Prova med ett kortare CV.')
    }
    if (!message.parsed_output) {
      throw new HttpError(502, 'Analysen kom tillbaka i ett format vi inte kunde tolka. Försök igen.')
    }

    sendJson(res, 200, {
      analysis: normalizeAnalysis(message.parsed_output),
      meta: {
        model: message.model,
        targetRole,
        analyzedAt: new Date().toISOString(),
        usage: {
          inputTokens: message.usage?.input_tokens ?? null,
          outputTokens: message.usage?.output_tokens ?? null,
        },
      },
    })
  } catch (error) {
    const httpError = toHttpError(error)
    if (httpError.status >= 500) console.error('[analyze-cv]', error)
    sendJson(res, httpError.status, { error: httpError.message })
  }
}
