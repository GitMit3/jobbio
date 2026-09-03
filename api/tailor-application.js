import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { APPLICATION_SYSTEM_PROMPT, applicationSchema, buildApplicationUserPrompt } from '../shared/application.js'
import { MAX_CV_CHARS, MIN_CV_CHARS } from '../shared/atsAnalysis.js'
import { MAX_AD_CHARS, MIN_AD_CHARS } from '../shared/jobMatch.js'
import { EFFORT, MODEL, getClient, toHttpError } from './_lib/claude.js'
import { HttpError, readJsonBody, sendJson } from './_lib/http.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Endast POST stöds.')

    const body = await readJsonBody(req)
    const cvText = typeof body.cvText === 'string' ? body.cvText.trim() : ''
    const jobAdText = typeof body.jobAdText === 'string' ? body.jobAdText.trim() : ''

    if (cvText.length < MIN_CV_CHARS) {
      throw new HttpError(400, `CV-texten är för kort (minst ${MIN_CV_CHARS} tecken).`)
    }
    if (cvText.length > MAX_CV_CHARS) {
      throw new HttpError(413, `CV-texten är ${cvText.length} tecken, gränsen är ${MAX_CV_CHARS}.`)
    }
    if (jobAdText.length < MIN_AD_CHARS) {
      throw new HttpError(400, `Jobbannonsen är för kort (minst ${MIN_AD_CHARS} tecken).`)
    }
    if (jobAdText.length > MAX_AD_CHARS) {
      throw new HttpError(413, `Jobbannonsen är ${jobAdText.length} tecken, gränsen är ${MAX_AD_CHARS}.`)
    }

    const message = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: EFFORT,
        format: zodOutputFormat(applicationSchema),
      },
      system: APPLICATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildApplicationUserPrompt({ cvText, jobAdText }) }],
    })

    if (message.stop_reason === 'refusal') {
      throw new HttpError(422, 'Modellen kunde inte skriva ansökan utifrån de här texterna.')
    }
    if (message.stop_reason === 'max_tokens') {
      throw new HttpError(502, 'Texten blev avklippt. Prova med en kortare annons.')
    }
    if (!message.parsed_output) {
      throw new HttpError(502, 'Svaret kom tillbaka i ett format vi inte kunde tolka. Försök igen.')
    }

    sendJson(res, 200, {
      application: message.parsed_output,
      meta: {
        model: message.model,
        writtenAt: new Date().toISOString(),
        usage: {
          inputTokens: message.usage?.input_tokens ?? null,
          outputTokens: message.usage?.output_tokens ?? null,
        },
      },
    })
  } catch (error) {
    const httpError = toHttpError(error)
    if (httpError.status >= 500) console.error('[tailor-application]', error)
    sendJson(res, httpError.status, { error: httpError.message })
  }
}
