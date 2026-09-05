import { spawn } from 'node:child_process'
import { HttpError } from './http.js'

/**
 * Kör en prompt genom Claude Code i headless-läge. Autentiseringen sköts av din
 * lokala inloggning, så analysen betalas av abonnemanget i stället för
 * API-krediter.
 *
 * Finns bara i utvecklingsmiljön: en deploy har ingen CLI att anropa, och
 * endpointen ska inte kunna följa med ut av misstag. Vite sätter flaggan i
 * vite.config.js; på Vercel är den aldrig satt.
 */

const TIMEOUT_MS = Number(process.env.JOBBIO_LOCAL_TIMEOUT_MS) || 300_000
const MAX_OUTPUT_BYTES = 2_000_000

export const isLocalRuntime = () => process.env.JOBBIO_LOCAL_RUNTIME === '1'

export function assertLocalRuntime() {
  if (!isLocalRuntime()) {
    throw new HttpError(
      403,
      'Claude Code-läget finns bara i den lokala utvecklingsmiljön. Använd manuellt läge eller en API-nyckel här.',
    )
  }
}

export function runClaudeCode(prompt) {
  // --restricted tar bort de verktyg som kör kommandon och kod. Vi vill bara ha
  // text tillbaka. Notera att --bare INTE går att använda: den tvingar fram
  // autentisering med API-nyckel och stänger av OAuth, alltså precis det vi
  // försöker undvika.
  const args = ['-p', '--restricted', '--output-format', 'text', '--disable-slash-commands']
  if (process.env.JOBBIO_LOCAL_MODEL) args.push('--model', process.env.JOBBIO_LOCAL_MODEL)
  if (process.env.JOBBIO_LOCAL_EFFORT) args.push('--effort', process.env.JOBBIO_LOCAL_EFFORT)

  return new Promise((resolve, reject) => {
    // shell:true krävs för att hitta claude.cmd på Windows. Alla argument är
    // fasta flaggor - prompten går via stdin, aldrig via kommandoraden, både
    // för att slippa citattecken och för att Windows kapar långa argument.
    const child = spawn('claude', args, { shell: true, windowsHide: true })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(
        new HttpError(
          504,
          `Claude Code svarade inte inom ${Math.round(TIMEOUT_MS / 1000)} sekunder. Prova ett kortare CV, eller sätt JOBBIO_LOCAL_EFFORT=low.`,
        ),
      )
    }, TIMEOUT_MS)

    child.stdout.on('data', (chunk) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 20_000) stderr += chunk
    })

    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(toRunError(error, stderr))
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)

      if (code !== 0) {
        reject(toRunError(null, stderr, code))
        return
      }
      if (!stdout.trim()) {
        reject(new HttpError(502, 'Claude Code svarade tomt. Kontrollera att du är inloggad med `claude`.'))
        return
      }
      resolve(stdout)
    })

    child.stdin.on('error', () => {
      // Processen dog innan prompten skrevs klart – hanteras av close/error.
    })
    child.stdin.end(prompt)
  })
}

function toRunError(error, stderr, code) {
  if (error?.code === 'ENOENT') {
    return new HttpError(
      500,
      'Claude Code hittades inte. Installera med `npm install -g @anthropic-ai/claude-code` och logga in med `claude`.',
    )
  }

  const text = `${stderr}`.trim()
  if (/not logged in|authenticate|unauthorized|login/i.test(text)) {
    return new HttpError(500, 'Claude Code är inte inloggat. Kör `claude` i terminalen och logga in, och försök igen.')
  }
  if (/usage limit|rate limit/i.test(text)) {
    return new HttpError(429, 'Abonnemangets användningsgräns är nådd. Vänta en stund, eller byt till manuellt läge.')
  }

  const detail = text.split('\n').slice(-3).join(' ').slice(0, 300)
  return new HttpError(502, `Claude Code avslutades med fel${code != null ? ` (kod ${code})` : ''}. ${detail}`.trim())
}
