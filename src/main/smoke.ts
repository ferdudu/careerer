import { app, type BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { MOCK_POSTING } from './llm/fixtures/posting'

/**
 * Headless smoke check (CAREERER_SMOKE=1, runs with mock mode): drives the real renderer through
 * saving the profile, running the mock pipeline, opening Review and exporting both PDFs.
 * Exit code 0 on success, 1 on any failure. Writes smoke.log into CAREERER_SMOKE_OUT if set.
 */
export async function runSmoke(win: BrowserWindow, appRoot: string): Promise<void> {
  const log: string[] = []
  const out = process.env.CAREERER_SMOKE_OUT
  const done = async (ok: boolean): Promise<void> => {
    if (out) await fs.writeFile(join(out, 'smoke.log'), log.join('\n') + `\n${ok ? 'PASS' : 'FAIL'}\n`).catch(() => undefined)
    app.exit(ok ? 0 : 1)
  }
  const run = <T>(code: string): Promise<T> => win.webContents.executeJavaScript(code, true) as Promise<T>
  const fail = async (m: string): Promise<void> => {
    log.push(`FAIL: ${m}`)
    await done(false)
  }
  const timeout = setTimeout(() => void fail('timed out after 120 s'), 120_000)
  try {
    if (win.webContents.isLoading()) await new Promise<void>((r) => win.webContents.once('did-finish-load', () => r()))
    const sample = await fs.readFile(join(appRoot, 'docs', 'sample-profile.txt'), 'utf8')
    const posting = MOCK_POSTING

    const isMock = await run<boolean>('window.careerer.isMock')
    if (!isMock) return void (await fail('mock mode is not on'))
    log.push('mock flag visible to renderer')

    await run(`window.careerer.profile.save(${JSON.stringify(sample)})`)
    const prof = await run<{ parsed?: { name: string } }>('window.careerer.profile.get()')
    if (prof.parsed?.name !== 'Deji Ojo') return void (await fail('profile was not parsed'))
    log.push('profile saved and parsed')

    const id = await run<string>(`new Promise((resolve, reject) => {
      let id = null; const seen = []
      const off = window.careerer.generation.onProgress((e) => {
        if (id && e.id !== id) return
        seen.push(e.step + ':' + e.status)
        if (e.status === 'complete') { off(); resolve(e.id) }
        if (e.status === 'error') { off(); reject(new Error(e.error)) }
      })
      window.careerer.generation.start({ text: ${JSON.stringify(posting)} }).then((r) => { id = r.id })
    })`)
    log.push(`generation complete (${id})`)

    await run(`location.hash = '#/review/${id}'`)
    await new Promise((r) => setTimeout(r, 2500))
    const view = await run<{ doc: boolean; text: string; editable: number }>(
      `({ doc: !!document.querySelector('.doc'), text: document.body.innerText, editable: document.querySelectorAll('[contenteditable]').length })`
    )
    if (!view.doc || !/SUMMARY/i.test(view.text)) return void (await fail('Review did not render the resume preview'))
    if (view.editable < 3) return void (await fail('preview is not editable'))
    if (!/CHECK BEFORE YOU APPLY/i.test(view.text)) return void (await fail('knockout checklist missing'))
    if (!/HOW YOU MATCH THE WISHLIST/i.test(view.text) || /LEFT OUT/i.test(view.text)) return void (await fail('wishlist card missing or old gaps card present'))
    if (!/WORTH PREPARING FOR AT INTERVIEW/i.test(view.text)) return void (await fail('private stretch note missing'))
    log.push(`Review rendered (${view.editable} editable regions)`)

    // Manual Repair: plant a placeholder, open Review, click Repair, submit, and expect it to be gone.
    await run(`(async () => {
      const d = await window.careerer.applications.get('${id}')
      d.result.resume.summary += ' Cut load times from [X sec] to [Y sec].'
      await window.careerer.applications.writeFile('${id}', 'result', d.result)
    })()`)
    await run(`location.hash = '#/'`)
    await new Promise((r) => setTimeout(r, 400))
    await run(`location.hash = '#/review/${id}'`)
    await new Promise((r) => setTimeout(r, 2500))
    const click = (label: string): Promise<boolean> =>
      run<boolean>(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '${label}'); if (!b || b.disabled) return false; b.click(); return true })()`)
    if (!(await click('Repair'))) return void (await fail('Repair button not found'))
    await new Promise((r) => setTimeout(r, 500))
    const panel = await run<string>('document.body.innerText')
    if (!/Leftover placeholder: \[X sec\]/.test(panel)) return void (await fail('Repair panel did not list the placeholder'))
    if (!(await click('Repair now'))) return void (await fail('Repair now button not available'))
    let repaired = false
    for (let i = 0; i < 30 && !repaired; i++) {
      await new Promise((r) => setTimeout(r, 500))
      repaired = await run<boolean>(`document.body.innerText.includes('Repaired. The previous version')`)
    }
    if (!repaired) return void (await fail('Repair did not finish'))
    const after = await run<{ summary: string; placeholders: string[]; prev: boolean }>(`(async () => {
      const d = await window.careerer.applications.get('${id}')
      return { summary: d.result.resume.summary, placeholders: d.result.checks.placeholders, prev: true }
    })()`)
    if (/\[X sec\]/.test(after.summary) || after.placeholders.length) return void (await fail('Repair left the placeholder in place'))
    log.push('Repair removed the placeholder and refreshed the preview')

    for (const route of ['/', '/library', '/profile', '/settings']) {
      await run(`location.hash = '#${route}'`)
      await new Promise((r) => setTimeout(r, 400))
      const ok = await run<boolean>(`document.querySelector('main h1') !== null`)
      if (!ok) return void (await fail(`screen ${route} did not render`))
    }
    log.push('all screens render')

    const res = await run<{ warnings: string[]; resumePath: string }>(`window.careerer.export.run('${id}')`)
    if (res.warnings.length) return void (await fail(`export warnings: ${res.warnings.join(' | ')}`))
    log.push(`export ok: ${res.resumePath}`)
    clearTimeout(timeout)
    await done(true)
  } catch (err) {
    clearTimeout(timeout)
    await fail(err instanceof Error ? err.message : String(err))
  }
}
