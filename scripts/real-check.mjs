// ONE real end-to-end run through the Claude CLI (haiku): profile parse, requirements, generation,
// post-checks and PDF export. Spends a little of your Claude plan usage. Usage: npm run real-check [-- <outDir>]
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(process.argv[2] ?? join(tmpdir(), 'careerer-real-check'))
const electron = createRequire(import.meta.url)('electron')

const build = spawnSync('npx', ['electron-vite', 'build'], { cwd: root, stdio: 'inherit', shell: true })
if (build.status !== 0) process.exit(build.status ?? 1)

const env = { ...process.env, CAREERER_REAL_CHECK: out }
delete env.ELECTRON_RUN_AS_NODE
delete env.CAREERER_MOCK
const run = spawnSync(electron, ['.'], { cwd: root, env, stdio: 'inherit' })
console.log(`\nOutput folder: ${out}`)
process.exit(run.status ?? 1)
