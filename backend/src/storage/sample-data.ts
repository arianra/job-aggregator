import { Job, Company, JobSource, Profile } from '@job-aggregator/shared'

/**
 * Sample data for testing and development
 */

export const sampleCompanies: Company[] = [
  {
    id: 'company-1',
    name: 'TechCorp',
    website: 'https://techcorp.example.com',
    industry: 'Technology',
    size: '1000-5000',
    location: { city: 'San Francisco', state: 'CA', country: 'USA' },
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'company-2',
    name: 'StartupXYZ',
    website: 'https://startupxyz.example.com',
    industry: 'AI/ML',
    size: '50-200',
    location: { city: 'New York', state: 'NY', country: 'USA' },
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'company-3',
    name: 'DataFlow Inc',
    website: 'https://dataflow.example.com',
    industry: 'Data Analytics',
    size: '200-1000',
    location: { city: 'Austin', state: 'TX', country: 'USA' },
    createdAt: new Date('2024-02-01'),
  },
]

export const sampleJobs: Job[] = [
  {
    id: 'job-1',
    title: 'Senior Software Engineer',
    description: 'We are looking for a senior software engineer to join our backend team.',
    requirements: [
      '5+ years of experience with Node.js',
      'Experience with PostgreSQL',
      'Strong TypeScript skills',
    ],
    company: sampleCompanies[0],
    location: 'San Francisco, CA',
    isRemote: true,
    salaryMin: 150000,
    salaryMax: 200000,
    tags: ['typescript', 'nodejs', 'postgresql', 'backend'],
    postedDate: new Date('2024-06-01'),
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-01'),
  },
  {
    id: 'job-2',
    title: 'Full Stack Developer',
    description: 'Join our fast-paced startup building the next generation of AI tools.',
    requirements: [
      '3+ years of full stack experience',
      'React and Node.js',
      'Experience with AI/ML is a plus',
    ],
    company: sampleCompanies[1],
    location: 'New York, NY',
    isRemote: false,
    salaryMin: 120000,
    salaryMax: 160000,
    tags: ['react', 'nodejs', 'fullstack', 'ai'],
    postedDate: new Date('2024-06-10'),
    createdAt: new Date('2024-06-10'),
    updatedAt: new Date('2024-06-10'),
  },
  {
    id: 'job-3',
    title: 'Data Engineer',
    description: 'Build and maintain our data pipeline infrastructure.',
    requirements: [
      'Experience with Python and SQL',
      'Knowledge of Apache Spark',
      'Cloud platform experience (AWS/GCP)',
    ],
    company: sampleCompanies[2],
    location: 'Austin, TX',
    isRemote: true,
    salaryMin: 130000,
    salaryMax: 170000,
    tags: ['python', 'sql', 'spark', 'aws', 'data'],
    postedDate: new Date('2024-06-15'),
    createdAt: new Date('2024-06-15'),
    updatedAt: new Date('2024-06-15'),
  },
]

export const sampleSources: JobSource[] = [
  {
    id: 'source-1',
    jobId: 'job-1',
    source: 'linkedin',
    externalId: 'linkedin-12345',
    url: 'https://linkedin.com/jobs/12345',
    scrapedAt: new Date('2024-06-01'),
    createdAt: new Date('2024-06-01'),
  },
  {
    id: 'source-2',
    jobId: 'job-1',
    source: 'indeed',
    externalId: 'indeed-abc123',
    url: 'https://indeed.com/jobs/abc123',
    scrapedAt: new Date('2024-06-02'),
    createdAt: new Date('2024-06-02'),
  },
  {
    id: 'source-3',
    jobId: 'job-2',
    source: 'linkedin',
    externalId: 'linkedin-67890',
    url: 'https://linkedin.com/jobs/67890',
    scrapedAt: new Date('2024-06-10'),
    createdAt: new Date('2024-06-10'),
  },
  {
    id: 'source-4',
    jobId: 'job-3',
    source: 'indeed',
    externalId: 'indeed-def456',
    url: 'https://indeed.com/jobs/def456',
    scrapedAt: new Date('2024-06-15'),
    createdAt: new Date('2024-06-15'),
  },
]

export const sampleProfile: Profile = {
  id: 'profile-1',
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '+1-555-0123',
  location: { city: 'San Francisco', state: 'CA', country: 'USA' },
  skills: [
    { name: 'TypeScript', level: 5, yearsExperience: 4 },
    { name: 'Node.js', level: 5, yearsExperience: 5 },
    { name: 'React', level: 4, yearsExperience: 3 },
    { name: 'PostgreSQL', level: 4, yearsExperience: 3 },
    { name: 'Python', level: 3, yearsExperience: 2 },
  ],
  experience: [
    {
      company: 'PreviousCorp',
      title: 'Software Engineer',
      startDate: new Date('2020-01-01'),
      endDate: new Date('2024-01-01'),
      description: 'Built scalable backend services using Node.js and TypeScript',
    },
  ],
  education: [
    {
      institution: 'State University',
      degree: 'BS Computer Science',
      field: 'Computer Science',
      graduationYear: 2019,
    },
  ],
  preferences: {
    remoteOk: true,
    relocationOk: false,
    minSalary: 140000,
    locations: ['San Francisco', 'Remote'],
  },
  createdAt: new Date('2024-06-01'),
  updatedAt: new Date('2024-06-01'),
}
