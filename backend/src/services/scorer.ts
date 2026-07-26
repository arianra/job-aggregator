import type {
  Job,
  Profile,
  Skill,
  Match,
  MatchDimensions,
  DimensionScore,
} from '@job-aggregator/shared'
import { v4 as uuidv4 } from 'uuid'
import logger from '../utils/logger.js'

// ---------------------------------------------------------------------------
// Configurable weights (sum to 1.0)
// ---------------------------------------------------------------------------

const DEFAULT_WEIGHTS: Record<string, number> = {
  skills: 0.35,
  experience: 0.2,
  location: 0.15,
  salary: 0.15,
  preferences: 0.1,
  recency: 0.05,
}

/**
 * Score a job against a profile across multiple dimensions.
 * Returns a Match object with overall score (0-100) and dimension breakdown.
 */
export function scoreJob(profile: Profile, job: Job): Match {
  const dimensions: MatchDimensions = {
    skills: scoreSkills(profile.skills, job),
    experience: scoreExperience(profile.experience, job),
    location: scoreLocation(profile, job),
    salary: scoreSalary(profile.preferences, job),
    preferences: scorePreferences(profile.preferences, job),
    recency: scoreRecency(job),
  }

  // Weighted overall score (0-100)
  const overall = Math.round(
    Object.entries(dimensions).reduce((sum, [key, dim]) => {
      return sum + dim.weighted * 100
    }, 0)
  )

  const reasons = generateReasons(dimensions, job)
  const flags = generateFlags(dimensions, job, profile)

  return {
    id: uuidv4(),
    profile_id: profile.id,
    job_id: job.id,
    created_at: new Date(),
    updated_at: new Date(),
    score: overall,
    dimensions,
    reasons,
    flags,
  }
}

/**
 * Score multiple jobs against a profile, sorted by score descending.
 */
export function scoreJobs(profile: Profile, jobs: Job[]): Match[] {
  return jobs.map((job) => scoreJob(profile, job)).sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------------------------
// Dimension scorers
// ---------------------------------------------------------------------------

function scoreSkills(profileSkills: Skill[], job: Job): DimensionScore {
  if (!profileSkills.length || !job.tags.length) {
    return dim(0, DEFAULT_WEIGHTS.skills)
  }

  const profileSkillNames = new Set(profileSkills.map((s) => normalizeSkill(s.name)))
  const jobSkillNames = new Set(job.tags.map(normalizeSkill))

  let matched = 0
  let bonusWeight = 0

  for (const ps of profileSkills) {
    const normalized = normalizeSkill(ps.name)
    if (jobSkillNames.has(normalized)) {
      matched++
      // Proficiency bonus: expert skills weight more
      const profBonus =
        { beginner: 0.5, intermediate: 0.75, advanced: 1.0, expert: 1.25 }[ps.proficiency] ?? 1.0
      bonusWeight += profBonus
    }
  }

  // Also check requirements text
  for (const req of job.requirements ?? []) {
    for (const ps of profileSkills) {
      if (req.toLowerCase().includes(normalizeSkill(ps.name))) {
        matched += 0.5
      }
    }
  }

  const coverage =
    profileSkills.length > 0 ? Math.min(1, (matched + bonusWeight * 0.5) / profileSkills.length) : 0

  return dim(Math.round(coverage * 100), DEFAULT_WEIGHTS.skills)
}

function scoreExperience(profileExp: Profile['experience'], job: Job): DimensionScore {
  if (!profileExp.length) return dim(50, DEFAULT_WEIGHTS.experience)

  const totalYears = profileExp.reduce((sum, e) => {
    const start = new Date(e.start_date).getTime()
    const end = e.end_date ? new Date(e.end_date).getTime() : Date.now()
    return sum + (end - start) / (365 * 24 * 60 * 60 * 1000)
  }, 0)

  // Infer required years from job description
  const requiredYears = inferRequiredYears(job)

  let score: number
  if (requiredYears === 0) {
    score = 70 // Can't determine, give neutral score
  } else if (totalYears >= requiredYears * 1.5) {
    score = 100 // Well overqualified
  } else if (totalYears >= requiredYears) {
    score = 90 // Meets requirements
  } else if (totalYears >= requiredYears * 0.7) {
    score = 70 // Close
  } else if (totalYears >= requiredYears * 0.5) {
    score = 40 // Underqualified
  } else {
    score = 20 // Significantly underqualified
  }

  // Seniority alignment bonus
  const seniorityMap: Record<string, number> = {
    intern: 0,
    entry: 1,
    mid: 3,
    senior: 5,
    lead: 7,
    manager: 8,
    director: 10,
    vp: 12,
    executive: 15,
  }
  const profileSeniority = estimateSeniority(profileExp)
  const jobSeniority = seniorityMap[job.seniority_level ?? 'mid'] ?? 3

  if (profileSeniority >= jobSeniority) {
    score = Math.min(100, score + 5)
  } else if (profileSeniority >= jobSeniority - 1) {
    score = Math.max(0, score - 5)
  } else {
    score = Math.max(0, score - 15)
  }

  return dim(score, DEFAULT_WEIGHTS.experience)
}

function scoreLocation(profile: Profile, job: Job): DimensionScore {
  const prefs = profile.preferences
  const jobLoc = job.location

  // Remote match
  if (jobLoc.remote) {
    if (prefs.remote_ok) return dim(100, DEFAULT_WEIGHTS.location)
    if (prefs.hybrid_ok) return dim(70, DEFAULT_WEIGHTS.location)
    return dim(30, DEFAULT_WEIGHTS.location)
  }

  // Onsite: check if job location matches any preferred location
  if (!prefs.onsite_ok) return dim(20, DEFAULT_WEIGHTS.location)

  for (const prefLoc of prefs.locations) {
    if (
      prefLoc.city?.toLowerCase() === jobLoc.city?.toLowerCase() &&
      prefLoc.state?.toLowerCase() === jobLoc.state?.toLowerCase()
    ) {
      return dim(100, DEFAULT_WEIGHTS.location)
    }
    if (prefLoc.state?.toLowerCase() === jobLoc.state?.toLowerCase()) {
      return dim(70, DEFAULT_WEIGHTS.location)
    }
    if (prefLoc.country?.toLowerCase() === jobLoc.country?.toLowerCase()) {
      return dim(50, DEFAULT_WEIGHTS.location)
    }
  }

  return dim(30, DEFAULT_WEIGHTS.location)
}

function scoreSalary(prefs: Profile['preferences'], job: Job): DimensionScore {
  if (!prefs.salary_min || !job.salary_range) return dim(50, DEFAULT_WEIGHTS.salary)

  const jobMin = job.salary_range.min
  const jobMax = job.salary_range.max
  const prefMin = prefs.salary_min ?? 0

  // Job's max is below our min → poor
  if (jobMax < prefMin) {
    const ratio = jobMax / prefMin
    return dim(Math.round(ratio * 50), DEFAULT_WEIGHTS.salary)
  }

  // Job's range overlaps or exceeds our minimum
  if (jobMax >= prefMin) {
    const overlap = Math.min(1, (jobMax - prefMin) / (jobMax - jobMin || 1))
    return dim(Math.round(50 + overlap * 50), DEFAULT_WEIGHTS.salary)
  }

  return dim(50, DEFAULT_WEIGHTS.salary)
}

function scorePreferences(prefs: Profile['preferences'], job: Job): DimensionScore {
  let score = 50

  // Job type match
  if (prefs.job_types?.includes(job.job_type)) {
    score += 20
  }

  // Keyword match
  if (prefs.keywords?.length) {
    const desc = (job.description + ' ' + job.tags.join(' ')).toLowerCase()
    const matched = prefs.keywords.filter((k) => desc.includes(k.toLowerCase()))
    score += (matched.length / prefs.keywords.length) * 20
  }

  // Seniority match
  if (prefs.seniority_levels?.includes(job.seniority_level ?? 'mid')) {
    score += 10
  }

  return dim(Math.min(100, score), DEFAULT_WEIGHTS.preferences)
}

function scoreRecency(job: Job): DimensionScore {
  if (!job.posted_date) return dim(50, DEFAULT_WEIGHTS.recency)

  const daysAgo = (Date.now() - new Date(job.posted_date).getTime()) / (24 * 60 * 60 * 1000)

  if (daysAgo <= 1) return dim(100, DEFAULT_WEIGHTS.recency)
  if (daysAgo <= 3) return dim(90, DEFAULT_WEIGHTS.recency)
  if (daysAgo <= 7) return dim(80, DEFAULT_WEIGHTS.recency)
  if (daysAgo <= 14) return dim(60, DEFAULT_WEIGHTS.recency)
  if (daysAgo <= 30) return dim(40, DEFAULT_WEIGHTS.recency)
  return dim(20, DEFAULT_WEIGHTS.recency)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dim(score: number, weight: number): DimensionScore {
  return {
    score: Math.max(0, Math.min(100, score)),
    weight,
    weighted: (score / 100) * weight,
  }
}

function normalizeSkill(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+#]/g, '')
    .replace(/js$/, 'js')
    .trim()
}

function inferRequiredYears(job: Job): number {
  const text = (job.description + ' ' + (job.requirements ?? []).join(' ')).toLowerCase()
  const matches = text.match(/(\d+)[\+]?\s*(?:years|yrs?)(?:\s*(?:of\s*)?experience)?/g)
  if (!matches) return 0

  const years = matches.map((m) => parseInt(m.match(/\d+/)?.[0] ?? '0', 10))
  return Math.max(...years)
}

function estimateSeniority(experience: Profile['experience']): number {
  const totalYears = experience.reduce((sum, e) => {
    const start = new Date(e.start_date).getTime()
    const end = e.end_date ? new Date(e.end_date).getTime() : Date.now()
    return sum + (end - start) / (365 * 24 * 60 * 60 * 1000)
  }, 0)

  if (totalYears < 1) return 0 // intern
  if (totalYears < 2) return 1 // entry
  if (totalYears < 5) return 3 // mid
  if (totalYears < 8) return 5 // senior
  if (totalYears < 12) return 7 // lead
  return 10 // director+
}

function generateReasons(dimensions: MatchDimensions, job: Job): string[] {
  const reasons: string[] = []

  if (dimensions.skills.score >= 80) {
    reasons.push(`Strong skill match (${dimensions.skills.score}%)`)
  }
  if (dimensions.experience.score >= 80) {
    reasons.push(`Experience level matches well`)
  }
  if (dimensions.location.score >= 80) {
    reasons.push(`Location is a good fit`)
  }
  if (dimensions.salary.score >= 80) {
    reasons.push(`Salary range aligns with your preferences`)
  }
  if (dimensions.recency.score >= 80) {
    reasons.push(`Recently posted`)
  }

  return reasons
}

function generateFlags(dimensions: MatchDimensions, job: Job, profile: Profile): string[] {
  const flags: string[] = []

  if (job.direct_apply_url) flags.push('direct_apply_available')
  if (job.salary_range && profile.preferences.salary_min) {
    if (job.salary_range.min >= (profile.preferences.salary_min ?? 0)) {
      flags.push('salary_above_min')
    }
  }
  if (dimensions.skills.score >= 80) flags.push('strong_skills_match')
  if (dimensions.recency.score >= 80) flags.push('new_listing')

  return flags
}
