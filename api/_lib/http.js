/**
 * Små hjälpare så att handlers kan använda samma kod i Vercels Node-runtime
 * som i Vites dev-middleware. Vi rör bara vanliga Node req/res, aldrig
 * Vercel-specifika res.json()/res.status().
 */

const MAX_BODY_BYTES = 1_000_000

export function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

export async function readJsonBody(req) {
  // Vercel parsar JSON åt oss; dev-middleware gör det inte.
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {}

  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Förfrågan är för stor.')
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new HttpError(400, 'Kunde inte tolka förfrågan som JSON.')
  }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
