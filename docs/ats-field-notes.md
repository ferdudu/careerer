# ATS Field Notes: First-Hand Accounts

*Back-pocket material for the ATS research report. Collected 2026-11-22. Not yet merged into the main report.*

## How much to trust this

Real first-hand testimony is scarce. Most "insider" posts online are written or sponsored by companies selling resume tools or ATS software. Recruiters rarely post publicly about their own systems, and the best threads (Blind, Reddit) are often paywalled, deleted or anonymous. Every source below is graded:

- **A — named person, first-hand:** a named person describing what they personally do or saw. Identity not independently verified.
- **B — anonymous, first-hand:** first-hand but anonymous or unverifiable.
- **C — commentary or marketing:** useful for framing only, not as evidence.

---

## What practitioners say

### 1. A human, or a form question, does the rejecting
- **Jay Miller, CEO of the recruiting firm Uplink** (A, via ERE): every rejection is one of three things. A human viewed the application and rejected it, a knockout question disqualified it, or a human bulk-rejected it without viewing it. He also states plainly that "The ATS is not rejecting your resume."
- **A Fortune 500 recruiter, interviewed by Huntr** (B): candidates get filtered when they *accidentally* answer a screening question wrong, for example clicking that they're not authorized to work in the US.
- **An anonymous Reddit poster claiming to be a recruiter** (B, deleted post seen in an ERE screenshot): auto-reject criteria were set deliberately, which partly gave the team plausible deniability. In other words, auto-reject exists when a team switches it on, and it's a configuration choice, not a default.

**For the app:** the Review screen should show the knockout checklist (work authorization, location, years, certifications) *prominently* before export, with a note to answer those form questions carefully. That's where qualified people actually get cut.

### 2. Exact wording can still sink you
- **An anonymous Reddit tech lead and hiring manager** (B, via ERE): sent their own modified CV under a fake name to their own company's posting. It was auto-rejected almost instantly, and the cause was a keyword mismatch: the CV said "AngularJS" and the filter wanted "Angular".
- **Ted Staeb, recruiter at Microsoft** (A, interviewed by Huntr): described ATS keyword filters as "Boolean search with a better paint job".

**For the app:** this backs up the report's exact-term rule. Use the posting's spelling of each skill, and add the variant where it's the same thing (Angular / AngularJS, LWC / Lightning Web Components). The app's matched-terms list should compare against the posting's exact strings, not fuzzy matches.

### 3. Some recruiters read the resume itself, not the parsed profile
- **A Fortune 500 recruiter** (B, Huntr): doesn't use the parsed data at all. She reads the resume: the top first, then a scroll to the bottom, then companies, titles and tenure.
- **Blake Crosley, former VP of Product Design at ZipRecruiter** (A, self-stated): describes the typical flow as search, then filter, then a 6–10 second scan of the structured profile, and only sometimes opening the PDF. He gives no source for the timing.

**For the app:** both habits exist, so the document has to work both ways: clean parsing *and* a top third that sells the candidate in seconds. That supports the design choices so far: target title in the header, a summary that leads with the posting's top requirements, and recent relevant roles first.

### 4. Early applications win, because recruiters stop looking
- **Ted Staeb, Microsoft** (A): handles 30–50 open roles at a time, and six had 500+ applicants in under a week. Recruiters tend to stop once they have about five good candidates in the pipeline.

**For the app:** speed is a feature. The time from posting link to finished PDFs should be as short as possible, and the Library could show each posting's age so the user knows which applications are urgent.

### 5. Recruiters see every application you send them
- **A Fortune 500 recruiter** (B, Huntr): sees every role a candidate has applied to at her company. Fifteen applications to one company makes her "wonder why".

**For the app:** a useful guardrail. The Library can count applications per company and warn gently when the user has applied to several roles at the same employer. Tailoring each one makes mass-applying easier, and this tells the user when it starts to hurt them.

### 6. Layouts break parsers at scale
- **Blake Crosley, ex-ZipRecruiter** (A): at ZipRecruiter's scale they saw multi-column layouts, tables, text boxes, header and footer content and creative section headings cause parsing errors in "a significant percentage" of submissions.

**For the app:** first-hand support for keeping the resume template to one column with real text and standard headings. The teal band and color stripe are safe: the band holds plain text in reading order, and the stripe and markers contain no text.

---

## Sources

| Source | Grade | Notes |
|---|---|---|
| [Huntr — What recruiters actually do with your resume](https://huntr.co/blog/what-recruiters-actually-do-with-your-resume) (Apr 2026) | A/B | Best testimony found: interviews with named recruiters (Microsoft, Fortune 500, ex-Big Four) and some anonymous ones. Published by a company that sells job-seeker tools, with heavy product promotion. |
| [ERE — Who's rejecting?](https://ere.net/articles/whos-rejecting) (Oct 2024) | A/B | Recruiting trade publication. Relays Jay Miller's LinkedIn post and two anonymous Reddit accounts. |
| [Blake Crosley — ATS insider](https://blakecrosley.com/work/ats-insider) | A for ZipRecruiter parsing, C elsewhere | Former product design lead at a job marketplace, not a recruiter. Platform-specific claims are partly secondhand, and the page promotes ResumeGeni. |
| [Hiration — ATS auto-reject myth](https://www.hiration.com/blog/ats-auto-reject-resume-myth/) | C | Resume-builder blog. Unnamed sources and unsourced numbers. Useful only because it disputes the widely repeated "92% of recruiters" figure. |
| [ASA Central — Your AI recruiting tool is probably just Boolean search](https://asacentral.americanstaffing.net/blogs/tycho-de-saeytyd/2026/06/06/your-ai-recruiting-tool-is-probably-just-boolean-s) (Jun 2026) | C | Opinion piece by an ATS vendor. Argues that most "AI" ranking sits on top of a keyword filter. |
| [Blind — Can a recruiter explain how ATS works?](https://www.teamblind.com/post/can-a-recruiter-explain-how-ats-works-tcjokska) | — | Couldn't be read (paywalled). |

**Correction for the main report:** section 1 cites the "about 92% of recruiters say no auto-reject" figure from Enhancv's 25-recruiter survey. Hiration disputes it, and the sample is small. When merging, keep it as "a small, contested survey" or lean on the practitioner accounts above instead.

## Where to dig next
- r/recruiting and r/humanresources threads by verified flair-holders (search inside Reddit directly; search engines index few of them).
- Recruiter talks and podcasts (for example "Recruiting Future", "The Recruiting Brainfood" newsletter), which are often more candid than blogs.
- Greenhouse and Workday customer community forums, where admins discuss real auto-reject and knockout configurations.
