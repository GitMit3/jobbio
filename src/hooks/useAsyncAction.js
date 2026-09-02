import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Kör ett asynkront anrop och håller status/fel/resultat. Ett nytt anrop
 * avbryter det föregående, och ett avbrutet anrop skriver aldrig över state.
 *
 * `action` måste vara stabil mellan renderingar (t.ex. en modulnivå-funktion).
 */
export function useAsyncAction(action) {
  const [state, setState] = useState({ status: 'idle', error: '', data: null })
  const abortRef = useRef(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const run = useCallback(
    async (input) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState((previous) => ({ ...previous, status: 'loading', error: '' }))

      try {
        const data = await action(input, { signal: controller.signal })
        if (controller.signal.aborted) return
        setState({ status: 'done', error: '', data })
      } catch (error) {
        if (controller.signal.aborted || error.name === 'AbortError') return
        setState({ status: 'error', error: error.message, data: null })
      }
    },
    [action],
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState({ status: 'idle', error: '', data: null })
  }, [])

  return { ...state, run, reset }
}
