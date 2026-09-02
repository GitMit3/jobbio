import dns from 'node:dns/promises'
import net from 'node:net'
import { extractJobAd } from './_lib/htmlToText.js'
import { HttpError, readJsonBody, sendJson } from './_lib/http.js'

const MAX_REDIRECTS = 3
const MAX_BYTES = 3 * 1024 * 1024
const TIMEOUT_MS = 12_000
const MIN_USEFUL_CHARS = 300
const USER_AGENT = 'Mozilla/5.0 (compatible; JobbioBot/0.1; +https://github.com/GitMit3/jobbio)'

/**
 * Hämtar en jobbannons från en URL och returnerar den som text.
 *
 * URL:en kommer från användaren och hämtas av vår server, så varje hopp
 * kontrolleras mot interna adresser (SSRF). Kontrollen har en oundviklig
 * TOCTOU-lucka mellan DNS-slagning och anrop – acceptabel här eftersom svaret
 * bara blir text som visas för samma användare, aldrig något vi agerar på.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Endast POST stöds.')

    const body = await readJsonBody(req)
    const url = parseUrl(body.url)

    const { response, finalUrl } = await fetchFollowingRedirects(url)

    const contentType = response.headers.get('content-type') || ''
    if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
      throw new HttpError(
        415,
        `Länken pekar på ${contentType.split(';')[0] || 'okänt innehåll'}, inte en webbsida. Klistra in annonstexten istället.`,
      )
    }

    const page = await readCapped(response)
    const { text, title, source } =
      /text\/plain/i.test(contentType) ? { text: page.trim(), title: '', source: 'plain' } : extractJobAd(page)

    if (text.length < MIN_USEFUL_CHARS) {
      throw new HttpError(
        422,
        'Hittade ingen annonstext på sidan. Många jobbsajter kräver JavaScript eller blockerar hämtning – kopiera annonsen och klistra in den istället.',
      )
    }

    sendJson(res, 200, {
      text: text.slice(0, 40_000),
      title,
      finalUrl: finalUrl.href,
      warning:
        source === 'html'
          ? 'Texten hämtades från hela sidan och kan innehålla menyer och cookie-texter. Rensa bort det som inte hör till annonsen.'
          : '',
    })
  } catch (error) {
    const httpError = toFetchError(error)
    if (httpError.status >= 500) console.error('[fetch-job-ad]', error)
    sendJson(res, httpError.status, { error: httpError.message })
  }
}

function parseUrl(value) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, 'Ingen länk angavs.')

  let url
  try {
    url = new URL(value.trim())
  } catch {
    throw new HttpError(400, 'Länken ser inte ut som en giltig webbadress.')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'Bara http- och https-länkar kan hämtas.')
  }
  return url
}

async function fetchFollowingRedirects(startUrl) {
  let url = startUrl

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicHost(url)

    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
        'accept-language': 'sv-SE,sv;q=0.9,en;q=0.8',
      },
    })

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) throw new HttpError(502, 'Sidan svarade med en omdirigering utan måladress.')
      response.body?.cancel()
      url = new URL(location, url)
      continue
    }

    if (response.status === 403 || response.status === 429) {
      throw new HttpError(422, 'Sajten blockerade hämtningen. Kopiera annonstexten och klistra in den istället.')
    }
    if (!response.ok) {
      throw new HttpError(502, `Sidan svarade med status ${response.status}.`)
    }
    return { response, finalUrl: url }
  }

  throw new HttpError(502, 'Länken omdirigerade för många gånger.')
}

async function assertPublicHost(url) {
  // url.hostname behåller hakparenteserna runt IPv6-literaler ("[::1]").
  const hostname = url.hostname.replace(/^\[|\]$/g, '')

  if (net.isIP(hostname) && isPrivateAddress(hostname)) {
    throw new HttpError(400, 'Den adressen går till ett internt nätverk och kan inte hämtas.')
  }

  let addresses
  try {
    addresses = await dns.lookup(hostname, { all: true })
  } catch {
    throw new HttpError(400, `Hittade ingen server på ${hostname}.`)
  }

  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new HttpError(400, 'Den adressen går till ett internt nätverk och kan inte hämtas.')
  }
}

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a >= 224) return true // multicast och reserverat
    return false
  }

  const address = ip.toLowerCase().split('%')[0]
  if (address === '::' || address === '::1') return true
  if (/^(fc|fd|fe8|fe9|fea|feb)/.test(address)) return true // unique local, link local
  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mapped) return isPrivateAddress(mapped[1])
  return false
}

async function readCapped(response) {
  const declared = Number(response.headers.get('content-length'))
  if (declared > MAX_BYTES) throw new HttpError(413, 'Sidan är för stor för att hämtas.')

  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.length
    chunks.push(value)
    if (received > MAX_BYTES) {
      await reader.cancel()
      break
    }
  }

  return new TextDecoder('utf-8').decode(Buffer.concat(chunks.map(Buffer.from)))
}

function toFetchError(error) {
  if (error instanceof HttpError) return error
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return new HttpError(504, 'Sidan svarade inte i tid. Klistra in annonstexten istället.')
  }
  if (error instanceof TypeError) {
    return new HttpError(502, 'Kunde inte nå sidan. Kontrollera länken.')
  }
  return new HttpError(500, error?.message || 'Okänt fel vid hämtning.')
}
