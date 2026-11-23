# Careerer audit

Auditor pass. No source edited. Line numbers are against the tree as audited (2026-11-22).

## Command results (run by the auditor)

| Command | Result |
|---|---|
| `npm run typecheck` | pass (exit 0) |
| `npm test` | pass: 5 files, 40 tests |
| `npm run build` | pass (renderer JS 381 kB) |
| `npm run mock-export` | pass, `failures: []`, both themes: resume 1 page at 12px, letter 1 page at 14px, email intact, warnings empty |
| `npm run smoke` | PASS (exit 0) |

PDF text verified independently with pdfjs (`Daylight` resume and letter, per text item). Order: name, `SALESFORCE DEVELOPER`, contact line, SUMMARY, SKILLS, EXPERIENCE (NLT Media, Traction Complete, Summit Tools, Checkpoint One Apparel), PROJECTS, EDUCATION. Headings, name, dates and `RE: SALESFORCE DEVELOPER` extract as whole words at `TRACK = 0.08em`. Single column, real text, no stray text from the diamonds or hairlines. Reading order is fine. The mock fixture is the only content tested.

Counts: **Blocker 2, Should-fix 14, Nit 9.** Status after the fix round (and the switch from the Anthropic API to the Claude CLI) is marked on each item.

---

## Blockers

### B1. Real generation call always throws before any network request
**Status: Superseded: CLI (no SDK, no max_tokens streaming limit)**
`src/main/llm/provider.ts:144` passes `maxTokens: 32000`, and `src/main/llm/anthropic.ts:48` uses non-streaming `messages.create`. SDK 1.12 computes `3600 * max_tokens / 128000` = 900 s, which exceeds its 600 s ceiling, so it throws "Streaming is required for operations that may take longer than 10 minutes". I reproduced this offline with `claude-sonnet-5-5`, `max_tokens: 32000` and a dead base URL. `friendly()` (`anthropic.ts:25`) shows that text to the user. Mock mode hides it, so every real resume/cover-letter generation fails at step 4.
Fix: use `client.messages.stream(...).finalMessage()` for call 2 (and ideally all three calls). Keep the `signal` option. Alternatively drop `maxTokens` to 16000 for call 2 (a resume plus letter plus report is well under that), but streaming is the robust choice.

### B2. Output schema contains `maxItems`, which structured outputs likely reject
**Status: Superseded: CLI. Constraint keywords are still stripped from the schema sent to the CLI and a test asserts it**
`src/shared/llmSchemas.ts:113` has `.max(3)`. I confirmed `z.toJSONSchema` emits `"maxItems":3` on `companyDetails`, and that schema goes straight into `output_config.format` (`anthropic.ts:13-17,54`). The raw API does not support array size constraints beyond `minItems` 0/1 (the SDK's `parse()` helpers strip them; this code does not). Untestable without a key, so treat as a high-probability 400 on call 1.
Fix: remove `.max(3)` from the schema sent to the API (keep it in a local post-validation `.refine` or just `slice(0,3)` in `RequirementsSchema.transform`). Add a unit test asserting the JSON schemas contain none of `maxItems|minItems|minimum|maximum|maxLength|minLength|pattern`.

---

## Should-fix

### S1. Fast failures are never shown; Processing spins forever
**Status: Fixed: per-job event buffer in main plus `generation.status`, replayed by Processing**
`ipc.ts:316-331` starts `runGeneration` before the renderer has navigated and subscribed (`Processing.tsx:18`). Events emitted early are lost. The 2.5 s poll (`Processing.tsx:41-49`) only looks for a result, never an error. For a brand-new application the pipeline also deletes the app on error (`pipeline.ts:410`), so the poll gets null forever. Reproduce: empty profile ("Add your profile first."), `normalizeUrl` error, revoked key (401 in about 100 ms).
Fix: keep last status per id in main (`Map<id, ProgressEvent[]>`), add a `generation.status(id)` IPC that Processing calls on mount and in the poll; replay terminal events.

### S2. A failed new run destroys the user's pasted posting
**Status: Fixed for errors: failed new runs stay as drafts with posting.txt and Processing offers Try again. A cancelled new run is still discarded on purpose (the user chose to abandon it)**
`pipeline.ts:410` deletes the application folder, and the posting text with it, on any error or cancel (rate limit, bad key, network). The user must re-paste. Fix: keep the folder as `draft` with `posting.txt` until success, or return the text to the New Application form on error.

### S3. No guard against two concurrent runs of the same application
**Status: Fixed: `gen:start` rejects an id that is already running**
`ipc.ts:317` does `running.set(prep.id, ac)` without checking for an existing entry. A double-click on Regenerate (or Regenerate in a second window) overwrites the controller, so Cancel only aborts one run and both write `result.json`. Fix: reject `genStart` when `running.has(id)`.

### S4. `max_tokens` retry resends the identical request
**Status: Superseded: CLI (no max_tokens or effort parameters; CLI timeout is 3 minutes)**
`anthropic.ts:59-62`: on `max_tokens` it `continue`s with the same prompt and cap, which will truncate again, then reports "unusable response twice". Fix: on `max_tokens`, throw a specific error ("Output was cut off; shorten the profile or choose a larger model"), or retry once with a higher `max_tokens` via streaming. Also: adaptive thinking is on by default for these models and thinking tokens count against `max_tokens`; set `output_config.effort` (for example `medium` for generate, `low` for parse and requirements) alongside `format` to bound latency and cost.

### S5. Post-checks do not catch most invention
**Status: Fixed: skills, numbers, dates, titles, schools, credentials and projects checked against the raw profile text only; tests added**
`src/shared/checks.ts:55-76,78-89`. Only employers, titles, schools and certifications are checked, by substring in a haystack that includes the LLM-produced parsed profile (so a hallucinated parse validates a hallucinated resume). Not checked: tools and skills, numbers and metrics ("cut X by 60%"), dates, degree names, project names, anything in the cover letter or `report`. Fix, all pure and testable:
- every `skills[].items` entry must appear in the raw profile text (after `norm`, allowing the posting's acronym-plus-full-form variants);
- every number token (`\d[\d,.]*%?`) in resume and letter must appear in the raw profile or posting;
- every experience `start`/`end` must match the raw profile dates for that company;
- check against `profile.rawText` only, not the parsed JSON.
Surface hits as the existing yellow warnings.

### S6. Placeholder detector is narrow
**Status: Fixed: widened regex, scans every string field of resume and letter**
`checks.ts:4` `/\[[^\]\n]{1,100}\]/g` misses `[` spans over 100 chars, `{{x}}`, `<X>`, `XX%`, `TBD`, `___`. It also only scans `resumeText`/`coverLetterText`, which omit project link, dates, location, education year and certifications' neighbours. Fix: widen to `\[[^\]]{1,300}\]|\{\{[^}]*\}\}|<[A-Z ]{2,}>|\b(X{2,}|TBD|TODO)\b|_{3,}`, and scan the full JSON string of `resume` and `coverLetter` (`JSON.stringify` then regex) so no field is skipped.

### S7. Checks go stale after inline edits
**Status: Fixed: checks re-run after edits in Review and again in main on export**
`Review.tsx:88-97` writes edits into `result.current` but never recomputes `checks`. A user can type a placeholder or a new employer, and the warning panel (`Review.tsx:284`) still shows the old state. Export does not re-check either. Fix: run `runChecks` in the renderer (it is pure and shared) on each edit and before export, and have `export:run` re-run the placeholder check in main and refuse or warn.

### S8. Prompt-injection tag escape is bypassable
**Status: Fixed: every `<` in untrusted text is escaped; test added**
`prompts.ts:6-9` strips closing tags with a single regex pass. `</job_</job_posting>posting>` becomes `</job_posting>` after the replace. Fix: loop until stable, or escape `<` as `&lt;` in untrusted text (simpler and safe), or use a per-call random delimiter (`<job_posting_a9f3...>`). Also add the instruction that tags other than the exact opening ones are data. Add a test.

### S9. Profile parse failure is silent; exports then use a junk header
**Status: Fixed: `profile:save` returns parseError (shown on Profile); generation retries the parse and fails clearly; export no longer guesses a header**
`profile.ts:435` only `console.warn`s. The user sees nothing (bad key, rate limit, truncation). With no parsed profile, `export/service.ts:21` falls back to `naiveParse`, so the PDF header name is the first line of the raw text and phone, location and links are dropped (`provider.ts:166-181`). `Review.tsx:67` does the same on screen. Fix: return `{ profile, parseError }` from `profile:save` and show it on the Profile screen; make `exportApplication` and `runGeneration` fail with "Profile has not been parsed yet" in real mode instead of using `naiveParse`, or retry the parse at generation time.

### S10. Corrupted JSON silently resets data
**Status: Fixed: corrupt files are quarantined to *.corrupt-<ts>; settings use field-level catches; tests added**
`store.ts:67-71`: unreadable or invalid `settings.json` returns defaults, and the next `updateSettings` or `setApiKey` overwrites the file (loses `apiKeyEnc` and any other valid fields because one field was invalid, for example `model: ""`). `getProfile` (`store.ts:123`) returns null, and the next save overwrites it with no backup. `readJson` (`fsutil.ts:303`) cannot tell missing from corrupt. Fix: on parse failure rename the bad file to `*.corrupt-<ts>` before returning defaults, and use field-level fallback (`StoredSettingsSchema.catch`) so a bad `model` does not drop the key.

### S11. Corrupted or old `result.json` white-screens Review
**Status: Fixed: result validated on read (resultInvalid flag), on write via IPC, and an ErrorBoundary wraps the routes**
`Review.tsx:64` casts `detail.result as StoredResult` with no validation; `store.getApplication` returns it raw (`store.ts:198-199`). A missing `report` field throws in render. There is no error boundary (`App.tsx`), so the whole window goes blank. Same in `Library.tsx:29` (`computeCoverage`). Fix: validate with `StoredResultSchema.safeParse` in `getApplication` (return `result: undefined` plus a flag), add an `ErrorBoundary` around `<Routes>`, and validate in `appsWriteFile` (`ipc.ts:307`, currently accepts any JSON from the renderer).

### S12. Coverage only counts verbatim requirement text
**Status: Fixed: model reports requirementCoverage with evidence quotes, verified locally (substring or 70% token overlap) with a 60% token local fallback; partial counts half; tests added**
`checks.ts:92-100`. Confirmed with the mock data: 9 of 12; the three misses are phrase-level ("Salesforce Platform Developer I certification"). Real postings produce strings like "4+ years Salesforce development", "Strong communication skills", "Experience with Apex and SOQL", which will never match verbatim, so coverage reads far too low and is demoralising and misleading. Proposed fix, in layers:
1. Ask call 2 to return `report.requirementCoverage: [{requirement, status: "met"|"partial"|"gap", evidence}]` for every required and preferred item, and verify `evidence` is a substring of the output text (reject unsupported claims locally). This is the primary source.
2. Local fallback when the model is silent: tokenise the requirement, drop stopwords and generic words (years, experience, strong, ability, knowledge), strip `\d+\+?\s*years?`, and count covered if at least 60 percent of the remaining significant tokens (case-insensitive, word-boundary, using `countTerm`) appear in the output; treat "N+ years X" as covered when X is covered and the summary states a years figure.
3. Show `partial` as half credit and keep the "Left out" list tied to `report.gaps`, not to the string miss list.
Add tests for "4+ years Salesforce", "Experience with Apex and SOQL", and a certification phrase.

### S13. Posting-fetch window can download files and has no size cap
**Status: Fixed: will-download blocked, non-http navigation and redirects cancelled, text coerced and capped; posting capped at 60k chars, profile at 100k, import 5 MB**
`posting/fetch.ts`: no `will-download` handler on the partition session, so a hostile or odd URL (direct file link) can write into the user's Downloads folder. Add `ses.on('will-download', (e) => e.preventDefault())`. Also no navigation/redirect restrictions (`will-navigate`/`will-redirect` to non-http(s) should be cancelled) and `text` (`fetch.ts:371`) is unbounded, as are pasted posting text (`pipeline.ts:328`) and profile text. A huge page is sent to the API in full. Fix: cap posting at about 60k chars (truncate with a notice) and profile at a sane limit with a visible error; coerce `text` to string before `assessPosting`.

### S14. Regenerate overwrites hand edits without warning
**Status: Fixed: confirm before regenerating over edits, result.prev.json snapshot, requirements and meta written only on success**
`Review.tsx:127-136`: flushes edits then regenerates; `pipeline.ts:406` replaces `result.json`. No confirm and no backup. Also a cancelled or failed regenerate has already overwritten `requirements.json` and `meta.role/company` (`pipeline.ts:375-376`) while keeping the old result, so coverage no longer matches. Fix: confirm when `dirty` edits exist, copy the old result to `result.prev.json`, and write requirements and meta only at success.

---

## Nits

- N1. **[Won't fix: connect-src localhost is needed for the dev server; frame-ancestors cannot be set from a meta tag]** `index.html:201` CSP `connect-src` allows `localhost:*` in production builds. Inject it only for dev (electron-vite `transformIndexHtml`), and add `frame-ancestors 'none'`.
- N2. **[Fixed: hooks only run when the app is not packaged]** `CAREERER_SMOKE` and `CAREERER_DEMO_EXPORT` hooks (`index.ts:13,109`) ship in the production bundle. Env-gated and harmless, but `CAREERER_SMOKE` runs `rmSync` on a tmp path; gate behind `!app.isPackaged`.
- N3. **[Fixed: devTools disabled in packaged builds]** DevTools and the default menu accelerators are available in packaged builds. Set `devTools: false` in `webPreferences` when `app.isPackaged`.
- N4. **[Won't fix: single local window; preload exposes typed methods only]** No IPC sender validation (`ipc.ts:226`). Single local window, so low risk; add `e.senderFrame.url` check for defence in depth. Preload surface itself is good: typed methods only, no generic `invoke` or `send`, `on` limited to the progress channel.
- N5. **[Fixed: moot, API keys and safeStorage were removed]** Key handling is sound: encrypted with `safeStorage`, renderer sees `hasKey` only, `getApiKey` is not on IPC, no logging of keys or payloads, errors carry only `err.message`. Two gaps: `getApiKey` swallows decrypt failures and returns undefined, so the user is told to "add your key" while Settings shows a key present (`store.ts:116-119`); surface "stored key cannot be decrypted, re-enter it". And `safeStorage.isEncryptionAvailable()` is true on Linux with the plaintext `basic_text` backend; Windows is the target, but check `getSelectedStorageBackend()` if Linux ever ships.
- N6. **[Fixed: file name validated with AppFileSchema]** `store.ts:232-243`: `FILE_NAMES[name]` with `name` of `"constructor"` or `"__proto__"` resolves to a prototype member and fails in `join` with an odd error. Validate with `AppFileSchema.parse` (already exists, unused). Path traversal itself is blocked: ids pass `ApplicationIdSchema` (`^[A-Za-z0-9_-]{6,64}$`) before every `join`, and export file names pass through `pdfFileName`, which strips everything except letters, digits, whitespace and hyphen. `exportSaveAs` writes only to a path the user picked in a dialog.
- N7. **[Fixed: mock-export now includes a long fixture and checks real PDF page counts (2 pages, header on page 1 only); no page-count warning added]** `export/pdf.ts:99` page count comes from DOM `scrollHeight`, not from the PDF. Use pdfjs `numPages` from the post-export check (already opened) and warn if the resume exceeds 2. The two-page path (`box-decoration-break: clone` padding on page 2, `break-inside: avoid`) was never exercised; the fixture is one page. Add a mock-export case with a long profile and inspect page 2.
- N8. **[Fixed: ATS report capped at 200 KB, import at 5 MB]** The ATS-report Replace flow (`ipc.ts:296`) reads any file with no size cap straight into a cached system prompt; cap at about 200 KB. The same applies to PDF/DOCX import (`profile-import.ts`).
- N9. **[Fixed: title and dates must sit on or next to the employer line]** `unknownEntities` match by substring of normalized text (`checks.ts:66`), so a title like "Developer" passes if any "Web Developer" exists in the profile. Match the title in the same line as the company, or require the full `title` string.

## Verified OK (no action)

- Window flags: `contextIsolation`, `sandbox`, `nodeIntegration: false`, `webSecurity`, window-open denied, navigation limited to app URL, permissions denied, single instance. Fetch window: own in-memory partition, no preload, sandboxed, destroyed in `finally`, storage cleared.
- Prompts include the Part 7 rules (truthfulness 1-5, structure, tailoring 12-17, letter 18) and the full ATS report as the cached system block; the data-not-instructions rule is in every system prompt. Cache placement is correct (stable block first, volatile date and profile in the user turn); the report is about 4k tokens, near the minimum cacheable size for some models, so confirm `cache_read_input_tokens` once a key exists (and log it).
- Model ids `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-haiku-5-5` are valid. Abort is wired (`signal` passed as request option; Cancel path checked). SDK retries (default 2 for 429/5xx) apply, and typed errors are mapped. Still missing: a `fallbacks` or refusal-specific message beyond the generic one (low priority).
- Template: single column, real text, letter-spacing at 0.08em extracts whole; decoration is CSS only; escaping via `esc()` on all interpolations, and the preview's `dangerouslySetInnerHTML` only receives escaped template output.
- Spec coverage: all six screens and the core loop exist. Gaps: Library lacks the "files" column in the spec (`Library.tsx:96-101`, there is an ACTIONS column instead); coverage logic (S12); parse errors not shown (S9). No other missing requirements found.

---

# Round 2 (after the switch to the Claude CLI)

Auditor re-check, no source edited. `real-check` not run (CLI signed out).

## Commands (re-run)

| Command | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm test` | pass: 6 files, 70 tests |
| `npm run build` | pass (renderer 392 kB) |
| `npm run mock-export` | pass, `failures: []` (includes the long two-page case) |
| `npm run smoke` | PASS |

## Previous findings

All 14 Should-fix items marked Fixed or Superseded were spot-checked in code and tests: S1 (`ipc.ts:37-43,139` event replay), S2/S14 (draft kept, `result.prev.json`, writes at the end of `pipeline.ts:170-173`), S3 (partly, see R2-S2), S5/S6 (`checks.ts:7,108-131`), S8 (`prompts.ts:6` escapes every `<`), S9 (`pipeline.ts:105-117`), S10 (`fsutil.ts:42-62` quarantine), S11 (`ErrorBoundary`, `ipc.ts:104-109` schema validation), S12 (coverage with verified evidence), S13 (`fetch.ts:18-19,39-40,62`). B1/B2/S4 are moot: `schema.ts` strips constraint keywords. No `@anthropic-ai/sdk`, API key or `safeStorage` remains in `src`, `package.json`, the builder config, README or CLAUDE.md (the only hit is a test string in `cli.test.ts:73`).

## CLI runner review (`src/main/llm/cli.ts`)

Confirmed good: `shell: false` (`cli.ts:151`); args are a fixed list with `--tools ""`, `--no-session-persistence`, `--safe-mode`, `--system-prompt-file` (all present in `claude --help`); the user content goes only to stdin (`:183`); fresh empty `mkdtemp` cwd with the system file inside, removed in `finally` (`:199-208`); Windows tree kill with `taskkill /T /F` on abort and timeout; model comes from `z.enum(MODELS)` on read and write (`schemas.ts:11,18,24`), so it cannot inject an argument; output parsing handles non-JSON, non-zero exit, `is_error`, not-signed-in and rate-limit text, fenced JSON fallback and empty results; no retry on CLI errors, one retry on schema mismatch only.

## New findings

### Should-fix

**R2-S1. [Fixed: validateClaudePath (absolute, not UNC, basename claude/claude.exe, regular file) in resolveClaude and on settings:update; tests added] `claudePath` is only checked with `existsSync`.** `cli.ts:110-115`, `store.ts:84-86`, `schemas.ts:27`. Any existing file or directory is accepted and later spawned: `cmd.exe`, `powershell.exe`, or a UNC path (`\host\share\x.exe`, which also leaks NTLM credentials). The args and stdin are then attacker-influenced if the renderer is ever compromised. Fix: in main, on `settings:update` and in `resolveClaude`, require `isAbsolute`, not UNC, `statSync().isFile()`, and basename matching `/^claude(\.exe)?$/i`. Reject otherwise with a clear message. Add tests.

**R2-S2. [Fixed: the id is reserved synchronously before any await and released if preparation fails] The concurrent-run guard has a race.** `ipc.ts:115-118`: `running.has` is checked, then `await prepareGeneration`, then `running.set`. Two Regenerate clicks in the same tick both pass, and S3 persists. Fix: reserve synchronously (`running.set(id, ac)` before any `await` when `regenerateId` is given, and delete on failure), or serialise `gen:start` per id.

**R2-S3. [Fixed: stream-json with an inactivity timeout (90 s without events) plus a 10 minute hard cap; generation split into two parallel calls; live elapsed time on Processing; per-call durations stored in result.json] A 3-minute timeout may be too short for call 2.** `cli.ts:9,204`, `provider.ts:344`. The generate call carries the full ATS report, profile, requirements and a large JSON output, with a CLI start-up cost on top. On a slow turn it times out with "did not answer within 3 minutes", and then the user pays for it again on retry. Unverified without a signed-in CLI. Fix: pass `timeoutMs` per call (about 8 minutes for generate, 3 for parse and requirements), and surface elapsed time in the Processing detail.

### Nit

- R2-N1. **[Fixed: ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN and ANTHROPIC_BASE_URL are removed from the CLI environment; test updated]** `cleanEnv` (`cli.ts:44-49`) keeps `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` (a test asserts it, `cli.test.ts:73`). If the user has one in their environment, the CLI silently bills the API instead of using the subscription login the spec promises. Delete both (and `ANTHROPIC_BASE_URL`) before spawning.
- R2-N2. **[Fixed: kill, then wait up to 2 s for the process to close before the temp dir is removed. POSIX group kill not done (Windows only target)]** On timeout or abort the temp dir is removed while the killed process may still hold its cwd (`cli.ts:206-208`). On Windows `rm` can fail with EBUSY, swallowed by `.catch`, leaving `careerer-cli-*` folders in `%TEMP%`. Wait for the `close` event (with a 2 s cap) before cleanup. On POSIX `killTree` kills only the pid (`:128`), not the group; spawn with `detached: true` and `process.kill(-pid)` if Linux ever ships.
- R2-N3. **[Fixed: isAbort matches AbortError only]** `isAbort` (`pipeline.ts:86-88`) matches `/aborted/i` in any error message. A CLI error that contains "aborted" is treated as a user cancel, and a new draft is deleted (`:178`). Match `err.name === 'AbortError'` or `signal.aborted` only.
- R2-N4. **[Fixed: job events are dropped 10 minutes after the terminal event]** `jobs` (`ipc.ts:38`) keeps every job's events for the life of the process. Delete an entry a few minutes after its terminal event.
- R2-N5. **[Checked: the system prompt file is honoured (a canary word placed only in the file came back in the output) and structured_output is present in the result event; see progress.md]** Not testable here: that `--json-schema` yields `structured_output` in the JSON result on the installed CLI version, and that `--system-prompt-file` is honoured (it appears in `--help` only inside another flag's description). The code has a text fallback for the first; for the second, `real-check` should confirm that the ATS rules actually reach the model (for example, ask for a canary phrase from the system file).
