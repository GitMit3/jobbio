import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'

/**
 * Håller den inloggade sessionen. `loading` är sant tills vi vet om det finns
 * en sparad session, så vyn inte blinkar förbi inloggningsformuläret.
 */
export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return { session, user: session?.user ?? null, loading }
}
