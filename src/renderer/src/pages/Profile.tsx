import { useEffect, useState } from 'react'
import type { AtsInfo, ParsedProfile } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { errMsg, useProfile } from '../hooks'

function counts(p: ParsedProfile): { label: string; n: number }[] {
  return [
    { label: 'Roles', n: p.experience.length },
    { label: 'Skill groups', n: p.skills.length },
    { label: 'Skills', n: p.skills.reduce((a, g) => a + g.items.length, 0) },
    { label: 'Projects', n: p.projects.length },
    { label: 'Education', n: p.education.length },
    { label: 'Certifications', n: p.certifications.length },
    { label: 'Links', n: p.contacts.links.length + (p.contacts.email ? 1 : 0) + (p.contacts.phone ? 1 : 0) }
  ]
}

export function Profile(): JSX.Element {
  const { profile, loaded, reload } = useProfile()
  const [text, setText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [ats, setAts] = useState<AtsInfo | null>(null)
  const [parsedNow, setParsedNow] = useState<ParsedProfile | null>(null)

  useEffect(() => {
    if (loaded && !dirty) setText(profile?.rawText ?? '')
  }, [loaded, profile, dirty])
  useEffect(() => {
    void window.careerer.ats.info().then(setAts)
  }, [])

  const found = parsedNow ?? (!dirty ? profile?.parsed : undefined) ?? null
  const placeholders = Array.from(new Set(text.match(/\[[^\]\n]{1,100}\]/g) ?? []))

  async function save(): Promise<void> {
    setBusy(true)
    setMsg(null)
    try {
      const saved = await window.careerer.profile.save(text)
      setParsedNow(saved.profile.parsed ?? null)
      setDirty(false)
      await reload()
      window.dispatchEvent(new Event('profile-changed'))
      setMsg(
        saved.profile.parsed
          ? { kind: 'ok', text: 'Profile saved and read.' }
          : { kind: 'err', text: `Profile saved, but it could not be read into sections: ${saved.parseError ?? 'unknown reason'}. Fix that (see Settings) and save again.` }
      )
    } catch (e) {
      setMsg({ kind: 'err', text: errMsg(e) })
    } finally {
      setBusy(false)
    }
  }

  async function importFile(): Promise<void> {
    setMsg(null)
    try {
      const res = await window.careerer.profile.importFile()
      if (!res) return
      setText(res.text)
      setDirty(true)
      setMsg({ kind: 'ok', text: `Imported ${res.fileName}. Check the text, then save.` })
    } catch (e) {
      setMsg({ kind: 'err', text: errMsg(e) })
    }
  }

  async function atsAction(fn: () => Promise<AtsInfo | null>, ok: string): Promise<void> {
    try {
      const info = await fn()
      if (info) {
        setAts(info)
        setMsg({ kind: 'ok', text: ok })
      }
    } catch (e) {
      setMsg({ kind: 'err', text: errMsg(e) })
    }
  }

  return (
    <div className="page wide">
      <PageHeader
        eyebrow="PROFILE"
        title="Your profile"
        lead="Paste or type everything Careerer may use: roles, projects, skills, education. Only facts written here will appear in your documents."
      />
      <div className="stack">
        <label className="field-label" htmlFor="profile-text">
          Profile text
        </label>
        <textarea
          id="profile-text"
          className="profile-area"
          spellCheck={false}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setDirty(true)
            setMsg(null)
          }}
          placeholder="Paste your profile here"
        />
        <div className="row-wrap">
          <button type="button" className="btn" onClick={() => void save()} disabled={busy || !dirty || !text.trim()}>
            {busy ? 'Saving and reading' : 'Save profile'}
          </button>
          <button type="button" className="ghost" onClick={() => void importFile()} disabled={busy}>
            Import PDF or DOCX
          </button>
          {msg && (
            <span className={msg.kind === 'ok' ? 'ok' : 'err'} role="status">
              {msg.text}
            </span>
          )}
        </div>
      </div>

      {(found || placeholders.length > 0) && (
        <section className="card" aria-label="What Careerer found">
          <div className="card-h">
            <span>WHAT CAREERER FOUND</span>
          </div>
          {found && (
            <>
              <div className="card-t">
                {found.name}
                {found.headline && <span className="muted"> · {found.headline}</span>}
              </div>
              <ul className="found">
                {counts(found).map((c) => (
                  <li key={c.label}>
                    <b>{c.n}</b> {c.label}
                  </li>
                ))}
              </ul>
            </>
          )}
          {placeholders.length > 0 ? (
            <div className="stack tight">
              <div className="small muted">
                {placeholders.length} placeholder{placeholders.length === 1 ? '' : 's'} left to fill in. Documents leave these out until you do.
              </div>
              <ul className="bullets">
                {placeholders.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : (
            found && <div className="ok">No placeholders left.</div>
          )}
        </section>
      )}

      <section className="card">
        <div className="card-h">
          <span>ATS CONTEXT</span>
        </div>
        <div className="card-t">{ats?.exists ? `Research report (${Math.round(ats.bytes / 1024)} KB)` : 'No report found'}</div>
        {ats?.updatedAt && <div className="muted small">Updated {new Date(ats.updatedAt).toLocaleString()}</div>}
        <div className="row-wrap">
          <button type="button" className="ghost" onClick={() => void atsAction(() => window.careerer.ats.replace(), 'Report replaced.')}>
            Replace report
          </button>
          <button type="button" className="ghost" onClick={() => void atsAction(() => window.careerer.ats.reset(), 'Bundled report restored.')}>
            Restore bundled report
          </button>
        </div>
      </section>
    </div>
  )
}
