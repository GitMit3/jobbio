/**
 * Mallarna är avsiktligt enspaltiga, utan tabeller, textrutor och ikoner.
 * Tvåspaltiga CV ser snyggare ut men läses ofta sönder av ATS - och hela appen
 * går ut på att komma igenom just ett ATS. Skillnaden ligger i typografi och
 * rytm, inte i layouttrick.
 */
export const TEMPLATES = [
  {
    id: 'klassisk',
    name: 'Klassisk',
    description: 'Centrerat namn, linjer under rubrikerna. Neutral och lätt att läsa för både människa och maskin.',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Vänsterställt, stora rubriker och en färgad accent. Sticker ut utan att bli svårläst.',
  },
  {
    id: 'kompakt',
    name: 'Kompakt',
    description: 'Tätare typografi för CV som annars spiller över på en andra sida.',
  },
]

export const DEFAULT_TEMPLATE = 'klassisk'

/** Slår ihop punkter som följer på varandra till listor. */
export function groupBlocks(blocks) {
  const groups = []
  for (const block of blocks) {
    const last = groups[groups.length - 1]
    if (block.type === 'bullet') {
      if (last?.type === 'list') last.items.push(block.text)
      else groups.push({ type: 'list', items: [block.text] })
    } else {
      groups.push(block)
    }
  }
  return groups
}
