import { useEffect, useMemo, useState } from 'react'
import {
  STATUSES,
  createApplication,
  deleteApplication,
  listApplications,
  statusTone,
  todayIso,
  updateApplication,
} from '../lib/applications.js'

const EMPTY = { company: '', role_title: '', job_ad_url: '', status: 'skickad', applied_at: todayIso(), notes: '' }

function AddForm({ onAdd, busy }) {
  const [values, setValues] = useState(EMPTY)
  const [error, setError] = useState('')

  const set = (key) => (event) => setValues((previous) => ({ ...previous, [key]: event.target.value }))
  const ready = values.company.trim() && values.role_title.trim()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    try {
      await onAdd(values)
      setValues({ ...EMPTY, applied_at: values.applied_at })
    } catch (addError) {
      setError(addError.message)
    }
  }

  return (
    <form className="panel accent add-form" onSubmit={handleSubmit}>
      <h3>Lägg till ansökan</h3>

      <div className="add-grid">
        <div className="field">
          <label htmlFor="app-company">Företag</label>
          <input id="app-company" type="text" value={values.company} onChange={set('company')} disabled={busy} />
        </div>
        <div className="field">
          <label htmlFor="app-role">Roll</label>
          <input id="app-role" type="text" value={values.role_title} onChange={set('role_title')} disabled={busy} />
        </div>
        <div className="field">
          <label htmlFor="app-date">Datum</label>
          <input id="app-date" type="date" value={values.applied_at} onChange={set('applied_at')} disabled={busy} />
        </div>
        <div className="field">
          <label htmlFor="app-status">Status</label>
          <select id="app-status" value={values.status} onChange={set('status')} disabled={busy}>
            {STATUSES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field wide">
          <label htmlFor="app-url">Länk till annonsen</label>
          <input
            id="app-url"
            type="url"
            placeholder="https://…"
            value={values.job_ad_url}
            onChange={set('job_ad_url')}
            disabled={busy}
          />
        </div>
        <div className="field wide">
          <label htmlFor="app-notes">Anteckning</label>
          <input
            id="app-notes"
            type="text"
            placeholder="t.ex. kontaktperson eller vad du väntar på"
            value={values.notes}
            onChange={set('notes')}
            disabled={busy}
          />
        </div>
      </div>

      {error && <p className="hint warn">{error}</p>}

      <div className="uploader-actions">
        <button type="submit" className="primary" disabled={busy || !ready}>
          Lägg till
        </button>
      </div>
    </form>
  )
}

function Row({ item, onStatusChange, onDelete }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <li className={`application tone-${statusTone(item.status)}`}>
      <div className="application-main">
        <span className="application-role">{item.role_title}</span>
        <span className="dim"> · {item.company}</span>
        {item.notes && <p className="dim small">{item.notes}</p>}
      </div>

      <time className="application-date" dateTime={item.applied_at}>
        {item.applied_at}
      </time>

      <div className="application-link">
        {item.job_ad_url ? (
          <a href={item.job_ad_url} target="_blank" rel="noreferrer">
            Annons
          </a>
        ) : (
          <span className="faint">—</span>
        )}
      </div>

      <select
        className={`status-select tone-${statusTone(item.status)}`}
        value={item.status}
        onChange={(event) => onStatusChange(item, event.target.value)}
        aria-label={`Status för ${item.role_title}`}
      >
        {STATUSES.map(({ id, label }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>

      {confirming ? (
        <span className="confirm">
          <button type="button" className="danger" onClick={() => onDelete(item)}>
            Ta bort
          </button>
          <button type="button" className="ghost" onClick={() => setConfirming(false)}>
            Avbryt
          </button>
        </span>
      ) : (
        <button type="button" className="ghost" onClick={() => setConfirming(true)}>
          Ta bort
        </button>
      )}
    </li>
  )
}

export default function ApplicationsBoard({ userId }) {
  const [items, setItems] = useState([])
  const [state, setState] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('alla')

  useEffect(() => {
    let active = true
    listApplications()
      .then((rows) => {
        if (!active) return
        setItems(rows)
        setState('ready')
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError.message)
        setState('error')
      })
    return () => {
      active = false
    }
  }, [userId])

  const counts = useMemo(() => {
    const result = { alla: items.length }
    for (const { id } of STATUSES) result[id] = items.filter((item) => item.status === id).length
    return result
  }, [items])

  const visible = filter === 'alla' ? items : items.filter((item) => item.status === filter)

  async function handleAdd(values) {
    setBusy(true)
    try {
      const created = await createApplication(userId, values)
      setItems((previous) => [created, ...previous])
    } finally {
      setBusy(false)
    }
  }

  async function handleStatusChange(item, status) {
    const previousStatus = item.status
    setItems((previous) => previous.map((row) => (row.id === item.id ? { ...row, status } : row)))
    try {
      await updateApplication(item.id, { status })
    } catch (updateError) {
      setItems((previous) => previous.map((row) => (row.id === item.id ? { ...row, status: previousStatus } : row)))
      setError(updateError.message)
    }
  }

  async function handleDelete(item) {
    const snapshot = items
    setItems((previous) => previous.filter((row) => row.id !== item.id))
    try {
      await deleteApplication(item.id)
    } catch (deleteError) {
      setItems(snapshot)
      setError(deleteError.message)
    }
  }

  if (state === 'loading') {
    return (
      <div className="panel-message">
        <h3>Hämtar dina ansökningar</h3>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="panel-message bad">
        <h3>Kunde inte hämta ansökningarna</h3>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="result">
      <AddForm onAdd={handleAdd} busy={busy} />

      <div className="panel filters">
        {[{ id: 'alla', label: 'Alla' }, ...STATUSES].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`filter ${filter === id ? 'active' : ''} tone-${id === 'alla' ? 'neutral' : statusTone(id)}`}
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
          >
            <strong>{counts[id] ?? 0}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {error && <p className="hint warn">{error}</p>}

      {items.length === 0 ? (
        <div className="panel-message">
          <h3>Inga ansökningar än</h3>
          <p>Lägg till den första ovan, så samlas de här med status, datum och länk.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="panel-message">
          <h3>Inga med den statusen</h3>
        </div>
      ) : (
        <ul className="applications">
          {visible.map((item) => (
            <Row key={item.id} item={item} onStatusChange={handleStatusChange} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </div>
  )
}
