/**
 * Vilka delar av analysen som går att kryssa i, och vilken text som skickas
 * vidare när användaren väljer dem. Id:na måste vara stabila mellan
 * renderingar - de är nyckeln till urvalet.
 */

export const suggestionId = (kind, ...parts) => [kind, ...parts].join(':')

/** @returns {{ id: string, text: string }[]} allt som går att välja, i läsordning. */
export function selectableItems(analysis) {
  const items = analysis.topActions.map((action, i) => ({ id: suggestionId('action', i), text: action }))

  analysis.sections.forEach((section, sectionIndex) => {
    section.suggestions.forEach((suggestion, index) => {
      const example = suggestion.example ? ` Exempel på ny formulering: ${suggestion.example}` : ''
      items.push({
        id: suggestionId('fix', sectionIndex, index),
        text: `${section.name} – ${suggestion.issue}. ${suggestion.action}${example}`,
      })
    })
  })

  analysis.missingKeywords.forEach((keyword, index) => {
    items.push({
      id: suggestionId('keyword', index),
      text: `Väv in nyckelordet "${keyword.keyword}" där det hör hemma. ${keyword.reason}`,
    })
  })

  return items
}

export function selectedTexts(analysis, selectedIds) {
  return selectableItems(analysis)
    .filter((item) => selectedIds.has(item.id))
    .map((item) => item.text)
}

/** Allt utom det som redan fungerar – en rimlig utgångspunkt för "Välj alla". */
export function allSelectableIds(analysis) {
  return new Set(selectableItems(analysis).map((item) => item.id))
}
