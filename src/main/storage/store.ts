import { promises as fs } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import {
  ApplicationIdSchema,
  AppFileSchema,
  ApplicationMetaSchema,
  MetaPatchSchema,
  NewApplicationSchema,
  ProfileSchema,
  SettingsPatchSchema,
  StoredSettingsSchema
} from '@shared/schemas'
import { StoredResultSchema } from '@shared/llmSchemas'
import type {
  AppFileName,
  ApplicationDetail,
  ApplicationMeta,
  AtsInfo,
  MetaPatch,
  NewApplication,
  Profile,
  PublicSettings,
  SettingsPatch,
  StoredSettings
} from '@shared/types'
import { exists, quarantine, readJson, readJsonState, readText, writeFileAtomic, writeJson } from './fsutil'

export interface StoreOptions {
  dataDir: string
  /** Path of the bundled ats-research-report.md (copied on first run). */
  bundledAtsPath: string
  now?: () => Date
}

export function newApplicationId(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${stamp}-${randomBytes(3).toString('hex')}`
}

const FILE_NAMES: Record<AppFileName, string> = {
  posting: 'posting.txt',
  requirements: 'requirements.json',
  result: 'result.json'
}

export function createStore(opts: StoreOptions) {
  const { dataDir } = opts
  const now = opts.now ?? (() => new Date())
  const settingsPath = join(dataDir, 'settings.json')
  const profilePath = join(dataDir, 'profile.json')
  const atsPath = join(dataDir, 'ats-report.md')
  const appsDir = join(dataDir, 'applications')

  function appDir(id: string): string {
    // Validates the id so a renderer-supplied value can never escape appsDir.
    return join(appsDir, ApplicationIdSchema.parse(id))
  }

  // ---------- settings ----------
  async function readStored(): Promise<StoredSettings> {
    const r = await readJsonState(settingsPath)
    if (r.state === 'corrupt') await quarantine(settingsPath)
    const raw = r.state === 'ok' && r.value && typeof r.value === 'object' ? r.value : {}
    return StoredSettingsSchema.parse(raw)
  }

  function toPublic(s: StoredSettings): PublicSettings {
    return { model: s.model, defaultTheme: s.defaultTheme, ...(s.claudePath ? { claudePath: s.claudePath } : {}) }
  }

  async function getSettings(): Promise<PublicSettings> {
    return toPublic(await readStored())
  }

  async function updateSettings(patch: SettingsPatch): Promise<PublicSettings> {
    const p = SettingsPatchSchema.parse(patch)
    const cur = await readStored()
    const next: StoredSettings = {
      ...cur,
      ...(p.model !== undefined ? { model: p.model } : {}),
      ...(p.defaultTheme !== undefined ? { defaultTheme: p.defaultTheme } : {})
    }
    if (p.claudePath !== undefined) {
      if (p.claudePath.trim()) next.claudePath = p.claudePath.trim()
      else delete next.claudePath
    }
    await writeJson(settingsPath, next)
    return toPublic(next)
  }

  // ---------- profile ----------
  async function getProfile(): Promise<Profile | null> {
    const r = await readJsonState(profilePath)
    if (r.state === 'missing') return null
    const parsed = r.state === 'ok' ? ProfileSchema.safeParse(r.value) : null
    if (parsed?.success) return parsed.data
    await quarantine(profilePath)
    return null
  }

  async function saveProfile(rawText: string, parsed?: Profile['parsed']): Promise<Profile> {
    const prev = await getProfile()
    const profile: Profile = {
      rawText,
      // Keep an earlier parse only if the text is unchanged; otherwise it is stale.
      parsed: parsed ?? (prev && prev.rawText === rawText ? prev.parsed : undefined),
      updatedAt: now().toISOString()
    }
    await writeJson(profilePath, profile)
    return profile
  }

  // ---------- ATS report ----------
  async function atsInfo(): Promise<AtsInfo> {
    try {
      const st = await fs.stat(atsPath)
      return { exists: true, bytes: st.size, updatedAt: st.mtime.toISOString() }
    } catch {
      return { exists: false, bytes: 0 }
    }
  }

  async function ensureAtsReport(): Promise<void> {
    if (await exists(atsPath)) return
    const bundled = await readText(opts.bundledAtsPath)
    if (bundled !== undefined) await writeFileAtomic(atsPath, bundled)
  }

  async function readAtsReport(): Promise<string> {
    await ensureAtsReport()
    return (await readText(atsPath)) ?? ''
  }

  async function replaceAtsReport(content: string): Promise<AtsInfo> {
    if (!content.trim()) throw new Error('The report file is empty.')
    await writeFileAtomic(atsPath, content)
    return atsInfo()
  }

  async function resetAtsReport(): Promise<AtsInfo> {
    const bundled = await readText(opts.bundledAtsPath)
    if (bundled === undefined) throw new Error('Bundled ATS report not found.')
    await writeFileAtomic(atsPath, bundled)
    return atsInfo()
  }

  // ---------- applications ----------
  async function listApplications(): Promise<ApplicationMeta[]> {
    let names: string[]
    try {
      names = await fs.readdir(appsDir)
    } catch {
      return []
    }
    const out: ApplicationMeta[] = []
    for (const n of names) {
      if (!ApplicationIdSchema.safeParse(n).success) continue
      const m = ApplicationMetaSchema.safeParse(await readJson(join(appsDir, n, 'meta.json')))
      if (m.success) out.push(m.data)
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async function getApplication(id: string): Promise<ApplicationDetail | null> {
    const dir = appDir(id)
    const meta = ApplicationMetaSchema.safeParse(await readJson(join(dir, 'meta.json')))
    if (!meta.success) return null
    const rawResult = await readJson(join(dir, FILE_NAMES.result))
    const result = rawResult === undefined ? undefined : StoredResultSchema.safeParse(rawResult)
    return {
      meta: meta.data,
      posting: await readText(join(dir, FILE_NAMES.posting)),
      requirements: await readJson(join(dir, FILE_NAMES.requirements)),
      result: result?.success ? result.data : undefined,
      ...(result && !result.success ? { resultInvalid: true } : {})
    }
  }

  async function createApplication(input: NewApplication): Promise<ApplicationMeta> {
    const p = NewApplicationSchema.parse(input)
    const settings = await readStored()
    const meta: ApplicationMeta = {
      id: newApplicationId(now()),
      role: p.role,
      company: p.company,
      ...(p.url ? { url: p.url } : {}),
      createdAt: now().toISOString(),
      status: 'draft',
      theme: p.theme ?? settings.defaultTheme
    }
    const dir = appDir(meta.id)
    await writeJson(join(dir, 'meta.json'), meta)
    if (p.posting) await writeFileAtomic(join(dir, FILE_NAMES.posting), p.posting)
    return meta
  }

  async function updateApplicationMeta(id: string, patch: MetaPatch): Promise<ApplicationMeta> {
    const p = MetaPatchSchema.parse(patch)
    const dir = appDir(id)
    const cur = ApplicationMetaSchema.safeParse(await readJson(join(dir, 'meta.json')))
    if (!cur.success) throw new Error('Application not found.')
    const defined = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))
    const next: ApplicationMeta = { ...cur.data, ...defined, id: cur.data.id }
    await writeJson(join(dir, 'meta.json'), next)
    return next
  }

  async function writeApplicationFile(id: string, name: AppFileName, data: unknown): Promise<void> {
    const dir = appDir(id)
    if (!(await exists(join(dir, 'meta.json')))) throw new Error('Application not found.')
    const file = FILE_NAMES[AppFileSchema.parse(name)]
    if (name === 'posting') {
      if (typeof data !== 'string') throw new Error('Posting must be text.')
      await writeFileAtomic(join(dir, file), data)
    } else {
      await writeJson(join(dir, file), data)
    }
  }

  /** Copies result.json to result.prev.json before a regenerate replaces it. */
  async function snapshotResult(id: string): Promise<void> {
    const dir = appDir(id)
    if (await exists(join(dir, FILE_NAMES.result))) await fs.copyFile(join(dir, FILE_NAMES.result), join(dir, 'result.prev.json'))
  }

  async function deleteApplication(id: string): Promise<void> {
    await fs.rm(appDir(id), { recursive: true, force: true })
  }

  async function init(): Promise<void> {
    await fs.mkdir(appsDir, { recursive: true })
    await ensureAtsReport()
  }

  return {
    paths: { dataDir, settingsPath, profilePath, atsPath, appsDir },
    init,
    getSettings,
    updateSettings,
    getProfile,
    saveProfile,
    atsInfo,
    readAtsReport,
    replaceAtsReport,
    resetAtsReport,
    listApplications,
    getApplication,
    createApplication,
    updateApplicationMeta,
    writeApplicationFile,
    snapshotResult,
    deleteApplication
  }
}

export type Store = ReturnType<typeof createStore>
