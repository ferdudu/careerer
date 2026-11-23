import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { ProgressEvent } from '@shared/types'
import { IPC, type CareererApi, type IpcResult } from '@shared/api'

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!res.ok) throw new Error(res.error)
  return res.value
}

const isMock = process.argv.includes('--careerer-mock=1')

const api: CareererApi = {
  isMock,
  getAppInfo: () => call(IPC.appInfo),
  openDataFolder: () => call(IPC.openDataFolder),
  settings: {
    get: () => call(IPC.settingsGet),
    update: (patch) => call(IPC.settingsUpdate, patch),
  },
  cli: { status: () => call(IPC.cliStatus) },
  profile: {
    get: () => call(IPC.profileGet),
    save: (rawText) => call(IPC.profileSave, rawText),
    importFile: () => call(IPC.profileImport)
  },
  ats: {
    info: () => call(IPC.atsInfo),
    read: () => call(IPC.atsRead),
    replace: () => call(IPC.atsReplace),
    reset: () => call(IPC.atsReset)
  },
  applications: {
    list: () => call(IPC.appsList),
    get: (id) => call(IPC.appsGet, id),
    create: (input) => call(IPC.appsCreate, input),
    updateMeta: (id, patch) => call(IPC.appsUpdateMeta, id, patch),
    writeFile: (id, name, data) => call(IPC.appsWriteFile, id, name, data),
    remove: (id) => call(IPC.appsDelete, id),
    setTheme: (id, theme) => call(IPC.appsSetTheme, id, theme)
  },
  generation: {
    start: (input) => call(IPC.genStart, input),
    cancel: (id) => call(IPC.genCancel, id),
    status: (id) => call(IPC.genStatus, id),
    onProgress: (cb) => {
      const h = (_e: IpcRendererEvent, ev: ProgressEvent): void => cb(ev)
      ipcRenderer.on(IPC.genProgress, h)
      return () => {
        ipcRenderer.removeListener(IPC.genProgress, h)
      }
    }
  },
  repair: {
    start: (id, input) => call(IPC.repairStart, id, input),
    cancel: (id) => call(IPC.repairCancel, id)
  },
  export: {
    run: (id) => call(IPC.exportRun, id),
    saveAs: (id, which) => call(IPC.exportSaveAs, id, which),
    showInFolder: (id) => call(IPC.exportShow, id)
  }
}

contextBridge.exposeInMainWorld('careerer', api)
