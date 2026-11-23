import { z } from 'zod'

export const RequirementsSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  seniority: z.string().optional(),
  required: z.array(z.string()),
  preferred: z.array(z.string()),
  repeatedTerms: z.array(z.string()),
  knockouts: z.array(z.string()),
  /** One entry per required or preferred item: must-have or wishlist, and the need behind it. */
  needs: z
    .array(z.object({ requirement: z.string(), level: z.enum(['must', 'wishlist']), intent: z.string() }))
    .default([]),
  /** At most 3 are used; trimmed locally (array-size limits are not sent to the CLI schema). */
  companyDetails: z.array(z.string())
})

const SkillGroup = z.object({ group: z.string(), items: z.array(z.string()) })
const Experience = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  start: z.string(),
  end: z.string(),
  bullets: z.array(z.string())
})
const Project = z.object({
  name: z.string(),
  tech: z.string().optional(),
  link: z.string().optional(),
  description: z.string()
})
const Education = z.object({
  credential: z.string(),
  school: z.string(),
  location: z.string().optional(),
  year: z.string()
})

export const ResumeSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  skills: z.array(SkillGroup),
  experience: z.array(Experience),
  projects: z.array(Project),
  education: z.array(Education),
  certifications: z.array(z.string())
})

export const CoverLetterSchema = z.object({
  greeting: z.string(),
  paragraphs: z.array(z.string()),
  closing: z.string(),
  signature: z.string()
})

export const ReportSchema = z.object({
  matched: z.array(z.object({ term: z.string(), count: z.number(), where: z.array(z.string()) })),
  missingInfo: z.array(z.string()),
  knockoutFlags: z.array(z.string()),
  changes: z.array(z.string()),
  /** For each requirement, the strongest true bridge from the profile to the posting. */
  bridges: z
    .array(
      z.object({
        requirement: z.string(),
        approach: z.enum(['direct', 'transferable', 'trajectory']),
        /** A short quote copied from the profile text. */
        evidence: z.string(),
        whereUsed: z.array(z.string())
      })
    )
    .default([]),
  /** Requirements with no honest bridge. Private note for the user; never used in the documents. */
  stretch: z.array(z.string()).default([])
})

/** What call 2 returns. */
export const GenerationOutputSchema = z.object({
  resume: ResumeSchema,
  coverLetter: CoverLetterSchema,
  report: ReportSchema
})

/** What is stored in result.json: model output plus local post-check findings. */
export const StoredResultSchema = GenerationOutputSchema.extend({
  checks: z
    .object({
      placeholders: z.array(z.string()),
      unknownEntities: z.array(z.string()),
      inventions: z.array(z.string()).default([]),
      coverLetterWords: z.number()
    })
    .optional(),
  timings: z.array(z.object({ label: z.string(), ms: z.number() })).optional()
})
