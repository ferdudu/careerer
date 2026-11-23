import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ParsedProfile, StoredResult, Theme } from '@shared/types'
import {
  coverLetterHtml,
  documentCss,
  fontSteps,
  formatDateLabel,
  headerFromProfile,
  LETTER_FONT_MAX,
  LETTER_FONT_MIN,
  PAGE_H,
  PAGE_W,
  resumeHtml,
  RESUME_FONT_MAX,
  RESUME_FONT_MIN
} from '@shared/template'

interface Props {
  kind: 'resume' | 'letter'
  theme: Theme
  profile: ParsedProfile
  result: StoredResult
  company: string
  role: string
  /** Bumped when content changes from outside (regenerate); typing does not re-render the HTML. */
  version: number
  onEdit: (path: string, value: string) => void
}

/**
 * Scaled live preview using the same template as the PDF. The HTML is injected once per
 * (kind, theme, version); edits happen in place in the DOM and are reported through onEdit.
 */
function DocPreviewInner({ kind, theme, profile, result, company, role, version, onEdit }: Props): JSX.Element {
  const wrap = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.6)
  const [height, setHeight] = useState(PAGE_H)
  const latest = useRef(result)
  latest.current = result

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / PAGE_W)))
    ro.observe(el)
    setScale(Math.min(1, el.clientWidth / PAGE_W))
    return () => ro.disconnect()
  }, [])

  const steps = useMemo(
    () => (kind === 'resume' ? fontSteps(RESUME_FONT_MAX, RESUME_FONT_MIN) : fontSteps(LETTER_FONT_MAX, LETTER_FONT_MIN, 0.25)),
    [kind]
  )
  const css = useMemo(() => documentCss(theme, steps[0], kind), [theme, steps, kind])
  const html = useMemo(() => {
    const header = headerFromProfile(profile)
    const r = latest.current
    return kind === 'resume'
      ? resumeHtml(header, r.resume)
      : coverLetterHtml(header, r.resume.headline, r.coverLetter, {
          company,
          role,
          dateLabel: formatDateLabel(new Date())
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, theme, version, profile, company, role])

  // Make editable regions real text boxes and fit the page like the PDF export does.
  useLayoutEffect(() => {
    const d = docRef.current
    if (!d) return
    d.querySelectorAll<HTMLElement>('[data-edit]').forEach((el) => {
      el.setAttribute('contenteditable', 'plaintext-only')
      el.setAttribute('tabindex', '0')
      el.setAttribute('role', 'textbox')
      el.setAttribute('aria-multiline', 'true')
      el.setAttribute('aria-label', 'Edit text')
      el.spellcheck = true
    })
    const fit = (): void => {
      let h = PAGE_H
      for (const px of steps) {
        d.style.fontSize = `${px}px`
        h = d.scrollHeight
        if (h <= PAGE_H + 1) break
      }
      setHeight(Math.max(PAGE_H, h))
    }
    fit()
    void document.fonts?.ready.then(fit)
  }, [html, steps])

  return (
    <div className="preview-wrap" ref={wrap}>
      <div className="preview-clip" style={{ height: height * scale }}>
        <div
          className="preview-fade"
          key={`${kind}-${theme}-${version}`}
          style={{ width: PAGE_W, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <style>{css}</style>
          <div
            className="doc"
            ref={docRef}
            onInput={(e) => {
              const t = (e.target as HTMLElement).closest<HTMLElement>('[data-edit]')
              if (t?.dataset.edit) onEdit(t.dataset.edit, t.innerText.replace(/\n+/g, ' ').trim())
              const d = docRef.current
              if (d) setHeight(Math.max(PAGE_H, d.scrollHeight))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault()
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  )
}

export const DocPreview = memo(DocPreviewInner)
