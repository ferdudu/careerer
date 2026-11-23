/** Pure post-checks on generated output. No Electron, no I/O. */
import type { StoredResult } from './types'

type Doc = Pick<StoredResult, 'resume' | 'coverLetter'> & { report?: StoredResult['report'] }

// Square brackets, {{x}}, <X>, XX / XXX, TBD, TODO and ___ blanks.
const PLACEHOLDER_RE = /\[[^\]]{1,300}\]|\{\{[^}]*\}\}|<[A-Z ]{2,}>|\b(?:X{2,}|TBD|TODO)\b|_{3,}/g

export function findPlaceholders(text: string): string[] {
  return Array.from(new Set(text.match(PLACEHOLDER_RE) ?? []))
}

function collectStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collectStrings(x, out))
  return out
}

/** Scans every string field of the documents (JSON form), so no field is skipped. */
export function findPlaceholdersInDoc(doc: Doc): string[] {
  return findPlaceholders(collectStrings(doc).join('\n'))
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}

/**
 * Case-insensitive, word-boundary count of an exact term.
 * Handles terms that end in symbols (C#, C++) and dotted names (Node.js, CI/CD):
 * "C" does not match inside "C#", "Node" does not match inside "Node.js".
 */
export function countTerm(text: string, term: string): number {
  const t = term.trim()
  if (!t) return 0
  const endsAlnum = /[\p{L}\p{N}]$/u.test(t)
  const before = '(?<![\\p{L}\\p{N}])'
  const after = endsAlnum ? '(?![\\p{L}\\p{N}])(?![#+])(?!\\.[\\p{L}\\p{N}])' : '(?![\\p{L}\\p{N}])'
  const re = new RegExp(`${before}${escapeRe(t)}${after}`, 'giu')
  return (text.match(re) ?? []).length
}

export function recountTerms(terms: string[], text: string): { term: string; count: number }[] {
  return terms.map((term) => ({ term, count: countTerm(text, term) }))
}

export function resumeText(r: StoredResult['resume']): string {
  return [
    r.headline,
    r.summary,
    ...r.skills.flatMap((s) => [s.group, ...s.items]),
    ...r.experience.flatMap((e) => [e.title, e.company, ...e.bullets]),
    ...r.projects.flatMap((p) => [p.name, p.tech ?? '', p.description]),
    ...r.education.flatMap((e) => [e.credential, e.school]),
    ...r.certifications
  ].join('\n')
}

export function coverLetterText(c: StoredResult['coverLetter']): string {
  return [c.greeting, ...c.paragraphs, c.closing, c.signature].join('\n')
}

export function wordCount(text: string): number {
  return (text.match(/\S+/g) ?? []).length
}

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim()
const wrapped = (s: string): string => ' ' + norm(s) + ' '

/** Employers, titles, dates, schools, credentials, projects and certifications must come from the raw profile. */
export function findUnknownEntities(resume: StoredResult['resume'], profileRaw: string): string[] {
  const lines = profileRaw.split(/\r?\n/).map(wrapped)
  const all = wrapped(profileRaw)
  const has = (v: string): boolean => {
    const n = norm(v)
    return n.length === 0 || all.includes(' ' + n + ' ')
  }
  const out: string[] = []
  for (const e of resume.experience) {
    const cn = ' ' + norm(e.company) + ' '
    const at = lines.map((l, i) => (l.includes(cn) ? i : -1)).filter((i) => i >= 0)
    if (!at.length) {
      out.push(`Employer not in profile: ${e.company}`)
      continue
    }
    // Title and dates must sit on or next to a line that names the employer.
    // Same line as the employer; the adjacent lines count only when the employer line starts with the
    // employer name (title written on its own line above or below).
    const near = at
      .flatMap((i) => (lines[i].startsWith(cn) ? [lines[i - 1] ?? '', lines[i], lines[i + 1] ?? ''] : [lines[i]]))
      .join(' ')
    if (!near.includes(' ' + norm(e.title) + ' ')) out.push(`Job title not listed for ${e.company}: ${e.title}`)
    for (const d of [e.start, e.end]) {
      if (/^present$/i.test(d.trim()) || !d.trim()) continue
      if (!near.includes(' ' + norm(d) + ' ')) out.push(`Date not in profile for ${e.company}: ${d}`)
    }
  }
  for (const e of resume.education) {
    if (!has(e.school)) out.push(`School not in profile: ${e.school}`)
    if (!has(e.credential)) out.push(`Credential not in profile: ${e.credential}`)
  }
  for (const p of resume.projects) if (!has(p.name)) out.push(`Project not in profile: ${p.name}`)
  for (const c of resume.certifications) if (!has(c)) out.push(`Certification not in profile: ${c}`)
  return out
}

function skillVariants(item: string): string[] {
  const out = [item]
  const m = item.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (m) out.push(m[1], m[2])
  return out.filter((v) => norm(v).length > 0)
}

const NUMBER_RE = /\d[\d,.]*%?/g
const numbersOf = (s: string): Set<string> =>
  new Set((s.match(NUMBER_RE) ?? []).map((n) => n.replace(/[.,]+$/, '')))

/** Skills and numbers in the output that the profile (or, for numbers, the posting) does not support. */
export function findInventions(doc: Doc, profileRaw: string, postingText = ''): string[] {
  const out: string[] = []
  const all = wrapped(profileRaw)
  for (const g of doc.resume.skills) {
    for (const item of g.items) {
      if (!skillVariants(item).some((v) => all.includes(' ' + norm(v) + ' '))) {
        out.push(`Skill not in profile: ${item}`)
      }
    }
  }
  for (const b of doc.report?.bridges ?? []) {
    if (!evidenceVerified(b.evidence, profileRaw)) out.push(`Bridge evidence not found in profile: "${b.evidence.slice(0, 80)}"`)
  }
  const known = new Set([...numbersOf(profileRaw), ...numbersOf(postingText)])
  const used = numbersOf(resumeText(doc.resume) + '\n' + coverLetterText(doc.coverLetter))
  for (const n of used) if (!known.has(n)) out.push(`Number not in profile or posting: ${n}`)
  return out
}

export function runChecks(doc: Doc, profileRaw: string, postingText = ''): NonNullable<StoredResult['checks']> {
  return {
    placeholders: findPlaceholdersInDoc(doc),
    unknownEntities: findUnknownEntities(doc.resume, profileRaw),
    inventions: findInventions(doc, profileRaw, postingText),
    coverLetterWords: wordCount(doc.coverLetter.paragraphs.join(' '))
  }
}

// ---------------- coverage ----------------

const STOP = new Set(
  'a an and or the of to in on for with by at as is are be can able ability strong good excellent solid proven experience experienced knowledge understanding working work skills skill familiarity proficiency proficient plus preferred required years year using use building build developing development including similar related relevant demonstrated hands'.split(
    ' '
  )
)

function significantTokens(req: string): string[] {
  const cleaned = req.replace(/\d+\+?\s*years?/gi, ' ')
  return Array.from(
    new Set(
      (cleaned.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}.#+/-]*/gu) ?? [])
        .map((t) => t.replace(/[.\-/]+$/, ''))
        .filter((t) => t.length > 1 && !STOP.has(t))
    )
  )
}

/** Local fallback: at least 60% of the requirement's significant tokens appear in the output. */
export function requirementCoveredLocally(req: string, outputText: string): boolean {
  const tokens = significantTokens(req)
  if (tokens.length === 0) return false
  const hit = tokens.filter((t) => countTerm(outputText, t) > 0).length
  if (hit / tokens.length < 0.6) return false
  if (/\d+\+?\s*years?/i.test(req) && !/\d+\+?\s*years?|\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+years?/i.test(outputText)) {
    return false
  }
  return true
}

/** Evidence must be a substring of the output, or share at least 70% of its tokens with it. */
export function evidenceVerified(evidence: string, outputText: string): boolean {
  const e = norm(evidence)
  if (e.length < 3) return false
  if (wrapped(outputText).includes(' ' + e + ' ')) return true
  const toks = e.split(' ').filter((t) => t.length > 2)
  if (toks.length < 2) return false
  const have = new Set(norm(outputText).split(' '))
  return toks.filter((t) => have.has(t)).length / toks.length >= 0.7
}

export interface CoverageItem {
  requirement: string
  approach: 'direct' | 'transferable' | 'trajectory' | 'stretch' | 'none'
  credit: number
  via: 'bridge' | 'local'
}

/**
 * A requirement is covered when the model reports a direct or transferable bridge whose evidence is
 * verified in the profile text. Trajectory bridges and stretch items do not count. When the model is
 * silent about a requirement, a local token check against the output decides.
 */
export function computeCoverage(
  req: { required: string[]; preferred: string[] } | undefined,
  result: Pick<StoredResult, 'resume' | 'coverLetter' | 'report'>,
  profileRaw?: string
): { covered: number; total: number; missing: string[]; items: CoverageItem[] } {
  if (!req) return { covered: 0, total: 0, missing: [], items: [] }
  const text = resumeText(result.resume) + '\n' + coverLetterText(result.coverLetter)
  const bridges = new Map((result.report.bridges ?? []).map((b) => [norm(b.requirement), b]))
  const stretch = new Set((result.report.stretch ?? []).map(norm))
  const items: CoverageItem[] = []
  for (const r of [...req.required, ...req.preferred]) {
    const b = bridges.get(norm(r))
    const verified = b ? profileRaw === undefined || evidenceVerified(b.evidence, profileRaw) : false
    if (b && verified && b.approach !== 'trajectory') {
      items.push({ requirement: r, approach: b.approach, credit: 1, via: 'bridge' })
    } else if (b && verified) {
      items.push({ requirement: r, approach: 'trajectory', credit: 0, via: 'bridge' })
    } else if (stretch.has(norm(r))) {
      items.push({ requirement: r, approach: 'stretch', credit: 0, via: 'bridge' })
    } else {
      const ok = requirementCoveredLocally(r, text)
      items.push({ requirement: r, approach: ok ? 'direct' : 'none', credit: ok ? 1 : 0, via: 'local' })
    }
  }
  const covered = items.reduce((n, i) => n + i.credit, 0)
  return { covered, total: items.length, missing: items.filter((i) => i.credit === 0).map((i) => i.requirement), items }
}

/** Removes placeholders (and the space before them) from text. Used by the mock repair fixture. */
export function removePlaceholders(text: string): string {
  return text
    .replace(PLACEHOLDER_RE, '')
    .replace(/[ \t]+([,.;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** Issues shown in the Repair panel, from the current documents. */
export function listIssues(doc: Doc, profileRaw: string, postingText = ''): string[] {
  const c = runChecks(doc, profileRaw, postingText)
  const out = [...c.placeholders.map((p) => `Leftover placeholder: ${p}`), ...c.unknownEntities, ...c.inventions]
  if (c.coverLetterWords < 250 || c.coverLetterWords > 400) {
    out.push(`Cover letter has ${c.coverLetterWords} words (target 250 to 400)`)
  }
  return out
}
