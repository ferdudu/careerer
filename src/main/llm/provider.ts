import type { ParsedProfile, Requirements, StoredResult } from '@shared/types'
import { removePlaceholders } from '@shared/checks'
import { CoverLetterSchema, ReportSchema, RequirementsSchema, ResumeSchema } from '@shared/llmSchemas'
import { ParsedProfileSchema } from '@shared/schemas'
import { z } from 'zod'
import { CliError, resolveClaude, runClaude, type RunOutput } from './cli'
import {
  generateSystemText,
  generateUser,
  PARSE_SYSTEM,
  parseUser,
  REPAIR_SYSTEM,
  repairUser,
  REQUIREMENTS_SYSTEM,
  requirementsUser
} from './prompts'
import { toJsonSchema } from './schema'
import { MOCK_PARSED_PROFILE } from './fixtures/profile'
import { MOCK_REQUIREMENTS } from './fixtures/requirements'
import { MOCK_RESULT, MOCK_RESULT_LONG } from './fixtures/result'

/**
 * Reports each CLI invocation (including the retry): once when it starts, about once a second
 * while it streams (elapsedMs), and once when it finishes (durationMs).
 */
export type OnCall = (info: { label: string; attempt: number; elapsedMs?: number; durationMs?: number }) => void

const ResumeAndReportSchema = z.object({ resume: ResumeSchema, report: ReportSchema })
const LetterSchema = z.object({ coverLetter: CoverLetterSchema })

const RepairSchema = z.object({ resume: ResumeSchema, coverLetter: CoverLetterSchema })

export type RepairOutput = z.infer<typeof RepairSchema>

export type GenerateOutput = Pick<StoredResult, 'resume' | 'coverLetter' | 'report'>

/** The three LLM operations. The CLI and mock implementations are interchangeable. */
export interface LlmProvider {
  parseProfile(rawText: string, signal?: AbortSignal, onCall?: OnCall): Promise<ParsedProfile>
  extractRequirements(posting: string, signal?: AbortSignal, onCall?: OnCall): Promise<Requirements>
  /** One call that corrects the current documents; may only remove, reword or reorder profile facts. */
  repair(args: {
    docs: RepairOutput
    rawProfile: string
    issues: string[]
    note: string
    signal?: AbortSignal
    onCall?: OnCall
  }): Promise<RepairOutput>
  generate(args: {
    requirements: Requirements
    parsed?: ParsedProfile
    rawProfile: string
    atsReport: string
    signal?: AbortSignal
    onCall?: OnCall
  }): Promise<GenerateOutput>
}

export type CliRunner = (i: Parameters<typeof runClaude>[0]) => Promise<RunOutput>

/** One structured call: CLI run, zod validation, one retry with the validation problem appended. */
export async function callStructured<T>(opts: {
  run: CliRunner
  exe: string
  model: string
  system: string
  user: string
  schema: z.ZodType<T>
  label: string
  effort?: 'low' | 'medium' | 'high'
  signal?: AbortSignal
  onCall?: OnCall
}): Promise<T> {
  const jsonSchema = toJsonSchema(opts.schema)
  let problem = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    opts.onCall?.({ label: opts.label, attempt })
    const user = attempt === 1 ? opts.user : `${opts.user}\n\nYour previous reply was invalid (${problem}). Return valid JSON that matches the schema.`
    const out = await opts.run({
      exe: opts.exe,
      model: opts.model,
      system: opts.system,
      user,
      schema: jsonSchema,
      effort: opts.effort,
      signal: opts.signal,
      onActivity: (a) => opts.onCall?.({ label: opts.label, attempt, elapsedMs: a.elapsedMs })
    })
    opts.onCall?.({ label: opts.label, attempt, durationMs: out.ms })
    const parsed = opts.schema.safeParse(out.value)
    if (parsed.success) return parsed.data
    problem = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
  }
  throw new CliError('Claude returned output that did not match the expected format twice. Try again.')
}

export function createCliProvider(
  getSettings: () => Promise<{ model: string; claudePath?: string }>,
  run: CliRunner = runClaude
): LlmProvider {
  async function ctx(): Promise<{ exe: string; model: string }> {
    const s = await getSettings()
    const r = resolveClaude(s.claudePath)
    if (!r.path) throw new CliError(r.problem ?? 'Claude CLI was not found.')
    return { exe: r.path, model: s.model }
  }
  return {
    async parseProfile(rawText, signal, onCall) {
      return callStructured({
        run,
        ...(await ctx()),
        system: PARSE_SYSTEM,
        user: parseUser(rawText),
        schema: ParsedProfileSchema,
        label: 'Reading your profile',
        effort: 'low',
        signal,
        onCall
      })
    },
    async extractRequirements(posting, signal, onCall) {
      const r = await callStructured({
        run,
        ...(await ctx()),
        system: REQUIREMENTS_SYSTEM,
        user: requirementsUser(posting),
        schema: RequirementsSchema,
        label: 'Reading the requirements (call 1 of 3)',
        effort: 'low',
        signal,
        onCall
      })
      return { ...r, companyDetails: r.companyDetails.slice(0, 3) }
    },
    async repair({ docs, rawProfile, issues, note, signal, onCall }) {
      return callStructured({
        run,
        ...(await ctx()),
        system: REPAIR_SYSTEM,
        user: repairUser(docs, rawProfile, issues, note),
        schema: RepairSchema,
        label: 'Repairing the documents',
        effort: 'medium',
        signal,
        onCall
      })
    },
    /**
     * Two parallel calls instead of one big one: the resume with its report, and the cover letter.
     * Each produces about half the output, so wall time drops to the slower of the two.
     */
    async generate({ requirements, rawProfile, atsReport, signal, onCall }) {
      const today = new Date().toISOString().slice(0, 10)
      const c = await ctx()
      const ac = new AbortController()
      const onAbort = (): void => ac.abort()
      signal?.addEventListener('abort', onAbort, { once: true })
      const common = { run, ...c, signal: ac.signal, onCall }
      try {
        const [resumePart, letterPart] = await Promise.all([
          callStructured({
            ...common,
            system: generateSystemText(atsReport, 'resume'),
            user: generateUser(requirements, rawProfile, today, 'resume'),
            schema: ResumeAndReportSchema,
            label: 'Writing the resume (call 2 of 3)',
            effort: 'medium'
          }),
          callStructured({
            ...common,
            system: generateSystemText(atsReport, 'letter'),
            user: generateUser(requirements, rawProfile, today, 'letter'),
            schema: LetterSchema,
            label: 'Writing the cover letter (call 3 of 3)',
            effort: 'low'
          })
        ])
        return { resume: resumePart.resume, report: resumePart.report, coverLetter: letterPart.coverLetter }
      } catch (err) {
        ac.abort() // stop the sibling call
        throw err
      } finally {
        signal?.removeEventListener('abort', onAbort)
      }
    }
  }
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** Rough parse for mock mode with a profile that is not the bundled sample. */
export function naiveParse(rawText: string): ParsedProfile {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const email = rawText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]
  return {
    name: lines[0] ?? '',
    headline: lines[1] ?? '',
    location: '',
    contacts: { email, links: [] },
    summary: '',
    skills: [],
    experience: [],
    projects: [],
    education: [],
    certifications: [],
    strengths: [],
    trajectory: ''
  }
}

export type MockVariant = 'standard' | 'long'

/** Fixtures for CAREERER_MOCK=1 (or =long for the two-page resume). A short delay per step shows progress. */
export function createMockProvider(stepDelayMs = 900, variant: MockVariant = 'standard'): LlmProvider {
  return {
    async parseProfile(rawText, signal) {
      await delay(stepDelayMs / 2, signal)
      return /Deji Ojo/.test(rawText) ? MOCK_PARSED_PROFILE : naiveParse(rawText)
    },
    async extractRequirements(_posting, signal, onCall) {
      onCall?.({ label: 'Reading the requirements (call 1 of 3)', attempt: 1 })
      await delay(stepDelayMs, signal)
      return MOCK_REQUIREMENTS
    },
    async repair({ docs, signal, onCall }) {
      onCall?.({ label: 'Repairing the documents', attempt: 1 })
      await delay(stepDelayMs, signal)
      // Mock fixture: the same documents with every placeholder removed.
      const clean = (v: unknown): unknown =>
        typeof v === 'string'
          ? removePlaceholders(v)
          : Array.isArray(v)
            ? v.map(clean).filter((x) => x !== '')
            : v && typeof v === 'object'
              ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]))
              : v
      return clean(structuredClone(docs)) as RepairOutput
    },
    async generate({ signal, onCall }) {
      onCall?.({ label: 'Writing the resume and cover letter (calls 2 and 3 of 3)', attempt: 1 })
      await delay(stepDelayMs * 1.5, signal)
      const { resume, coverLetter, report } = variant === 'long' ? MOCK_RESULT_LONG : MOCK_RESULT
      return structuredClone({ resume, coverLetter, report })
    }
  }
}
