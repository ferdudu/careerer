import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { STEPS } from '@shared/constants'
import type { ProgressEvent, Requirements } from '@shared/types'

type StepState = 'pending' | 'active' | 'done'

export function Processing(): JSX.Element {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [states, setStates] = useState<StepState[]>(['active', 'pending', 'pending', 'pending'])
  const [req, setReq] = useState<Requirements | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const finished = useRef(false)

  const [detail, setDetail] = useState<string | null>(null)

  useEffect(() => {
    const apply = (e: ProgressEvent): void => {
      if (e.requirements) setReq(e.requirements)
      if (e.detail) setDetail(e.detail)
      if (e.status === 'active' || e.status === 'done') {
        setStates((prev) => {
          const next = [...prev]
          for (let i = 0; i < e.step; i++) next[i] = 'done'
          next[e.step] = e.status === 'done' ? 'done' : 'active'
          return next
        })
      }
      if (e.status === 'complete') {
        finished.current = true
        navigate(`/review/${id}`, { replace: true })
      } else if (e.status === 'error') {
        finished.current = true
        setError(e.error ?? 'Generation failed.')
      } else if (e.status === 'cancelled') {
        finished.current = true
        navigate('/', { replace: true })
      }
    }
    const off = window.careerer.generation.onProgress((e: ProgressEvent) => {
      if (e.id === id) apply(e)
    })
    // Replay what happened before this screen subscribed (fast failures included).
    const replay = (): void => {
      void window.careerer.generation.status(id).then((events) => {
        if (finished.current) return
        events.forEach(apply)
      })
    }
    replay()
    const poll = window.setInterval(() => {
      if (!finished.current) replay()
    }, 2500)
    return () => {
      off()
      window.clearInterval(poll)
    }
  }, [id, navigate])

  async function retry(): Promise<void> {
    setError(null)
    setDetail(null)
    setStates(['active', 'pending', 'pending', 'pending'])
    finished.current = false
    try {
      await window.careerer.generation.start({ regenerateId: id })
    } catch (e) {
      finished.current = true
      setError(e instanceof Error ? e.message : 'Could not start again.')
    }
  }

  const heading = req?.title ?? 'Reading the posting'
  const sub = detail ?? (req ? [req.company, req.location].filter(Boolean).join(' · ') : 'This can take a minute or two.')
  const pasteHint = !!error && /paste/i.test(error)

  return (
    <div className="page proc">
      <div className="proc-main">
        <header className="page-head">
          <div className="eyebrow">TAILORING</div>
          <h1 className="display" aria-live="polite">
            {heading}
          </h1>
          <p className="lead">{sub}</p>
        </header>

        <ol className="steps" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} className={`step ${states[i]}`} aria-current={states[i] === 'active' ? 'step' : undefined}>
              <span className="step-dot" aria-hidden="true">
                {states[i] === 'done' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                ) : states[i] === 'active' ? (
                  <span className="live" />
                ) : null}
              </span>
              <div className="step-body">
                <div className="step-label">{label}</div>
                {i === 1 && states[1] === 'done' && req && (
                  <div className="muted small">
                    {req.required.length} required and {req.preferred.length} preferred requirements found
                  </div>
                )}
                {states[i] === 'active' && !error && (
                  <div className="bar" aria-hidden="true">
                    <span />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>

        {error ? (
          <div className="errbox" role="alert">
            <strong>That did not work.</strong>
            <p>{error}</p>
            <div className="row-wrap">
              <button type="button" className="btn" onClick={() => void retry()}>
                Try again
              </button>
              <Link to="/" className="ghost">
                {pasteHint ? 'Paste the posting text' : 'Back'}
              </Link>
              {/claude|sign|settings/i.test(error) && (
                <Link to="/settings" className="ghost">
                  Open Settings
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="row-wrap">
            <button
              type="button"
              className="ghost"
              disabled={cancelling}
              onClick={() => {
                setCancelling(true)
                void window.careerer.generation.cancel(id)
              }}
            >
              {cancelling ? 'Cancelling' : 'Cancel'}
            </button>
          </div>
        )}
      </div>

      <aside className={`proc-side${req ? ' in' : ''}`} aria-label="From the posting">
        <div className="eyebrow">FROM THE POSTING</div>
        {!req && <p className="muted small">Requirements appear here as soon as the posting is read.</p>}
        {req && (
          <>
            <ChipGroup title="Required" items={req.required} />
            <ChipGroup title="Preferred" items={req.preferred} />
            {req.knockouts.length > 0 && (
              <div className="callout">
                <span className="gold">Screening questions likely:</span> {req.knockouts.join('; ')}. Confirm these on the application form.
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  )
}

function ChipGroup({ title, items }: { title: string; items: string[] }): JSX.Element | null {
  if (!items.length) return null
  return (
    <div className="stack tight">
      <div className="small muted">{title}</div>
      <div className="chips">
        {items.map((t) => (
          <span key={t} className="chip">
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}
