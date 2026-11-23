// Runs the mock pipeline and exports both PDFs in both themes, without a window.
// Usage: npm run mock-export [-- <outDir>]   (default: <os tmp>/careerer-mock-export)
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(process.argv[2] ?? join(tmpdir(), 'careerer-mock-export'))
const require = createRequire(import.meta.url)
const electron = require('electron')

const build = spawnSync('npx', ['electron-vite', 'build'], { cwd: root, stdio: 'inherit', shell: true })
if (build.status !== 0) process.exit(build.status ?? 1)

const env = { ...process.env, CAREERER_MOCK: '1', CAREERER_DEMO_EXPORT: out }
delete env.ELECTRON_RUN_AS_NODE
const run = spawnSync(electron, ['.'], { cwd: root, env, stdio: 'inherit' })
console.log(`\nOutput folder: ${out}`)
process.exit(run.status ?? 1)
