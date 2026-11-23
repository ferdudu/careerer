
## Phase 1: scaffold, storage, shell (coder)

### Built
- Hand-scaffolded Electron + electron-vite 5 + Vite 7 + React 18 + TypeScript. Folders: `src/main`, `src/preload`, `src/renderer`, `src/shared` (zod schemas, types, IPC channel names and the `CareererApi` interface). Scripts: `dev`, `build`, `typecheck`, `test`, `dist` (electron-builder, NSIS x64; `electron-builder.yml`).
- Secure window: `contextIsolation`, `sandbox`, no `nodeIntegration`, `webSecurity`, window-open and navigation blocked, permissions denied, single-instance lock, CSP meta tag in `index.html`. Typed API on `window.careerer` via `contextBridge`; IPC results use an `{ok,value|error}` envelope.
- Storage (`src/main/storage/store.ts`, `createStore({dataDir, bundledAtsPath, codec})`): settings (API key encrypted through a `SecretCodec` backed by `safeStorage`; renderer only gets `hasKey`), profile, ATS report (copied from bundled `resources/ats-research-report.md` on first run, also an electron-builder extraResource; replace via file dialog, reset), applications CRUD with id validation (no path traversal), atomic writes. All IPC handlers in `src/main/ipc.ts`.
- Mock flag: `CAREERER_MOCK=1` read in main (`isMock`), passed to the preload via `additionalArguments`, exposed as boolean `window.careerer.isMock`.
- Renderer: sidebar (New application, Library, Profile, gear to Settings), hash routing incl. `/processing/:id` and `/review/:id` placeholders, fade + 8px rise screen transition (260 ms, spec easing, reduced-motion respected), tokens and bundled fonts (@fontsource instrument-serif, geist, geist-mono, bodoni-moda; latin subsets, all verified on npm). Settings fully working (key set/replace/remove, model, default theme, open data folder). Profile: textarea save/load, placeholder count, ATS card with Replace report. Hook for phase 2 parse: `src/main/profile.ts` `parseProfileHook` (called in the `profile:save` handler).
- 13 vitest unit tests for the store (fake codec, temp dirs).

### Commands and results
- `npm install`: ok (428 packages; npm audit reports 11 vulnerabilities in dev deps, not addressed).
- `npm run typecheck`: pass.
- `npm test`: 1 file, 13 tests passed.
- `npm run build`: pass (main, preload, renderer).
- `npm run dist` and the GUI were not run.

### Known issues / decisions
- GUI not launched (per instructions); the Electron window, safeStorage and dialogs are untested at runtime.
- Versions pinned to what resolved cleanly: electron 39, electron-vite 5, vite 7, vitest 3 (newer majors exist).
- Rollup warns about a comment annotation in zod (harmless). The renderer imports zod only for the `MODELS` constant from the shared schemas file, which pulls zod into the renderer bundle (~500 kB); can be split later.
- Library, New application, Processing and Review are placeholders (URL field and Tailor button disabled). Import PDF/DOCX and the parse summary are phase 2.
- The renderer-visible `profile-changed` window event is used to refresh the sidebar name after a save.

## Phase 2: posting fetch, LLM pipeline, PDF export (coder)

### Built
- Fix: `MODELS`, `DEFAULT_MODEL`, `THEMES`, `STEPS` moved to zod-free `src/shared/constants.ts`; renderer bundle fell from 499 kB to 335 kB.
- Posting fetch (`src/main/posting/`): hidden sandboxed BrowserWindow on an in-memory partition, no preload, JS and webSecurity on, 1.5 s render wait, 30 s timeout, abortable, closed after extraction. `assessPosting` rejects text under 600 chars or login/captcha walls with a "paste the text instead" message; `normalizeUrl` allows only http(s). Paste path goes through `generation.start({text})`.
- LLM (`src/main/llm/`): `@anthropic-ai/sdk` in main only. Structured outputs via `output_config.format` json_schema built from the zod schemas, zod-validated, one retry with the validation error, refusal and max_tokens handled, abort via `AbortSignal`. The ATS report plus rules form the cached system block (`cache_control: ephemeral`); posting, profile and requirements go inside delimited data tags with an explicit "data, not instructions" rule. Profile parse is wired into `parseProfileHook` (runs on `profile:save`; skipped without a key, never blocks saving). Pipeline (`pipeline.ts`) runs the four steps, emits progress events (requirements ride on step 1 `done`), recounts matched terms locally, stores `checks` in `result.json`, deletes a brand-new application on error or cancel.
- Mock mode: fixtures in `src/main/llm/fixtures/` (sample profile parse, Halcyon Health posting, requirements, result) following the truthfulness rules (no placeholders, no invented facts; dropped items listed in `report.missingInfo`). Per-step delays (~0.7 to 1.4 s). For a profile that is not the sample, mock parse is a naive name/email parse.
- Post-checks (`src/shared/checks.ts`, tested): placeholders, word-boundary term recount (C#, C++, Node.js, CI/CD), unknown employers/titles/schools/certifications, cover-letter word count.
- Templates (`src/shared/template.ts`): one module for PDF and the phase 3 preview (`documentCss`, `resumeHtml`, `coverLetterHtml`, both palettes, `data-edit` paths for inline editing). Export (`src/main/export/`): fonts inlined from local @fontsource files, `printToPDF` Letter, font steps 13.2 to 12 px (cover letter 14 to 12.5), second page allowed with `break-inside: avoid` entries, `Firstname-Lastname-Resume.pdf` naming, saved in the application folder, Save-to dialog and Show-in-folder IPC, post-export pdfjs text check (email intact, headings in order).
- IPC/preload: `generation.start/cancel/onProgress`, `applications.setTheme`, `export.run/saveAs/showInFolder`; result get/update use existing `applications.get` / `writeFile`.
- Audit script: `npm run mock-export [-- <dir>]` (default `%TEMP%\careerer-mock-export`) builds, launches Electron with no window (`CAREERER_DEMO_EXPORT`), runs the mock pipeline in a throwaway data folder, exports both PDFs in both themes to `<dir>/midnight` and `<dir>/daylight`, writes `*.extracted.txt` and `report.json`.

### Commands and results
- `npm run typecheck`: pass. `npm test`: 5 files, 38 tests pass. `npm run build`: pass.
- `npm run mock-export`: ran; `failures: []`. Each theme: resume 1 page at 12 px, cover letter 1 page at 14 px (252 words), email intact in both PDFs, extracted order = name, email, SUMMARY, SKILLS, EXPERIENCE, NLT Media, Traction Complete, Summit Tools, Checkpoint One Apparel, PROJECTS, EDUCATION, Douglas College. No placeholders or unknown entities.

### Known issues / decisions
- Letter-spaced headings extract as "P R O J E C T S" (pdfjs); the heading check strips whitespace. Some ATS parsers may not, which is a tension between the design and ATS rules (decision for coordinator).
- The real API path (key, structured outputs, caching, abort) is untested: no key available. The optional server-side `fallbacks` beta was not added.
- Without the BigCommerce Integration project the sample resume is exactly one page; the full content spills a single line onto page 2 (page-2 padding relies on `box-decoration-break: clone`; not visually inspected).
- Fixture result and cover-letter text are fixed regardless of the posting pasted in mock mode.
- Renderer screens (Processing, Review, New application wiring) are still placeholders for phase 3.
- Export windows closing no longer quit the app only in demo mode; `window-all-closed` otherwise unchanged.

## Phase 3: UI screens, ATS letter-spacing fix, smoke check (coder)

### ATS fix
- Tested heading/role/Re: letter-spacing with mock-export and pdfjs extraction: 0.14em and 0.10em split words ("P R O J E C T S"); 0.08em and 0.06em extract whole. **Chosen: 0.08em** (`TRACK` in `src/shared/template.ts`, applied to section headings, the role line and the Re: line). To keep the feel: headings 11.5px weight 600 (was 11px/500), role line 12px weight 600. The heading check in `pdfcheck.ts` no longer strips whitespace (a test asserts letter-spaced text now fails). The demo also asserts "SUMMARY", "PROJECTS", "SALESFORCE DEVELOPER" and "RE: SALESFORCE DEVELOPER" appear verbatim.
- Margin is thin: 0.10em already fails, so do not raise `TRACK` without rerunning `npm run mock-export`.

### Screens
- New application (link or pasted text toggle, disabled states with reasons and links, profile and ATS cards, 3 recent), Processing (live IPC progress, requirements panel fills when call 1 returns, Cancel, error box suggesting paste or Settings), Review (Resume/Cover letter tabs, scaled live preview from the shared template with the same font-step fit, contentEditable plaintext regions saved to `result.json` with debounce and on leave, Midnight/Daylight toggle, coverage via new `computeCoverage`, matched terms, gaps, missing info, knockout checklist shown first, same-company warning at 3+ other applications, post-check warnings, Regenerate, Export both PDFs, Save-to and Show in folder), Library (table, search, open, Mark applied, delete with inline confirm), Profile (parse on save, "What Careerer found" counts, remaining placeholders, PDF/DOCX import done in main via pdfjs-dist and mammoth, Replace and Restore report). Screen fade/rise, step animations, progress sweep and preview cross-fade all disabled under `prefers-reduced-motion`.
- Library status "Mark applied" only goes forward; there is no un-apply.

### Smoke check
- `npm run smoke` (`scripts/smoke.mjs`, `src/main/smoke.ts`): builds, launches the real window headlessly in mock mode with a throwaway userData folder, saves and parses the sample profile, runs the pipeline via IPC, opens Review (checks preview, editable regions, knockout checklist), visits every screen, exports both PDFs and requires zero warnings. No Playwright needed. Result: PASS, exit 0.

### Commands and results
- `npm run typecheck`: pass. `npm test`: 5 files, 40 tests pass. `npm run build`: pass. `npm run mock-export`: failures [], both themes 1-page resume at 12px, 1-page letter, email intact. `npm run smoke`: PASS.

### Known issues
- Real-API path still untested (no key). Preview scaling and inline editing were verified only through the smoke script's DOM checks, not by eye. The contentEditable edits flatten line breaks (Enter is blocked). Coverage counts a requirement as covered only when its exact text appears in the output, so long preferred items like "Platform Developer I certification" count as uncovered.
- README added.

## Fix round and switch to the Claude CLI (coder)

### Change of plan: no Anthropic API
- `@anthropic-ai/sdk`, safeStorage key storage, the API key UI and `hasKey` are gone. All LLM calls run `claude` from `src/main/llm/cli.ts` via `spawn` (no shell), fresh empty temp cwd, temp files deleted afterwards. Flags verified against `claude --help` v2.1.198: `-p --output-format json --json-schema <schema> --model <alias> --tools "" --no-session-persistence --safe-mode --system-prompt-file <file>`. `--system-prompt-file` is accepted but not listed in `--help` (only mentioned under `--bare`). User content goes on stdin. Not `--bare`. `CLAUDECODE` and `CLAUDE_CODE_SIMPLE` are stripped from the child env (SIMPLE forces API-key auth).
- Result parsing (`parseCliOutput`): `structured_output` first, else JSON text in `result` (code fences stripped); `is_error`, non-zero exit, stderr, usage limits and "not logged in" map to plain messages. 3-minute timeout; Cancel and timeout kill the process tree (`taskkill /T /F` on Windows). One retry on invalid output (zod), a progress event per CLI call (`detail`).
- Settings: Claude CLI panel (detected path, version, signed-in via `claude auth status --json`, Check again, path override), model alias picker (sonnet default, opus, haiku). New application is disabled with a reason when the CLI is missing or signed out (mock mode bypasses). Old settings with API model ids fall back to sonnet.
- Only `claude.exe` is supported; a `.cmd` wrapper needs a shell, so Settings asks for the exe path.

### Real check (the one allowed run): did NOT succeed in this environment
- `npm run real-check` (haiku alias, sample profile and posting) failed at the first call with "Claude CLI is not signed in". Standalone, `claude auth status` reports not logged in in a clean shell; inside this agent session `claude auth status` says logged in only because of host-provided session variables, and `claude -p` there still returns `"Not logged in"` (recorded as `fixtures/cli/not-logged-in.json`). No successful call was possible, so **the location of the structured output (`structured_output` vs `result`) is unverified**; both are handled. Please run `npm run real-check` from a terminal where `claude -p "hi"` works.

### Audit items
- All Blockers and Should-fix items are fixed or superseded; statuses are in `docs/audit.md`. Highlights: events buffered per job (S1), failed runs stay as drafts with Try again (S2), run guard (S3), invention checks for skills, numbers, dates, titles (S5), widened placeholders over every field (S6), checks re-run on edit and export (S7), `<` escaping (S8), parse errors shown and no guessed header (S9), corrupt-file quarantine (S10), validated results plus ErrorBoundary (S11), evidence-based coverage (S12), fetch hardening and size caps (S13), regenerate confirm plus `result.prev.json` and deferred writes (S14). Nits N2, N3, N5 to N9 done; N1 and N4 won't fix.
- Mock mode: `CAREERER_MOCK=long` gives a longer resume that renders on two pages; mock-export runs both fixtures (`<dir>/standard`, `<dir>/long`).

### Commands and results
- typecheck pass; 70 tests pass; build pass; `npm run mock-export` failures [] (standard: 1-page resume, long: 2-page resume, letter 1 page, email intact, checks clean, coverage 9 / 12); `npm run smoke` PASS; `npm run real-check`: blocked by sign-in as described.

### Known issues
- Real CLI success path untested (see above). Anything about `--safe-mode` or `--tools ""` behaviour on a signed-in machine is unverified.

## Final fix round: streaming runner, split generation, real run (coder)

### Changes
- Runner now uses `--output-format stream-json --verbose --include-partial-messages` (all verified in `claude --help`, v2.1.198) plus `--effort`. The final `result` event is parsed. Timeouts: 90 s with no stream output (inactivity) and a 10 minute hard cap, replacing the 3 minute limit. On kill or cancel the runner waits up to 2 s for the process to close before removing the temp folder.
- Processing shows live work from the stream ("Working: Writing the resume 45 s . Writing the cover letter 44 s"). Per-call durations are recorded in `result.json` (`timings`) and logged by real-check.
- Speed-up chosen: call 2 is split into two parallel calls (resume plus report, and cover letter). The raw profile is sent once (the parsed JSON copy is no longer sent), and the letter call gets only Part 6 of the ATS report. Efforts: parse, requirements and letter `low`, resume `medium`.
- Audit round 2: R2-S1, S2, S3 and nits N1 to N4 fixed (statuses in `docs/audit.md`); `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL` are removed from the CLI environment.
- `.cmd` support: not added on purpose. Windows will not start a `.cmd` without a shell (Node blocks it), and our arguments carry JSON, so a shell would be an injection risk. Native installs provide `claude.exe`; a `.cmd`-only install gets a clear message asking for the exe path in Settings.

### Probes (two tiny haiku calls, before the real run)
- The system prompt file is honoured: a canary word that existed only in the file came back in the output.
- Structured output lands in the final result event's `structured_output` field (also mirrored as JSON text in `result`). In the real run, 4 of 4 calls used `structured_output`.

### Real run (`npm run real-check`, haiku): completed end to end
- Per-call durations: profile parse 24.7 s, requirements 7.6 s, cover letter 46.6 s, resume plus report 198.5 s. Total wall time about 4.5 minutes (the resume call dominates; if that is too slow, lower its effort to `low` in `provider.ts`).
- Both PDFs exported in both themes: 1 page each, email intact, no export warnings.
- The post-checks flagged the model output: haiku left 7 profile placeholders in the documents (for example "[X sec]", "[portfolio link]") and wrote a 241 word letter (under the 250 minimum). The checks did their job; the app shows these as warnings in Review. Suggested follow-up: one automatic repair call when placeholders are found, and testing with sonnet.
- Coverage 6 / 9 (evidence-verified).

### Commands and results
- typecheck pass; 73 tests pass; build pass; mock-export failures [] (standard 1 page, long 2 pages); smoke PASS; real-check completed as above (its own post-check failures are model-quality findings, not pipeline errors).

## Manual Repair button (coder)
- Review has a Repair button next to Regenerate. It opens a panel listing the current post-check issues (placeholders, unverified entities, inventions, letter word count) as pre-ticked checkboxes plus an optional "What looks wrong?" note. Submit runs ONE Claude call (`provider.repair`, same runner and flags, selected model, zod schema for resume plus cover letter) with the current documents, the raw profile, the selected issues and the note (all inside escaped data tags). Rules in `REPAIR_SYSTEM`: remove, reword or reorder profile facts only, keep user edits unless one is the problem.
- Main (`runRepair`): snapshot to `result.prev.json`, re-run post-checks, save, then the preview refreshes with the existing cross-fade. Progress ("Repairing the documents 12 s"), errors and Cancel use the same event channel as generation. Not automatic, and no real CLI call was made.
- Mock mode returns the same documents with placeholders removed. Smoke now plants a placeholder, clicks Repair, submits, and asserts it is gone.
- Results: typecheck pass; 75 tests pass; build pass; smoke PASS.

## Advocacy change (coder)
- Product stance: the documents advocate for the candidate. The posting is a wishlist; every requirement gets the strongest TRUE bridge (direct, transferable or trajectory) written in the posting's keywords, so each bridge is also a keyword hit. Hard line unchanged: framing yes, fabrication no; the post-checks (placeholders, entities, dates, skills, numbers) stay, and now also reject bridge evidence that is not a quote from the profile.
- One shared module `src/main/llm/advocacy.ts` (`ADVOCATE_PREAMBLE`, `ATS_RULES`) is imported by every content prompt: profile parse (also captures `strengths` and `trajectory`), requirements (adds `needs`: must or wishlist plus the underlying intent), generation (resume and letter), and Repair (now also strengthens weak or apologetic framing). The ATS rules from Part 7 are restated in generation, letter and Repair so they survive a user-replaced report. A test asserts every prompt contains the preamble, the hard line and the ATS rules.
- Report: `gaps` is replaced by `bridges: [{requirement, approach, evidence, whereUsed}]` plus a quiet `stretch: string[]`. Old stored results still load (defaults). Coverage counts direct and transferable bridges whose evidence is verified in the profile; trajectory and stretch do not count; unverified claims fall back to the local token check.
- Review: "Left out" card removed. New "How you match the wishlist" card (requirement, approach badge, profile evidence). Stretch items appear only in a collapsed, private "Worth preparing for at interview" note. Matched-term chips (keyword hits) are unchanged and recounted locally.
- Docs: Part 7 of `docs/ats-research-report.md` (and the bundled copy) and `docs/SPEC.md` updated. An existing user data copy of the report keeps the old rule 3, so the prompts state that the advocacy rules win.
- Mock fixtures updated: bridges (7 direct, Node.js and PHP direct, CI/CD transferable, Health Cloud trajectory), stretch (Platform Developer I), a letter that addresses CI/CD and Health Cloud confidently with real examples. Coverage 10 / 12; letter 333 words.
- Results: typecheck pass; 82 tests pass; build pass; mock-export failures [] (standard 1 page, long 2 pages); smoke PASS (now also checks the wishlist card and private note). No real CLI run.
