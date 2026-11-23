import type { ParsedProfile } from '@shared/types'
import type { LlmProvider } from './llm/provider'

/**
 * Turns raw profile text into a ParsedProfile (Claude CLI, or fixtures in mock mode).
 * Failure never blocks saving: the caller stores the raw text and shows `error` to the user.
 */
export async function parseProfileHook(
  provider: LlmProvider,
  rawText: string
): Promise<{ parsed?: ParsedProfile; error?: string }> {
  if (!rawText.trim()) return {}
  try {
    return { parsed: await provider.parseProfile(rawText) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Reading the profile failed.' }
  }
}
