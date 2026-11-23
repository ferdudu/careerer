import type {
  AppFileName,
  AppInfo,
  ApplicationDetail,
  ApplicationMeta,
  AtsInfo,
  CliStatus,
  SaveProfileResult,
  ExportResult,
  GenerationInput,
  ProgressEvent,
  Theme,
  MetaPatch,
  NewApplication,
  Profile,
  PublicSettings,
  SettingsPatch
} from './types'

/** IPC channel names, shared by main and preload. */
export const IPC = {
  appInfo: 'app:info',
  openDataFolder: 'app:openDataFolder',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  cliStatus: 'cli:status',
  profileGet: 'profile:get',
  profileSave: 'profile:save',
  profileImport: 'profile:import',
  atsInfo: 'ats:info',
  atsRead: 'ats:read',
  atsReplace: 'ats:replace',
  atsReset: 'ats:reset',
  appsList: 'apps:list',
  appsGet: 'apps:get',
  appsCreate: 'apps:create',
  appsUpdateMeta: 'apps:updateMeta',
  appsWriteFile: 'apps:writeFile',
  appsDelete: 'apps:delete',
  appsSetTheme: 'apps:setTheme',
  genStart: 'gen:start',
  genCancel: 'gen:cancel',
  genStatus: 'gen:status',
  repairStart: 'repair:start',
  repairCancel: 'repair:cancel',
  genProgress: 'gen:progress',
  exportRun: 'export:run',
  exportSaveAs: 'export:saveAs',
  exportShow: 'export:show'
} as const

/** Result envelope so errors cross IPC as plain data. */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string }

/** The typed API exposed on window.careerer. */
export interface CareererApi {
  /** True when the main process runs with CAREERER_MOCK=1. */
  readonly isMock: boolean
  getAppInfo(): Promise<AppInfo>
  openDataFolder(): Promise<void>
  settings: {
    get(): Promise<PublicSettings>
    update(patch: SettingsPatch): Promise<PublicSettings>
  }
  cli: {
    /** Detects the Claude CLI, its version and whether it is signed in. */
    status(): Promise<CliStatus>
  }
  profile: {
    get(): Promise<Profile | null>
    /** Saves the text and tries to read it into sections; parseError says why that failed. */
    save(rawText: string): Promise<SaveProfileResult>
    /** File dialog in main; extracts text from a PDF or DOCX. Null if cancelled. */
    importFile(): Promise<{ fileName: string; text: string } | null>
  }
  ats: {
    info(): Promise<AtsInfo>
    read(): Promise<string>
    /** Opens a file dialog in main; resolves null if cancelled. */
    replace(): Promise<AtsInfo | null>
    reset(): Promise<AtsInfo>
  }
  applications: {
    list(): Promise<ApplicationMeta[]>
    get(id: string): Promise<ApplicationDetail | null>
    create(input: NewApplication): Promise<ApplicationMeta>
    updateMeta(id: string, patch: MetaPatch): Promise<ApplicationMeta>
    writeFile(id: string, name: AppFileName, data: unknown): Promise<void>
    remove(id: string): Promise<void>
    setTheme(id: string, theme: Theme): Promise<ApplicationMeta>
  }
  generation: {
    /** Creates the application (or reuses regenerateId) and starts the pipeline in main. */
    start(input: GenerationInput): Promise<{ id: string }>
    cancel(id: string): Promise<void>
    /** Events recorded so far for a job, for screens that subscribed late. */
    status(id: string): Promise<ProgressEvent[]>
    /** Subscribe to progress events; returns an unsubscribe function. */
    onProgress(cb: (e: ProgressEvent) => void): () => void
  }
  repair: {
    /** One manual correction call. Progress and the outcome arrive through generation.onProgress (same id). */
    start(id: string, input: { issues: string[]; note: string }): Promise<void>
    cancel(id: string): Promise<void>
  }
  export: {
    /** Renders both PDFs into the application folder and verifies their text. */
    run(id: string): Promise<ExportResult>
    /** Save-to dialog for one of the exported PDFs; resolves null if cancelled. */
    saveAs(id: string, which: 'resume' | 'coverLetter'): Promise<string | null>
    showInFolder(id: string): Promise<void>
  }
}

declare global {
  interface Window {
    careerer: CareererApi
  }
}
