import { groupBlocks } from '../lib/cvTemplates.js'

/** CV:t satt i en mall. Samma markup används på skärm och vid utskrift. */
export default function CvPreview({ doc, template }) {
  return (
    <article className={`cv-page tpl-${template}`}>
      <header className="cv-head">
        <h1>{doc.name}</h1>
        {doc.title && <p className="cv-role">{doc.title}</p>}
        {doc.contact.map((line, i) => (
          <p className="cv-contact" key={i}>
            {line}
          </p>
        ))}
      </header>

      {doc.sections.map((section, sectionIndex) => (
        <section className="cv-section" key={sectionIndex}>
          {section.heading && <h2>{section.heading}</h2>}
          {groupBlocks(section.blocks).map((block, blockIndex) => {
            if (block.type === 'list') {
              return (
                <ul key={blockIndex}>
                  {block.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )
            }
            if (block.type === 'entry') {
              return (
                <div className="cv-entry" key={blockIndex}>
                  <span className="cv-entry-title">{block.title}</span>
                  {block.meta && <span className="cv-entry-meta">{block.meta}</span>}
                </div>
              )
            }
            return <p key={blockIndex}>{block.text}</p>
          })}
        </section>
      ))}
    </article>
  )
}
