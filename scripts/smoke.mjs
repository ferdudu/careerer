// Headless smoke check: builds, launches the app in mock mode, drives the UI and pipeline, exports PDFs.
// Exit code 0 = pass. Usage: npm run smoke
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const outDir = join(tmpdir(), 'careerer-smoke-out')
mkdirSync(outDir, { recursive: true })
const electron = createRequire(import.meta.url)('electron')

const build = spawnSync('npx', ['electron-vite', 'build'], { cwd: root, stdio: 'inherit', shell: true })
if (build.status !== 0) process.exit(build.status ?? 1)

const env = { ...process.env, CAREERER_MOCK: '1', CAREERER_SMOKE: '1', CAREERER_SMOKE_OUT: outDir }
delete env.ELECTRON_RUN_AS_NODE
const run = spawnSync(electron, ['.'], { cwd: root, env, stdio: 'inherit' })
try {
  console.log(readFileSync(join(outDir, 'smoke.log'), 'utf8'))
} catch {
  console.log('no smoke.log written')
}
process.exit(run.status ?? 1)
