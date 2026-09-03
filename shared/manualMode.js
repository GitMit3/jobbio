import { z } from 'zod'

/**
 * Manuellt läge: användaren kör prompten i Claude.ai eller Claude Code och
 * klistrar tillbaka svaret. Samma modell och samma prompt som API-läget, men
 * utan structured outputs – därför skickar vi med JSON-schemat i klartext och
 * validerar svaret här i stället för att lita på att formen stämmer.
 */

export function buildManualPrompt({ system, user, schema }) {
  return `${system}

SVARSFORMAT

Svara med enbart ett JSON-objekt som följer schemat nedan. Ingen text före eller efter, ingen förklaring, ingen markdown-kodruta. Alla fält är obligatoriska.

${JSON.stringify(z.toJSONSchema(schema), null, 2)}

UPPGIFT

${user}`
}

/**
 * @returns {{ ok: true, data: unknown } | { ok: false, error: string }}
 */
export function parseManualResponse(text, schema) {
  const raw = typeof text === 'string' ? text.trim() : ''
  if (!raw) return { ok: false, error: 'Klistra in svaret från Claude först.' }

  const json = extractJsonObject(raw)
  if (!json) {
    return {
      ok: false,
      error:
        'Hittade inget komplett JSON-objekt. Kopiera hela svaret från Claude, från första { till sista } – båda måste vara med.',
    }
  }

  let parsed
  try {
    parsed = JSON.parse(json)
  } catch {
    return {
      ok: false,
      error: 'Texten är inte giltig JSON. Kontrollera att hela svaret kom med och att inget klipptes av på slutet.',
    }
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    return { ok: false, error: `Svaret saknar eller har fel form på: ${describeIssues(result.error)}.` }
  }
  return { ok: true, data: result.data }
}

/** Plockar ut det yttersta JSON-objektet, även om det ligger i en kodruta. */
function extractJsonObject(text) {
  const withoutFences = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const start = withoutFences.indexOf('{')
  const end = withoutFences.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  return withoutFences.slice(start, end + 1)
}

function describeIssues(error) {
  const paths = error.issues.slice(0, 4).map((issue) => issue.path.join('.') || '(roten)')
  const unique = [...new Set(paths)]
  const rest = error.issues.length > unique.length ? ` med flera` : ''
  return unique.join(', ') + rest
}
