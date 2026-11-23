import { mkdtemp, readdir, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MOCK_RESULT } from '../llm/fixtures/result'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createStore, newApplicationId, type Store } from './store'

let root: string
let store: Store

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'careerer-test-'))
  await writeFile(join(root, 'bundled.md'), '# ATS report')
  store = createStore({
    dataDir: join(root, 'data'),
    bundledAtsPath: join(root, 'bundled.md')
  })
  await store.init()
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('settings', () => {
  it('returns defaults', async () => {
    expect(await store.getSettings()).toEqual({ model: 'sonnet', defaultTheme: 'midnight' })
  })

  it('updates model, theme and the Claude path override, and clears the path', async () => {
    let s = await store.updateSettings({ model: 'opus', defaultTheme: 'daylight', claudePath: ' C:\tools\claude.exe ' })
    expect(s).toEqual({ model: 'opus', defaultTheme: 'daylight', claudePath: 'C:\tools\claude.exe' })
    s = await store.updateSettings({ claudePath: '' })
    expect(s.claudePath).toBeUndefined()
    expect(s.model).toBe('opus')
  })

  it('quarantines a corrupt settings file instead of overwriting it', async () => {
    await writeFile(store.paths.settingsPath, '{not json')
    expect((await store.getSettings()).model).toBe('sonnet')
    const names = await readdir(join(root, 'data'))
    expect(names.some((n) => n.startsWith('settings.json.corrupt-'))).toBe(true)
  })

  it('keeps valid fields when one field is bad, and maps old API model ids to the default', async () => {
    await writeFile(store.paths.settingsPath, JSON.stringify({ model: 'claude-sonnet-5-5', defaultTheme: 'daylight' }))
    expect(await store.getSettings()).toEqual({ model: 'sonnet', defaultTheme: 'daylight' })
  })

  it('rejects invalid themes and models', async () => {
    await expect(store.updateSettings({ defaultTheme: 'neon' as never })).rejects.toThrow()
    await expect(store.updateSettings({ model: 'gpt' as never })).rejects.toThrow()
  })
})

describe('profile', () => {
  it('quarantines a corrupt profile', async () => {
    await writeFile(store.paths.profilePath, 'oops')
    expect(await store.getProfile()).toBeNull()
    expect((await readdir(join(root, 'data'))).some((n) => n.startsWith('profile.json.corrupt-'))).toBe(true)
  })

  it('is null before first save, then round-trips', async () => {
    expect(await store.getProfile()).toBeNull()
    const saved = await store.saveProfile('hello')
    expect(saved.rawText).toBe('hello')
    expect((await store.getProfile())?.rawText).toBe('hello')
  })
})

describe('ats report', () => {
  it('is copied from the bundle on init and not overwritten', async () => {
    expect(await store.readAtsReport()).toBe('# ATS report')
    await store.replaceAtsReport('custom')
    await store.init()
    expect(await store.readAtsReport()).toBe('custom')
    const info = await store.atsInfo()
    expect(info.exists).toBe(true)
    await store.resetAtsReport()
    expect(await store.readAtsReport()).toBe('# ATS report')
  })

  it('refuses empty replacement', async () => {
    await expect(store.replaceAtsReport('  ')).rejects.toThrow()
  })
})

describe('applications', () => {
  it('creates, lists newest first, updates, writes files, deletes', async () => {
    let t = 1_700_000_000_000
    const s = createStore({
      dataDir: join(root, 'data'),
      bundledAtsPath: join(root, 'bundled.md'),
      now: () => new Date((t += 60_000))
    })
    const a = await s.createApplication({ role: 'Dev', company: 'Acme', posting: 'text', url: 'https://x.test' })
    const b = await s.createApplication({ role: 'Eng', company: 'Beta', theme: 'daylight' })
    expect(a.status).toBe('draft')
    expect(a.theme).toBe('midnight')
    expect(b.theme).toBe('daylight')
    expect((await s.listApplications()).map((m) => m.id)).toEqual([b.id, a.id])

    const upd = await s.updateApplicationMeta(a.id, { status: 'applied', company: 'Acme Inc' })
    expect(upd).toMatchObject({ status: 'applied', company: 'Acme Inc', role: 'Dev', id: a.id })

    await s.writeApplicationFile(a.id, 'result', MOCK_RESULT)
    await s.writeApplicationFile(a.id, 'requirements', { required: ['a'] })
    const detail = await s.getApplication(a.id)
    expect(detail?.posting).toBe('text')
    expect(detail?.result).toEqual(MOCK_RESULT)
    expect(detail?.requirements).toEqual({ required: ['a'] })

    await s.deleteApplication(a.id)
    expect(await s.getApplication(a.id)).toBeNull()
    expect((await s.listApplications()).length).toBe(1)
  })

  it('rejects path traversal ids', async () => {
    await expect(store.getApplication('../settings')).rejects.toThrow()
    await expect(store.deleteApplication('..')).rejects.toThrow()
    await expect(store.writeApplicationFile('../../x', 'result', {})).rejects.toThrow()
  })

  it('flags an invalid result.json instead of returning it, and rejects bad file names', async () => {
    const m = await store.createApplication({ role: 'A', company: 'B' })
    await writeFile(join(store.paths.appsDir, m.id, 'result.json'), JSON.stringify({ resume: {} }))
    const d = await store.getApplication(m.id)
    expect(d?.result).toBeUndefined()
    expect(d?.resultInvalid).toBe(true)
    await expect(store.writeApplicationFile(m.id, 'constructor' as never, {})).rejects.toThrow()
  })

  it('errors on writes to a missing application and ignores stray folders', async () => {
    await expect(store.writeApplicationFile('abcdef123456', 'result', {})).rejects.toThrow(/not found/)
    await mkdir(join(store.paths.appsDir, 'not-an-app'), { recursive: true })
    expect(await store.listApplications()).toEqual([])
  })

  it('generates unique sortable ids', () => {
    const d = new Date('2026-01-02T03:04:05Z')
    const a = newApplicationId(d)
    expect(a).toMatch(/^20260102030405-[0-9a-f]{6}$/)
    expect(newApplicationId(d)).not.toBe(a)
  })
})
