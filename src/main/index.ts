import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'node:path'
import * as fs from 'node:fs'
import { createStore } from './storage/store'
import { registerIpc } from './ipc'
import { createCliProvider, createMockProvider } from './llm/provider'
import { runDemoExport, runRealCheck } from './demo'
import { runSmoke } from './smoke'
import { tmpdir } from 'node:os'

// Smoke runs use a throwaway data folder so they never touch real data.
if (process.env.CAREERER_SMOKE && !app.isPackaged) {
  app.setPath('userData', join(tmpdir(), 'careerer-smoke-data'))
  fs.rmSync(app.getPath('userData'), { recursive: true, force: true })
}

/** CAREERER_MOCK=1 uses fixtures; CAREERER_MOCK=long uses the long-profile fixture (two-page resume). */
export const isMock = process.env.CAREERER_MOCK === '1' || process.env.CAREERER_MOCK === 'long'

function bundledAtsPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'ats-research-report.md')
    : join(app.getAppPath(), 'resources', 'ats-research-report.md')
}

function isAppUrl(url: string): boolean {
  const dev = process.env['ELECTRON_RENDERER_URL']
  if (dev) return url.startsWith(dev)
  return url.startsWith('file://')
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#0D0D0C',
    title: 'Careerer',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
      allowRunningInsecureContent: false,
      additionalArguments: [`--careerer-mock=${isMock ? '1' : '0'}`]
    }
  })

  win.once('ready-to-show', () => win.show())

  // Never let the app window navigate away or open new windows.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!isAppUrl(url)) e.preventDefault()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w) {
      if (w.isMinimized()) w.restore()
      w.focus()
    }
  })

  void app.whenReady().then(async () => {
    app.setAppUserModelId('com.careerer.app')

    // Deny every permission request (camera, geolocation, notifications...).
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))

    const store = createStore({
      dataDir: app.getPath('userData'),
      bundledAtsPath: bundledAtsPath()
    })
    await store.init()
    const provider = isMock
      ? createMockProvider(900, process.env.CAREERER_MOCK === 'long' ? 'long' : 'standard')
      : createCliProvider(() => store.getSettings())

    // Dev/audit hook: renders the mock pipeline to PDFs without a window, then quits.
    if ((process.env.CAREERER_DEMO_EXPORT || process.env.CAREERER_REAL_CHECK) && !app.isPackaged) {
      const outDir = (process.env.CAREERER_DEMO_EXPORT ?? process.env.CAREERER_REAL_CHECK) as string
      try {
        if (process.env.CAREERER_REAL_CHECK) await runRealCheck(app.getAppPath(), outDir)
        else await runDemoExport(app.getAppPath(), outDir)
      } catch (err) {
        const msg = err instanceof Error ? (err.stack ?? err.message) : String(err)
        await fs.promises.writeFile(join(outDir, 'error.txt'), msg)
        app.exit(1)
      }
      app.quit()
      return
    }

    registerIpc(store, { provider, isMock, appRoot: app.getAppPath() })
    const win = createWindow()
    if (process.env.CAREERER_SMOKE && !app.isPackaged) void runSmoke(win, app.getAppPath())

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !process.env.CAREERER_DEMO_EXPORT && !process.env.CAREERER_REAL_CHECK && !process.env.CAREERER_SMOKE) app.quit()
  })
}
