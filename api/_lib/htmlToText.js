/**
 * Plockar ut annonstext ur en HTML-sida. Många jobbsajter märker upp sina
 * annonser med schema.org JobPosting i JSON-LD – det är betydligt renare än
 * sidans synliga text, så vi provar det först och faller tillbaka på <body>.
 */

const BLOCK_TAGS =
  'address|article|aside|blockquote|br|div|dd|dl|dt|fieldset|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul'

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  aring: 'å',
  Aring: 'Å',
  auml: 'ä',
  Auml: 'Ä',
  ouml: 'ö',
  Ouml: 'Ö',
  eacute: 'é',
  Eacute: 'É',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  bull: '•',
  middot: '·',
  laquo: '«',
  raquo: '»',
  shy: '',
}

export function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name] ?? match)
}

function safeCodePoint(code) {
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

/** Tar bort taggar och gör block-element till radbrytningar. */
export function stripTags(html) {
  return collapse(
    decodeEntities(
      html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style|noscript|svg|template|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n')
        .replace(/<[^>]+>/g, ' '),
    ),
  )
}

function collapse(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * @returns {{ text: string, title: string, source: 'json-ld' | 'html' }}
 */
export function extractJobAd(html) {
  const posting = findJobPosting(html)
  const description = posting?.description ? stripTags(String(posting.description)) : ''

  // Litar på uppmärkningen så snart den har en riktig beskrivning. En stub med
  // bara titel säger mindre än sidans egen text, och faller därför igenom.
  if (posting && description.length >= 80) {
    const parts = [
      posting.title,
      [posting.hiringOrganization?.name, locationOf(posting)].filter(Boolean).join(' – '),
      posting.employmentType && `Anställningsform: ${asText(posting.employmentType)}`,
      description,
      posting.qualifications && stripTags(String(posting.qualifications)),
      posting.skills && `Kompetenser: ${asText(posting.skills)}`,
      posting.responsibilities && stripTags(String(posting.responsibilities)),
    ].filter(Boolean)

    return {
      text: collapse(parts.join('\n\n')),
      title: String(posting.title || '').trim(),
      source: 'json-ld',
    }
  }

  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html
  return {
    text: stripTags(body),
    title: decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim(),
    source: 'html',
  }
}

function asText(value) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(', ')
  if (value && typeof value === 'object') return String(value.name ?? '')
  return String(value ?? '')
}

function locationOf(posting) {
  const address = [posting.jobLocation].flat()[0]?.address
  if (!address) return ''
  return [address.addressLocality, address.addressRegion, address.addressCountry]
    .map(asText)
    .filter(Boolean)
    .join(', ')
}

function findJobPosting(html) {
  const scripts = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)

  for (const [, raw] of scripts) {
    let parsed
    try {
      parsed = JSON.parse(raw.trim())
    } catch {
      continue
    }
    const found = searchForPosting(parsed)
    if (found) return found
  }
  return null
}

function searchForPosting(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 5) return null

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = searchForPosting(item, depth + 1)
      if (found) return found
    }
    return null
  }

  const type = node['@type']
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return node

  for (const key of ['@graph', 'mainEntity', 'itemListElement']) {
    const found = searchForPosting(node[key], depth + 1)
    if (found) return found
  }
  return null
}
