import { useCallback, useEffect, useRef, useState } from 'react'

const INITIAL = { status: 'idle', error: '', data: null, prompt: '' }

/**
 * Driver en analys i något av två lägen:
 *
 *  - API-läge: `runApi` anropar serverfunktionen, som pratar med Anthropic.
 *  - Claude Code-läge: `runLocal` går samma väg, men serverfunktionen kör
 *    prompten genom din lokala Claude Code i stället för mot API:t.
 *  - Manuellt läge: `showPrompt` bygger prompten användaren kör i Claude.ai,
 *    och `submitManual` validerar svaret som klistras tillbaka.
 *
 * Status: idle → loading → done | error (automatiskt), eller idle → prompt →
 * done (manuellt). Alla callbacks måste vara stabila mellan renderingar.
 */
export function useFeatureRun({ apiAction, localAction, buildPrompt, parseResult }) {
  const [state, setState] = useState(INITIAL)
  const abortRef = useRef(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const run = useCallback(async (action, input) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState({ ...INITIAL, status: 'loading' })

    try {
      const data = await action(input, { signal: controller.signal })
      if (controller.signal.aborted) return
      setState({ status: 'done', error: '', data, prompt: '' })
    } catch (error) {
      if (controller.signal.aborted || error.name === 'AbortError') return
      setState({ status: 'error', error: error.message, data: null, prompt: '' })
    }
  }, [])

  const runApi = useCallback((input) => run(apiAction, input), [run, apiAction])
  const runLocal = useCallback((input) => run(localAction, input), [run, localAction])

  const showPrompt = useCallback(
    (input) => {
      abortRef.current?.abort()
      setState({ status: 'prompt', error: '', data: null, prompt: buildPrompt(input) })
    },
    [buildPrompt],
  )

  const submitManual = useCallback(
    (text) => {
      const result = parseResult(text)
      if (!result.ok) {
        setState((previous) => ({ ...previous, error: result.error }))
        return false
      }
      setState((previous) => ({ ...previous, status: 'done', error: '', data: result.data }))
      return true
    },
    [parseResult],
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(INITIAL)
  }, [])

  return { ...state, runApi, runLocal, showPrompt, submitManual, reset }
}
