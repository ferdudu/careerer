# Careerer

Electron desktop app that writes tailored resumes and cover letters from a job posting and the user's profile.

- **Spec (source of truth):** `docs/SPEC.md`. Read it before any work.
- **Visual reference:** `docs/design/*.dc.html` (HTML mockups; read inline styles for exact values). App name in the UI is "Careerer", not "Tailor".
- **Generation rules and ATS context:** `docs/ats-research-report.md` (Part 7 is the LLM rule set). `docs/ats-field-notes.md` is background.
- **Sample profile for fixtures and testing:** `docs/sample-profile.txt`.

## Rules
- Truthfulness is a hard rule: generated documents may only use facts from the user's profile.
- LLM calls go through the local Claude Code CLI (`claude -p`), never the Anthropic API. Spawn it only from main, with tools disabled, in an empty temp dir, with user content on stdin.
- Keep the resume ATS-safe: one column, real text, standard headings, decoration in CSS only.
- Every feature must work in mock mode (`CAREERER_MOCK=1`) so it can be tested without a key.
- Before saying a task is done, run `npm run typecheck`, `npm test` and `npm run build`, and report the real results.
- Don't commit or push unless asked.
- Windows is the primary target; use cross-platform paths (`path.join`).

## Team workflow
A coordinator assigns work in phases to a coder agent, then an auditor agent reviews. Each phase ends with a short report in `docs/progress.md`: what was built, commands run and their results, known issues.
