# Careerer

Desktop app (Electron, Windows first) that turns a job posting and your profile into a tailored, ATS-safe resume and cover letter, exported as PDFs.

## Setup

Requires Node 22 and npm 10.

```
npm install
npm run dev          # launch the app with hot reload
npm run build        # production build into out/
npm run dist         # Windows NSIS installer into release/
npm run typecheck
npm test
```

1. Install Claude Code and sign in once (`claude auth login`). Careerer runs the `claude` CLI on your computer with your own Claude login; there is no API key. Open **Settings** to see the detected path, version and sign-in state, pick a model (sonnet, opus or haiku), or point it at `claude.exe` manually.
2. Open **Profile**, paste your background (or import a PDF/DOCX) and save.
3. On **New application**, paste a job link or the posting text. Many boards (LinkedIn, Workday) block automatic reading, so pasting the text is a first-class path.
4. Review, edit inline, pick Midnight or Daylight, then export both PDFs.

## Mock mode (no Claude sign-in)

```
set CAREERER_MOCK=1 && npm run dev          (cmd)
$env:CAREERER_MOCK=1; npm run dev           (PowerShell)
```

`CAREERER_MOCK=long` uses a longer resume that spills onto a second page. All LLM calls return fixtures (a Salesforce Developer role at Halcyon Health, built from `docs/sample-profile.txt`). Paste or save the sample profile and the whole loop works, including PDF export.

## Checks without the GUI

- `npm run mock-export [-- <dir>]` runs the mock pipeline and writes both PDFs in both themes (plus extracted text and `report.json`) to `<dir>` (default `%TEMP%\careerer-mock-export`).
- `npm run real-check` runs ONE real generation through the Claude CLI (haiku alias) with the sample profile and posting, exports both PDFs and runs the post-checks. It uses a little of your plan.
- `npm run smoke` launches the built app headlessly in mock mode, drives the profile, pipeline, Review and export, and exits 0 on success.

## Where data is stored

Everything is JSON and files under Electron's `userData` folder, shown in **Settings** with an "Open folder" button (on Windows: `%APPDATA%\careerer`).

- `settings.json`: model alias, default theme, optional Claude path
- `profile.json`: your profile text and its parsed form
- `ats-report.md`: the ATS research report used as standing context (replaceable in Profile)
- `applications/<id>/`: `meta.json`, `posting.txt`, `requirements.json`, `result.json`, and the exported `Firstname-Lastname-Resume.pdf` and `Firstname-Lastname-Cover-Letter.pdf`

## Layout

`src/main` (storage, LLM pipeline, posting fetch, PDF export), `src/preload` (typed `window.careerer` API), `src/renderer` (React UI), `src/shared` (types, zod schemas, post-checks, document templates). The spec is `docs/SPEC.md`.
