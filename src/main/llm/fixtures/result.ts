import type { StoredResult } from '@shared/types'

/**
 * Mock output for the Halcyon Health posting. Every fact comes from
 * docs/sample-profile.txt; sentences that depended on placeholders were
 * rewritten without them and listed under report.missingInfo.
 */
export const MOCK_RESULT: StoredResult = {
  resume: {
    headline: 'Salesforce Developer',
    summary:
      'Salesforce Developer with 4+ years building production features in Apex, SOQL and Lightning Web Components (LWC), alongside React and PHP. Shipped customer-facing features for a Salesforce AppExchange product, deployed hotfixes directly to production Salesforce orgs during live customer sessions, and turned slow queries and messy data into fast, usable tools.',
    skills: [
      { group: 'Salesforce', items: ['Apex', 'SOQL', 'Lightning Web Components (LWC)', 'customer org deployments'] },
      { group: 'Languages & front end', items: ['JavaScript', 'React', 'HTML/CSS', 'CreateJS'] },
      { group: 'Back end', items: ['REST APIs', 'PHP', 'Laravel', 'Node.js (LoopBack)', 'SQL / relational databases'] },
      { group: 'Tools', items: ['Git', 'BigCommerce API', 'FTP/CSV data pipelines'] }
    ],
    experience: [
      {
        title: '3D Set Designer (Part-time Contract)',
        company: 'NLT Media',
        location: 'Remote',
        start: 'Apr 2024',
        end: 'Present',
        bullets: [
          'Sole designer of 3D sets, levels and environments for indie games in active development; beta test builds and report bugs and gameplay issues to the team before release.'
        ]
      },
      {
        title: 'Product Developer',
        company: 'Traction Complete',
        location: 'Vancouver, BC (Remote)',
        start: 'Jan 2022',
        end: 'Dec 2023',
        bullets: [
          'Refactored SOQL queries to support lazy loading, speeding up large searches in a Salesforce AppExchange product.',
          'Joined live customer sessions to diagnose critical issues and deployed hotfixes directly to production Salesforce orgs.',
          'Used CreateJS to give users more control over their Assignment Flows, contributing to a 10% increase in customer retention.',
          'Designed and shipped time-zone support so admins and managers could schedule and route work across global teams.',
          'Worked with design, QA, client success, customer success and marketing teams to build, test and launch new features and redesign existing UI.'
        ]
      },
      {
        title: 'Web Developer',
        company: 'Summit Tools',
        location: 'Vancouver, BC',
        start: 'Jan 2021',
        end: 'Dec 2021',
        bullets: [
          'Developed an internal REST API and analytics dashboard in React and LoopBack, and designed the UI for both tools end to end.',
          'Built an in-house inventory manager in PHP that cleaned and simplified data from a complex relational database before syncing it to the storefront through the BigCommerce API.'
        ]
      },
      {
        title: 'Web Developer (Contract)',
        company: 'Checkpoint One Apparel',
        location: 'Vancouver, BC',
        start: 'Sep 2019',
        end: 'Dec 2019',
        bullets: [
          'Upgraded the inventory management system, cutting double-booked items by 50%.',
          'Built a React analytics dashboard that combined internal databases, supplier CSV files from FTP and 8 BigCommerce storefronts into one view.',
          'Maintained and patched legacy PHP systems.'
        ]
      }
    ],
    projects: [
      {
        name: 'ACEA News',
        tech: 'MongoDB, Express, React, Node.js',
        link: 'github.com/Dei-Gee/acea-news',
        description: 'Full-stack MERN news web app; forked by 4 other developers.'
      }
    ],
    education: [
      {
        credential: 'Diploma in Computing Studies & Information Systems',
        school: 'Douglas College',
        location: 'New Westminster, BC',
        year: '2020'
      }
    ],
    certifications: []
  },
  coverLetter: {
    greeting: 'Dear Hiring Team,',
    paragraphs: [
      'Halcyon Health is looking for a Salesforce Developer who can build in Apex, SOQL and Lightning Web Components (LWC) and work close to the people who use the platform every day. That is the work I have done for the past four years. Your platform serves front-desk staff and clinicians at independent clinics across Western Canada and ships changes weekly, and that pairing of daily users with a steady release rhythm is why this role stands out to me.',
      'At Traction Complete I built customer-facing features for a Salesforce AppExchange product. I refactored SOQL queries to support lazy loading so large searches stopped stalling, used CreateJS to give users more control over their Assignment Flows, which contributed to a 10% increase in customer retention, and shipped time-zone support so admins and managers could schedule and route work across global teams. When something broke for a customer, I joined the live session, diagnosed the cause and deployed the hotfix directly to their production Salesforce org. Shipping hotfixes straight to production orgs and managing customer org deployments is the release discipline that CI/CD for Salesforce builds on.',
      'Before that, I built REST APIs, React dashboards and PHP data tools that pulled messy sources, including relational databases, supplier CSV files and eight BigCommerce storefronts, into one reliable view, and I cut double-booked inventory by 50%. I also worked with design, QA, customer success and marketing teams to build, test and launch features, which matches the small cross-functional teams you describe. That path, from PHP and React work at Checkpoint One Apparel and Summit Tools into Apex, SOQL and Lightning Web Components at Traction Complete, is how I work: pick up the stack the job needs and ship real features in it. I would bring that same approach to Health Cloud, building on the customer-facing Salesforce work I have already shipped.',
      'I am based in Burnaby, BC, and I would welcome the chance to talk about how I could help your team. Thank you for your time.'
    ],
    closing: 'Sincerely,',
    signature: 'Deji Ojo'
  },
  report: {
    matched: [
      { term: 'Apex', count: 3, where: ['summary', 'skills', 'cover letter'] },
      { term: 'SOQL', count: 5, where: ['summary', 'skills', 'experience', 'cover letter'] },
      { term: 'Lightning Web Components (LWC)', count: 3, where: ['summary', 'skills', 'cover letter'] },
      { term: 'JavaScript', count: 1, where: ['skills'] },
      { term: 'React', count: 6, where: ['summary', 'skills', 'experience', 'projects', 'cover letter'] },
      { term: 'REST APIs', count: 3, where: ['skills', 'experience', 'cover letter'] },
      { term: 'Git', count: 1, where: ['skills'] },
      { term: 'Node.js', count: 2, where: ['skills', 'projects'] },
      { term: 'PHP', count: 6, where: ['summary', 'skills', 'experience', 'projects', 'cover letter'] },
      { term: 'CI/CD', count: 1, where: ['cover letter'] },
      { term: 'Health Cloud', count: 1, where: ['cover letter'] }
    ],
    missingInfo: [
      'Traction Complete: how much faster large searches got after the lazy-loading refactor (the profile leaves the before and after times blank).',
      'Traction Complete: how many customers or users the time-zone support reached.',
      'Summit Tools: what the analytics dashboard let staff see or decide.',
      'NLT Media: which 3D tools or engines you used, and how many environments or levels you delivered.',
      'ACEA News and BigCommerce Integration: one line each on a feature you built or what the project handles.',
      'Your portfolio link.'
    ],
    knockoutFlags: [
      'Authorized to work in Canada: confirm on the application form; your profile does not say.',
      'Based in British Columbia: met (Burnaby, BC).'
    ],
    changes: [
      'Used the posting title "Salesforce Developer" as the headline; your real job titles are unchanged in Experience.',
      'Moved Salesforce skills first and wrote Lightning Web Components (LWC) in the posting form.',
      'Reordered Traction Complete bullets so SOQL and hotfix work come first.',
      'Removed sentences and skills that depended on placeholders instead of guessing at them.',
      'Merged the NLT Media bullets into one, since the role is not central to this posting.',
      'Left out the BigCommerce Integration starter project to keep the resume to one page.',
      'Framed the hotfix and customer org deployment work as release experience that carries over to CI/CD, and showed the PHP and React to Salesforce path as a record of ramping up quickly.'
    ],
    bridges: [
      { requirement: 'Apex', approach: 'direct', evidence: 'Apex, SOQL, Lightning Web Components (LWC)', whereUsed: ['summary', 'skills', 'cover letter'] },
      { requirement: 'SOQL', approach: 'direct', evidence: 'Refactored SOQL queries to support lazy loading', whereUsed: ['summary', 'experience', 'cover letter'] },
      { requirement: 'Lightning Web Components (LWC)', approach: 'direct', evidence: 'Apex, SOQL, Lightning Web Components (LWC)', whereUsed: ['summary', 'skills', 'cover letter'] },
      { requirement: 'JavaScript', approach: 'direct', evidence: 'JavaScript, React, HTML/CSS, CreateJS', whereUsed: ['skills'] },
      { requirement: 'React', approach: 'direct', evidence: 'Built an analytics dashboard in React', whereUsed: ['summary', 'skills', 'experience', 'cover letter'] },
      { requirement: 'REST APIs', approach: 'direct', evidence: 'Developed an internal REST API and analytics dashboard in React and LoopBack', whereUsed: ['skills', 'experience', 'cover letter'] },
      { requirement: 'Git', approach: 'direct', evidence: 'Git, BigCommerce API, FTP/CSV data pipelines', whereUsed: ['skills'] },
      { requirement: 'Node.js', approach: 'direct', evidence: 'Node.js (LoopBack)', whereUsed: ['skills', 'projects'] },
      { requirement: 'PHP', approach: 'direct', evidence: 'Built an in-house inventory manager in PHP', whereUsed: ['summary', 'skills', 'experience'] },
      { requirement: 'CI/CD', approach: 'transferable', evidence: 'deployed hotfixes directly to production Salesforce orgs', whereUsed: ['experience', 'cover letter'] },
      { requirement: 'Health Cloud', approach: 'trajectory', evidence: 'Shipped customer-facing features for a Salesforce AppExchange product', whereUsed: ['cover letter'] }
    ],
    stretch: ['Salesforce Platform Developer I certification']
  }
}

/**
 * Long variant (CAREERER_MOCK=long): restores profile bullets and the second project that the
 * standard fixture trims, so the resume overflows one page and exercises the two-page path.
 * Still only facts from docs/sample-profile.txt.
 */
export const MOCK_RESULT_LONG: StoredResult = (() => {
  const r = structuredClone(MOCK_RESULT)
  const byCompany = (c: string) => r.resume.experience.find((e) => e.company === c)!
  byCompany('NLT Media').bullets = [
    'Sole designer of 3D sets, levels and environments for indie games in active development.',
    'Member of the story group, contributing ideas on story direction and game mechanics during planning sessions.',
    'Beta test builds before release, reporting bugs and gameplay issues to the team.'
  ]
  byCompany('Summit Tools').bullets.push('Designed the UI for both tools end to end.')
  r.resume.projects.push({
    name: 'BigCommerce Integration',
    tech: 'PHP, BigCommerce API',
    link: 'github.com/Dei-Gee/bigcommerce_integration',
    description: 'Starter project for managing a BigCommerce store through its API.'
  })
  r.resume.skills.push({ group: 'Front end', items: ['JavaScript', 'React', 'HTML/CSS', 'CreateJS'] })
  r.report.changes = r.report.changes.filter((c) => !c.includes('BigCommerce Integration'))
  return r
})()
