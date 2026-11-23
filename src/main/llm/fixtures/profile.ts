import type { ParsedProfile } from '@shared/types'

/** Parse of docs/sample-profile.txt. Placeholders are kept verbatim, as the spec requires. */
export const MOCK_PARSED_PROFILE: ParsedProfile = {
  name: 'Deji Ojo',
  headline: 'Software Developer — Salesforce · React · PHP',
  location: 'Burnaby, BC',
  contacts: {
    email: 'deji2109@gmail.com',
    links: ['linkedin.com/in/deji-ojo', 'github.com/Dei-Gee', '[portfolio link]']
  },
  summary:
    'Full-stack developer with 4+ years building production features in Salesforce (Apex, SOQL, LWC), React and PHP. Shipped customer-facing features for a Salesforce AppExchange product, built inventory and analytics systems on the BigCommerce API, and worked directly with customers to resolve urgent production issues. Strong at turning messy data and slow queries into fast, usable tools.',
  skills: [
    { group: 'Salesforce', items: ['Apex', 'SOQL', 'Lightning Web Components (LWC)', 'customer org deployments'] },
    { group: 'Front end', items: ['JavaScript', 'React', 'HTML/CSS', 'CreateJS'] },
    { group: 'Back end', items: ['PHP', 'Laravel', 'Node.js (LoopBack)', 'REST APIs', 'SQL / relational databases'] },
    {
      group: 'Platforms & tools',
      items: ['Git', 'BigCommerce API', 'FTP/CSV data pipelines', '[3D tools, e.g. Blender / Unity]']
    }
  ],
  experience: [
    {
      title: 'Product Developer',
      company: 'Traction Complete',
      location: 'Vancouver, BC (Remote)',
      start: 'Jan 2022',
      end: 'Dec 2023',
      bullets: [
        'Used CreateJS to give users more control over their Assignment Flows [describe: e.g. visual editing of routing steps] and contributing to a 10% increase in customer retention.',
        'Designed and shipped time-zone support so admins and managers could schedule and route work across global teams [add: number of customers or users].',
        'Refactored SOQL queries to support lazy loading, cutting wait times on large searches from [X sec] to [Y sec].',
        'Joined live customer sessions to diagnose critical issues and deployed hotfixes directly to production Salesforce orgs.',
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
        'Built an in-house inventory manager in PHP that cleaned and simplified data from a complex relational database before syncing it to the storefront through the BigCommerce API.',
        'Developed an internal REST API and analytics dashboard in React and LoopBack, giving staff [what it let them see or decide, e.g. daily sales and stock levels in one place].',
        'Designed the UI for both tools end to end.'
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
        'Built an analytics dashboard in React that combined internal databases, supplier CSV files from FTP and 8 BigCommerce storefronts into one view.',
        'Maintained and patched legacy PHP systems.'
      ]
    },
    {
      title: '3D Set Designer (Part-time Contract)',
      company: 'NLT Media',
      location: 'Remote',
      start: 'Apr 2024',
      end: 'Present',
      bullets: [
        'Sole designer of 3D sets, levels and environments for indie games in active development, using [tools/engines].',
        'Member of the story group, contributing ideas on story direction and game mechanics during planning sessions.',
        'Beta test builds before release, reporting bugs and gameplay issues to the team.',
        '[Optional: number of environments/levels delivered.]'
      ]
    }
  ],
  projects: [
    {
      name: 'ACEA News',
      tech: 'MongoDB, Express, React, Node.js',
      link: 'github.com/Dei-Gee/acea-news',
      description: 'Full-stack MERN news web app; forked by 4 other developers. [One line: a feature you built or a technical problem you solved.]'
    },
    {
      name: 'BigCommerce Integration',
      tech: 'PHP, BigCommerce API',
      link: 'github.com/Dei-Gee/bigcommerce_integration',
      description: 'Starter project for managing a BigCommerce store through its API. [One line: what it handles, e.g. products, orders or inventory.]'
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
  certifications: [],
  strengths: [
    'Customer-facing: joined live customer sessions and deployed hotfixes directly to production Salesforce orgs',
    'Turns messy data and slow queries into fast, usable tools',
    'Combined internal databases, supplier CSV files and 8 BigCommerce storefronts into one view',
    'Works with design, QA, client success, customer success and marketing teams'
  ],
  trajectory:
    'Moved from PHP and React web work at Checkpoint One Apparel and Summit Tools into Salesforce development at Traction Complete, shipping customer-facing features for a Salesforce AppExchange product.'
}
