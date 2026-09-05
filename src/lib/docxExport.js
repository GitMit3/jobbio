import { groupBlocks } from './cvTemplates.js'

/**
 * Bygger en riktig .docx av det tolkade CV:t. Rubriker sätts som Word-rubriker
 * och punkter som riktiga listor – inga tabeller eller textrutor, så att både
 * Word och ett ATS läser dokumentet som det ser ut.
 */

const FONTS = {
  klassisk: { body: 'Georgia', head: 'Georgia', accent: '000000', center: true },
  modern: { body: 'Calibri', head: 'Calibri', accent: 'C00000', center: false },
  kompakt: { body: 'Calibri', head: 'Calibri', accent: '000000', center: false },
}

const SIZES = {
  klassisk: { name: 32, role: 22, heading: 24, body: 21 },
  modern: { name: 40, role: 24, heading: 24, body: 21 },
  kompakt: { name: 28, role: 20, heading: 21, body: 19 },
}

export async function cvToDocxBlob(doc, template = 'klassisk') {
  // docx är ~380 kB och behövs bara när någon faktiskt sparar som Word.
  const { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx')

  const font = FONTS[template] ?? FONTS.klassisk
  const size = SIZES[template] ?? SIZES.klassisk
  const align = font.center ? AlignmentType.CENTER : AlignmentType.LEFT

  const children = [
    new Paragraph({
      alignment: align,
      spacing: { after: 40 },
      children: [new TextRun({ text: doc.name, bold: true, size: size.name, font: font.head })],
    }),
  ]

  if (doc.title) {
    children.push(
      new Paragraph({
        alignment: align,
        spacing: { after: 40 },
        children: [new TextRun({ text: doc.title, size: size.role, font: font.head, color: font.accent })],
      }),
    )
  }

  for (const line of doc.contact) {
    children.push(
      new Paragraph({
        alignment: align,
        spacing: { after: 40 },
        children: [new TextRun({ text: line, size: size.body, font: font.body })],
      }),
    )
  }

  for (const section of doc.sections) {
    if (section.heading) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 280, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 4, color: font.accent } },
          children: [
            new TextRun({
              text: section.heading,
              bold: true,
              size: size.heading,
              font: font.head,
              color: font.accent,
            }),
          ],
        }),
      )
    }

    for (const block of groupBlocks(section.blocks)) {
      if (block.type === 'list') {
        for (const item of block.items) {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 60 },
              children: [new TextRun({ text: item, size: size.body, font: font.body })],
            }),
          )
        }
        continue
      }

      if (block.type === 'entry') {
        children.push(
          new Paragraph({
            spacing: { before: 140, after: 20 },
            children: [new TextRun({ text: block.title, bold: true, size: size.body, font: font.body })],
          }),
        )
        if (block.meta) {
          children.push(
            new Paragraph({
              spacing: { after: 60 },
              children: [new TextRun({ text: block.meta, italics: true, size: size.body - 1, font: font.body })],
            }),
          )
        }
        continue
      }

      children.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: block.text, size: size.body, font: font.body })],
        }),
      )
    }
  }

  const document = new Document({
    creator: 'Jobbio',
    title: doc.name || 'CV',
    sections: [
      {
        properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
        children,
      },
    ],
  })

  return Packer.toBlob(document)
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function cvFileName(doc, extension) {
  const slug = (doc.name || 'cv')
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
  return `cv-${slug || 'jobbio'}.${extension}`
}
