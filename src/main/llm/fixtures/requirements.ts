import type { Requirements } from '@shared/types'

export const MOCK_REQUIREMENTS: Requirements = {
  title: 'Salesforce Developer',
  company: 'Halcyon Health',
  location: 'Vancouver, BC (hybrid, Pacific time)',
  seniority: 'Mid-level (3+ years)',
  required: [
    'Apex',
    'SOQL',
    'Lightning Web Components (LWC)',
    'JavaScript',
    'React',
    'REST APIs',
    'Git'
  ],
  preferred: [
    'Salesforce Platform Developer I certification',
    'Health Cloud',
    'Node.js',
    'PHP',
    'CI/CD'
  ],
  repeatedTerms: ['Salesforce', 'Apex', 'SOQL', 'Lightning Web Components (LWC)', 'customer'],
  knockouts: ['Authorized to work in Canada', 'Based in British Columbia'],
  needs: [
    { requirement: 'Apex', level: 'must', intent: 'Write server-side Salesforce logic that ships weekly and holds up under daily clinic use.' },
    { requirement: 'SOQL', level: 'must', intent: 'Keep data-heavy pages and searches fast.' },
    { requirement: 'Lightning Web Components (LWC)', level: 'must', intent: 'Build the screens front-desk staff and clinicians use all day.' },
    { requirement: 'JavaScript', level: 'must', intent: 'Be productive in the front-end layer of the platform.' },
    { requirement: 'React', level: 'must', intent: 'Comfortable with a modern component framework, not tied to one stack.' },
    { requirement: 'REST APIs', level: 'must', intent: 'Move data between Halcyon and other systems reliably.' },
    { requirement: 'Git', level: 'must', intent: 'Work in a team using normal review and branching workflows.' },
    { requirement: 'Salesforce Platform Developer I certification', level: 'wishlist', intent: 'Evidence of solid Salesforce platform fundamentals.' },
    { requirement: 'Health Cloud', level: 'wishlist', intent: 'Ability to work with healthcare data and clinical workflows on Salesforce.' },
    { requirement: 'Node.js', level: 'wishlist', intent: 'Able to work on back ends outside Salesforce.' },
    { requirement: 'PHP', level: 'wishlist', intent: 'Able to work on back ends outside Salesforce.' },
    { requirement: 'CI/CD', level: 'wishlist', intent: 'Ship changes safely and often, with automated deployment of Salesforce changes.' }
  ],
  companyDetails: [
    'Halcyon Health builds scheduling and care-coordination software for independent clinics across Western Canada.',
    'The Salesforce-based platform is used every day by front-desk staff and clinicians, and changes ship weekly.',
    'Work happens in small cross-functional teams of developers, QA and customer success.'
  ]
}
