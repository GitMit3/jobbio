import {
  ATS_SYSTEM_PROMPT,
  MAX_CV_CHARS,
  MIN_CV_CHARS,
  analysisSchema,
  buildAtsUserPrompt,
  normalizeAnalysis,
} from '../shared/atsAnalysis.js'
import {
  MATCH_SYSTEM_PROMPT,
  MAX_AD_CHARS,
  MIN_AD_CHARS,
  buildMatchUserPrompt,
  matchSchema,
  normalizeMatch,
} from '../shared/jobMatch.js'
import { APPLICATION_SYSTEM_PROMPT, applicationSchema, buildApplicationUserPrompt } from '../shared/application.js'
import { buildManualPrompt, parseManualResponse } from '../shared/manualMode.js'
import { assertLocalRuntime, runClaudeCode } from './_lib/claudeCode.js'
import { HttpError, readJsonBody, sendJson } from './_lib/http.js'

const identity = (value) => value

function requireCv(cvText) {
  if (cvText.length < MIN_CV_CHARS) throw new HttpError(400, `CV-texten är för kort (minst ${MIN_CV_CHARS} tecken).`)
  if (cvText.length > MAX_CV_CHARS) {
    throw new HttpError(413, `CV-texten är ${cvText.length} tecken, gränsen är ${MAX_CV_CHARS}.`)
  }
}

function requireAd(jobAdText) {
  if (jobAdText.length < MIN_AD_CHARS) {
    throw new HttpError(400, `Jobbannonsen är för kort (minst ${MIN_AD_CHARS} tecken).`)
  }
  if (jobAdText.length > MAX_AD_CHARS) {
    throw new HttpError(413, `Jobbannonsen är ${jobAdText.length} tecken, gränsen är ${MAX_AD_CHARS}.`)
  }
}

/**
 * Samma prompter och scheman som API-läget och manuellt läge - bara en annan
 * väg fram till modellen.
 */
const FEATURES = {
  ats: {
    resultKey: 'analysis',
    schema: analysisSchema,
    system: ATS_SYSTEM_PROMPT,
    buildUser: buildAtsUserPrompt,
    normalize: normalizeAnalysis,
    validate: ({ cvText }) => requireCv(cvText),
  },
  match: {
    resultKey: 'match',
    schema: matchSchema,
    system: MATCH_SYSTEM_PROMPT,
    buildUser: buildMatchUserPrompt,
    normalize: normalizeMatch,
    validate: ({ cvText, jobAdText }) => {
      requireCv(cvText)
      requireAd(jobAdText)
    },
  },
  application: {
    resultKey: 'application',
    schema: applicationSchema,
    system: APPLICATION_SYSTEM_PROMPT,
    buildUser: buildApplicationUserPrompt,
    normalize: identity,
    validate: ({ cvText, jobAdText }) => {
      requireCv(cvText)
      requireAd(jobAdText)
    },
  },
}

export default async function handler(req, res) {
  try {
    assertLocalRuntime()
    if (req.method !== 'POST') throw new HttpError(405, 'Endast POST stöds.')

    const body = await readJsonBody(req)
    const feature = FEATURES[body.feature]
    if (!feature) throw new HttpError(400, `Okänd analystyp: ${body.feature}`)

    const input = {
      cvText: typeof body.cvText === 'string' ? body.cvText.trim() : '',
      jobAdText: typeof body.jobAdText === 'string' ? body.jobAdText.trim() : '',
      targetRole: typeof body.targetRole === 'string' ? body.targetRole.trim().slice(0, 200) : '',
    }
    feature.validate(input)

    const startedAt = Date.now()
    const output = await runClaudeCode(
      buildManualPrompt({ system: feature.system, user: feature.buildUser(input), schema: feature.schema }),
    )

    const parsed = parseManualResponse(output, feature.schema)
    if (!parsed.ok) {
      throw new HttpError(502, `Claude Code svarade i ett format vi inte kunde tolka. ${parsed.error}`)
    }

    sendJson(res, 200, {
      [feature.resultKey]: feature.normalize(parsed.data),
      meta: {
        runtime: 'claude-code',
        targetRole: input.targetRole,
        seconds: Math.round((Date.now() - startedAt) / 1000),
      },
    })
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    if (status >= 500) console.error('[claude-code]', error)
    sendJson(res, status, { error: error.message || 'Okänt fel.' })
  }
}
