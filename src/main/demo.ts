import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { THEMES } from '@shared/constants'
import type { ProgressEvent } from '@shared/types'
import { createStore } from './storage/store'
import { cliStats } from './llm/cli'
import { createCliProvider, createMockProvider, type LlmProvider } from './llm/provider'
import { prepareGeneration, runGeneration } from './llm/pipeline'
import { MOCK_POSTING } from './llm/fixtures/posting'
import { loadDocInput } from './export/service'
import { exportPair } from './export/pdf'
import { extractPdfText } from './export/pdfcheck'
import { computeCoverage } from '@shared/checks'
import type { Requirements } from '@shared/types'

interface Scenario {
  label: string
  appRoot: string
  outDir: string
  provider: LlmProvider
  isMock: boolean
  posting: string
  /** Expected resume page count, or undefined to accept 1 or 2. */
  expectResumePages?: number
}

/** Runs the pipeline in a throwaway data folder, exports both themes, and returns a report plus failures. */
async function runScenario(s: Scenario): Promise<{ report: Record<string, unknown>; failures: string[] }> {
  const data = join(s.outDir, '_data')
  await fs.rm(data, { recursive: true, force: true })
  const store = createStore({ dataDir: data, bundledAtsPath: join(s.appRoot, 'resources', 'ats-research-report.md') })
  await store.init()
  const sample = await fs.readFile(join(s.appRoot, 'docs', 'sample-profile.txt'), 'utf8')
  const failures: string[] = []
  const events: ProgressEvent[] = []
  let lastLog = 0

  const res = await store.saveProfile(sample)
  if (s.isMock) await store.saveProfile(sample, await s.provider.parseProfile(sample))
  else void res // the pipeline parses a profile that has no parse yet

  const prep = await prepareGeneration({ store }, { text: s.posting })
  await runGeneration(
    {
      store,
      provider: s.provider,
      isMock: s.isMock,
      stepPauseMs: 0,
      fetchPosting: async () => s.posting,
      emit: (e) => {
        events.push(e)
        if (e.detail && Date.now() - lastLog > 10_000) {
          lastLog = Date.now()
          console.log(`[${s.label}] ${e.detail}`)
        }
        if (e.timings) console.log(`[${s.label}] call durations: ${e.timings.map((t) => `${t.label} ${(t.ms / 1000).toFixed(1)} s`).join(' | ')}`)
      }
    },
    prep,
    new AbortController().signal
  )
  const final = events[events.length - 1]
  if (final?.status !== 'complete') {
    failures.push(`${s.label}: pipeline did not complete: ${JSON.stringify(final)}`)
    return { report: { label: s.label, events: events.map((e) => `${e.step}:${e.status}`) }, failures }
  }

  const { profile, result, meta } = await loadDocInput(store, prep.id)
  const detail = await store.getApplication(prep.id)
  const cov = computeCoverage(detail?.requirements as Requirements, result, sample)
  const report: Record<string, unknown> = {
    label: s.label,
    events: events.map((e) => `${e.step}:${e.status}`),
    checks: result.checks,
    coverage: `${cov.covered} / ${cov.total}`,
    timings: result.timings,
    cliLanding: { ...cliStats },
    themes: {}
  }
  const c = result.checks
  if (c && (c.placeholders.length || c.unknownEntities.length || c.inventions.length)) {
    failures.push(`${s.label}: post-checks flagged: ${JSON.stringify(c)}`)
  }
  const words = c?.coverLetterWords ?? 0
  if (words < 250 || words > 400) failures.push(`${s.label}: cover letter has ${words} words`)

  for (const theme of THEMES) {
    const dir = join(s.outDir, theme)
    await fs.mkdir(dir, { recursive: true })
    const out = await exportPair(s.appRoot, dir, {
      profile,
      resume: result.resume,
      coverLetter: result.coverLetter,
      company: meta.company,
      role: meta.role,
      theme
    })
    const resumeText = await extractPdfText(out.resume.path)
    const letterText = await extractPdfText(out.coverLetter.path)
    await fs.writeFile(join(dir, 'resume.extracted.txt'), resumeText.text)
    await fs.writeFile(join(dir, 'cover-letter.extracted.txt'), letterText.text)

    const flat = resumeText.text.replace(/\s+/g, '')
    const markers = [
      profile.name.replace(/\s+/g, ''),
      profile.contacts.email ?? '',
      'SUMMARY',
      'SKILLS',
      'EXPERIENCE',
      ...result.resume.experience.map((e) => e.company.replace(/\s+/g, '')),
      ...(result.resume.projects.length ? ['PROJECTS'] : []),
      'EDUCATION',
      ...result.resume.education.map((e) => e.school.replace(/\s+/g, ''))
    ]
    let from = 0
    const order: string[] = []
    for (const m of markers) {
      const at = flat.toLowerCase().indexOf(m.toLowerCase(), from)
      if (at < 0) {
        order.push(`MISSING ${m}`)
        failures.push(`${s.label}/${theme}: marker not found in order: ${m}`)
      } else {
        order.push(`${m}@${at}`)
        from = at
      }
    }
    for (const w of ['SUMMARY', 'PROJECTS', 'SALESFORCE DEVELOPER']) {
      if (w === 'PROJECTS' && !result.resume.projects.length) continue
      if (!resumeText.text.includes(w) && !(w === 'SALESFORCE DEVELOPER' && profile.name !== 'Deji Ojo' && s.isMock === false)) {
        failures.push(`${s.label}/${theme}: "${w}" not extracted as whole text`)
      }
    }
    if (/\[[^\]]+\]/.test(resumeText.text)) failures.push(`${s.label}/${theme}: placeholder in resume PDF`)
    if (!letterText.text.includes(profile.contacts.email ?? '@@')) failures.push(`${s.label}/${theme}: email missing in cover letter`)
    if (resumeText.pages > 2) failures.push(`${s.label}/${theme}: resume has ${resumeText.pages} pages`)
    if (s.expectResumePages && resumeText.pages !== s.expectResumePages) {
      failures.push(`${s.label}/${theme}: expected ${s.expectResumePages} resume page(s), got ${resumeText.pages}`)
    }
    if (letterText.pages !== 1) failures.push(`${s.label}/${theme}: cover letter has ${letterText.pages} pages`)
    for (const w of out.warnings) failures.push(`${s.label}/${theme}: ${w}`)
    ;(report.themes as Record<string, unknown>)[theme] = {
      resume: { path: out.resume.path, pages: resumeText.pages, bodyFontPx: out.resume.fontPx },
      coverLetter: { path: out.coverLetter.path, pages: letterText.pages, bodyFontPx: out.coverLetter.fontPx },
      emailIntact: resumeText.text.includes(profile.contacts.email ?? '@@'),
      readingOrder: order,
      warnings: out.warnings
    }
  }
  return { report, failures }
}

async function finish(outDir: string, report: Record<string, unknown>, failures: string[]): Promise<void> {
  report.failures = failures
  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  app.exit(failures.length ? 1 : 0)
}

/**
 * Audit hook (CAREERER_DEMO_EXPORT=<dir>): runs the mock pipeline for the standard and the long
 * fixture, writing PDFs for both themes to <dir>/standard and <dir>/long. No window is shown.
 */
export async function runDemoExport(appRoot: string, outDir: string): Promise<void> {
  const all: Record<string, unknown> = {}
  const failures: string[] = []
  for (const [variant, pages] of [['standard', 1], ['long', 2]] as const) {
    const r = await runScenario({
      label: variant,
      appRoot,
      outDir: join(outDir, variant),
      provider: createMockProvider(0, variant),
      isMock: true,
      posting: MOCK_POSTING,
      expectResumePages: pages
    })
    all[variant] = r.report
    failures.push(...r.failures)
  }
  await finish(outDir, all, failures)
}

/**
 * ONE real end-to-end run through the Claude CLI with the haiku alias (CAREERER_REAL_CHECK=<dir>).
 * Uses docs/sample-profile.txt and a short sample posting; spends a little of the user's plan usage.
 */
export async function runRealCheck(appRoot: string, outDir: string): Promise<void> {
  const r = await runScenario({
    label: 'real-haiku',
    appRoot,
    outDir: join(outDir, 'real'),
    provider: createCliProvider(async () => ({ model: 'haiku' })),
    isMock: false,
    posting: MOCK_POSTING
  })
  await finish(outDir, { 'real-haiku': r.report }, r.failures)
}
