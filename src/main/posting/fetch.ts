import { BrowserWindow, session } from 'electron'
import { assessPosting, normalizeUrl } from './check'

const TIMEOUT_MS = 30_000
const RENDER_WAIT_MS = 1500
const PARTITION = 'careerer-posting-fetch' // in-memory, separate from the app session

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Loads the page in a hidden, sandboxed window and returns document.body.innerText. */
export async function fetchPostingText(rawUrl: string, signal?: AbortSignal): Promise<string> {
  const url = normalizeUrl(rawUrl)
  const ses = session.fromPartition(PARTITION)
  ses.setPermissionRequestHandler((_wc, _p, cb) => cb(false))
  // A direct file link must never write into the user's Downloads folder.
  ses.removeAllListeners('will-download')
  ses.on('will-download', (e) => e.preventDefault())

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      partition: PARTITION,
      // No preload, no node, sandboxed; JS on and webSecurity on so client-rendered boards work.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      javascript: true,
      webSecurity: true
    }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const httpOnly = (e: { preventDefault: () => void }, target: string): void => {
    if (!/^https?:\/\//i.test(target)) e.preventDefault()
  }
  win.webContents.on('will-navigate', (e, target) => httpOnly(e, target))
  win.webContents.on('will-redirect', (e, target) => httpOnly(e, target))

  let timer: NodeJS.Timeout | undefined
  const abortP = new Promise<never>((_, reject) => {
    const onAbort = (): void => reject(new DOMException('Aborted', 'AbortError'))
    if (signal?.aborted) onAbort()
    signal?.addEventListener('abort', onAbort, { once: true })
  })
  const timeoutP = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('The page took too long to load. Use "Paste the posting text instead".')),
      TIMEOUT_MS
    )
  })

  const work = (async () => {
    try {
      await win.loadURL(url)
    } catch {
      throw new Error('Could not open that link. Check the address, or use "Paste the posting text instead".')
    }
    await sleep(RENDER_WAIT_MS)
    const text = String(await win.webContents.executeJavaScript('document.body ? document.body.innerText : ""', true)).slice(0, 200_000)
    const verdict = assessPosting(text)
    if (!verdict.ok) throw new Error(verdict.message)
    return text.trim()
  })()

  try {
    return await Promise.race([work, abortP, timeoutP])
  } finally {
    clearTimeout(timer)
    work.catch(() => undefined)
    if (!win.isDestroyed()) win.destroy()
    void ses.clearStorageData()
  }
}
