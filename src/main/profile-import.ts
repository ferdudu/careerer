import { promises as fs } from 'node:fs'
import { extname } from 'node:path'
import { extractPdfText } from './export/pdfcheck'

/** Plain text from a .pdf (pdfjs-dist) or .docx (mammoth). */
export async function extractDocumentText(path: string): Promise<string> {
  const ext = extname(path).toLowerCase()
  if (ext === '.pdf') {
    const { text } = await extractPdfText(path)
    return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  }
  if (ext === '.docx') {
    const mammoth = await import('mammoth')
    const buffer = await fs.readFile(path)
    const res = await mammoth.extractRawText({ buffer })
    return res.value.trim()
  }
  throw new Error('Choose a PDF or DOCX file.')
}
