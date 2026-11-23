import { z } from 'zod'

import { DEFAULT_MODEL, MODELS } from './constants'
export { MODELS, DEFAULT_MODEL } from './constants'

export const ThemeSchema = z.enum(['midnight', 'daylight'])
export const StatusSchema = z.enum(['draft', 'exported', 'applied'])

/** What is stored on disk. Field-level catches so one bad field never drops the others. */
export const StoredSettingsSchema = z.object({
  model: z.enum(MODELS).catch(DEFAULT_MODEL),
  defaultTheme: ThemeSchema.catch('midnight'),
  /** Optional absolute path to the Claude CLI executable. */
  claudePath: z.string().min(1).optional().catch(undefined)
})

export const PublicSettingsSchema = z.object({
  model: z.enum(MODELS),
  defaultTheme: ThemeSchema,
  claudePath: z.string().optional()
})

export const SettingsPatchSchema = z.object({
  model: z.enum(MODELS).optional(),
  defaultTheme: ThemeSchema.optional(),
  /** Empty string clears the override. */
  claudePath: z.string().optional()
})

export const ParsedProfileSchema = z.object({
  name: z.string(),
  headline: z.string(),
  location: z.string(),
  contacts: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    links: z.array(z.string())
  }),
  summary: z.string(),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string().optional(),
      start: z.string(),
      end: z.string(),
      bullets: z.array(z.string())
    })
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      tech: z.string().optional(),
      link: z.string().optional(),
      description: z.string()
    })
  ),
  education: z.array(
    z.object({
      credential: z.string(),
      school: z.string(),
      location: z.string().optional(),
      year: z.string()
    })
  ),
  certifications: z.array(z.string()),
  /** Transferable strengths, outcomes, scale and customer-facing work, each directly supported by the text. */
  strengths: z.array(z.string()).default([]),
  /** One to three sentences on how the career developed (new stacks, growing scope). */
  trajectory: z.string().default('')
})

export const ProfileSchema = z.object({
  rawText: z.string(),
  parsed: ParsedProfileSchema.optional(),
  updatedAt: z.string()
})

export const ApplicationIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,64}$/)

export const ApplicationMetaSchema = z.object({
  id: ApplicationIdSchema,
  role: z.string(),
  company: z.string(),
  url: z.string().optional(),
  createdAt: z.string(),
  status: StatusSchema,
  theme: ThemeSchema
})

export const NewApplicationSchema = z.object({
  role: z.string().default(''),
  company: z.string().default(''),
  url: z.string().optional(),
  theme: ThemeSchema.optional(),
  posting: z.string().optional()
})

export const MetaPatchSchema = z.object({
  role: z.string().optional(),
  company: z.string().optional(),
  url: z.string().optional(),
  status: StatusSchema.optional(),
  theme: ThemeSchema.optional()
})

export const APP_FILES = ['posting', 'requirements', 'result'] as const
export const AppFileSchema = z.enum(APP_FILES)
