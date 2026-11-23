import { describe, expect, it } from 'vitest'
import { contactLine, coverLetterHtml, esc, fontSteps, pdfFileName, resumeHtml } from './template'
import type { ResumeData } from './types'

describe('fontSteps', () => {
  it('steps from 13.2 down to 12', () => {
    expect(fontSteps(13.2, 12)).toEqual([13.2, 12.9, 12.6, 12.3, 12])
  })
})

describe('pdfFileName', () => {
  it('builds Firstname-Lastname names', () => {
    expect(pdfFileName('Deji Ojo', 'resume')).toBe('Deji-Ojo-Resume.pdf')
    expect(pdfFileName('Mary Jane Watson', 'cover-letter')).toBe('Mary-Watson-Cover-Letter.pdf')
    expect(pdfFileName('', 'resume')).toBe('Candidate-Resume.pdf')
  })
})

describe('template', () => {
  const header = { name: 'A <B>', location: 'X', email: 'a@b.co', links: ['[portfolio link]', 'gh.com/a'] }
  const resume: ResumeData = {
    headline: 'Dev',
    summary: 'S & S',
    skills: [{ group: 'G', items: ['a', 'b'] }],
    experience: [{ title: 'T', company: 'C', start: 'Jan 2020', end: 'Present', bullets: ['one', 'two'] }],
    projects: [],
    education: [],
    certifications: []
  }
  it('escapes html and drops placeholder links from the contact line', () => {
    expect(esc('<a>&"')).toBe('&lt;a&gt;&amp;&quot;')
    expect(contactLine(header)).toBe('X · a@b.co · gh.com/a')
    expect(resumeHtml(header, resume)).toContain('A &lt;B&gt;')
  })
  it('renders sections in order with editable bullets', () => {
    const h = resumeHtml(header, resume)
    expect(h.indexOf('Summary')).toBeLessThan(h.indexOf('Skills'))
    expect(h.indexOf('Skills')).toBeLessThan(h.indexOf('Experience'))
    expect(h).toContain('data-edit="resume.experience.0.bullets.1"')
    expect(h).toContain('Jan 2020 – Present')
  })
  it('renders the cover letter', () => {
    const h = coverLetterHtml(header, 'Dev', { greeting: 'Hi', paragraphs: ['p1'], closing: 'Bye', signature: 'Me' }, {
      company: 'Co',
      role: 'Dev',
      dateLabel: 'Jan 1, 2026'
    })
    expect(h).toContain('Re: Dev')
    expect(h).toContain('Hiring Team, Co')
    expect(h).toContain('data-edit="coverLetter.paragraphs.0"')
  })
})
