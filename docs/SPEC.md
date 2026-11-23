# Careerer — Build Spec

Desktop app (Electron, Windows first) that turns a job posting plus a candidate profile into a tailored resume and cover letter, both as PDFs. It is generic: any user enters their own profile as text.

## Core loop
1. User gives a job posting link (or pastes posting text).
2. App gets the posting text.
3. LLM call 1 extracts structured requirements from the posting.
4. LLM call 2 reconciles requirements with the user's profile, using `docs/ats-research-report.md` as standing context, and returns the resume, cover letter and match report as JSON.
5. User reviews, optionally edits, picks a style, and exports both PDFs.

## Stack
- Electron + electron-vite + React 18 + TypeScript. Plain CSS (CSS modules or one stylesheet with tokens). No UI kit.
- LLM calls go through the locally installed **Claude Code CLI** (`claude -p`), using the user's own Claude login. No Anthropic API key and no `@anthropic-ai/sdk`. The CLI is spawned only from the main process.
- Storage: JSON files under `app.getPath('userData')`. No database.
- Tests: Vitest for pure logic.
- Packaging: electron-builder config for a Windows installer (`npm run dist`). `npm run dev` must work for manual testing.

## Security
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` for app windows. Expose a typed API via `contextBridge` in preload.
- CLI runs with all tools disabled (`--tools ""`), `--safe-mode`, `--no-session-persistence`, in a fresh empty temp directory. Spawned without a shell; user content goes on stdin. Cancel kills the process tree.
- Posting-fetch windows: separate session partition, no preload, JS on, `webSecurity` on, closed after extraction.
- Treat posting text as untrusted data in prompts (wrap in clearly delimited tags; tell the model it is data, not instructions).

## Data model (userData)
- `settings.json`: `{ cliPath?: string, model: "sonnet"|"opus"|"haiku", defaultTheme: "midnight"|"daylight" }`. Default model alias: `sonnet`.
- `profile.json`: `{ rawText: string, parsed?: ParsedProfile, updatedAt: string }`.
- `ats-report.md`: copied from the bundled `docs/ats-research-report.md` on first run; user can replace it in Profile.
- `applications/<id>/`: `meta.json` (`{id, role, company, url?, createdAt, status: "draft"|"exported"|"applied", theme}`), `posting.txt`, `requirements.json`, `result.json`, `resume.pdf`, `cover-letter.pdf`.

## Getting the posting
- If URL: load it in a hidden `BrowserWindow` (own partition), wait for load plus ~1.5 s for client rendering, read `document.body.innerText`, close the window. 30 s timeout.
- If the text is under ~600 characters, or looks like a login or captcha wall, fail with a friendly message asking the user to paste the posting text. Many boards (LinkedIn, Workday) block this; the paste path is first-class, not an afterthought.

## LLM pipeline (main process)
Each call is one `claude -p --output-format json --json-schema <schema> --model <alias> --tools "" --safe-mode --no-session-persistence` run, with the system prompt passed by file and the user content on stdin. Validate with zod. One retry on invalid output, then show an error. Handle: CLI missing, not signed in, non-zero exit, `is_error`, 3-minute timeout. Settings shows the CLI path, version and signed-in status.

**Profile parse** (on profile save): raw text → `ParsedProfile` `{ name, headline, location, contacts: {email?, phone?, links[]}, summary, skills: [{group, items[]}], experience: [{title, company, location?, start, end|"Present", bullets[]}], projects: [{name, tech?, link?, description}], education: [{credential, school, location?, year}], certifications[] }`. Placeholders like `[X sec]` are kept verbatim in parse output.

**Call 1 — requirements**: posting text → `{ title, company, location?, seniority?, required: string[], preferred: string[], repeatedTerms: string[], knockouts: string[], companyDetails: string[] (≤3, for the cover letter) }`.

**Call 2 — generate**: system prompt = ATS report + rules below; user content = requirements JSON + ParsedProfile + raw profile text. Returns:
```
{ resume: { headline, summary, skills:[{group, items[]}], experience:[{title, company, location?, start, end, bullets[]}], projects:[...], education:[...], certifications:[] },
  coverLetter: { greeting, paragraphs: string[], closing, signature },
  report: { matched: [{term, count, where: string[]}], bridges: [{requirement, approach: "direct"|"transferable"|"trajectory", evidence, whereUsed: string[]}], stretch: string[], missingInfo: string[], knockoutFlags: string[], changes: string[] } }
```
Rules that must be in the prompt (Part 7 of the ATS report is the source of truth):
- Use only facts in the profile. Never invent employers, titles, dates, tools, metrics or certifications. Advocate: treat the posting as a wishlist, find the strongest true bridge for each requirement and write it with the posting's keywords (ATS rules still apply). Framing yes, fabrication no. Requirements with no honest bridge go to the private `stretch` note, never into the documents. Every content prompt (profile parse, requirements, generation, cover letter, Repair) shares one advocate preamble.
- Drop any sentence that depends on a `[placeholder]`, or rewrite it without the placeholder; list it in `missingInfo`.
- Keep real job titles in experience; the headline may use the posting's title.
- Mirror the posting's exact spelling for matched skills; acronym plus full form once.
- Reverse-chronological experience; reorder bullets by relevance; max ~3 mentions per term; cover letter 250–400 words.

**Local post-checks** (pure functions, unit tested): find leftover `[...]` placeholders in output; recount matched terms against the posting's exact strings (case-insensitive, word-boundary, handles `C#`, `Node.js`, `CI/CD`); flag any employer/title in output that is not in the profile.

**Mock mode**: env `CAREERER_MOCK=1` makes all LLM calls return fixture JSON from `src/main/llm/fixtures/` (a realistic Salesforce Developer example using the sample profile in `docs/sample-profile.txt`). The whole app must be testable end to end without the Claude CLI.

## PDF export
- Resume and cover letter are React (or plain HTML string) templates rendered into a hidden `BrowserWindow`, then `webContents.printToPDF({ pageSize: 'Letter', printBackground: true, margins: { marginType: 'none' } })`.
- Fonts bundled locally (no network at export): Bodoni Moda and Geist via `@fontsource` packages or vendored woff2 with their OFL licences.
- Text must be real, selectable text in reading order. One column. Decorative lines and diamonds are CSS only, no text.
- Fit: resume targets one page; if content overflows, step body font from 13.2px down to 12px, then allow a second page (`break-inside: avoid` on entries; the header only on page 1). Cover letter is one page.
- File names: `Firstname-Lastname-Resume.pdf`, `Firstname-Lastname-Cover-Letter.pdf`. Export saves to the application folder and offers a "Save to…" dialog plus "Show in folder".
- After export, extract text from the PDF (e.g. `pdfjs-dist`) and check that the email appears intact and section headings appear in order; surface a warning if not.

## Document styles
Two themes, same layout. Match `docs/design/Resume.dc.html` and `CoverLetter.dc.html` exactly (fonts, sizes, spacing, centered invitation-style header with gold hairlines and diamonds, letter-spaced gold section headings, Bodoni job titles, violet dates).
- **Midnight gala** (default): paper `#0A0E18`, ink `#E9E5DB`, soft `#F3EEE2`, muted `#9AA0B1`, gold `#CDAE72`, date `#B0A2DA`, rule `#242A3A`, hair `#6E5D3C`.
- **Daylight gala**: paper `#FFFFFF`, ink `#0F1A33`, soft `#0A1430`, muted `#4A5470`, gold `#8C6A2C`, date `#5B4B92`, rule `#E2E4EA`, hair `#CDAE72`.
The theme toggle sits on the Review screen (per application) and Settings holds the default.

## App UI
Match `docs/design/*.dc.html` (Main, Processing, Review, Library, Profile). These are HTML mockups: read their inline styles for exact colors, type and spacing. Replace the working name "Tailor" with "Careerer". App palette: bg `#0D0D0C`, sidebar `#111110`, card `#121211`, line `#22211E`, text `#ECE9E2`, muted `#A19D93`, faint `#8F8B81`, accent `#D2B27A`, success `#9CC3A4`. Fonts: Instrument Serif (display), Geist (UI), Geist Mono (labels), bundled locally.

Screens:
1. **New application**: URL field + "Paste the posting text instead" toggle (textarea). Disabled with a clear reason if no profile, or the Claude CLI is missing or not signed in (unless mock mode). Profile and ATS context cards. Recent 3 applications.
2. **Processing**: four steps (Reading the posting → Matching your profile → Applying ATS context → Writing resume and cover letter) driven by real progress events from main over IPC. Requirements panel fills in as soon as call 1 returns. Cancel aborts the request.
3. **Review & export**: Resume / Cover letter tabs with a live scaled preview using the same template as the PDF. Inline editing of summary, bullets and letter paragraphs (contentEditable, saved to `result.json`). Midnight/Daylight toggle. Right panel: coverage (requirements covered / total), matched terms with counts, "How you match the wishlist" (each requirement with its bridge and profile evidence; coverage counts direct and transferable bridges) and a collapsed private "Worth preparing for at interview" note for stretch items, missing info ("Fill these in to strengthen it"), knockout checklist shown prominently, and a gentle warning if the user already has 3+ applications at this company. Buttons: Regenerate, Export both PDFs.
4. **Library**: table of applications (role, company, created, coverage, status, files). Search. Click to open Review. Status can be set to Applied. Delete with confirm.
5. **Profile**: big textarea (paste or type) + Import PDF/DOCX (extract text with `pdfjs-dist` / `mammoth`). On save, run profile parse and show "What Careerer found" counts plus the list of `[placeholders]` left. ATS context card with Replace report.
6. **Settings** (gear in sidebar footer): Claude CLI panel (detected path and version, signed-in status, path override), model alias, default theme, data folder location with "Open folder".

Transitions: screen changes fade + 6–8 px rise (200–300 ms, cubic-bezier(.2,.7,.2,1)); steps animate in sequence; progress line sweep; document preview cross-fades between tabs and themes. Honour `prefers-reduced-motion`. Keyboard accessible; visible focus rings; real buttons and labels.

## Done means
- `npm run dev` launches the app; `CAREERER_MOCK=1 npm run dev` runs the full loop without the CLI.
- `npm run build`, `npm run typecheck` and `npm test` pass.
- Both PDFs export in both themes with selectable text in correct reading order.
- README with setup, mock mode, and where data is stored.
