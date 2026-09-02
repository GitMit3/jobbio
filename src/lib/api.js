/** Anropar serverfunktionen som i sin tur pratar med Claude. */
export async function analyzeCv({ cvText, targetRole, signal }) {
  const response = await fetch('/api/analyze-cv', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cvText, targetRole }),
    signal,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.error || `Analysen misslyckades (${response.status}).`)
  }
  if (!payload?.analysis) {
    throw new Error('Servern svarade utan analys.')
  }
  return payload
}
