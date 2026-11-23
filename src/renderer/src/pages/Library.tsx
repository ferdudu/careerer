import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ApplicationMeta, Requirements, StoredResult } from '@shared/types'
import { computeCoverage } from '@shared/checks'
import { errMsg } from '../hooks'

interface Row {
  meta: ApplicationMeta
  coverage?: { covered: number; total: number }
}

const STATUS_LABEL = { draft: 'Draft', exported: 'Exported', applied: 'Applied' } as const
const STATUS_COLOR = { draft: '#8F8B81', exported: '#D2B27A', applied: '#9CC3A4' } as const

export function Library(): JSX.Element {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [query, setQuery] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await window.careerer.applications.list()
      const raw = (await window.careerer.profile.get())?.rawText
      const out = await Promise.all(
        list.map(async (meta): Promise<Row> => {
          const d = await window.careerer.applications.get(meta.id)
          if (d?.result && d.requirements) {
            const c = computeCoverage(d.requirements as Requirements, d.result as StoredResult, raw)
            return { meta, coverage: { covered: c.covered, total: c.total } }
          }
          return { meta }
        })
      )
      setRows(out)
    } catch (e) {
      setError(errMsg(e))
      setRows([])
    }
  }, [])
  useEffect(() => void load(), [load])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!rows) return []
    return q ? rows.filter((r) => `${r.meta.role} ${r.meta.company}`.toLowerCase().includes(q)) : rows
  }, [rows, query])

  async function markApplied(id: string): Promise<void> {
    try {
      await window.careerer.applications.updateMeta(id, { status: 'applied' })
      await load()
    } catch (e) {
      setError(errMsg(e))
    }
  }
  async function remove(id: string): Promise<void> {
    try {
      await window.careerer.applications.remove(id)
      setConfirmId(null)
      await load()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  return (
    <div className="page wide">
      <header className="lib-head">
        <div className="page-head">
          <div className="eyebrow">LIBRARY</div>
          <h1 className="display">Applications</h1>
        </div>
        <div className="row-wrap">
          <label className="sr-only" htmlFor="search">
            Search applications
          </label>
          <input id="search" type="search" className="input" placeholder="Search role or company" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Link to="/" className="btn">
            New application
          </Link>
        </div>
      </header>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      {rows && rows.length === 0 && <p className="note">Nothing here yet. Applications you create will appear here.</p>}
      {rows && rows.length > 0 && shown.length === 0 && <p className="note">No applications match that search.</p>}
      {shown.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">ROLE</th>
                <th scope="col">COMPANY</th>
                <th scope="col">CREATED</th>
                <th scope="col">COVERAGE</th>
                <th scope="col">STATUS</th>
                <th scope="col">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ meta, coverage }) => (
                <tr key={meta.id}>
                  <td>
                    <Link to={`/review/${meta.id}`}>{meta.role || 'Untitled role'}</Link>
                  </td>
                  <td className="muted">{meta.company || '-'}</td>
                  <td className="muted">{new Date(meta.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                  <td>{coverage ? `${Number.isInteger(coverage.covered) ? coverage.covered : coverage.covered.toFixed(1)} / ${coverage.total}` : '-'}</td>
                  <td>
                    <span className="tag">
                      <span className="dot" style={{ background: STATUS_COLOR[meta.status] }} />
                      {STATUS_LABEL[meta.status]}
                    </span>
                  </td>
                  <td>
                    {confirmId === meta.id ? (
                      <span className="row-wrap tight" role="alertdialog" aria-label={`Delete ${meta.role}?`}>
                        <span className="small">Delete this application and its files?</span>
                        <button type="button" className="ghost danger sm" onClick={() => void remove(meta.id)}>
                          Delete
                        </button>
                        <button type="button" className="ghost sm" onClick={() => setConfirmId(null)} autoFocus>
                          Keep
                        </button>
                      </span>
                    ) : (
                      <span className="row-wrap tight">
                        <button type="button" className="ghost sm" onClick={() => navigate(`/review/${meta.id}`)}>
                          Open
                        </button>
                        {meta.status !== 'applied' && (
                          <button type="button" className="ghost sm" onClick={() => void markApplied(meta.id)}>
                            Mark applied
                          </button>
                        )}
                        <button type="button" className="ghost danger sm" onClick={() => setConfirmId(meta.id)}>
                          Delete
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
