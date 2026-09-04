import { createClient } from '@supabase/supabase-js'

/**
 * Supabase används bara av ansökningsspårningen. Saknas konfiguration körs
 * resten av appen precis som förut – klienten blir null och vyn visar en
 * instruktion i stället för att krascha.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null
