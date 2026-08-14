# Database Schema Documentation

## Overview

This document explains the PostgreSQL database schema used by Prisma ORM.

---

## Entity Relationship Diagram

```
┌─────────────┐         ┌─────────────┐
│   Company   │         │     Job     │
├─────────────┤         ├─────────────┤
│ id (PK)     │◄────────│ companyId   │
│ name        │         │ id (PK)     │
│ description │         │ title       │
│ website     │         │ description │
│ industry    │         │ location    │
│ size        │         │ salaryMin   │
│ createdAt   │         │ salaryMax   │
│ updatedAt   │         │ remote      │
└─────────────┘         │ tags        │
                        │ postedDate  │
                        │ createdAt   │
                        │ updatedAt   │
                        └──────┬──────┘
                               │
                               │ 1:N
                               │
                        ┌──────┴──────┐
                        │   Source    │
                        ├─────────────┤
                        │ id (PK)     │
                        │ jobId (FK)  │
                        │ board       │
                        │ externalId  │
                        │ url         │
                        │ scrapedAt   │
                        └─────────────┘
```

---

## Table Definitions

### 1. Company

Stores information about companies posting jobs.

```prisma
model Company {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  website     String?
  industry    String?
  size        String?  // "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"

  jobs        Job[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Fields:**

- `id` - Unique identifier (CUID format)
- `name` - Company name (unique, prevents duplicates)
- `description` - Optional company description
- `website` - Company website URL
- `industry` - Industry sector (e.g., "Technology", "Finance")
- `size` - Company size range
- `jobs` - Relationship to all jobs posted by this company
- `createdAt/updatedAt` - Timestamps

**Example:**

```json
{
  "id": "clx123abc",
  "name": "Acme Corp",
  "description": "Leading provider of widgets",
  "website": "https://acme.com",
  "industry": "Manufacturing",
  "size": "501-1000"
}
```

---

### 2. Job

Core entity representing a job posting.

```prisma
model Job {
  id          String   @id @default(cuid())

  // Job details
  title       String
  description String
  location    String   // "San Francisco, CA" or "Remote"
  salaryMin   Int?     // Minimum salary in USD
  salaryMax   Int?     // Maximum salary in USD
  remote      Boolean  @default(false)
  tags        String[] // ["react", "typescript", "node"]
  postedDate  DateTime?

  // Relationships
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  sources     Source[]

  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Indexes for performance
  @@index([title])
  @@index([location])
  @@index([remote])
  @@index([postedDate])
  @@index([companyId])
}
```

**Fields:**

- `id` - Unique job identifier
- `title` - Job title (e.g., "Senior Software Engineer")
- `description` - Full job description (markdown/plain text)
- `location` - Job location or "Remote"
- `salaryMin/salaryMax` - Salary range in USD (nullable)
- `remote` - Whether job is remote-friendly
- `tags` - Array of skills/technologies
- `postedDate` - When job was originally posted
- `companyId` - Foreign key to Company
- `sources` - All job boards where this job was found
- `createdAt/updatedAt` - Timestamps

**Indexes:**

- `title` - Fast search by job title
- `location` - Filter by location
- `remote` - Filter remote jobs
- `postedDate` - Sort by recency
- `companyId` - Fast lookup by company

**Example:**

```json
{
  "id": "clx456def",
  "title": "Senior React Developer",
  "description": "We're looking for an experienced React developer...",
  "location": "San Francisco, CA",
  "salaryMin": 150000,
  "salaryMax": 200000,
  "remote": true,
  "tags": ["react", "typescript", "graphql"],
  "postedDate": "2024-01-15T00:00:00Z",
  "companyId": "clx123abc"
}
```

---

### 3. Source

Tracks where each job was found (Indeed, LinkedIn, etc.).

```prisma
model Source {
  id          String   @id @default(cuid())

  // Source details
  board       String   // "indeed", "linkedin"
  externalId  String   // Job ID on the board
  url         String   // Direct link to job posting
  scrapedAt   DateTime @default(now())

  // Relationship
  jobId       String
  job         Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)

  // Unique constraint
  @@unique([board, externalId])

  // Indexes
  @@index([jobId])
  @@index([board])
}
```

**Fields:**

- `id` - Unique source identifier
- `board` - Job board name (e.g., "indeed", "linkedin")
- `externalId` - Job ID on that board (e.g., Indeed's job key)
- `url` - Direct link to job posting on the board
- `scrapedAt` - When we scraped this job
- `jobId` - Foreign key to Job
- `@@unique([board, externalId])` - Prevents duplicate sources

**Why This Design?**

One job can appear on multiple boards. This table tracks all sources:

```
Job: "Senior React Developer at Acme Corp"
  ├── Source: Indeed (ID: abc123, URL: indeed.com/viewjob?jk=abc123)
  ├── Source: LinkedIn (ID: 456789, URL: linkedin.com/jobs/view/456789)
  └── Source: Glassdoor (ID: xyz789, URL: glassdoor.com/job/xyz789)
```

**Example:**

```json
{
  "id": "clx789ghi",
  "board": "indeed",
  "externalId": "abc123def456",
  "url": "https://www.indeed.com/viewjob?jk=abc123def456",
  "scrapedAt": "2024-01-20T10:30:00Z",
  "jobId": "clx456def"
}
```

---

## Prisma Schema File

**File:** `backend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Company {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  website     String?
  industry    String?
  size        String?

  jobs        Job[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Job {
  id          String   @id @default(cuid())
  title       String
  description String
  location    String
  salaryMin   Int?
  salaryMax   Int?
  remote      Boolean  @default(false)
  tags        String[]
  postedDate  DateTime?

  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  sources     Source[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([title])
  @@index([location])
  @@index([remote])
  @@index([postedDate])
  @@index([companyId])
}

model Source {
  id          String   @id @default(cuid())
  board       String
  externalId  String
  url         String
  scrapedAt   DateTime @default(now())

  jobId       String
  job         Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@unique([board, externalId])
  @@index([jobId])
  @@index([board])
}
```

---

## Common Queries

### 1. Get All Jobs with Company Info

```typescript
const jobs = await prisma.job.findMany({
  include: {
    company: true,
    sources: true,
  },
})
```

**Generated SQL:**

```sql
SELECT
  j.*,
  c.name as company_name,
  c.website as company_website
FROM Job j
LEFT JOIN Company c ON j.companyId = c.id
```

---

### 2. Filter Jobs by Criteria

```typescript
const jobs = await prisma.job.findMany({
  where: {
    title: { contains: 'react', mode: 'insensitive' },
    location: 'San Francisco, CA',
    remote: true,
    salaryMin: { gte: 100000 },
  },
  orderBy: {
    postedDate: 'desc',
  },
  take: 50,
})
```

**Generated SQL:**

```sql
SELECT * FROM Job
WHERE
  title ILIKE '%react%'
  AND location = 'San Francisco, CA'
  AND remote = true
  AND salaryMin >= 100000
ORDER BY postedDate DESC
LIMIT 50
```

---

### 3. Count Jobs by Board

```typescript
const counts = await prisma.source.groupBy({
  by: ['board'],
  _count: {
    board: true,
  },
})
```

**Result:**

```json
[
  { "board": "indeed", "_count": { "board": 150 } },
  { "board": "linkedin", "_count": { "board": 89 } }
]
```

---

### 4. Find Duplicate Jobs

Jobs that appear on multiple boards:

```typescript
const duplicates = await prisma.job.findMany({
  where: {
    sources: {
      some: {}, // Has at least one source
    },
  },
  include: {
    sources: true,
    company: true,
  },
  orderBy: {
    sources: {
      _count: 'desc',
    },
  },
})
```

---

### 5. Upsert Company (Create or Update)

```typescript
const company = await prisma.company.upsert({
  where: { name: 'Acme Corp' },
  update: {
    website: 'https://acme.com',
    industry: 'Technology',
  },
  create: {
    name: 'Acme Corp',
    website: 'https://acme.com',
    industry: 'Technology',
  },
})
```

---

## Migrations

### Create Initial Migration

```bash
cd backend
npx prisma migrate dev --name init
```

This creates:

- `prisma/migrations/20240120_init/migration.sql` - SQL to create tables
- Updates `prisma/schema.prisma` if needed

### Apply Migrations in Production

```bash
npx prisma migrate deploy
```

### Reset Database (Development Only)

```bash
# WARNING: Deletes all data!
npx prisma migrate reset
```

---

## Seed Data

### Create Seed Script

**File:** `backend/prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create companies
  const acme = await prisma.company.upsert({
    where: { name: 'Acme Corp' },
    update: {},
    create: {
      name: 'Acme Corp',
      website: 'https://acme.com',
      industry: 'Technology',
      size: '51-200',
    },
  })

  // Create jobs
  const job1 = await prisma.job.create({
    data: {
      title: 'Senior React Developer',
      description: 'We are looking for...',
      location: 'San Francisco, CA',
      salaryMin: 150000,
      salaryMax: 200000,
      remote: true,
      tags: ['react', 'typescript', 'node'],
      postedDate: new Date(),
      companyId: acme.id,
    },
  })

  // Create sources
  await prisma.source.create({
    data: {
      board: 'indeed',
      externalId: 'abc123',
      url: 'https://indeed.com/viewjob?jk=abc123',
      jobId: job1.id,
    },
  })

  console.log('Seed data created')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

### Run Seed

```bash
npx prisma db seed
```

### Configure Seed in package.json

**File:** `backend/package.json`

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

---

## Performance Optimization

### Indexes

Already defined in schema:

- `Job.title` - Fast text search
- `Job.location` - Filter by location
- `Job.remote` - Filter remote jobs
- `Job.postedDate` - Sort by recency
- `Job.companyId` - Join with Company
- `Source.jobId` - Join with Job
- `Source.board` - Group by board

### Additional Indexes (if needed)

```prisma
model Job {
  // ... existing fields

  // Composite index for common filters
  @@index([location, remote, postedDate])

  // Full-text search (PostgreSQL specific)
  @@index([title, description])
}
```

### Query Optimization

**Bad (N+1 problem):**

```typescript
const jobs = await prisma.job.findMany()
for (const job of jobs) {
  const company = await prisma.company.findUnique({
    where: { id: job.companyId },
  })
  console.log(job.title, company.name)
}
```

**Good (single query):**

```typescript
const jobs = await prisma.job.findMany({
  include: { company: true },
})
jobs.forEach((job) => {
  console.log(job.title, job.company.name)
})
```

---

## Database GUI Tools

### Option 1: Prisma Studio (Built-in)

```bash
npx prisma studio
```

Opens web interface at http://localhost:5555

### Option 2: TablePlus (macOS/Windows)

1. Download: https://tableplus.com/
2. Create new connection:
   - Host: `localhost`
   - Port: `5432`
   - User: `job_aggregator`
   - Password: `*PASSWORD_REMOVED_FROM_HISTORY`
   - Database: `job_aggregator_dev`

### Option 3: DBeaver (Cross-platform)

1. Download: https://dbeaver.io/
2. Create PostgreSQL connection with same credentials

---

## Backup & Restore

### Backup Database

```bash
docker-compose exec postgres pg_dump -U job_aggregator job_aggregator_dev > backup.sql
```

### Restore Database

```bash
cat backup.sql | docker-compose exec -T postgres psql -U job_aggregator job_aggregator_dev
```

---

## Next Steps

1. **Review schema** - Understand relationships and indexes
2. **Run migrations** - `npx prisma db push`
3. **Explore with Prisma Studio** - `npx prisma studio`
4. **Add seed data** - Create realistic test data
5. **Optimize queries** - Use `include` instead of N+1 queries
