import { promises as fs } from 'node:fs'

/** Extracts text from a PDF in reading order (pdfjs-dist, legacy build for Node). */
export async function extractPdfText(path: string): Promise<{ text: string; pages: number }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(await fs.readFile(path))
  const doc = await pdfjs.getDocument({ data }).promise
  let text = ''
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    for (const item of content.items) {
      if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ')
    }
    text += '\n'
  }
  const pages = doc.numPages
  return { text, pages }
}

/** Pure: given extracted text, returns warnings about email integrity and heading order. */
export function evaluateExtractedText(
  text: string,
  opts: { email?: string; headings: string[]; label: string }
): string[] {
  const warnings: string[] = []
  const squashed = text.replace(/\s+/g, '')
  if (opts.email) {
    if (!text.includes(opts.email)) {
      warnings.push(
        squashed.includes(opts.email)
          ? `${opts.label}: the email address is split by spaces in the extracted text; some ATS may misread it.`
          : `${opts.label}: the email address was not found in the extracted text.`
      )
    }
  }
  // Headings are rendered uppercase. Search the real extracted text, in order, with no whitespace stripping.
  let from = 0
  for (const h of opts.headings) {
    const needle = h.toUpperCase()
    const at = text.indexOf(needle, from)
    if (at < 0) {
      warnings.push(
        `${opts.label}: section heading "${h}" was not found as whole text in order (letter-spacing may be splitting it).`
      )
    } else {
      from = at + needle.length
    }
  }
  return warnings
}

export async function checkPdfText(
  path: string,
  opts: { email?: string; headings: string[]; label: string }
): Promise<string[]> {
  try {
    const { text } = await extractPdfText(path)
    return evaluateExtractedText(text, opts)
  } catch (err) {
    return [`${opts.label}: could not read the PDF text back to verify it (${err instanceof Error ? err.message : 'unknown error'}).`]
  }
}
