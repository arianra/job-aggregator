import { Job, Company, Source, Profile } from '@job-aggregator/shared'

/**
 * Sample data for testing and development
 */

export const sampleCompanies: Company[] = [
  {
    id: 'company-1',
    name: 'TechCorp',
    aliases: [],
    website: 'https://techcorp.example.com',
    careers_url: 'https://techcorp.example.com/careers',
    industry: 'Technology',
    size: '1000-5000',
    location: { city: 'San Francisco', state: 'CA', country: 'USA', remote: false },
    description: 'Leading technology company',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  },
  {
    id: 'company-2',
    name: 'StartupXYZ',
    aliases: [],
    website: 'https://startupxyz.example.com',
    careers_url: 'https://startupxyz.example.com/jobs',
    industry: 'AI/ML',
    size: '50-200',
    location: { city: 'New York', state: 'NY', country: 'USA', remote: false },
    description: 'AI-focused startup',
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-15'),
  },
  {
    id: 'company-3',
    name: 'DataFlow Inc',
    aliases: [],
    website: 'https://dataflow.example.com',
    careers_url: 'https://dataflow.example.com/positions',
    industry: 'Data Analytics',
    size: '200-1000',
    location: { city: 'Austin', state: 'TX', country: 'USA', remote: false },
    description: 'Data analytics platform',
    created_at: new Date('2024-02-01'),
    updated_at: new Date('2024-02-01'),
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
    location: { city: 'San Francisco', state: 'CA', country: 'USA', remote: true },
    salary_range: {
      min: 150000,
      max: 200000,
      currency: 'USD',
      period: 'annual'
    },
    job_type: 'full-time',
    seniority_level: 'senior',
    is_remote: true,
    posted_date: new Date('2024-06-01'),
    tags: ['typescript', 'nodejs', 'postgresql', 'backend'],
    sources: [],
    status: 'active',
    created_at: new Date('2024-06-01'),
    updated_at: new Date('2024-06-01'),
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
    location: { city: 'New York', state: 'NY', country: 'USA', remote: false },
    salary_range: {
      min: 120000,
      max: 160000,
      currency: 'USD',
      period: 'annual'
    },
    job_type: 'full-time',
    seniority_level: 'mid',
    is_remote: false,
    posted_date: new Date('2024-06-10'),
    tags: ['react', 'nodejs', 'fullstack', 'ai'],
    sources: [],
    status: 'active',
    created_at: new Date('2024-06-10'),
    updated_at: new Date('2024-06-10'),
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
    location: { city: 'Austin', state: 'TX', country: 'USA', remote: true },
    salary_range: {
      min: 130000,
      max: 170000,
      currency: 'USD',
      period: 'annual'
    },
    job_type: 'full-time',
    seniority_level: 'mid',
    is_remote: true,
    posted_date: new Date('2024-06-15'),
    tags: ['python', 'sql', 'spark', 'aws', 'data'],
    sources: [],
    status: 'active',
    created_at: new Date('2024-06-15'),
    updated_at: new Date('2024-06-15'),
  },
]

export const sampleSources: Source[] = [
  {
    id: 'source-1',
    job_id: 'job-1',
    board: 'linkedin',
    board_job_id: 'linkedin-12345',
    url: 'https://linkedin.com/jobs/12345',
    scraped_at: new Date('2024-06-01'),
    status: 'active',
  },
  {
    id: 'source-2',
    job_id: 'job-1',
    board: 'indeed',
    board_job_id: 'indeed-abc123',
    url: 'https://indeed.com/jobs/abc123',
    scraped_at: new Date('2024-06-02'),
    status: 'active',
  },
  {
    id: 'source-3',
    job_id: 'job-2',
    board: 'linkedin',
    board_job_id: 'linkedin-67890',
    url: 'https://linkedin.com/jobs/67890',
    scraped_at: new Date('2024-06-10'),
    status: 'active',
  },
  {
    id: 'source-4',
    job_id: 'job-3',
    board: 'indeed',
    board_job_id: 'indeed-def456',
    url: 'https://indeed.com/jobs/def456',
    scraped_at: new Date('2024-06-15'),
    status: 'active',
  },
]

export const sampleProfile: Profile = {
  id: 'profile-1',
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '+1-555-0123',
  location: { city: 'San Francisco', state: 'CA', country: 'USA', remote: false },
  skills: [
    { name: 'TypeScript', proficiency: 'expert', years: 4, category: 'language' },
    { name: 'Node.js', proficiency: 'expert', years: 5, category: 'framework' },
    { name: 'React', proficiency: 'advanced', years: 3, category: 'framework' },
    { name: 'PostgreSQL', proficiency: 'advanced', years: 3, category: 'database' },
    { name: 'Python', proficiency: 'intermediate', years: 2, category: 'language' },
  ],
  experience: [
    {
      company: 'PreviousCorp',
      title: 'Software Engineer',
      start_date: new Date('2020-01-01'),
      end_date: new Date('2024-01-01'),
      description: 'Built scalable backend services using Node.js and TypeScript',
      skills_used: ['TypeScript', 'Node.js', 'PostgreSQL'],
    },
  ],
  education: [
    {
      institution: 'State University',
      degree: 'BS Computer Science',
      field: 'Computer Science',
      graduation_year: 2019,
    },
  ],
  certifications: [],
  preferences: {
    locations: [
      { city: 'San Francisco', state: 'CA', country: 'USA', remote: false },
      { country: 'USA', remote: true }
    ],
    remote_ok: true,
    hybrid_ok: true,
    onsite_ok: true,
    job_types: ['full-time'],
    seniority_levels: ['mid', 'senior'],
    salary_min: 140000,
    currency: 'USD',
    keywords: ['backend', 'fullstack', 'typescript']
  },
  search_queries: [],
  resume: {
    filename: 'resume.pdf',
    mime_type: 'application/pdf',
    stored_path: '/tmp/resume.pdf'
  },
  created_at: new Date('2024-06-01'),
  updated_at: new Date('2024-06-01'),
}
