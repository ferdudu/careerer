import { spawn } from 'node:child_process'
import { existsSync, promises as fs, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, delimiter, isAbsolute, join } from 'node:path'
import type { CliStatus } from '@shared/types'

export class CliError extends Error {}

/** Where results landed, for diagnostics (real-check reports it). */
export const cliStats = { structuredOutput: 0, resultText: 0 }

/** Kill a call that streams nothing for this long, and any call that runs longer than the hard cap. */
export const INACTIVITY_MS = 90_000
export const HARD_CAP_MS = 600_000
const MAX_OUTPUT = 20 * 1024 * 1024

// ---------------- pure helpers (unit tested) ----------------

export interface CliArgsInput {
  model: string
  schemaJson: string
  systemPromptFile: string
  effort?: 'low' | 'medium' | 'high'
}

/**
 * Flags verified against `claude --help` (v2.1.198). --system-prompt-file is accepted by the CLI
 * but is not listed in --help (only mentioned under --bare); it avoids the Windows command-line limit.
 * The user content goes on stdin, never in an argument.
 */
export function buildArgs(i: CliArgsInput): string[] {
  return [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--json-schema',
    i.schemaJson,
    '--model',
    i.model,
    '--tools',
    '',
    '--no-session-persistence',
    '--safe-mode',
    '--system-prompt-file',
    i.systemPromptFile,
    ...(i.effort ? ['--effort', i.effort] : [])
  ]
}

/** Remove variables that put the CLI in nested/bare mode, which would demand an API key. */
export function cleanEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = { ...env }
  delete out.CLAUDECODE
  delete out.CLAUDE_CODE_SIMPLE
  // Always use the user's Claude login, never a key or proxy from the environment.
  delete out.ANTHROPIC_API_KEY
  delete out.ANTHROPIC_AUTH_TOKEN
  delete out.ANTHROPIC_BASE_URL
  return out
}

const NOT_SIGNED_IN =
  'Claude CLI is not signed in. Open a terminal, run "claude auth login", then try again.'

/** Turns the CLI's single JSON result into the structured value, or throws a friendly CliError. */
export function parseCliOutput(stdout: string, exitCode: number | null, stderr: string): unknown {
  const text = stdout.trim()
  let json: Record<string, unknown> | undefined
  try {
    const v = JSON.parse(text)
    if (v && typeof v === 'object' && !Array.isArray(v)) json = v as Record<string, unknown>
  } catch {
    /* handled below */
  }
  if (!json) {
    const tail = (stderr || text).trim().slice(-400)
    if (/not logged in|\/login|auth login/i.test(tail)) throw new CliError(NOT_SIGNED_IN)
    throw new CliError(
      exitCode ? `Claude CLI failed (exit ${exitCode})${tail ? `: ${tail}` : '.'}` : `Claude CLI returned unreadable output${tail ? `: ${tail}` : '.'}`
    )
  }
  const result = typeof json.result === 'string' ? json.result : ''
  if (json.is_error === true || (exitCode !== 0 && exitCode !== null)) {
    if (/not logged in|\/login|auth login|invalid api key|authentication/i.test(result + stderr)) throw new CliError(NOT_SIGNED_IN)
    if (/rate limit|usage limit|limit reached|overloaded/i.test(result)) {
      throw new CliError(`Claude reported a usage or rate limit: ${result.slice(0, 200)}`)
    }
    throw new CliError(`Claude CLI error: ${(result || stderr || 'unknown error').trim().slice(0, 400)}`)
  }
  if (json.structured_output !== undefined && json.structured_output !== null) {
    cliStats.structuredOutput++
    return json.structured_output
  }
  // Fallback: some versions return the JSON as text in `result`.
  const cleaned = result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  if (cleaned) {
    try {
      const v = JSON.parse(cleaned)
      cliStats.resultText++
      return v
    } catch {
      throw new CliError('Claude returned text instead of the requested JSON.')
    }
  }
  throw new CliError('Claude returned no structured output.')
}

/** Finds claude.exe (preferred) on PATH or in the default install folder. Pure given exists(). */
export function findExecutable(
  pathEnv: string,
  home: string,
  exists: (p: string) => boolean,
  platform: NodeJS.Platform = process.platform
): { path?: string; cmdOnly?: string } {
  const names = platform === 'win32' ? ['claude.exe'] : ['claude']
  const dirs = [...pathEnv.split(delimiter).filter(Boolean), join(home, '.local', 'bin')]
  for (const d of dirs) for (const n of names) if (exists(join(d, n))) return { path: join(d, n) }
  if (platform === 'win32') {
    for (const d of dirs) if (exists(join(d, 'claude.cmd'))) return { cmdOnly: join(d, 'claude.cmd') }
  }
  return {}
}

// ---------------- process runner ----------------

/** Absolute, local, a regular file, and named claude or claude.exe. Rejects UNC paths and shells. */
export function validateClaudePath(
  p: string,
  isFile: (p: string) => boolean = (x) => {
    try {
      return statSync(x).isFile()
    } catch {
      return false
    }
  }
): string | null {
  if (!isAbsolute(p) && !/^[a-zA-Z]:[\\/]/.test(p)) return 'The Claude path must be a full path, for example C:\\Users\\you\\.local\\bin\\claude.exe.'
  if (/^[\\/]{2}/.test(p)) return 'Network (UNC) paths are not allowed for the Claude CLI.'
  if (!/^claude(\.exe)?$/i.test(basename(p.replace(/\\/g, '/')))) return 'The file must be named claude.exe (or claude).'
  if (!isFile(p)) return `No file exists at ${p}.`
  return null
}

export function resolveClaude(override?: string): { path?: string; problem?: string } {
  if (override) {
    const problem = validateClaudePath(override)
    return problem ? { problem } : { path: override }
  }
  const f = findExecutable(process.env.PATH ?? process.env.Path ?? '', homedir(), existsSync)
  if (f.path) return { path: f.path }
  if (f.cmdOnly) {
    // Windows will not start a .cmd without a shell, and our arguments carry JSON, so a shell would be an injection risk.
    return { problem: `Found ${f.cmdOnly}, which cannot be started safely. Install the native Claude Code (claude.exe) or set its path in Settings.` }
  }
  return { problem: 'Claude CLI was not found. Install Claude Code, or set its path in Settings.' }
}

function killTree(pid: number | undefined): void {
  if (!pid) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => undefined)
  } else {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
  }
}

interface Captured {
  stdout: string
  stderr: string
  code: number | null
  /** Milliseconds from start to exit. */
  ms: number
}

export interface Activity {
  elapsedMs: number
  /** Stream lines seen so far; rises while the model is working. */
  events: number
}

function runProcess(
  exe: string,
  args: string[],
  opts: {
    cwd: string
    stdin?: string
    signal?: AbortSignal
    /** Kill when no output arrives for this long. */
    inactivityMs: number
    /** Kill after this long regardless. */
    hardCapMs: number
    onActivity?: (a: Activity) => void
  }
): Promise<Captured> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const started = Date.now()
    const child = spawn(exe, args, {
      cwd: opts.cwd,
      env: cleanEnv(process.env),
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    let events = 0
    let settled = false
    let closed = false
    let inactivity: NodeJS.Timeout | undefined
    let hardCap: NodeJS.Timeout | undefined
    let ticker: NodeJS.Timeout | undefined
    const cleanup = (): void => {
      clearTimeout(inactivity)
      clearTimeout(hardCap)
      if (ticker) clearInterval(ticker)
      opts.signal?.removeEventListener('abort', onAbort)
    }
    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      cleanup()
      fn()
    }
    /** Kill, then wait (at most 2 s) for the process to release its folder before reporting. */
    const killThen = (fn: () => void): void => {
      killTree(child.pid)
      cleanup()
      if (closed) return finish(fn)
      const t = setTimeout(() => finish(fn), 2000)
      child.once('close', () => {
        clearTimeout(t)
        finish(fn)
      })
    }
    const onAbort = (): void => killThen(() => reject(new DOMException('Aborted', 'AbortError')))
    const armInactivity = (): void => {
      clearTimeout(inactivity)
      inactivity = setTimeout(
        () => killThen(() => reject(new CliError(`Claude went quiet for ${Math.round(opts.inactivityMs / 1000)} seconds and was stopped. Try again.`))),
        opts.inactivityMs
      )
    }
    armInactivity()
    hardCap = setTimeout(
      () => killThen(() => reject(new CliError(`Claude took longer than ${Math.round(opts.hardCapMs / 60000)} minutes and was stopped.`))),
      opts.hardCapMs
    )
    if (opts.onActivity) {
      ticker = setInterval(() => opts.onActivity?.({ elapsedMs: Date.now() - started, events }), 1000)
    }
    opts.signal?.addEventListener('abort', onAbort, { once: true })
    child.stdout.on('data', (d: Buffer) => {
      const chunk = d.toString('utf8')
      events += (chunk.match(/\n/g) ?? []).length
      if (stdout.length < MAX_OUTPUT) stdout += chunk
      if (!settled) armInactivity()
    })
    child.stderr.on('data', (d: Buffer) => {
      if (stderr.length < 100_000) stderr += d.toString('utf8')
    })
    child.on('error', (e) => finish(() => reject(new CliError(`Could not start Claude CLI: ${e.message}`))))
    child.on('close', (code) => {
      closed = true
      finish(() => resolve({ stdout, stderr, code, ms: Date.now() - started }))
    })
    child.stdin.on('error', () => undefined)
    child.stdin.end(opts.stdin ?? '')
  })
}

/** The final `result` event of a stream-json run (last line whose type is "result"). */
export function lastResultLine(stdout: string): string | undefined {
  const lines = stdout.split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim()
    if (l.startsWith('{') && /"type"\s*:\s*"result"/.test(l.slice(0, 40))) return l
  }
  return undefined
}

export interface RunInput {
  exe: string
  model: string
  system: string
  user: string
  schema: Record<string, unknown>
  effort?: 'low' | 'medium' | 'high'
  signal?: AbortSignal
  inactivityMs?: number
  hardCapMs?: number
  onActivity?: (a: Activity) => void
}

export interface RunOutput {
  value: unknown
  ms: number
}

/** One CLI call in a fresh empty temp dir. Temp files are always removed. */
export async function runClaude(i: RunInput): Promise<RunOutput> {
  const dir = await fs.mkdtemp(join(tmpdir(), 'careerer-cli-'))
  try {
    const sysFile = join(dir, 'system.txt')
    await fs.writeFile(sysFile, i.system, 'utf8')
    const args = buildArgs({ model: i.model, schemaJson: JSON.stringify(i.schema), systemPromptFile: sysFile, effort: i.effort })
    const out = await runProcess(i.exe, args, {
      cwd: dir,
      stdin: i.user,
      signal: i.signal,
      inactivityMs: i.inactivityMs ?? INACTIVITY_MS,
      hardCapMs: i.hardCapMs ?? HARD_CAP_MS,
      onActivity: i.onActivity
    })
    return { value: parseCliOutput(lastResultLine(out.stdout) ?? out.stdout, out.code, out.stderr), ms: out.ms }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/** Version and sign-in state. `claude auth status --json` is a local check and spends no usage. */
export async function checkClaude(override?: string): Promise<CliStatus> {
  const r = resolveClaude(override)
  if (!r.path) return { found: false, problem: r.problem }
  const dir = await fs.mkdtemp(join(tmpdir(), 'careerer-cli-'))
  try {
    const v = await runProcess(r.path, ['--version'], { cwd: dir, inactivityMs: 20_000, hardCapMs: 20_000 })
    const version = v.stdout.trim().split(/\s+/)[0] || undefined
    let loggedIn: boolean | undefined
    try {
      const a = await runProcess(r.path, ['auth', 'status', '--json'], { cwd: dir, inactivityMs: 20_000, hardCapMs: 20_000 })
      loggedIn = (JSON.parse(a.stdout) as { loggedIn?: boolean }).loggedIn === true
    } catch {
      loggedIn = undefined
    }
    return {
      found: true,
      path: r.path,
      version,
      loggedIn,
      ...(loggedIn === false ? { problem: NOT_SIGNED_IN } : {})
    }
  } catch (e) {
    return { found: false, path: r.path, problem: e instanceof Error ? e.message : 'Could not run Claude CLI.' }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}
