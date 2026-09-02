import Anthropic from '@anthropic-ai/sdk'
import { HttpError } from './http.js'

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5'

// low | medium | high | xhigh | max. medium räcker gott för CV-analys och
// håller nere både kostnad och svarstid; höj om analyserna känns ytliga.
export const EFFORT = process.env.ANTHROPIC_EFFORT || 'medium'

let client

export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(500, 'ANTHROPIC_API_KEY saknas på servern. Se .env.example.')
  }
  if (!client) client = new Anthropic()
  return client
}

/** Översätter SDK-fel till något som går att visa för användaren. */
export function toHttpError(error) {
  if (error instanceof HttpError) return error
  if (error instanceof Anthropic.AuthenticationError) {
    return new HttpError(500, 'Anthropic avvisade API-nyckeln. Kontrollera ANTHROPIC_API_KEY.')
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new HttpError(429, 'För många förfrågningar mot Anthropic just nu. Försök igen om en stund.')
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new HttpError(400, `Anthropic avvisade förfrågan: ${error.message}`)
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new HttpError(502, 'Kunde inte nå Anthropic. Kontrollera nätverket och försök igen.')
  }
  if (error instanceof Anthropic.APIError) {
    return new HttpError(502, `Fel från Anthropic (${error.status}): ${error.message}`)
  }
  return new HttpError(500, error?.message || 'Okänt serverfel.')
}
