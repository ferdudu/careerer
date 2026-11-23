import { describe, expect, it } from 'vitest'
import {
  computeCoverage,
  countTerm,
  evidenceVerified,
  findInventions,
  findPlaceholders,
  findPlaceholdersInDoc,
  findUnknownEntities,
  recountTerms,
  requirementCoveredLocally,
  runChecks
} from './checks'
import type { StoredResult } from './types'

describe('findPlaceholders', () => {
  it('finds unique bracket placeholders', () => {
    expect(findPlaceholders('cut from [X sec] to [Y sec], again [X sec]')).toEqual(['[X sec]', '[Y sec]'])
  })
  it('finds long brackets, mustache, angle, XX, TBD and blanks', () => {
    const long = '[' + 'describe '.repeat(20) + ']'
    expect(findPlaceholders(long)).toHaveLength(1)
    expect(findPlaceholders('{{name}} <COMPANY> grew XX% TBD ____')).toEqual(['{{name}}', '<COMPANY>', 'XX', 'TBD', '____'])
  })
  it('returns empty for clean text', () => {
    expect(findPlaceholders('Built things. No brackets. 50% faster.')).toEqual([])
  })
})

describe('countTerm', () => {
  it('is case-insensitive with word boundaries', () => {
    expect(countTerm('React, react and Reactive', 'React')).toBe(2)
  })
  it('handles C# without matching C', () => {
    expect(countTerm('I know C# and C++ and C.', 'C#')).toBe(1)
    expect(countTerm('I know C# and C++ and C.', 'C')).toBe(1)
  })
  it('handles Node.js', () => {
    expect(countTerm('Node.js services; node.js again; Node alone', 'Node.js')).toBe(2)
    expect(countTerm('Node.js services', 'Node')).toBe(0)
  })
  it('handles CI/CD', () => {
    expect(countTerm('Owned CI/CD pipelines, ci/cd checks.', 'CI/CD')).toBe(2)
  })
  it('handles terms with parentheses and spaces', () => {
    expect(countTerm('Lightning Web Components (LWC) and LWC', 'Lightning Web Components (LWC)')).toBe(1)
    expect(countTerm('Lightning Web Components (LWC) and LWC', 'LWC')).toBe(2)
  })
  it('does not match inside words and ignores empty terms', () => {
    expect(countTerm('JavaScript', 'Java')).toBe(0)
    expect(countTerm('abc', '  ')).toBe(0)
  })
  it('recounts a list', () => {
    expect(recountTerms(['SOQL', 'Apex'], 'Apex and SOQL and soql')).toEqual([
      { term: 'SOQL', count: 2 },
      { term: 'Apex', count: 1 }
    ])
  })
})

const emptyReport = { matched: [], missingInfo: [], knockoutFlags: [], changes: [], bridges: [], stretch: [] }
const resume = (company: string, title: string, start = 'Jan 2022', end = 'Dec 2023'): StoredResult['resume'] => ({
  headline: 'h',
  summary: 's',
  skills: [],
  experience: [{ title, company, start, end, bullets: [] }],
  projects: [],
  education: [],
  certifications: []
})
const letter = { greeting: 'Hi', paragraphs: ['one two three'], closing: 'Bye', signature: 'Me' }

describe('findUnknownEntities', () => {
  const profile = 'Product Developer — Traction Complete, Vancouver, BC (Remote) Jan 2022 – Dec 2023\n- did things'
  it('accepts known employers, titles and dates', () => {
    expect(findUnknownEntities(resume('Traction Complete', 'Product Developer'), profile)).toEqual([])
    expect(findUnknownEntities(resume('Traction Complete', 'Product Developer', 'Jan 2022', 'Present'), profile)).toEqual([])
  })
  it('flags invented employers and titles', () => {
    expect(findUnknownEntities(resume('Globex', 'Senior Architect'), profile)).toEqual(['Employer not in profile: Globex'])
    expect(findUnknownEntities(resume('Traction Complete', 'Senior Architect'), profile)[0]).toMatch(/title not listed/)
  })
  it('flags wrong dates for the employer', () => {
    expect(findUnknownEntities(resume('Traction Complete', 'Product Developer', 'Jan 2019', 'Dec 2023'), profile)).toEqual([
      'Date not in profile for Traction Complete: Jan 2019'
    ])
  })
  it('does not accept a partial title found elsewhere (N9)', () => {
    const p = 'Web Developer — Summit Tools Jan 2021 – Dec 2021\nProduct Developer — Traction Complete Jan 2022 – Dec 2023'
    expect(findUnknownEntities(resume('Traction Complete', 'Web Developer'), p)[0]).toMatch(/title not listed/)
  })
  it('flags unknown certifications, schools and projects', () => {
    const r = {
      ...resume('Traction Complete', 'Product Developer'),
      certifications: ['Platform Developer I'],
      education: [{ credential: 'MBA', school: 'Nowhere U', year: '2020' }],
      projects: [{ name: 'Rocket', description: 'x' }]
    }
    expect(findUnknownEntities(r, profile)).toEqual([
      'School not in profile: Nowhere U',
      'Credential not in profile: MBA',
      'Project not in profile: Rocket',
      'Certification not in profile: Platform Developer I'
    ])
  })
})

describe('findInventions', () => {
  const profile = 'Skills: Apex, SOQL, Lightning Web Components (LWC)\ncut double-booked items by 50% over 8 storefronts'
  const doc = (skills: string[], summary: string) => ({
    resume: { ...resume('A', 'B'), summary, skills: [{ group: 'g', items: skills }] },
    coverLetter: letter
  })
  it('accepts supported skills, acronym forms and numbers', () => {
    expect(findInventions(doc(['Apex', 'Lightning Web Components (LWC)', 'LWC'], 'cut by 50% across 8 storefronts'), profile)).toEqual([])
  })
  it('flags invented skills', () => {
    expect(findInventions(doc(['Kubernetes'], ''), profile)).toEqual(['Skill not in profile: Kubernetes'])
  })
  it('flags invented metrics but allows numbers from the posting', () => {
    expect(findInventions(doc([], 'cut costs by 60%'), profile)).toEqual(['Number not in profile or posting: 60%'])
    expect(findInventions(doc([], 'cut costs by 60%'), profile, 'we want 60% improvements')).toEqual([])
  })
})

describe('runChecks', () => {
  it('reports placeholders anywhere, even in non-text fields, plus word counts', () => {
    const r = { ...resume('Traction Complete', 'Product Developer'), summary: 'from [X sec]' }
    r.projects = [{ name: 'p', link: '[link]', description: 'd' }]
    const c = runChecks({ resume: r, coverLetter: letter }, 'Product Developer Traction Complete Jan 2022 Dec 2023 p')
    expect(c.placeholders).toEqual(['[X sec]', '[link]'])
    expect(c.coverLetterWords).toBe(3)
    expect(findPlaceholdersInDoc({ resume: r, coverLetter: letter })).toHaveLength(2)
  })
})

describe('coverage', () => {
  const res = (summary: string) => ({
    resume: { ...resume('A', 'B'), summary },
    coverLetter: letter,
    report: { ...emptyReport }
  })
  it('covers "4+ years Salesforce" only when Salesforce and a years figure are present', () => {
    expect(requirementCoveredLocally('4+ years Salesforce', 'Salesforce developer with 4+ years of work')).toBe(true)
    expect(requirementCoveredLocally('4+ years Salesforce', 'Salesforce developer')).toBe(false)
  })
  it('covers "Experience with Apex and SOQL" without verbatim text', () => {
    expect(requirementCoveredLocally('Experience with Apex and SOQL', 'Wrote Apex and refactored SOQL queries')).toBe(true)
    expect(requirementCoveredLocally('Experience with Apex and SOQL', 'Wrote Python')).toBe(false)
  })
  it('treats a certification phrase as uncovered unless the words are present', () => {
    expect(requirementCoveredLocally('Salesforce Platform Developer I certification', 'Salesforce developer')).toBe(false)
  })
  it('verifies evidence as a substring or by token overlap', () => {
    expect(evidenceVerified('refactored SOQL queries', 'We refactored SOQL queries for speed')).toBe(true)
    expect(evidenceVerified('refactored SOQL query lazy', 'We refactored SOQL queries lazy')).toBe(true)
    expect(evidenceVerified('led a team of ten', 'We refactored SOQL queries')).toBe(false)
  })
  it('counts direct and transferable bridges with evidence from the profile, not trajectory or stretch', () => {
    const profile = 'Wrote Apex and SOQL daily. Deployed hotfixes to production orgs. Shipped features for an AppExchange product.'
    const bridges = [
      { requirement: 'Apex', approach: 'direct' as const, evidence: 'Wrote Apex and SOQL daily', whereUsed: ['summary'] },
      { requirement: 'CI/CD', approach: 'transferable' as const, evidence: 'Deployed hotfixes to production orgs', whereUsed: ['experience'] },
      { requirement: 'Health Cloud', approach: 'trajectory' as const, evidence: 'Shipped features for an AppExchange product', whereUsed: ['cover letter'] },
      { requirement: 'Kubernetes', approach: 'direct' as const, evidence: 'ran Kubernetes clusters at scale', whereUsed: [] }
    ]
    const r = { ...res('Wrote Apex and SOQL daily'), report: { ...emptyReport, bridges, stretch: ['Platform Developer I'] } }
    const req = { required: ['Apex', 'Kubernetes'], preferred: ['CI/CD', 'Health Cloud', 'Platform Developer I'] }
    const c = computeCoverage(req, r, profile)
    expect(c.items.map((i) => [i.requirement, i.approach, i.credit])).toEqual([
      ['Apex', 'direct', 1],
      ['Kubernetes', 'none', 0], // fabricated evidence is not in the profile, so the claim is rejected
      ['CI/CD', 'transferable', 1],
      ['Health Cloud', 'trajectory', 0],
      ['Platform Developer I', 'stretch', 0]
    ])
    expect(c.covered).toBe(2)
    expect(c.missing).toEqual(['Kubernetes', 'Health Cloud', 'Platform Developer I'])
    expect(computeCoverage(undefined, r).total).toBe(0)
  })
  it('flags bridge evidence that is not in the profile as an invention', () => {
    const doc = {
      resume: resume('A', 'B'),
      coverLetter: letter,
      report: { ...emptyReport, bridges: [{ requirement: 'X', approach: 'direct' as const, evidence: 'led a team of twelve', whereUsed: [] }] }
    }
    expect(findInventions(doc, 'Wrote Apex')[0]).toMatch(/Bridge evidence not found/)
  })
})
