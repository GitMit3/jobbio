import { useState } from 'react'

/**
 * Kompletterande frågor innan omskrivningen. Svaren blir fakta i CV:t, och
 * ersätter de platshållare som annars hade lämnats kvar som hål i texten.
 */
export default function ImproveQuestions({ questions, onSubmit, onSkip, isWriting }) {
  const [answers, setAnswers] = useState({})

  const answered = questions.filter((item) => (answers[item.id] || '').trim()).length

  return (
    <section className="panel accent questions">
      <div className="document-head">
        <div>
          <h3>Innan jag skriver om</h3>
          <span className="counter">
            {answered} av {questions.length} besvarade
          </span>
        </div>
        <div className="document-actions">
          <button type="button" className="ghost" onClick={onSkip} disabled={isWriting}>
            Hoppa över
          </button>
          <button type="button" className="primary" onClick={() => onSubmit(answers)} disabled={isWriting}>
            {isWriting ? 'Skriver om…' : 'Skriv om CV:t'}
          </button>
        </div>
      </div>

      <p className="hint">
        Svaren används som fakta i texten. Hoppar du över en fråga utelämnas det förslaget hellre än att något gissas
        fram – du får se vad som utelämnades efteråt.
      </p>

      <ol className="question-list">
        {questions.map((item) => (
          <li key={item.id}>
            <label htmlFor={`q-${item.id}`}>{item.question}</label>
            <p className="dim small">{item.context}</p>
            <input
              id={`q-${item.id}`}
              type="text"
              placeholder={item.hint}
              value={answers[item.id] || ''}
              onChange={(event) => setAnswers((previous) => ({ ...previous, [item.id]: event.target.value }))}
              disabled={isWriting}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}
