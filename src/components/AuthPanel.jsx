import { useId, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const MESSAGES = {
  'Invalid login credentials': 'Fel e-post eller lösenord.',
  'User already registered': 'Det finns redan ett konto med den e-posten. Logga in i stället.',
  'Email not confirmed': 'Kontot är inte bekräftat. Kolla din mejl, eller stäng av e-postbekräftelse i Supabase.',
}

const translate = (message) =>
  MESSAGES[message] ??
  (/password.*at least (\d+)/i.test(message)
    ? `Lösenordet måste vara minst ${message.match(/at least (\d+)/i)[1]} tecken.`
    : message)

export default function AuthPanel() {
  const emailId = useId()
  const passwordId = useId()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')

    try {
      const credentials = { email: email.trim(), password }
      const { data, error: authError } = isSignUp
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials)

      if (authError) {
        setError(translate(authError.message))
      } else if (isSignUp && !data.session) {
        setNotice('Konto skapat. Bekräfta din e-postadress via länken vi skickat, och logga sedan in.')
      }
      // Lyckad inloggning fångas av onAuthStateChange i useAuth.
    } catch (unexpected) {
      setError(unexpected.message || 'Något gick fel vid inloggningen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel auth" onSubmit={handleSubmit}>
      <h3>{isSignUp ? 'Skapa konto' : 'Logga in'}</h3>
      <p className="hint">
        Ansökningarna sparas per konto. De tre andra flikarna fungerar utan inloggning.
      </p>

      <div className="field">
        <label htmlFor={emailId}>E-post</label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
        />
      </div>

      <div className="field">
        <label htmlFor={passwordId}>Lösenord</label>
        <input
          id={passwordId}
          type="password"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
        />
      </div>

      {error && <p className="hint warn">{error}</p>}
      {notice && <p className="hint">{notice}</p>}

      <div className="uploader-actions">
        <button type="submit" className="primary" disabled={busy || !email.trim() || !password}>
          {busy ? 'Vänta…' : isSignUp ? 'Skapa konto' : 'Logga in'}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setIsSignUp(!isSignUp)
            setError('')
            setNotice('')
          }}
          disabled={busy}
        >
          {isSignUp ? 'Jag har redan ett konto' : 'Skapa nytt konto'}
        </button>
      </div>
    </form>
  )
}
