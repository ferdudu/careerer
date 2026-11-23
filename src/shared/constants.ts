/** Zod-free constants shared by main and renderer (keeps zod out of the renderer bundle). */
/** Claude CLI model aliases. */
export const MODELS = ['sonnet', 'opus', 'haiku'] as const
export const DEFAULT_MODEL = 'sonnet'
export const THEMES = ['midnight', 'daylight'] as const
export const STEPS = [
  'Reading the posting',
  'Matching your profile',
  'Applying ATS context',
  'Writing resume and cover letter'
] as const
