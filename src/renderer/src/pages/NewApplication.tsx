import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ApplicationMeta, AtsInfo } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { errMsg, useCli, useProfile } from '../hooks'

export function NewApplication(): JSX.Element {
  const navigate = useNavigate()
  const { profile, loaded } = useProfile()
  const cli = useCli()
  const [pasteMode, setPasteMode] = useState(false)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState<ApplicationMeta[]>([])
  const [ats, setAts] = useState<AtsInfo | null>(null)
  const mock = window.careerer.isMock

  useEffect(() => {
    void window.careerer.applications.list().then((l) => setRecent(l.slice(0, 3)))
    void window.careerer.ats.info().then(setAts)
  }, [])

  const noProfile = loaded && !profile?.rawText.trim()
  const noCli = !mock && (cli === null || !cli.found)
  const notSignedIn = !mock && cli?.found === true && cli.loggedIn === false
  const reason = noProfile
    ? 'Add your profile first.'
    : cli === null && !mock
      ? 'Checking for the Claude CLI...'
      : noCli
        ? (cli?.problem ?? 'The Claude CLI was not found.') + ' Set it up in Settings.'
        : notSignedIn
          ? 'Claude CLI is not signed in. Run "claude auth login" in a terminal, then check again in Settings.'
          : null
  const empty = pasteMode ? !text.trim() : !url.trim()
  const disabled = !!reason || busy || empty || !loaded

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (disabled) return
    setBusy(true)
    setError(null)
    try {
      const { id } = await window.careerer.generation.start(pasteMode ? { text } : { url })
      navigate(`/processing/${id}`)
    } catch (err) {
      setError(errMsg(err))
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="NEW APPLICATION"
        title="Tailor a resume to a role"
        lead="Paste a job link or the posting text. Careerer matches it against your profile and writes a resume and cover letter."
      />
      <form className="stack" onSubmit={(e) => void submit(e)} aria-describedby={reason ? 'reason' : undefined}>
        {pasteMode ? (
          <>
            <label className="field-label" htmlFor="posting-text">
              Posting text
            </label>
            <textarea
              id="posting-text"
              className="input posting-area"
              placeholder="Paste the whole job description here"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </>
        ) : (
          <>
            <label className="field-label" htmlFor="posting-url">
              Job posting link
            </label>
            <input
              id="posting-url"
              className="input"
              type="text"
              inputMode="url"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </>
        )}
        <div className="row-wrap">
          <button type="submit" className="btn" disabled={disabled}>
            {busy ? 'Starting' : 'Tailor my documents'}
          </button>
          <button
            type="button"
            className="linkbtn"
            onClick={() => {
              setPasteMode((p) => !p)
              setError(null)
            }}
          >
            {pasteMode ? 'Use a link instead' : 'Paste the posting text instead'}
          </button>
        </div>
        {reason && (
          <p id="reason" className="note" role="status">
            {reason}{' '}
            <Link to={noProfile ? '/profile' : '/settings'} className="link">
              {noProfile ? 'Open Profile' : 'Open Settings'}
            </Link>
          </p>
        )}
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        {mock && <p className="note">Mock mode is on: sample data, no Claude sign-in needed.</p>}
      </form>

      <section className="cards" aria-label="Context">
        <div className="card">
          <div className="card-h">
            <span>PROFILE</span>
            {profile && <span className="ok">Ready</span>}
          </div>
          <div className="card-t">
            {profile?.parsed?.name ?? (profile ? 'Profile saved' : 'No profile yet')}
          </div>
          <Link to="/profile" className="link">
            {profile ? 'Edit profile' : 'Add your profile'}
          </Link>
        </div>
        <div className="card">
          <div className="card-h">
            <span>ATS CONTEXT</span>
            {ats?.exists && <span className="ok">Loaded</span>}
          </div>
          <div className="card-t">{ats?.exists ? 'Research report in use' : 'No report found'}</div>
          <Link to="/profile" className="link">
            Manage
          </Link>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="stack" aria-label="Recent applications">
          <div className="eyebrow">RECENT</div>
          <ul className="plain-list">
            {recent.map((a) => (
              <li key={a.id}>
                <Link to={`/review/${a.id}`} className="list-row">
                  <span className="grow">{a.role || 'Untitled role'}</span>
                  <span className="muted">{a.company}</span>
                  <span className="muted">{new Date(a.createdAt).toLocaleDateString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
