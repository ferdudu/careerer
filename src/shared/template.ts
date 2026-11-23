/**
 * Resume and cover-letter templates, shared by the PDF exporter (main) and the
 * live preview (renderer, phase 3). Pure string builders: no DOM, no Electron.
 * Values follow docs/design/Resume.dc.html and CoverLetter.dc.html.
 */
import type { CoverLetterData, ParsedProfile, ResumeData, Theme } from './types'

export interface Palette {
  paper: string
  ink: string
  soft: string
  muted: string
  gold: string
  date: string
  rule: string
  hair: string
}

export const PALETTES: Record<Theme, Palette> = {
  midnight: {
    paper: '#0A0E18',
    ink: '#E9E5DB',
    soft: '#F3EEE2',
    muted: '#9AA0B1',
    gold: '#CDAE72',
    date: '#B0A2DA',
    rule: '#242A3A',
    hair: '#6E5D3C'
  },
  daylight: {
    paper: '#FFFFFF',
    ink: '#0F1A33',
    soft: '#0A1430',
    muted: '#4A5470',
    gold: '#8C6A2C',
    date: '#5B4B92',
    rule: '#E2E4EA',
    hair: '#CDAE72'
  }
}

export const RESUME_FONT_MAX = 13.2
export const RESUME_FONT_MIN = 12
export const LETTER_FONT_MAX = 14
export const LETTER_FONT_MIN = 12.5
/** Letter-spacing for headings, role line and Re: line; chosen so PDF text extracts as whole words. */
export const TRACK = '0.08em'
export const PAGE_W = 816
export const PAGE_H = 1056

export interface DocHeader {
  name: string
  location?: string
  email?: string
  phone?: string
  links: string[]
}

export interface DocMeta {
  /** Company the letter is addressed to. */
  company: string
  /** Role shown after "Re:". */
  role: string
  /** Already formatted, e.g. "November 22, 2026". */
  dateLabel: string
}

export function headerFromProfile(p: ParsedProfile): DocHeader {
  return {
    name: p.name,
    location: p.location,
    email: p.contacts.email,
    phone: p.contacts.phone,
    links: p.contacts.links
  }
}

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function contactLine(h: DocHeader): string {
  return [h.location, h.email, h.phone, ...h.links]
    .filter((x): x is string => !!x && !/\[[^\]]*\]/.test(x))
    .join(' · ')
}

/** CSS for both documents. Scope everything under .doc so it can sit inside the app preview. */
export function documentCss(theme: Theme, bodyPx: number, kind: 'resume' | 'letter'): string {
  const c = PALETTES[theme]
  return `
.doc{--paper:${c.paper};--ink:${c.ink};--soft:${c.soft};--muted:${c.muted};--gold:${c.gold};--date:${c.date};--rule:${c.rule};--hair:${c.hair};
  width:${PAGE_W}px;min-height:${PAGE_H}px;box-sizing:border-box;background:var(--paper);color:var(--ink);
  font-family:'Geist',Arial,sans-serif;font-size:${bodyPx}px;display:flex;flex-direction:column;
  -webkit-box-decoration-break:clone;box-decoration-break:clone;
  ${
    kind === 'resume'
      ? 'padding:46px 66px 40px;line-height:1.44;gap:17px;'
      : 'padding:46px 66px 48px;line-height:1.64;gap:32px;'
  }}
.doc *{box-sizing:border-box}
.doc header{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;${kind === 'resume' ? 'padding-bottom:6px;' : ''}}
.doc h1{margin:0;font-family:'Bodoni Moda',Didot,Georgia,serif;font-weight:400;font-size:42px;line-height:1;letter-spacing:.04em;color:var(--ink)}
.doc .band{display:flex;align-items:center;gap:14px;width:100%}
.doc .hair{flex:1;height:1px;background:var(--hair)}
.doc .diamond{width:5px;height:5px;transform:rotate(45deg);background:var(--gold);flex:0 0 auto}
.doc .headline{font-size:12px;font-weight:600;letter-spacing:${TRACK};text-transform:uppercase;color:var(--gold)}
.doc .contact{font-size:12.3px;letter-spacing:.02em;color:var(--muted)}
.doc section{display:flex;flex-direction:column;gap:6px}
.doc section.exp{gap:11px}
.doc .sec-h{display:flex;align-items:center;gap:12px;break-after:avoid}
.doc h2{margin:0;font-size:11.5px;font-weight:600;letter-spacing:${TRACK};text-transform:uppercase;color:var(--gold)}
.doc .sec-h .line{flex:1;height:1px;background:var(--rule)}
.doc p{margin:0}
.doc .entry{display:flex;flex-direction:column;gap:3px;break-inside:avoid}
.doc .row{display:flex;justify-content:space-between;gap:16px;align-items:baseline}
.doc .ttl{font-family:'Bodoni Moda',Georgia,serif;font-size:15px;font-weight:500}
.doc .at{color:var(--muted)}
.doc .dates{flex:0 0 auto;font-size:12px;letter-spacing:.06em;color:var(--date)}
.doc ul{margin:0;padding-left:16px;display:flex;flex-direction:column;gap:2px}
.doc .skills{display:flex;flex-direction:column;gap:2px}
.doc .skills b{font-weight:500;color:var(--soft)}
.doc .re{display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px;align-items:flex-end;padding-bottom:14px;border-bottom:1px solid var(--rule)}
.doc .re-l{display:flex;flex-direction:column;gap:2px}
.doc .re-k{font-size:11.5px;font-weight:600;letter-spacing:${TRACK};text-transform:uppercase;color:var(--gold)}
.doc .re-d{font-size:12px;letter-spacing:.06em;color:var(--date)}
.doc .body{display:flex;flex-direction:column;gap:16px}
.doc .sign{display:flex;flex-direction:column;gap:6px;padding-top:10px}
.doc .sig{font-family:'Bodoni Moda',Didot,Georgia,serif;font-size:24px;letter-spacing:.03em;color:var(--soft)}
`
}

function headerHtml(h: DocHeader, headline: string): string {
  return `<header>
<h1>${esc(h.name)}</h1>
<div class="band"><span class="hair" aria-hidden="true"></span><span class="diamond" aria-hidden="true"></span><span class="headline">${esc(headline)}</span><span class="diamond" aria-hidden="true"></span><span class="hair" aria-hidden="true"></span></div>
<div class="contact">${esc(contactLine(h))}</div>
</header>`
}

function secHead(title: string): string {
  return `<div class="sec-h"><h2>${esc(title)}</h2><span class="line" aria-hidden="true"></span></div>`
}

function dateRange(start: string, end: string): string {
  return start && end ? `${start} – ${end}` : start || end
}

/** Inner markup of the resume page (without the css). Each editable text carries data-edit. */
export function resumeHtml(header: DocHeader, r: ResumeData): string {
  const parts: string[] = [headerHtml(header, r.headline)]

  if (r.summary.trim()) {
    parts.push(`<section>${secHead('Summary')}<p data-edit="resume.summary">${esc(r.summary)}</p></section>`)
  }
  if (r.skills.length) {
    const rows = r.skills
      .map((s) => `<div><b>${esc(s.group)}:</b> ${esc(s.items.join(', '))}</div>`)
      .join('')
    parts.push(`<section>${secHead('Skills')}<div class="skills">${rows}</div></section>`)
  }
  if (r.experience.length) {
    const entries = r.experience
      .map((e, i) => {
        const where = [e.company, e.location].filter(Boolean).join(', ')
        const lis = e.bullets
          .map((b, j) => `<li data-edit="resume.experience.${i}.bullets.${j}">${esc(b)}</li>`)
          .join('')
        return `<div class="entry"><div class="row"><div><span class="ttl">${esc(e.title)}</span> <span class="at">— ${esc(where)}</span></div><div class="dates">${esc(dateRange(e.start, e.end))}</div></div><ul>${lis}</ul></div>`
      })
      .join('')
    parts.push(`<section class="exp">${secHead('Experience')}${entries}</section>`)
  }
  if (r.projects.length) {
    const items = r.projects
      .map((p) => {
        const meta = [p.tech, p.link].filter(Boolean).join(' · ')
        return `<div class="entry"><div><span class="ttl">${esc(p.name)}</span>${meta ? ` <span class="at">— ${esc(meta)}</span>` : ''} ${esc(p.description)}</div></div>`
      })
      .join('')
    parts.push(`<section>${secHead('Projects')}${items}</section>`)
  }
  if (r.education.length) {
    const items = r.education
      .map((e) => {
        const where = [e.school, e.location].filter(Boolean).join(', ')
        return `<div class="entry"><div class="row"><div><span class="ttl">${esc(e.credential)}</span> <span class="at">— ${esc(where)}</span></div><div class="dates">${esc(e.year)}</div></div></div>`
      })
      .join('')
    parts.push(`<section>${secHead('Education')}${items}</section>`)
  }
  if (r.certifications.length) {
    parts.push(`<section>${secHead('Certifications')}<div>${esc(r.certifications.join(', '))}</div></section>`)
  }
  return parts.join('\n')
}

export function coverLetterHtml(header: DocHeader, headline: string, c: CoverLetterData, meta: DocMeta): string {
  const paras = c.paragraphs.map((p, i) => `<p data-edit="coverLetter.paragraphs.${i}">${esc(p)}</p>`).join('')
  return `${headerHtml(header, headline)}
<div class="re"><div class="re-l"><div class="re-k">Re: ${esc(meta.role)}</div><div class="at">Hiring Team, ${esc(meta.company)}</div></div><div class="re-d">${esc(meta.dateLabel)}</div></div>
<div class="body"><p>${esc(c.greeting)}</p>${paras}<div class="sign"><div>${esc(c.closing)}</div><div class="sig">${esc(c.signature)}</div></div></div>`
}

/** Complete page used by the exporter. `fontFaceCss` is supplied by main (local, base64). */
export function wrapDocument(inner: string, css: string, fontFaceCss: string, theme: Theme): string {
  const paper = PALETTES[theme].paper
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Careerer document</title>
<style>${fontFaceCss}
@page{size:8.5in 11in;margin:0}
html,body{margin:0;padding:0;background:${paper};-webkit-print-color-adjust:exact;print-color-adjust:exact}
${css}</style></head><body><div class="doc" id="doc">${inner}</div></body></html>`
}

export function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** Body font sizes to try, largest first (spec: 13.2px stepping down to 12px). */
export function fontSteps(max: number, min: number, step = 0.3): number[] {
  const out: number[] = []
  for (let v = max; v >= min - 1e-6; v -= step) out.push(Math.round(v * 100) / 100)
  return out
}

/** "Firstname-Lastname-Resume.pdf" */
export function pdfFileName(fullName: string, kind: 'resume' | 'cover-letter'): string {
  const parts = fullName
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
  const base = parts.length ? parts.join('-') : 'Candidate'
  const first = parts[0] ?? 'Candidate'
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  const nm = last ? `${first}-${last}` : base
  return `${nm}-${kind === 'resume' ? 'Resume' : 'Cover-Letter'}.pdf`
}
