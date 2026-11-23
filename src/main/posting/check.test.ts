import { describe, expect, it } from 'vitest'
import { assessPosting, normalizeUrl } from './check'

describe('assessPosting', () => {
  it('rejects short text with a paste hint', () => {
    const r = assessPosting('too short')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/Paste the posting text/)
  })
  it('rejects login walls', () => {
    const r = assessPosting('Please sign in to continue. '.padEnd(700, 'x '))
    expect(r.ok).toBe(false)
  })
  it('accepts a long posting, even one mentioning sign in', () => {
    expect(assessPosting('Responsibilities and skills. '.repeat(120) + ' sign in to continue').ok).toBe(true)
  })
})

describe('normalizeUrl', () => {
  it('adds https and rejects other schemes', () => {
    expect(normalizeUrl('example.com/jobs/1')).toBe('https://example.com/jobs/1')
    expect(() => normalizeUrl('file:///etc/passwd')).toThrow()
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow()
  })
})
