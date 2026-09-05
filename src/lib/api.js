/** Anropar serverfunktionerna, som i sin tur pratar med Claude. */

async function post(path, body, { signal } = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.error || `Anropet misslyckades (${response.status}).`)
  }
  return payload
}

export async function analyzeCv({ cvText, targetRole }, options) {
  const payload = await post('/api/analyze-cv', { cvText, targetRole }, options)
  if (!payload?.analysis) throw new Error('Servern svarade utan analys.')
  return payload
}

export async function matchJob({ cvText, jobAdText }, options) {
  const payload = await post('/api/match-job', { cvText, jobAdText }, options)
  if (!payload?.match) throw new Error('Servern svarade utan matchning.')
  return payload
}

export async function fetchJobAd(url, options) {
  const payload = await post('/api/fetch-job-ad', { url }, options)
  if (!payload?.text) throw new Error('Servern svarade utan annonstext.')
  return payload
}

export async function tailorApplication({ cvText, jobAdText }, options) {
  const payload = await post('/api/tailor-application', { cvText, jobAdText }, options)
  if (!payload?.application) throw new Error('Servern svarade utan ansökan.')
  return payload
}

/**
 * Kör analysen genom Claude Code lokalt, med ditt abonnemang i stället för en
 * API-nyckel. Svaret har samma form som motsvarande /api-endpoint.
 */
export async function runWithClaudeCode(feature, input, options) {
  const payload = await post('/api/claude-code', { feature, ...input }, options)
  if (!payload) throw new Error('Servern svarade tomt.')
  return payload
}

export async function improveCv({ cvText, targetRole, selections, answers }, options) {
  const payload = await post('/api/improve-cv', { cvText, targetRole, selections, answers }, options)
  if (!payload?.improvement) throw new Error('Servern svarade utan omskrivning.')
  return payload
}

export async function askQuestions({ cvText, targetRole, selections }, options) {
  const payload = await post('/api/ask-questions', { cvText, targetRole, selections }, options)
  if (!payload?.questions) throw new Error('Servern svarade utan frågor.')
  return payload.questions
}
