import type { z } from 'zod'
import type {
  ApplicationMetaSchema,
  MetaPatchSchema,
  NewApplicationSchema,
  ParsedProfileSchema,
  ProfileSchema,
  PublicSettingsSchema,
  SettingsPatchSchema,
  StoredSettingsSchema,
  ThemeSchema,
  StatusSchema,
  AppFileSchema
} from './schemas'

export type Theme = z.infer<typeof ThemeSchema>
export type Status = z.infer<typeof StatusSchema>
export type StoredSettings = z.infer<typeof StoredSettingsSchema>
export type PublicSettings = z.infer<typeof PublicSettingsSchema>
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>
export type ParsedProfile = z.infer<typeof ParsedProfileSchema>
export type Profile = z.infer<typeof ProfileSchema>
export type ApplicationMeta = z.infer<typeof ApplicationMetaSchema>
export type NewApplication = z.input<typeof NewApplicationSchema>
export type MetaPatch = z.infer<typeof MetaPatchSchema>
export type AppFileName = z.infer<typeof AppFileSchema>

export interface ApplicationDetail {
  meta: ApplicationMeta
  posting?: string
  requirements?: unknown
  result?: unknown
  /** True when result.json exists but failed validation. */
  resultInvalid?: boolean
}

export interface AtsInfo {
  exists: boolean
  bytes: number
  updatedAt?: string
}

export interface AppInfo {
  dataDir: string
  version: string
}

// ---- generation pipeline ----
export type Requirements = {
  title: string
  company: string
  location?: string
  seniority?: string
  required: string[]
  preferred: string[]
  repeatedTerms: string[]
  knockouts: string[]
  companyDetails: string[]
  needs: { requirement: string; level: 'must' | 'wishlist'; intent: string }[]
}
export type SkillGroup = { group: string; items: string[] }
export type ResumeData = {
  headline: string
  summary: string
  skills: SkillGroup[]
  experience: { title: string; company: string; location?: string; start: string; end: string; bullets: string[] }[]
  projects: { name: string; tech?: string; link?: string; description: string }[]
  education: { credential: string; school: string; location?: string; year: string }[]
  certifications: string[]
}
export type CoverLetterData = { greeting: string; paragraphs: string[]; closing: string; signature: string }
export type ReportData = {
  matched: { term: string; count: number; where: string[] }[]
  missingInfo: string[]
  knockoutFlags: string[]
  changes: string[]
  bridges: { requirement: string; approach: 'direct' | 'transferable' | 'trajectory'; evidence: string; whereUsed: string[] }[]
  stretch: string[]
}
export type StoredResult = {
  resume: ResumeData
  coverLetter: CoverLetterData
  report: ReportData
  checks?: { placeholders: string[]; unknownEntities: string[]; inventions: string[]; coverLetterWords: number }
  /** Duration of each Claude call in this generation. */
  timings?: { label: string; ms: number }[]
}

export type GenerationInput = { url?: string; text?: string; regenerateId?: string }
export type ProgressEvent = {
  id: string
  /** 0..3 matching STEPS */
  step: number
  status: 'active' | 'done' | 'error' | 'cancelled' | 'complete'
  requirements?: Requirements
  error?: string
  /** Extra line for the UI, e.g. which Claude call is running. */
  detail?: string
  /** Per-call durations, on the complete event. */
  timings?: { label: string; ms: number }[]
}
export type ExportResult = {
  resumePath: string
  coverLetterPath: string
  warnings: string[]
}

export interface CliStatus {
  found: boolean
  path?: string
  version?: string
  loggedIn?: boolean
  /** Why it is unusable, in plain language. */
  problem?: string
}
export interface SaveProfileResult {
  profile: Profile
  parseError?: string
}
