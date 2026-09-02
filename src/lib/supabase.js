import { createClient } from '@supabase/supabase-js'

/**
 * Förberedd men ännu inte använd. Steg 1 (CV-analys) körs helt utan inloggning
 * och utan lagring, så att den går att testa fristående. Auth och databas
 * kopplas på när vi bygger ansökningsspårningen.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null
