import type { GenerationInput, ProgressEvent, StoredResult } from '@shared/types'
import { coverLetterText, countTerm, resumeText, runChecks } from '@shared/checks'
import { assessPosting } from '../posting/check'
import { naiveParse } from './provider'
import type { Store } from '../storage/store'
import type { LlmProvider } from './provider'
import { delay, type OnCall } from './provider'
import { MOCK_POSTING } from './fixtures/posting'

export interface PipelineDeps {
  store: Store
  provider: LlmProvider
  /** Fetches and validates posting text from a URL (Electron window in the app). */
  fetchPosting: (url: string, signal?: AbortSignal) => Promise<string>
  isMock: boolean
  emit: (e: ProgressEvent) => void
  /** Pause between steps so progress is visible (mock mode only). */
  stepPauseMs?: number
}

export const MAX_POSTING_CHARS = 60_000
export const MAX_PROFILE_CHARS = 100_000

export interface Prepared {
  id: string
  isNew: boolean
}

/** Creates (or reuses) the application folder. Throws friendly errors for bad input. */
export async function prepareGeneration(deps: Pick<PipelineDeps, 'store'>, input: GenerationInput): Promise<Prepared> {
  const { store } = deps
  if (input.regenerateId) {
    const existing = await store.getApplication(input.regenerateId)
    if (!existing) throw new Error('Application not found.')
    return { id: input.regenerateId, isNew: false }
  }
  const text = input.text?.trim()
  const url = input.url?.trim()
  if (!text && !url) throw new Error('Enter a job link or paste the posting text.')
  if (text) {
    const v = assessPosting(text)
    if (!v.ok && text.length < 200) throw new Error('That text is too short to be a job posting. Paste the whole description.')
  }
  const meta = await store.createApplication({ role: '', company: '', url: url || undefined, posting: text })
  return { id: meta.id, isNew: true }
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

/** Runs the four steps. Never throws: outcomes are reported through emit(). */
export async function runGeneration(deps: PipelineDeps, prep: Prepared, signal: AbortSignal): Promise<void> {
  const { store, provider, emit } = deps
  const { id } = prep
  const pause = deps.isMock ? (deps.stepPauseMs ?? 700) : 0
  let step = 0
  const active = (s: number): void => {
    step = s
    emit({ id, step: s, status: 'active' })
  }
  const timings: { label: string; ms: number }[] = []
  const running = new Map<string, number>() // label -> elapsed ms, for calls in flight
  const onCall: OnCall = ({ label, attempt, elapsedMs, durationMs }) => {
    if (durationMs !== undefined) {
      running.delete(label)
      timings.push({ label: attempt > 1 ? `${label} (retry)` : label, ms: durationMs })
    } else {
      running.set(label, elapsedMs ?? 0)
    }
    const parts = [...running].map(([l, ms]) => `${l.replace(/ \(call.*$/, '')}${attempt > 1 ? ' (retrying once)' : ''} ${Math.round(ms / 1000)} s`)
    emit({ id, step, status: 'active', detail: parts.length ? `Working: ${parts.join(' · ')}` : undefined })
  }
  try {
    let profile = await store.getProfile()
    if (!profile?.rawText.trim()) throw new Error('Add your profile first.')
    if (!profile.parsed) {
      // The parse at save time did not happen or failed; try again now rather than using a guessed header.
      try {
        const parsed = await provider.parseProfile(profile.rawText, signal, onCall)
        profile = await store.saveProfile(profile.rawText, parsed)
      } catch (err) {
        if (signal.aborted || isAbort(err)) throw err
        if (!deps.isMock) {
          throw new Error(`Your profile has not been read yet: ${err instanceof Error ? err.message : 'unknown error'}`)
        }
        profile = await store.saveProfile(profile.rawText, naiveParse(profile.rawText))
      }
    }

    // Step 0: the posting
    active(0)
    const detail = await store.getApplication(id)
    if (!detail) throw new Error('Application not found.')
    let posting = detail.posting?.trim() ?? ''
    if (!posting) {
      if (!detail.meta.url) throw new Error('No posting text to work from.')
      posting = deps.isMock ? MOCK_POSTING : await deps.fetchPosting(detail.meta.url, signal)
      if (deps.isMock) await delay(pause, signal)
      await store.writeApplicationFile(id, 'posting', posting)
    } else if (deps.isMock) {
      await delay(pause / 2, signal)
    }
    if (posting.length > MAX_POSTING_CHARS) {
      posting = posting.slice(0, MAX_POSTING_CHARS) + '\n[Posting truncated for length.]'
    }
    emit({ id, step: 0, status: 'done' })

    // Step 1: requirements (call 1). Nothing is saved until the whole run succeeds.
    active(1)
    const requirements = await provider.extractRequirements(posting, signal, onCall)
    emit({ id, step: 1, status: 'done', requirements })

    // Step 2: ATS context
    active(2)
    const atsReport = await store.readAtsReport()
    if (deps.isMock) await delay(pause, signal)
    emit({ id, step: 2, status: 'done' })

    // Step 3: generate (call 2)
    active(3)
    const out = await provider.generate({
      requirements,
      rawProfile: profile.rawText,
      atsReport,
      signal,
      onCall
    })
    const all = resumeText(out.resume) + '\n' + coverLetterText(out.coverLetter)
    const result: StoredResult = {
      ...out,
      report: {
        ...out.report,
        // Recount against the final text; drop terms that do not actually appear.
        matched: out.report.matched
          .map((m) => ({ ...m, count: countTerm(all, m.term) }))
          .filter((m) => m.count > 0)
      },
      checks: runChecks(out, profile.rawText, posting),
      timings
    }
    await store.snapshotResult(id)
    await store.writeApplicationFile(id, 'requirements', requirements)
    await store.writeApplicationFile(id, 'result', result)
    await store.updateApplicationMeta(id, { role: requirements.title, company: requirements.company })
    emit({ id, step: 3, status: 'done' })
    emit({ id, step: 3, status: 'complete', timings })
  } catch (err) {
    // A cancelled brand-new run is discarded. A failed one stays as a draft with its posting so Retry works.
    if ((signal.aborted || isAbort(err)) && prep.isNew) await store.deleteApplication(id).catch(() => undefined)
    if (signal.aborted || isAbort(err)) {
      emit({ id, step, status: 'cancelled' })
    } else {
      emit({ id, step, status: 'error', error: err instanceof Error ? err.message : 'Generation failed.' })
    }
  }
}

export interface RepairInput {
  issues: string[]
  note: string
}

/**
 * Manual Repair: ONE call that corrects the current documents. Re-runs the post-checks, snapshots the
 * old result to result.prev.json, saves, and reports through emit() like a generation (never throws).
 */
export async function runRepair(
  deps: Pick<PipelineDeps, 'store' | 'provider' | 'isMock' | 'emit'>,
  id: string,
  input: RepairInput,
  signal: AbortSignal
): Promise<void> {
  const { store, provider, emit } = deps
  const t0 = Date.now()
  const onCall: OnCall = ({ label, elapsedMs }) =>
    emit({ id, step: 3, status: 'active', detail: `${label} ${Math.round((elapsedMs ?? 0) / 1000)} s` })
  try {
    emit({ id, step: 3, status: 'active', detail: 'Repairing the documents' })
    const detail = await store.getApplication(id)
    if (!detail?.result) throw new Error('This application has no documents to repair.')
    const profile = await store.getProfile()
    if (!profile?.rawText.trim()) throw new Error('Profile not found.')
    const old = detail.result as StoredResult
    const note = input.note.slice(0, 1000)
    const fixed = await provider.repair({
      docs: { resume: old.resume, coverLetter: old.coverLetter },
      rawProfile: profile.rawText,
      issues: input.issues.slice(0, 50),
      note,
      signal,
      onCall
    })
    const all = resumeText(fixed.resume) + '\n' + coverLetterText(fixed.coverLetter)
    const result: StoredResult = {
      ...old,
      resume: fixed.resume,
      coverLetter: fixed.coverLetter,
      report: { ...old.report, matched: old.report.matched.map((m) => ({ ...m, count: countTerm(all, m.term) })).filter((m) => m.count > 0) },
      checks: runChecks(fixed, profile.rawText, detail.posting ?? ''),
      timings: [...(old.timings ?? []), { label: 'Repair', ms: Date.now() - t0 }]
    }
    await store.snapshotResult(id)
    await store.writeApplicationFile(id, 'result', result)
    emit({ id, step: 3, status: 'complete' })
  } catch (err) {
    if (signal.aborted || isAbort(err)) emit({ id, step: 3, status: 'cancelled' })
    else emit({ id, step: 3, status: 'error', error: err instanceof Error ? err.message : 'Repair failed.' })
  }
}
