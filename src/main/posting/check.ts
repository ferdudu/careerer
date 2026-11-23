/** Pure checks on fetched posting text. */
export const MIN_POSTING_CHARS = 600

const WALL_PATTERNS: RegExp[] = [
  /\bsign in to (continue|view|see)\b/i,
  /\blog ?in to (continue|view|see)\b/i,
  /\b(verify|confirm) (that )?you are (a )?human\b/i,
  /\bare you a robot\b/i,
  /\bcaptcha\b/i,
  /\bjust a moment\.\.\./i,
  /\bchecking your browser\b/i,
  /\baccess denied\b/i,
  /\benable javascript\b/i,
  /\bjoin now to see\b/i
]

export const PASTE_HINT = 'Use "Paste the posting text instead" and paste the job description.'

export function assessPosting(text: string): { ok: true } | { ok: false; message: string } {
  const t = text.trim()
  if (t.length < MIN_POSTING_CHARS) {
    return {
      ok: false,
      message: `That page returned very little text (${t.length} characters). Many job boards block automatic reading. ${PASTE_HINT}`
    }
  }
  // Only treat wall phrases as decisive on shortish pages; real postings can mention "sign in".
  if (t.length < 3000 && WALL_PATTERNS.some((re) => re.test(t))) {
    return {
      ok: false,
      message: `That page looks like a login or bot-check wall. ${PASTE_HINT}`
    }
  }
  return { ok: true }
}

export function normalizeUrl(input: string): string {
  let u = input.trim()
  if (/^(javascript|data|file|blob|about|chrome|ftp):/i.test(u) || (/^[a-z][a-z0-9+.-]*:\/\//i.test(u) && !/^https?:\/\//i.test(u))) {
    throw new Error('Only http and https links are supported.')
  }
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`
  const parsed = new URL(u) // throws on invalid
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Only http and https links are supported.')
  return parsed.toString()
}
