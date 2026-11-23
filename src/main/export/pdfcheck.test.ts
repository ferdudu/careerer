import { describe, expect, it } from 'vitest'
import { evaluateExtractedText } from './pdfcheck'

describe('evaluateExtractedText', () => {
  const ok = 'DEJI OJO\nBurnaby, BC · deji2109@gmail.com\nSUMMARY\nText\nSKILLS\nEXPERIENCE\nEDUCATION'
  it('passes when email is intact and headings are in order', () => {
    expect(evaluateExtractedText(ok, { email: 'deji2109@gmail.com', headings: ['Summary', 'Skills', 'Experience', 'Education'], label: 'R' })).toEqual([])
  })
  it('warns when headings are out of order', () => {
    const w = evaluateExtractedText(ok, { headings: ['Experience', 'Skills'], label: 'R' })
    expect(w).toHaveLength(1)
    expect(w[0]).toMatch(/Skills/)
  })
  it('does not forgive letter-spaced headings', () => {
    const w = evaluateExtractedText('S U M M A R Y\nSKILLS', { headings: ['Summary', 'Skills'], label: 'R' })
    expect(w).toHaveLength(1)
  })
  it('warns when the email is split or missing', () => {
    expect(evaluateExtractedText('deji2109@ gmail.com', { email: 'deji2109@gmail.com', headings: [], label: 'R' })[0]).toMatch(/split/)
    expect(evaluateExtractedText('nothing', { email: 'deji2109@gmail.com', headings: [], label: 'R' })[0]).toMatch(/not found/)
  })
})
