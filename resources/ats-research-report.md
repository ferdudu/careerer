# ATS Research Report: How the Top Applicant Tracking Systems Read and Rank Resumes

*Compiled 2026-11-22. Written to be read by people and to be loaded as standing context for the app's generation step. Part 7 is the rule set the LLM follows.*

---

## 1. Summary

- **The top three by reach are Workday, Greenhouse and iCIMS.** Workday leads at large enterprises, Greenhouse leads at tech and growth companies, and iCIMS is the other big enterprise system. Lever, Ashby, SAP SuccessFactors and Oracle Taleo cover most of the rest.
- **ATS rarely reject resumes automatically on content.** In a small 2025 recruiter survey, about 92% said their system does not auto-reject on formatting, missing keywords or a low match score. The common automatic filters are **knockout questions** (work authorization, location, minimum years, required certifications), which the application form asks, not the resume.
- **What the resume controls is how it is parsed, searched and ranked.** Recruiters filter and search parsed data with keywords, often exact-match, and a growing number of systems also rank candidates with AI "fit" scores. A resume must parse cleanly, contain the posting's exact terms where they are true, and read well to the person who opens the PDF.
- **Volume is the real filter.** Many recruiters stop reviewing after a few hundred strong applicants. A clean, specific, well-matched resume that gets read in the first pass wins over a keyword-stuffed one.

## 2. Market share (which systems to optimize for)

The numbers depend on which companies are counted, so treat them as ranges.

| Sample | Leader | Then |
|---|---|---|
| Fortune 500 (Jobscan, 2026) | Workday, over 40% | SAP SuccessFactors ~12% |
| 13,130 companies (Jobscan, 2026) | Greenhouse 19.0% | Workday 17.5%, Lever 15.6%, iCIMS 14.4% |
| 1.7M job postings (Huntr, Dec 2025) | Greenhouse 30.6% | Workday 19.6%, Ashby 10.7%, iCIMS 7.4%, Lever 6.2% |
| 3,222 top-rated employers (ResumeGeni, 2026) | Greenhouse 49.0% | Workday 21.8%, Lever 8.0% |

**Practical rule:** a resume that parses cleanly in Workday, Greenhouse and iCIMS will parse in nearly anything. Their common requirements are what the app optimizes for.

## 3. The three systems

### Workday Recruiting
- **Where:** most large enterprises, banks, retailers, healthcare, government.
- **Parsing:** auto-fills application fields from the uploaded resume, and the candidate reviews them. Per Workday's admin guide, parsing does **not** fill the Skills or Languages fields, so candidates usually type skills into the form separately.
- **Search and ranking:** recruiters filter by fields such as years of experience and certifications. The HiredScore add-on (now part of Workday) adds AI ranking and keyword search across the original resume text.
- **What it means for the resume:** standard section headings and clear job entries (title, company, dates on predictable lines) so the auto-filled work history comes out right. The candidate should check the auto-filled fields before submitting.

### Greenhouse
- **Where:** tech companies, startups and scale-ups. The most common ATS in current job postings.
- **Parsing:** reads text in flow order, top to bottom. Sidebars and columns get merged into stray paragraphs. Text-based PDFs parse reliably, while scanned or image PDFs don't. Greenhouse has reported problems parsing very large files, so keep exports small (well under 2 MB).
- **Search:** full-text keyword search, Boolean where enabled. It is **literal, not semantic**: a recruiter searching "Kubernetes" won't find a resume that only says "container orchestration".
- **Human review:** Greenhouse recruiters are more likely than most to open the actual PDF, so the visual design still counts.

### iCIMS
- **Where:** large enterprises, retail, healthcare, staffing.
- **Parsing:** reads left to right, top to bottom. Tables and multi-column layouts are the most common failure, for example dates in a second column getting attached to the wrong employer. Sections merge when headings are nonstandard or have no space between them, and nonstandard headings ("Where I've Been") can send content into an unstructured catch-all field.
- **Contact info:** details placed only in the page header or footer, or in text boxes, may be skipped.
- **What it means for the resume:** one column, standard headings with clear space above each, contact details in the body text.

### Others, briefly
- **Lever / Ashby:** modern parsers similar to Greenhouse. Same rules apply.
- **Oracle Taleo / SAP SuccessFactors:** older, stricter parsers. Plain layouts and standard date formats matter most here.

## 4. Parsing rules: what breaks and what's safe

| Do | Don't |
|---|---|
| One column, reading order matching visual order | Two-column layouts or sidebars holding experience, skills or dates |
| Real, selectable text (HTML → PDF is ideal) | Scanned PDFs, text inside images, text converted to outlines |
| Standard headings: Summary, Experience, Skills, Projects, Education, Certifications | Creative headings ("My Journey", "Toolbox") |
| Contact details in the main body near the top | Contact details only in the page header or footer, or in a text box |
| Each job as Title, Company, Location, Dates on consistent lines | Tables used for layout |
| Dates as `Jan 2022 – Dec 2023` or `01/2022 – 12/2023`, one format throughout | Mixed formats, seasons ("Summer 2021"), dates only as icons or bars |
| Simple bullets (•, –) | Icons, skill-level bars, star ratings, charts, emoji |
| Standard fonts embedded in the PDF | Ligatures or custom glyphs that extract as garbage |
| File name like `Firstname-Lastname-Resume.pdf` | `resume_final_v7.pdf` |
| Small file size (well under 2 MB) | Embedded high-res images or background art |

**Design latitude that is safe:** typeface pairing, size and weight hierarchy, generous whitespace, thin rules between sections, a single accent color on headings or names, small caps or letter-spaced headings. Anything that changes how it *looks* without changing the reading order is fine.

**About dark designs:** a dark page background doesn't affect parsing as long as the text is real text, but recruiters print resumes and many PDF viewers and ATS previews render them poorly. The safe approach is to export on a white or warm off-white page and carry the "dark elegant" look through near-black type, a deep accent and refined typography. A dark variant can exist for on-screen portfolios, not for applications.

**Self-check the app can automate:** extract the text from the generated PDF and confirm (1) the reading order matches the layout, (2) the email and phone appear intact, (3) every section heading appears once, in order, and (4) each job's dates sit next to the right employer.

## 5. Keywords and ranking

**How matching works in practice**
1. **Recruiter keyword search** (all systems): literal and often Boolean. Exact terms from the posting count.
2. **AI fit scores and ranking** (HiredScore in Workday, Greenhouse's matching, Eightfold and others): more semantic, skills-based and tied to context. Keyword stuffing doesn't help, but clear evidence of skills in context does.
3. **The human read:** typically a few seconds on the top third of page one, then a closer read if that holds up.

**Rules that serve all three**
- **Mirror the posting's exact wording** for skills, tools and certifications the candidate actually has: "Lightning Web Components (LWC)", not just "Salesforce front end".
- **Use both forms of an acronym once:** "Lightning Web Components (LWC)", "Continuous Integration (CI/CD)". After that the short form is fine.
- **Match the job title where honest.** If the posting says "Salesforce Developer" and the candidate did that work as "Product Developer", the summary or headline can say "Salesforce Developer", but the employer's real title stays in the Experience entry.
- **Put key skills in bullets, not only in the Skills list.** AI ranking weighs skills that appear alongside an outcome ("Refactored SOQL queries for lazy loading, cutting search wait times by 60%") much more than a bare list.
- **Front-load the requirements.** The top 3–5 required skills in the posting should appear in the summary and in the first bullets of the most relevant role.
- **Keep keyword density natural.** Each key term 2–3 times across the resume (summary, skills, one or two bullets) is plenty. Repetition beyond that reads as stuffing to people and adds little to AI ranking.
- **Quantify.** Numbers (%, $, time saved, users, scale) are the strongest signal for both people and AI rankers.
- **Cover hard requirements explicitly.** If the posting asks for "4+ years" or a specific degree or certification, state it in words a filter can match ("4+ years of Salesforce development").

**Where keywords come from (priority order)**
1. Required qualifications in the posting
2. Repeated terms in the posting (mentioned 2 or more times)
3. Preferred or "nice to have" qualifications
4. The posting's job title and seniority words
5. Standard industry terms for the same skills (only where they truthfully apply)

## 6. Cover letters

- Many systems store cover letters but don't parse them into fields. Some recruiters skip them entirely, and others read them closely for borderline candidates. They are worth writing well, but they're secondary.
- **Format:** plain single-column letter, text-based PDF, the same header (name and contact) as the resume for a matched set.
- **Length:** 250–400 words, 3–4 short paragraphs.
- **Structure:**
  1. A hook naming the role and company, plus one specific reason for this company (taken from the posting or company context, never generic).
  2. The candidate's strongest 1–2 proof points mapped to the posting's top requirements, with numbers.
  3. A secondary fit point: a domain, tool, team style or customer-facing experience the posting mentions.
  4. A short close asking for the conversation.
- Use the posting's key terms naturally. Avoid clichés ("I am writing to express my interest…", "passionate team player", "I believe I would be a great fit").

## 7. Generation rules for the LLM

Follow these on every generation.

**Truthfulness (overrides everything else)**
1. Use only facts in the candidate profile. Never invent employers, titles, dates, degrees, certifications, tools, metrics or responsibilities.
2. You may reword, reorder, merge, trim and emphasize. You may rename a skill to the posting's exact term only when it is the same thing (for example "LWC" → "Lightning Web Components (LWC)").
3. Advocate for the candidate: treat the posting as a wishlist and, for every requirement, find the strongest true bridge in the profile (a direct match, a transferable or adjacent skill, the same outcome with a different tool, domain overlap, scale, customer-facing work, or a record of learning new stacks quickly). Describe the candidate's real work in the posting's vocabulary wherever that is honest, and never write that the candidate lacks something. But never claim a skill, certification, tool, title, employer, metric or date the profile doesn't support: framing yes, fabrication no. A requirement with no honest bridge is left out of the documents and listed in `stretch` as a private note to the user.
4. Leave placeholders in the profile (text in square brackets, such as `[X sec]`) out of the output, and list them in `missing_info` so the user can fill them in.
5. Keep employer job titles as given. Retitling is only allowed in the headline or summary.

**Structure and format**
6. Sections in this order: Header (name, target title, location, email, phone, links), Summary, Skills, Experience, Projects (if relevant), Education, Certifications (if any).
7. Use the standard section names exactly.
8. Each role: Title — Company, Location · Dates (`Mon YYYY – Mon YYYY`, or `Present`), then 3–5 bullets for recent or relevant roles, 1–3 for older or less relevant ones.
9. Each bullet: strong past-tense verb (present tense for current roles), what was done, the tools used, and the result with a number where the profile gives one. Keep bullets to one or two lines.
10. Aim for 1 page under 5 years of experience and 2 pages at most otherwise. Cut the least relevant content first.
11. Output plain structured data (for example JSON matching the app's resume schema) for the template to render. Don't output layout, styling or markdown tables.

**Tailoring**
12. Extract from the posting: job title, seniority, required skills, preferred skills, repeated terms, domain and industry, and 3 company-specific details for the cover letter.
13. Rewrite the Summary (3–4 lines) to lead with the posting's title and its top 3 matching requirements, stating years of experience where they meet a stated requirement.
14. Reorder Skills so matched posting terms come first, grouped by category, using the posting's spelling.
15. Reorder bullets within each role so the most relevant come first. Drop bullets that are irrelevant to this posting when space is tight.
16. Each required skill the candidate has should appear in the summary or skills **and** in at least one experience bullet.
17. No keyword stuffing: at most about 3 mentions of any term. No hidden or white text, no keyword blocks.

**Cover letter**
18. Follow Part 6. Name the company and role. Use only real proof points from the profile. 250–400 words.

**Return alongside the documents**
- `matched_keywords`: posting terms used and where they appear
- `bridges`: for each requirement with an honest bridge, `{requirement, approach: direct|transferable|trajectory, evidence (a quote from the profile), whereUsed}`; write each bridge with the posting's keywords so it is also a keyword hit
- `stretch`: requirements with no honest bridge, as a private note to the user (never used in the documents)
- `missing_info`: placeholders or vague items the user should fill in to strengthen the result
- `knockout_flags`: hard requirements (authorization, location, years, certifications) the user should check against the application form

## 8. Confidence and sources

None of these vendors publishes a full parser specification. Most detailed guidance comes from resume-tool companies and career blogs, which have a commercial angle. The rules above are the ones multiple independent sources agree on, plus vendor documentation where it exists. Market share figures depend on the sample. The recruiter survey (Enhancv, 25 recruiters) is small and run by a resume company, so treat it as directional.

- [Jobscan — 2026 ATS Usage Report](https://www.jobscan.co/blog/fortune-500-use-applicant-tracking-systems/)
- [Huntr — How Applicant Tracking Systems Actually Work in 2026](https://api.huntr.co/blog/how-applicant-tracking-systems-work)
- [ResumeGeni — ATS Market Share 2026](https://resumegeni.com/research/ats-market-share-2026)
- [WithResumeAI — State of ATS 2026](https://withresumeai.com/reports/state-of-ats-2026)
- [Pin — 2026 ATS Market Share Report](https://www.pin.com/blog/ats-market-share-report/)
- [Workday Admin Guide — Set Up Prospects and Candidates (resume parsing)](https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/set-up-prospects-and-candidates/hdc1552497830785.html)
- [Workday HiredScore — Candidate Profiles](https://doc.workday.com/hiredscore/en-us/workday-hiredscore/recruiter-productivity-/concept--candidate-profiles.html)
- [Greenhouse Support — Unsuccessful resume parse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse)
- [Greenhouse — Best AI recruiting software in 2026](https://www.greenhouse.com/blog/best-ai-recruiting-software)
- [ResumeGeni — Greenhouse ATS Resume Guide](https://resumegeni.com/blog/greenhouse-ats-resume-guide)
- [ResumeGeni — iCIMS ATS Resume Guide](https://resumegeni.com/blog/icims-ats-resume-guide)
- [Hireflow — iCIMS parsing: keeping sections from merging](https://hireflow.net/blog/icims-parsing-how-to-keep-sections-from-merging-us)
- [Textkernel — Improving extraction from column resumes](https://textkernel.com/learn-support/blog/improving-extraction-from-column-resumes)
- [Santa Clara University Career Center — Common ATS formatting mistakes](https://scu.edu/careercenter/toolkit/job-scan-common-ats-resume-formatting-mistakes)
- [Enhancv — Does ATS reject resumes?](https://enhancv.com/blog/does-ats-reject-resumes/)
- [ClearanceJobs — Recruiters reveal ATS doesn't kill your resume, volume does](https://news.clearancejobs.com/2026/07/29/recruiters-reveal-ats-doesnt-kill-your-resume-its-overwhelming-volume/)
- [G2 — Workday HiredScore AI for Recruiting](https://www.g2.com/products/workday-hiredscore-ai-for-recruiting/features)
