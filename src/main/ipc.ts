import { app, dialog, ipcMain, shell, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import { basename } from 'node:path'
import { IPC, type IpcResult } from '@shared/api'
import { RequirementsSchema, StoredResultSchema } from '@shared/llmSchemas'
import type { GenerationInput, ProgressEvent, SaveProfileResult } from '@shared/types'
import { ApplicationIdSchema } from '@shared/schemas'
import type { Store } from './storage/store'
import { parseProfileHook } from './profile'
import type { LlmProvider } from './llm/provider'
import { MAX_PROFILE_CHARS, prepareGeneration, runGeneration, runRepair } from './llm/pipeline'
import { checkClaude, validateClaudePath } from './llm/cli'
import { fetchPostingText } from './posting/fetch'
import { exportApplication, exportedPaths, loadDocInput } from './export/service'
import { extractDocumentText } from './profile-import'

/** Wraps a handler so thrown errors reach the renderer as plain data. */
function handle<A extends unknown[], T>(channel: string, fn: (...args: A) => Promise<T> | T): void {
  ipcMain.handle(channel, async (_e, ...args): Promise<IpcResult<T>> => {
    try {
      return { ok: true, value: await fn(...(args as A)) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  })
}

export interface IpcContext {
  provider: LlmProvider
  isMock: boolean
  appRoot: string
}

const MAX_ATS_BYTES = 200 * 1024

export function registerIpc(store: Store, ctx: IpcContext): void {
  const running = new Map<string, AbortController>()
  /** Events per job, so a screen that subscribes late (or after a fast failure) can replay them. */
  const jobs = new Map<string, ProgressEvent[]>()
  const send = (e: ProgressEvent): void => {
    const list = jobs.get(e.id) ?? []
    list.push(e)
    jobs.set(e.id, list)
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(IPC.genProgress, e)
  }

  handle(IPC.appInfo, () => ({ dataDir: store.paths.dataDir, version: app.getVersion() }))
  handle(IPC.openDataFolder, async () => {
    const err = await shell.openPath(store.paths.dataDir)
    if (err) throw new Error(err)
  })

  handle(IPC.settingsGet, () => store.getSettings())
  handle(IPC.settingsUpdate, (patch: unknown) => {
    const p = patch as { claudePath?: string }
    if (p?.claudePath?.trim()) {
      const problem = validateClaudePath(p.claudePath.trim())
      if (problem) throw new Error(problem)
    }
    return store.updateSettings(patch as never)
  })
  handle(IPC.cliStatus, async () => checkClaude((await store.getSettings()).claudePath))

  handle(IPC.profileGet, () => store.getProfile())
  handle(IPC.profileSave, async (rawText: unknown): Promise<SaveProfileResult> => {
    if (typeof rawText !== 'string') throw new Error('Invalid profile text.')
    if (rawText.length > MAX_PROFILE_CHARS) {
      throw new Error(`The profile is too long (${rawText.length.toLocaleString()} characters; the limit is ${MAX_PROFILE_CHARS.toLocaleString()}).`)
    }
    const saved = await store.saveProfile(rawText)
    if (saved.parsed) return { profile: saved }
    const res = await parseProfileHook(ctx.provider, rawText)
    if (res.parsed) return { profile: await store.saveProfile(rawText, res.parsed) }
    return { profile: saved, parseError: res.error }
  })
  handle(IPC.profileImport, async () => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const opts = {
      title: 'Import profile from PDF or DOCX',
      properties: ['openFile' as const],
      filters: [{ name: 'PDF or Word', extensions: ['pdf', 'docx'] }]
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (res.canceled || !res.filePaths[0]) return null
    const file = res.filePaths[0]
    if ((await fs.stat(file)).size > 5 * 1024 * 1024) throw new Error('That file is larger than 5 MB.')
    const text = await extractDocumentText(file)
    if (!text.trim()) throw new Error('No text could be read from that file. Scanned PDFs are not supported; paste the text instead.')
    return { fileName: basename(file), text }
  })

  handle(IPC.atsInfo, () => store.atsInfo())
  handle(IPC.atsRead, () => store.readAtsReport())
  handle(IPC.atsReplace, async () => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const opts = {
      title: 'Choose an ATS report',
      properties: ['openFile' as const],
      filters: [{ name: 'Markdown or text', extensions: ['md', 'txt'] }]
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (res.canceled || !res.filePaths[0]) return null
    if ((await fs.stat(res.filePaths[0])).size > MAX_ATS_BYTES) throw new Error('That report is larger than 200 KB.')
    return store.replaceAtsReport(await fs.readFile(res.filePaths[0], 'utf8'))
  })
  handle(IPC.atsReset, () => store.resetAtsReport())

  handle(IPC.appsList, () => store.listApplications())
  handle(IPC.appsGet, (id: unknown) => store.getApplication(id as string))
  handle(IPC.appsCreate, (input: unknown) => store.createApplication(input as never))
  handle(IPC.appsUpdateMeta, (id: unknown, patch: unknown) => store.updateApplicationMeta(id as string, patch as never))
  handle(IPC.appsWriteFile, (id: unknown, name: unknown, data: unknown) => {
    // The renderer may only store well-formed files.
    if (name === 'result') data = StoredResultSchema.parse(data)
    else if (name === 'requirements') data = RequirementsSchema.parse(data)
    return store.writeApplicationFile(id as string, name as never, data)
  })
  handle(IPC.appsDelete, (id: unknown) => store.deleteApplication(id as string))
  handle(IPC.appsSetTheme, (id: unknown, theme: unknown) => store.updateApplicationMeta(id as string, { theme: theme as never }))

  handle(IPC.genStart, async (input: unknown) => {
    const inp = input as GenerationInput
    const ac = new AbortController()
    // Reserve the id before any await so two quick clicks cannot both start a run.
    if (inp.regenerateId) {
      if (running.has(inp.regenerateId)) throw new Error('This application is already being generated.')
      running.set(inp.regenerateId, ac)
    }
    let prep
    try {
      prep = await prepareGeneration({ store }, inp)
    } catch (err) {
      if (inp.regenerateId) running.delete(inp.regenerateId)
      throw err
    }
    running.set(prep.id, ac)
    jobs.set(prep.id, [])
    void runGeneration(
      {
        store,
        provider: ctx.provider,
        fetchPosting: fetchPostingText,
        isMock: ctx.isMock,
        emit: (e) => {
          send(e)
          if (e.status === 'complete' || e.status === 'error' || e.status === 'cancelled') {
            running.delete(prep.id)
            // Keep the events briefly so a screen that opens late can still replay the outcome.
            setTimeout(() => jobs.delete(prep.id), 10 * 60_000).unref()
          }
        }
      },
      prep,
      ac.signal
    )
    return { id: prep.id }
  })
  handle(IPC.genCancel, (id: unknown) => {
    running.get(id as string)?.abort()
  })
  handle(IPC.repairStart, (id: unknown, input: unknown) => {
    const rid = ApplicationIdSchema.parse(id)
    const inp = input as { issues?: unknown; note?: unknown }
    const issues = Array.isArray(inp?.issues) ? inp.issues.filter((x): x is string => typeof x === 'string') : []
    const note = typeof inp?.note === 'string' ? inp.note : ''
    if (running.has(rid)) throw new Error('This application is already being worked on.')
    const ac = new AbortController()
    running.set(rid, ac)
    jobs.set(rid, [])
    void runRepair(
      {
        store,
        provider: ctx.provider,
        isMock: ctx.isMock,
        emit: (e) => {
          send(e)
          if (e.status === 'complete' || e.status === 'error' || e.status === 'cancelled') running.delete(rid)
        }
      },
      rid,
      { issues, note },
      ac.signal
    )
  })
  handle(IPC.repairCancel, (id: unknown) => {
    running.get(id as string)?.abort()
  })
  handle(IPC.genStatus, (id: unknown) => jobs.get(id as string) ?? [])

  handle(IPC.exportRun, (id: unknown) => exportApplication(store, ctx.appRoot, id as string))
  handle(IPC.exportSaveAs, async (id: unknown, which: unknown) => {
    const { meta, profile } = await loadDocInput(store, id as string)
    const paths = exportedPaths(store, meta, profile)
    const src = which === 'coverLetter' ? paths.coverLetter : paths.resume
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const opts = { title: 'Save PDF to', defaultPath: basename(src), filters: [{ name: 'PDF', extensions: ['pdf'] }] }
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (res.canceled || !res.filePath) return null
    await fs.copyFile(src, res.filePath)
    return res.filePath
  })
  handle(IPC.exportShow, async (id: unknown) => {
    const { meta, profile } = await loadDocInput(store, id as string)
    shell.showItemInFolder(exportedPaths(store, meta, profile).resume)
  })
}
