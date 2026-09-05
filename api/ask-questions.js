import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { MAX_CV_CHARS, MIN_CV_CHARS } from '../shared/atsAnalysis.js'
import { QUESTIONS_SYSTEM_PROMPT, buildQuestionsUserPrompt, questionsSchema } from '../shared/cvQuestions.js'
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
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      output_config: { effort: EFFORT, format: zodOutputFormat(questionsSchema) },
      system: QUESTIONS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildQuestionsUserPrompt({ cvText, targetRole, selections }) }],
    })

    if (message.stop_reason === 'refusal') throw new HttpError(422, 'Modellen kunde inte förbereda frågorna.')
    if (!message.parsed_output) {
      throw new HttpError(502, 'Svaret kom tillbaka i ett format vi inte kunde tolka. Försök igen.')
    }

    sendJson(res, 200, { questions: message.parsed_output.questions.slice(0, 8), meta: { model: message.model } })
  } catch (error) {
    const httpError = toHttpError(error)
    if (httpError.status >= 500) console.error('[ask-questions]', error)
    sendJson(res, httpError.status, { error: httpError.message })
  }
}
