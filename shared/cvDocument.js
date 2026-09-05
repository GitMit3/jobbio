/**
 * Tolkar ett CV i ren text till struktur, så att det kan sättas i en mall och
 * exporteras till PDF eller Word.
 *
 * Texten kommer från appens egen omskrivning och följer därför ett känt mönster:
 * namn överst, rubriker i VERSALER, punkter med bindestreck. Parsern är ändå
 * skriven för att aldrig tappa innehåll - det som inte känns igen blir vanlig
 * text i stället för att försvinna.
 */

const BULLET = /^[-•*]\s+/
const YEAR = /\b(19|20)\d{2}\b/
const ONGOING = /\b(nu|nuvarande|pågående|idag|present)\b/i
const CONTACT = /[@]|\d{3}|\b(linkedin|github)\b/i

const isBlank = (line) => !line.trim()

/** "NOV 2024 – APR 2025", "2021 - nu", "SEP 2023 – JUN 2025" */
function isDateLine(line) {
  const text = line.trim()
  if (text.length > 60) return false
  if (!YEAR.test(text)) return false
  return /[–—-]/.test(text) || ONGOING.test(text)
}

/** Rubrik: versaler, inga siffror, kort. Datumrader fångas av sifferkravet. */
function isHeading(line) {
  const text = line.trim()
  if (!text || text.length > 40) return false
  if (/\d/.test(text)) return false
  if (BULLET.test(text)) return false
  return text === text.toLocaleUpperCase('sv-SE') && /[A-ZÅÄÖ]/.test(text)
}

export function parseCv(rawText) {
  const lines = String(rawText || '').replace(/\r\n?/g, '\n').split('\n')

  const header = { name: '', title: '', contact: [] }
  let index = 0

  // Rubrikblocket: allt fram till första tomma raden.
  const headerLines = []
  while (index < lines.length && !isBlank(lines[index])) {
    headerLines.push(lines[index].trim())
    index += 1
  }

  if (headerLines.length) header.name = headerLines.shift()
  for (const line of headerLines) {
    if (CONTACT.test(line)) header.contact.push(line)
    else if (!header.title) header.title = line
    else header.contact.push(line)
  }

  const sections = []
  let current = null
  const push = (block) => {
    if (!current) {
      current = { heading: '', blocks: [] }
      sections.push(current)
    }
    current.blocks.push(block)
  }

  for (; index < lines.length; index += 1) {
    const line = lines[index]
    if (isBlank(line)) continue
    const text = line.trim()

    if (isHeading(text)) {
      current = { heading: text, blocks: [] }
      sections.push(current)
      continue
    }

    if (BULLET.test(text)) {
      push({ type: 'bullet', text: text.replace(BULLET, '') })
      continue
    }

    if (isDateLine(text)) {
      // Datumraden hör till posten ovanför, om det finns en.
      const last = current?.blocks[current.blocks.length - 1]
      if (last && last.type === 'entry' && !last.meta) last.meta = text
      else push({ type: 'text', text })
      continue
    }

    // En rad följd av datum eller punkter är en rubrik för en post.
    const next = lines[index + 1]?.trim() ?? ''
    if (isDateLine(next) || BULLET.test(next)) push({ type: 'entry', title: text, meta: '' })
    else push({ type: 'text', text })
  }

  return { ...header, sections: sections.filter((s) => s.heading || s.blocks.length) }
}

/** Platshållare kvar i texten – värt att varna för före export. */
export function findPlaceholders(text) {
  return [...new Set([...String(text || '').matchAll(/\[[^\]\n]{1,60}\]/g)].map((m) => m[0]))]
}
