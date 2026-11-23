import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ApplicationMeta, ExportResult, ParsedProfile, Requirements, StoredResult, Theme } from '@shared/types'
import { computeCoverage, listIssues, runChecks } from '@shared/checks'
import { DocPreview } from '../components/DocPreview'
import { errMsg } from '../hooks'

/** Sets obj.a.b.0.c = value from a dotted path. */
function setPath(obj: unknown, path: string, value: string): void {
  const keys = path.split('.')
  let cur = obj as Record<string, unknown>
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]] as Record<string, unknown>
  cur[keys[keys.length - 1]] = value
}

const APPROACH_LABEL = { direct: 'Direct', transferable: 'Transferable', trajectory: 'Your trajectory' } as const as Record<string, string>
const norm = (x: string): string => x.toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim()

export function Review(): JSX.Element {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [meta, setMeta] = useState<ApplicationMeta | null>(null)
  const [req, setReq] = useState<Requirements | undefined>()
  const [profile, setProfile] = useState<ParsedProfile | null>(null)
  const [missing, setMissing] = useState<string | null>(null)
  const [tab, setTab] = useState<'resume' | 'letter'>('resume')
  const [version, setVersion] = useState(0)
  const [editTick, bump] = useState(0) // re-render the side panel after edits
  const [sameCompany, setSameCompany] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState<ExportResult | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [ticked, setTicked] = useState<Record<number, boolean>>({})
  const result = useRef<StoredResult | null>(null)
  const saveTimer = useRef<number | undefined>()
  const dirty = useRef(false)
  const edited = useRef(false)
  const rawProfile = useRef('')
  const posting = useRef('')
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [repair, setRepair] = useState<{ open: boolean; issues: string[]; ticked: boolean[]; note: string; busy: boolean; detail: string; error: string | null }>({
    open: false,
    issues: [],
    ticked: [],
    note: '',
    busy: false,
    detail: '',
    error: null
  })
  const repairBusy = useRef(false)
  const [canRetry, setCanRetry] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const [detail, prof, all] = await Promise.all([
        window.careerer.applications.get(id),
        window.careerer.profile.get(),
        window.careerer.applications.list()
      ])
      if (!alive) return
      if (!detail || !detail.result) {
        setCanRetry(!!detail)
        setMissing(
          !detail
            ? 'Application not found.'
            : detail.resultInvalid
              ? 'The saved documents for this application are damaged. Generate them again.'
              : 'This application has no generated documents yet.'
        )
        return
      }
      result.current = detail.result as StoredResult
      setReq(detail.requirements as Requirements | undefined)
      setMeta(detail.meta)
      if (!prof?.parsed) {
        setMissing('Your profile has not been read into sections yet. Open Profile and save it again.')
        return
      }
      rawProfile.current = prof.rawText
      posting.current = detail.posting ?? ''
      setProfile(prof.parsed)
      const co = detail.meta.company.trim().toLowerCase()
      setSameCompany(co ? all.filter((a) => a.id !== id && a.company.trim().toLowerCase() === co).length : 0)
      setVersion((v) => v + 1)
    })().catch((e) => setMissing(errMsg(e)))
    return () => {
      alive = false
    }
  }, [id])

  // Progress and outcome of a manual Repair arrive on the same channel as generation.
  useEffect(() => {
    return window.careerer.generation.onProgress((e) => {
      if (e.id !== id || !repairBusy.current) return
      if (e.detail) setRepair((r) => ({ ...r, detail: e.detail as string }))
      if (e.status === 'complete') {
        repairBusy.current = false
        void window.careerer.applications.get(id).then((d) => {
          if (d?.result) {
            result.current = d.result as StoredResult
            edited.current = false
            dirty.current = false
            setVersion((v) => v + 1) // new key, so the preview cross-fades to the repaired text
            bump((n) => n + 1)
          }
          setRepair((r) => ({ ...r, open: false, busy: false, detail: '', error: null }))
          setMsg({ kind: 'ok', text: 'Repaired. The previous version is kept as result.prev.json in the application folder.' })
        })
      } else if (e.status === 'error' || e.status === 'cancelled') {
        repairBusy.current = false
        setRepair((r) => ({ ...r, busy: false, detail: '', error: e.status === 'error' ? (e.error ?? 'Repair failed.') : 'Repair cancelled.' }))
      }
    })
  }, [id])

  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current)
    if (dirty.current && result.current) {
      dirty.current = false
      await window.careerer.applications.writeFile(id, 'result', result.current)
    }
  }, [id])

  // Save on leaving the screen.
  useEffect(() => () => void flush(), [flush])

  const onEdit = useCallback(
    (path: string, value: string) => {
      if (!result.current) return
      setPath(result.current, path, value)
      dirty.current = true
      edited.current = true
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        // Re-run the post-checks on the edited text so warnings never go stale.
        if (result.current) result.current.checks = runChecks(result.current, rawProfile.current, posting.current)
        void flush().then(() => bump((n) => n + 1))
      }, 700)
    },
    [flush]
  )

  const coverage = useMemo(
    () => (result.current ? computeCoverage(req, result.current, rawProfile.current) : { covered: 0, total: 0, missing: [] as string[], items: [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [req, version, editTick]
  )

  if (missing) {
    return (
      <div className="page">
        <div className="errbox" role="alert">
          <strong>{missing}</strong>
          <div className="row-wrap">
            {canRetry && (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  void window.careerer.generation.start({ regenerateId: id }).then(() => navigate(`/processing/${id}`), (e) => setMissing(errMsg(e)))
                }
              >
                Generate again
              </button>
            )}
            <Link to="/" className="ghost">
              New application
            </Link>
          </div>
        </div>
      </div>
    )
  }
  if (!meta || !result.current || !profile) return <div className="page" aria-busy="true" />
  const r = result.current

  async function setTheme(theme: Theme): Promise<void> {
    if (!meta || theme === meta.theme) return
    setMeta(await window.careerer.applications.setTheme(id, theme))
  }

  async function regenerate(force = false): Promise<void> {
    setMsg(null)
    if (!force && edited.current) {
      setConfirmRegen(true)
      return
    }
    setConfirmRegen(false)
    try {
      await flush()
      await window.careerer.generation.start({ regenerateId: id })
      navigate(`/processing/${id}`)
    } catch (e) {
      setMsg({ kind: 'err', text: errMsg(e) })
    }
  }

  async function openRepair(): Promise<void> {
    await flush()
    const issues = result.current ? listIssues(result.current, rawProfile.current, posting.current) : []
    setRepair({ open: true, issues, ticked: issues.map(() => true), note: '', busy: false, detail: '', error: null })
  }

  async function submitRepair(): Promise<void> {
    const issues = repair.issues.filter((_, i) => repair.ticked[i])
    setRepair((r) => ({ ...r, busy: true, detail: 'Starting', error: null }))
    repairBusy.current = true
    try {
      await window.careerer.repair.start(id, { issues, note: repair.note })
    } catch (e) {
      repairBusy.current = false
      setRepair((r) => ({ ...r, busy: false, error: errMsg(e) }))
    }
  }

  async function exportBoth(): Promise<void> {
    setExporting(true)
    setMsg(null)
    try {
      await flush()
      const res = await window.careerer.export.run(id)
      setExported(res)
      setMeta((m) => (m && m.status === 'draft' ? { ...m, status: 'exported' } : m))
      setMsg({ kind: 'ok', text: res.warnings.length ? 'PDFs saved with warnings.' : 'Both PDFs saved to the application folder.' })
    } catch (e) {
      setMsg({ kind: 'err', text: errMsg(e) })
    } finally {
      setExporting(false)
    }
  }

  async function saveAs(which: 'resume' | 'coverLetter'): Promise<void> {
    try {
      const p = await window.careerer.export.saveAs(id, which)
      if (p) setMsg({ kind: 'ok', text: `Saved to ${p}` })
    } catch (e) {
      setMsg({ kind: 'err', text: errMsg(e) })
    }
  }

  const knockouts = [...(req?.knockouts ?? []), ...r.report.knockoutFlags.filter((k) => !(req?.knockouts ?? []).includes(k))]
  const checks = r.checks
  const privateNotes = Array.from(
    new Set([...(r.report.stretch ?? []), ...coverage.items.filter((i) => i.approach === 'none' || i.approach === 'stretch').map((i) => i.requirement)])
  )
  const pct = coverage.total ? Math.round((coverage.covered / coverage.total) * 100) : 0

  return (
    <div className="review">
      <header className="review-head">
        <div className="stack tight">
          <div className="eyebrow">READY FOR REVIEW</div>
          <h1 className="display sm">
            {meta.role || 'Untitled role'} {meta.company && <span className="muted-title">· {meta.company}</span>}
          </h1>
        </div>
        <div className="row-wrap">
          <button type="button" className="ghost" onClick={() => void regenerate()} disabled={exporting}>
            Regenerate
          </button>
          <button type="button" className="ghost" onClick={() => void openRepair()} disabled={exporting || repair.busy}>
            Repair
          </button>
          <button type="button" className="btn" onClick={() => void exportBoth()} disabled={exporting}>
            {exporting ? 'Exporting' : 'Export both PDFs'}
          </button>
        </div>
      </header>

      {repair.open && (
        <section className="warnbox" aria-label="Repair the documents">
          <strong>Repair</strong>
          <p className="muted small">
            One Claude call corrects the documents. It may only remove, reword or reorder facts from your profile, and keeps your edits unless one is the problem. The old version is saved as result.prev.json.
          </p>
          {repair.issues.length > 0 ? (
            <ul className="checklist">
              {repair.issues.map((issue, i) => (
                <li key={issue}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!repair.ticked[i]}
                      disabled={repair.busy}
                      onChange={(e) => setRepair((r) => ({ ...r, ticked: r.ticked.map((t, j) => (j === i ? e.target.checked : t)) }))}
                    />
                    <span>{issue}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small">The checks found no issues. You can still describe what looks wrong.</p>
          )}
          <label className="field-label" htmlFor="repair-note">
            What looks wrong?
          </label>
          <textarea
            id="repair-note"
            className="input posting-area"
            style={{ minHeight: 80 }}
            maxLength={1000}
            disabled={repair.busy}
            placeholder="Optional, for example: the second Traction Complete bullet claims something I did not do"
            value={repair.note}
            onChange={(e) => setRepair((r) => ({ ...r, note: e.target.value }))}
          />
          {repair.error && (
            <p className="err" role="alert">
              {repair.error}
            </p>
          )}
          {repair.busy && (
            <p className="small" role="status" aria-live="polite">
              {repair.detail || 'Working'}
            </p>
          )}
          <div className="row-wrap">
            {repair.busy ? (
              <button type="button" className="ghost" onClick={() => void window.careerer.repair.cancel(id)}>
                Cancel
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void submitRepair()}
                  disabled={!repair.ticked.some(Boolean) && !repair.note.trim()}
                >
                  Repair now
                </button>
                <button type="button" className="ghost" onClick={() => setRepair((r) => ({ ...r, open: false }))}>
                  Close
                </button>
              </>
            )}
          </div>
        </section>
      )}
      {confirmRegen && (
        <div className="warnbox" role="alertdialog" aria-label="Replace your edits?">
          <strong>Regenerating replaces your edits.</strong>
          <p className="muted small">The current version is kept as result.prev.json in the application folder.</p>
          <div className="row-wrap">
            <button type="button" className="btn" onClick={() => void regenerate(true)}>
              Regenerate anyway
            </button>
            <button type="button" className="ghost" onClick={() => setConfirmRegen(false)} autoFocus>
              Keep my edits
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p className={msg.kind === 'ok' ? 'ok' : 'err'} role="status">
          {msg.text}
        </p>
      )}
      {exported && (
        <div className="exportbox" role="status">
          {exported.warnings.map((w) => (
            <p key={w} className="warn">
              {w}
            </p>
          ))}
          <div className="row-wrap">
            <button type="button" className="ghost" onClick={() => void saveAs('resume')}>
              Save resume to...
            </button>
            <button type="button" className="ghost" onClick={() => void saveAs('coverLetter')}>
              Save cover letter to...
            </button>
            <button type="button" className="ghost" onClick={() => void window.careerer.export.showInFolder(id)}>
              Show in folder
            </button>
          </div>
        </div>
      )}

      <div className="review-body">
        <section className="preview-col" aria-label="Document preview">
          <div className="toolbar">
            <div role="tablist" aria-label="Document" className="tabs">
              {(['resume', 'letter'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`tab-${t}`}
                  aria-selected={tab === t}
                  aria-controls="doc-panel"
                  className={`tab${tab === t ? ' on' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {t === 'resume' ? 'Resume' : 'Cover letter'}
                </button>
              ))}
            </div>
            <div className="seg" role="radiogroup" aria-label="Document style">
              {(['midnight', 'daylight'] as Theme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={meta.theme === t}
                  className={`seg-btn${meta.theme === t ? ' on' : ''}`}
                  onClick={() => void setTheme(t)}
                >
                  {t === 'midnight' ? 'Midnight' : 'Daylight'}
                </button>
              ))}
            </div>
          </div>
          <div id="doc-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            <DocPreview
              kind={tab}
              theme={meta.theme}
              profile={profile}
              result={r}
              company={meta.company}
              role={meta.role}
              version={version}
              onEdit={onEdit}
            />
          </div>
          <p className="muted small">Click any summary line, bullet or letter paragraph to edit it. Changes save automatically.</p>
        </section>

        <aside className="report" aria-label="Match report">
          {knockouts.length > 0 && (
            <div className="knock" role="group" aria-label="Check before you apply">
              <h2 className="h">CHECK BEFORE YOU APPLY</h2>
              <ul className="checklist">
                {knockouts.map((k, i) => (
                  <li key={k}>
                    <label>
                      <input type="checkbox" checked={!!ticked[i]} onChange={(e) => setTicked({ ...ticked, [i]: e.target.checked })} />
                      <span>{k}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sameCompany >= 3 && (
            <p className="warn" role="note">
              You already have {sameCompany} other applications at {meta.company}. Recruiters notice repeat applications, so consider whether another one helps.
            </p>
          )}

          {checks && (checks.placeholders.length > 0 || checks.unknownEntities.length > 0 || (checks.inventions ?? []).length > 0) && (
            <div className="warnbox" role="alert">
              <h2 className="h">CHECK THESE</h2>
              <ul>
                {checks.placeholders.map((p) => (
                  <li key={p}>Leftover placeholder: {p}</li>
                ))}
                {(checks.inventions ?? []).map((p) => (
                  <li key={p}>{p}</li>
                ))}
                {checks.unknownEntities.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="panel">
            <h2 className="h">COVERAGE</h2>
            <div className="cov">
              <span className="cov-n">{Number.isInteger(coverage.covered) ? coverage.covered : coverage.covered.toFixed(1)}</span>
              <span className="muted"> / {coverage.total}</span>
              <span className="muted small"> wishlist items bridged (direct or transferable)</span>
            </div>
            <div className="meter" role="img" aria-label={`${pct} percent covered`}>
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="panel">
            <h2 className="h">MATCHED TERMS</h2>
            <div className="chips">
              {r.report.matched.map((m) => (
                <span key={m.term} className="chip">
                  {m.term} <b>{m.count}</b>
                </span>
              ))}
              {r.report.matched.length === 0 && <span className="muted small">None recorded.</span>}
            </div>
          </div>

          <div className="panel" aria-labelledby="wish-h">
            <h2 className="h" id="wish-h">
              HOW YOU MATCH THE WISHLIST
            </h2>
            <ul className="bridges">
              {coverage.items
                .filter((i) => i.approach === 'direct' || i.approach === 'transferable' || i.approach === 'trajectory')
                .map((i) => {
                  const bridge = r.report.bridges.find((x) => norm(x.requirement) === norm(i.requirement))
                  return (
                    <li key={i.requirement}>
                      <div className="bridge-top">
                        <span>{i.requirement}</span>
                        <span className={`badge ${i.approach}`}>{APPROACH_LABEL[i.approach]}</span>
                      </div>
                      {bridge?.evidence && <div className="muted small">From your profile: {bridge.evidence}</div>}
                    </li>
                  )
                })}
              {coverage.items.every((i) => i.credit === 0 && i.approach !== 'trajectory') && (
                <li className="muted small">No bridges recorded yet. Try Regenerate.</li>
              )}
            </ul>
          </div>

          {privateNotes.length > 0 && (
            <details className="panel">
              <summary className="h">WORTH PREPARING FOR AT INTERVIEW</summary>
              <p className="muted small">A private note for you. None of this appears in your documents.</p>
              <ul className="bullets">
                {privateNotes.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </details>
          )}

          {r.report.missingInfo.length > 0 && (
            <div className="panel">
              <h2 className="h">FILL THESE IN TO STRENGTHEN IT</h2>
              <ul className="bullets">
                {r.report.missingInfo.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
              <Link to="/profile" className="link">
                Update profile
              </Link>
            </div>
          )}

          {r.report.changes.length > 0 && (
            <details className="panel">
              <summary className="h">WHAT CHANGED</summary>
              <ul className="bullets">
                {r.report.changes.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </details>
          )}
        </aside>
      </div>
    </div>
  )
}
