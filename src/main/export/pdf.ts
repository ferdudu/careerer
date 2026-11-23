import { BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { CoverLetterData, ParsedProfile, ResumeData, Theme } from '@shared/types'
import {
  documentCss,
  coverLetterHtml,
  resumeHtml,
  fontSteps,
  formatDateLabel,
  headerFromProfile,
  LETTER_FONT_MAX,
  LETTER_FONT_MIN,
  PAGE_H,
  pdfFileName,
  RESUME_FONT_MAX,
  RESUME_FONT_MIN,
  wrapDocument,
  type DocHeader
} from '@shared/template'
import { checkPdfText } from './pdfcheck'

/** (family, weight) pairs bundled from @fontsource. Local files only: no network at export. */
const FONT_FILES: { family: string; weight: number; pkg: string; file: string }[] = [
  { family: 'Bodoni Moda', weight: 400, pkg: 'bodoni-moda', file: 'bodoni-moda-latin-400-normal.woff2' },
  { family: 'Bodoni Moda', weight: 500, pkg: 'bodoni-moda', file: 'bodoni-moda-latin-500-normal.woff2' },
  { family: 'Geist', weight: 400, pkg: 'geist', file: 'geist-latin-400-normal.woff2' },
  { family: 'Geist', weight: 500, pkg: 'geist', file: 'geist-latin-500-normal.woff2' },
  { family: 'Geist', weight: 600, pkg: 'geist', file: 'geist-latin-600-normal.woff2' }
]

let fontCache: string | undefined

/** @font-face rules with base64 data URIs. `appRoot` is app.getAppPath() (or the repo root). */
export async function loadFontFaceCss(appRoot: string): Promise<string> {
  if (fontCache) return fontCache
  const rules: string[] = []
  for (const f of FONT_FILES) {
    const buf = await fs.readFile(join(appRoot, 'node_modules', '@fontsource', f.pkg, 'files', f.file))
    rules.push(
      `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2')}`
    )
  }
  fontCache = rules.join('\n')
  return fontCache
}

export interface DocInput {
  profile: ParsedProfile
  resume: ResumeData
  coverLetter: CoverLetterData
  company: string
  role: string
  theme: Theme
  date?: Date
}

export interface RenderedPdf {
  path: string
  fontPx: number
  pages: number
}

async function renderToPdf(
  html: string,
  outPath: string,
  steps: number[]
): Promise<{ fontPx: number; pages: number }> {
  const tmpFile = join(tmpdir(), `careerer-doc-${Date.now()}-${Math.random().toString(36).slice(2)}.html`)
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true, webSecurity: true }
  })
  try {
    // Data URLs are too small for inlined fonts; load a temp file instead.
    await fs.writeFile(tmpFile, html, 'utf8')
    await win.loadFile(tmpFile)
    // Wait for the bundled fonts, then step the body size down until the page fits.
    let chosen = steps[0]
    let height = PAGE_H
    for (const px of steps) {
      chosen = px
      height = (await win.webContents.executeJavaScript(
        `document.fonts.ready.then(()=>{const d=document.getElementById('doc');d.style.fontSize='${px}px';return d.scrollHeight})`
      )) as number
      if (height <= PAGE_H + 1) break
    }
    const pdf = await win.webContents.printToPDF({
      pageSize: 'Letter',
      printBackground: true,
      margins: { marginType: 'none' },
      preferCSSPageSize: true
    })
    await fs.mkdir(dirname(outPath), { recursive: true })
    await fs.writeFile(outPath, pdf)
    return { fontPx: chosen, pages: Math.max(1, Math.ceil((height - 1) / PAGE_H)) }
  } finally {
    if (!win.isDestroyed()) win.destroy()
    await fs.rm(tmpFile, { force: true })
  }
}

export interface ExportedPair {
  resume: RenderedPdf
  coverLetter: RenderedPdf
  warnings: string[]
}

/** Renders both PDFs into `dir` and runs the post-export text check. */
export async function exportPair(appRoot: string, dir: string, input: DocInput): Promise<ExportedPair> {
  const fonts = await loadFontFaceCss(appRoot)
  const header: DocHeader = headerFromProfile(input.profile)
  const dateLabel = formatDateLabel(input.date ?? new Date())

  const resumeSteps = fontSteps(RESUME_FONT_MAX, RESUME_FONT_MIN)
  const resumePage = wrapDocument(
    resumeHtml(header, input.resume),
    documentCss(input.theme, resumeSteps[0], 'resume'),
    fonts,
    input.theme
  )
  const resumePath = join(dir, pdfFileName(header.name, 'resume'))
  const r = await renderToPdf(resumePage, resumePath, resumeSteps)

  const letterSteps = fontSteps(LETTER_FONT_MAX, LETTER_FONT_MIN, 0.25)
  const letterPage = wrapDocument(
    coverLetterHtml(header, input.resume.headline, input.coverLetter, {
      company: input.company,
      role: input.role,
      dateLabel
    }),
    documentCss(input.theme, letterSteps[0], 'letter'),
    fonts,
    input.theme
  )
  const letterPath = join(dir, pdfFileName(header.name, 'cover-letter'))
  const c = await renderToPdf(letterPage, letterPath, letterSteps)

  const warnings: string[] = []
  if (c.pages > 1) warnings.push('The cover letter runs onto a second page. Shorten it to fit one page.')
  warnings.push(
    ...(await checkPdfText(resumePath, {
      email: header.email,
      headings: resumeHeadings(input.resume),
      label: 'Resume'
    })),
    ...(await checkPdfText(letterPath, { email: header.email, headings: [], label: 'Cover letter' }))
  )

  return {
    resume: { path: resumePath, fontPx: r.fontPx, pages: r.pages },
    coverLetter: { path: letterPath, fontPx: c.fontPx, pages: c.pages },
    warnings
  }
}

export function resumeHeadings(r: ResumeData): string[] {
  const h: string[] = []
  if (r.summary.trim()) h.push('Summary')
  if (r.skills.length) h.push('Skills')
  if (r.experience.length) h.push('Experience')
  if (r.projects.length) h.push('Projects')
  if (r.education.length) h.push('Education')
  if (r.certifications.length) h.push('Certifications')
  return h
}
