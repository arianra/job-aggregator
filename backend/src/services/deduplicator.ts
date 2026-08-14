import type { Job, Source } from '@job-aggregator/shared'
import logger from '../utils/logger.js'

/**
 * Generates a deduplication fingerprint for a job.
 * The fingerprint is a normalized composite of the key identity fields:
 * company name + job title + location.
 *
 * Normalization removes casing, punctuation, and whitespace so that
 * "Google LLC" and "Google Inc." match the same canonical company.
 */
export function generateFingerprint(job: {
  title: string
  company: { name: string }
  location: { city?: string; state?: string; country: string }
}): string {
  const company = normalize(job.company.name)
  const title = normalize(job.title)
  const location = normalize(
    [job.location.city, job.location.state, job.location.country].filter(Boolean).join(' ')
  )
  return `${company}::${title}::${location}`
}

/**
 * Deduplicates a batch of jobs from multiple adapters.
 *
 * Strategy:
 * 1. Build a fingerprint index from existing jobs in storage
 * 2. For each incoming job, compute its fingerprint
 * 3. If the fingerprint matches an existing job, merge sources and enrich data
 * 4. If the fingerprint is new, save it as-is
 *
 * Returns the deduplicated set of jobs that were actually saved.
 */
export async function deduplicateJobs(
  incoming: Job[],
  allExisting: Job[],
  saveFn: (job: Job) => Promise<Job>,
  updateFn: (id: string, updates: Partial<Job>) => Promise<Job | null>,
  deleteFn: (id: string) => Promise<boolean>
): Promise<{ deduped: number; merged: number; saved: Job[] }> {
  // Index existing jobs by fingerprint
  const index = new Map<string, Job>()
  for (const job of allExisting) {
    const fp = generateFingerprint(job)
    index.set(fp, job)
  }

  let deduped = 0 // duplicates found and merged
  let merged = 0 // actually merged (some may be self-duplicates)
  const saved: Job[] = []

  for (const incomingJob of incoming) {
    const fp = generateFingerprint(incomingJob)

    const existing = index.get(fp)
    if (existing) {
      // Duplicate found — merge sources and enrich
      const updates = mergeJob(existing, incomingJob)
      if (Object.keys(updates).length > 0) {
        // Only update if there's actually new data
        await updateFn(existing.id, updates)
        merged++
      }
      // Link new sources to the canonical job
      for (const source of incomingJob.sources) {
        source.job_id = existing.id
      }
      index.set(fp, existing) // keep canonical in index
      deduped++
    } else {
      // New job — save it
      const savedJob = await saveFn(incomingJob)
      if (savedJob) {
        index.set(fp, savedJob)
        saved.push(savedJob)
      }
    }
  }

  logger.info(
    `[dedup] ${deduped} duplicates found, ${merged} merged, ${saved.length} new jobs saved`
  )
  return { deduped, merged, saved }
}

// ---------------------------------------------------------------------------
// Merge logic
// ---------------------------------------------------------------------------

/**
 * Merge data from a duplicate into the canonical job.
 * The canonical job is enriched with data from the duplicate.
 * Sources are not merged here — they are handled separately in the orchestrator.
 */
function mergeJob(canonical: Job, duplicate: Job): Partial<Job> {
  const updates: Partial<Job> = {}

  // Longer description wins
  if (
    duplicate.description &&
    duplicate.description.length > (canonical.description?.length ?? 0)
  ) {
    updates.description = duplicate.description
  }

  // Merge requirements (union, deduplicated)
  if (duplicate.requirements?.length) {
    const existing = new Set(canonical.requirements ?? [])
    const newReqs = duplicate.requirements.filter((r) => !existing.has(r))
    if (newReqs.length > 0) {
      updates.requirements = [...(canonical.requirements ?? []), ...newReqs]
    }
  }

  // Merge tags (union)
  if (duplicate.tags?.length) {
    const existing = new Set(canonical.tags ?? [])
    const newTags = duplicate.tags.filter((t) => !existing.has(t))
    if (newTags.length > 0) {
      updates.tags = [...(canonical.tags ?? []), ...newTags]
    }
  }

  // Salary: prefer the one with both min and max
  if (duplicate.salary_range?.min && duplicate.salary_range?.max) {
    if (!canonical.salary_range?.min || !canonical.salary_range?.max) {
      updates.salary_range = duplicate.salary_range
    }
  }

  // Direct apply URL: keep if canonical doesn't have one
  if (duplicate.direct_apply_url && !canonical.direct_apply_url) {
    updates.direct_apply_url = duplicate.direct_apply_url
    updates.direct_apply_confidence = duplicate.direct_apply_confidence
  }

  return updates
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // remove punctuation
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim()
}
