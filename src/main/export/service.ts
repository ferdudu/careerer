import { join } from 'node:path'
import type { ApplicationMeta, ExportResult, ParsedProfile, StoredResult } from '@shared/types'
import { StoredResultSchema } from '@shared/llmSchemas'
import { runChecks } from '@shared/checks'
import type { Store } from '../storage/store'
import { exportPair } from './pdf'
import { pdfFileName } from '@shared/template'

export async function loadDocInput(store: Store, id: string): Promise<{
  meta: ApplicationMeta
  profile: ParsedProfile
  rawProfile: string
  posting: string
  result: StoredResult
}> {
  const detail = await store.getApplication(id)
  if (!detail) throw new Error('Application not found.')
  const parsed = StoredResultSchema.safeParse(detail.result)
  if (!parsed.success) throw new Error('This application has no generated documents yet.')
  const p = await store.getProfile()
  if (!p) throw new Error('Profile not found.')
  if (!p.parsed) throw new Error('Your profile has not been read into sections yet. Open Profile and save it again.')
  return { meta: detail.meta, profile: p.parsed, rawProfile: p.rawText, posting: detail.posting ?? '', result: parsed.data }
}

/** Renders both PDFs into the application folder and marks the application exported. */
export async function exportApplication(store: Store, appRoot: string, id: string): Promise<ExportResult> {
  const { meta, profile, result, rawProfile, posting } = await loadDocInput(store, id)
  // Edits may have introduced placeholders or invented facts since generation; re-check before export.
  const checks = runChecks(result, rawProfile, posting)
  const pre: string[] = []
  if (checks.placeholders.length) pre.push(`Leftover placeholders in the documents: ${checks.placeholders.join(', ')}`)
  for (const x of [...checks.unknownEntities, ...checks.inventions]) pre.push(x)
  const dir = join(store.paths.appsDir, meta.id)
  const out = await exportPair(appRoot, dir, {
    profile,
    resume: result.resume,
    coverLetter: result.coverLetter,
    company: meta.company,
    role: meta.role,
    theme: meta.theme
  })
  if (meta.status === 'draft') await store.updateApplicationMeta(id, { status: 'exported' })
  return { resumePath: out.resume.path, coverLetterPath: out.coverLetter.path, warnings: [...pre, ...out.warnings] }
}

export function exportedPaths(store: Store, meta: ApplicationMeta, profile: ParsedProfile): { resume: string; coverLetter: string } {
  const dir = join(store.paths.appsDir, meta.id)
  return {
    resume: join(dir, pdfFileName(profile.name, 'resume')),
    coverLetter: join(dir, pdfFileName(profile.name, 'cover-letter'))
  }
}
