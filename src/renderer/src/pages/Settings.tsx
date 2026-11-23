import { useCallback, useEffect, useState } from 'react'
import { MODELS } from '@shared/constants'
import type { CliStatus, Theme } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { errMsg, useSettings } from '../hooks'

const MODEL_NOTE: Record<(typeof MODELS)[number], string> = {
  sonnet: 'Balanced quality and speed (default)',
  opus: 'Highest quality, slower, uses more of your plan',
  haiku: 'Fastest and lightest on your plan'
}

export function Settings(): JSX.Element {
  const { settings, setSettings } = useSettings()
  const [dataDir, setDataDir] = useState('')
  const [cli, setCli] = useState<CliStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [pathInput, setPathInput] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const check = useCallback(async () => {
    setChecking(true)
    try {
      setCli(await window.careerer.cli.status())
    } catch (e) {
      setCli({ found: false, problem: errMsg(e) })
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void window.careerer.getAppInfo().then((i) => setDataDir(i.dataDir))
  }, [])
  useEffect(() => {
    if (settings) setPathInput(settings.claudePath ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.claudePath])
  useEffect(() => void check(), [check, settings?.claudePath])

  async function run(fn: () => Promise<void>, ok: string): Promise<void> {
    try {
      await fn()
      setMsg({ kind: 'ok', text: ok })
    } catch (e) {
      setMsg({ kind: 'err', text: errMsg(e) })
    }
  }

  if (!settings) return <div className="page" />

  const ready = cli?.found && cli.loggedIn !== false
  return (
    <div className="page wide">
      <PageHeader eyebrow="SETTINGS" title="Settings" />

      <section className="card" aria-labelledby="cli-h">
        <div className="card-h">
          <span id="cli-h">CLAUDE CLI</span>
          {cli && (
            <span className={ready ? 'ok' : 'err'}>
              {!cli.found ? 'Not found' : cli.loggedIn === false ? 'Not signed in' : cli.loggedIn ? 'Signed in' : 'Found'}
            </span>
          )}
        </div>
        <p className="muted small">
          Careerer writes your documents by running the Claude Code CLI installed on this computer, using your own Claude sign-in. No API key is needed or stored.
          {window.careerer.isMock && ' Mock mode is on, so the CLI is not used.'}
        </p>
        {cli?.found && (
          <dl className="kv">
            <dt>Path</dt>
            <dd>
              <code className="path">{cli.path}</code>
            </dd>
            <dt>Version</dt>
            <dd>{cli.version ?? 'unknown'}</dd>
          </dl>
        )}
        {cli?.problem && (
          <p className="warn" role="status">
            {cli.problem}
            {cli.loggedIn === false && ' (Run: claude auth login)'}
          </p>
        )}
        <div className="row-wrap">
          <button type="button" className="ghost" onClick={() => void check()} disabled={checking}>
            {checking ? 'Checking' : 'Check again'}
          </button>
        </div>
        <form
          className="row-wrap"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              setSettings(await window.careerer.settings.update({ claudePath: pathInput }))
            }, pathInput.trim() ? 'Claude path saved.' : 'Using the Claude found on PATH.')
          }}
        >
          <label className="sr-only" htmlFor="claude-path">
            Path to claude.exe (optional)
          </label>
          <input
            id="claude-path"
            className="input grow"
            type="text"
            spellCheck={false}
            placeholder="Path to claude.exe (leave empty to detect automatically)"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
          />
          <button type="submit" className="ghost" disabled={pathInput.trim() === (settings.claudePath ?? '')}>
            Save path
          </button>
        </form>
      </section>

      <section className="card">
        <div className="card-h">
          <span>MODEL</span>
        </div>
        <label className="sr-only" htmlFor="model">
          Model
        </label>
        <select
          id="model"
          className="input select"
          value={settings.model}
          onChange={(e) =>
            void run(async () => {
              setSettings(await window.careerer.settings.update({ model: e.target.value as (typeof MODELS)[number] }))
            }, 'Model updated.')
          }
        >
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {m} ({MODEL_NOTE[m]})
            </option>
          ))}
        </select>
      </section>

      <section className="card">
        <div className="card-h">
          <span>DEFAULT DOCUMENT STYLE</span>
        </div>
        <div className="seg" role="radiogroup" aria-label="Default document style">
          {(['midnight', 'daylight'] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={settings.defaultTheme === t}
              className={`seg-btn${settings.defaultTheme === t ? ' on' : ''}`}
              onClick={() =>
                void run(async () => {
                  setSettings(await window.careerer.settings.update({ defaultTheme: t }))
                }, 'Default style updated.')
              }
            >
              {t === 'midnight' ? 'Midnight gala' : 'Daylight gala'}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <span>DATA FOLDER</span>
        </div>
        <code className="path">{dataDir}</code>
        <div>
          <button type="button" className="ghost" onClick={() => void run(() => window.careerer.openDataFolder(), 'Opened the data folder.')}>
            Open folder
          </button>
        </div>
      </section>

      <div className="status-line" role="status" aria-live="polite">
        {msg && <span className={msg.kind === 'ok' ? 'ok' : 'err'}>{msg.text}</span>}
      </div>
    </div>
  )
}
