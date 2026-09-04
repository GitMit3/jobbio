import { supabase } from './supabase.js'

/** Statusvärdena måste matcha check-villkoret i supabase/schema.sql. */
export const STATUSES = [
  { id: 'skickad', label: 'Skickad', tone: 'neutral' },
  { id: 'svar', label: 'Svar', tone: 'ok' },
  { id: 'intervju', label: 'Intervju', tone: 'good' },
  { id: 'avslag', label: 'Avslag', tone: 'bad' },
]

export const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label ?? id
export const statusTone = (id) => STATUSES.find((s) => s.id === id)?.tone ?? 'neutral'

export function todayIso() {
  const now = new Date()
  const offsetMinutes = now.getTimezoneOffset()
  return new Date(now.getTime() - offsetMinutes * 60_000).toISOString().slice(0, 10)
}

/** Supabase-fel är tekniska. Översätt de vi kan förutse. */
function toMessage(error, fallback) {
  const message = error?.message || ''
  if (/row-level security/i.test(message)) return 'Du saknar behörighet till den här raden.'
  if (/relation .*applications.* does not exist/i.test(message)) {
    return 'Tabellen saknas i databasen. Kör supabase/schema.sql i Supabase SQL Editor först.'
  }
  if (/violates check constraint/i.test(message)) return 'Ogiltig status.'
  if (/Failed to fetch|NetworkError/i.test(message)) return 'Kunde inte nå Supabase. Kontrollera din uppkoppling.'
  return message || fallback
}

export async function listApplications() {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .order('applied_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(toMessage(error, 'Kunde inte hämta ansökningarna.'))
  return data ?? []
}

export async function createApplication(userId, values) {
  const { data, error } = await supabase
    .from('applications')
    .insert({ ...normalize(values), user_id: userId })
    .select()
    .single()

  if (error) throw new Error(toMessage(error, 'Kunde inte spara ansökan.'))
  return data
}

export async function updateApplication(id, values) {
  const { data, error } = await supabase
    .from('applications')
    .update(normalize(values))
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(toMessage(error, 'Kunde inte uppdatera ansökan.'))
  return data
}

export async function deleteApplication(id) {
  const { error } = await supabase.from('applications').delete().eq('id', id)
  if (error) throw new Error(toMessage(error, 'Kunde inte ta bort ansökan.'))
}

function normalize(values) {
  const trimmed = {}
  for (const [key, value] of Object.entries(values)) {
    trimmed[key] = typeof value === 'string' ? value.trim() || null : value
  }
  return trimmed
}
