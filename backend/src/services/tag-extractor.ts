import logger from '../utils/logger.js';
import { extractSkillsFromText } from './skill-extractor.js';
import type { Job, Profile } from '@job-aggregator/shared';

/**
 * Fallback keyword list for when AI extraction isn't available
 */
const FALLBACK_KEYWORDS = [
  'react', 'node', 'typescript', 'javascript', 'python',
  'aws', 'docker', 'kubernetes', 'sql', 'postgresql',
  'mongodb', 'graphql', 'rest', 'api', 'java', 'golang',
  'ruby', 'rails', 'vue', 'angular', 'next', 'nuxt',
  'rust', 'go', 'elixir', 'terraform', 'linux', 'git',
  'redis', 'elasticsearch', 'kafka', 'cicd', 'agile',
  'scrum', 'tdd', 'microservices', 'serverless', 'sre',
];

/**
 * Extract and tag jobs with profile-aware skill matching
 * 
 * @param jobs - Array of jobs to process
 * @param profile - User profile containing their skills
 * @param options - Configuration options
 * @returns Jobs with extracted tags
 */
export async function tagJobsWithSkills(
  jobs: Job[],
  profile: Profile | null,
  options: {
    useAI?: boolean;
    qwenApiKey?: string;
    batchSize?: number;
  } = {}
): Promise<Job[]> {
  const { useAI = true, qwenApiKey, batchSize = 10 } = options;

  if (!profile || !profile.skills.length) {
    logger.info('[tag-jobs] No profile or skills found, using fallback keywords');
    return jobs.map(job => ({
      ...job,
      tags: extractFallbackTags(job)
    }));
  }

  const profileSkillNames = new Set(
    profile.skills.map(s => normalizeSkill(s.name))
  );

  const taggedJobs: Job[] = [];

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    
    if (useAI && qwenApiKey) {
      try {
        const extractedSkills = await extractSkillsFromText(
          batch.map(job => getJobText(job)),
          { apiKey: qwenApiKey }
        );

        batch.forEach((job, idx) => {
          const jobSkills = extractedSkills[idx] || [];
          // Filter to only skills that match the user's profile
          const matchingTags = jobSkills
            .map(s => normalizeSkill(s))
            .filter(s => profileSkillNames.has(s));
          
          taggedJobs.push({
            ...job,
            tags: [...new Set([...job.tags, ...matchingTags])]
          });
        });
      } catch (err) {
        logger.warn('[tag-jobs] AI extraction failed, using fallback', { err });
        batch.forEach(job => {
          taggedJobs.push({
            ...job,
            tags: extractFallbackTags(job, profileSkillNames)
          });
        });
      }
    } else {
      // Fallback mode: use keyword matching
      batch.forEach(job => {
        taggedJobs.push({
          ...job,
          tags: extractFallbackTags(job, profileSkillNames)
        });
      });
    }
  }

  return taggedJobs;
}

/**
 * Extract text content from a job for AI processing
 */
function getJobText(job: Job): string {
  const parts = [
    job.title,
    job.description,
    ...(job.requirements || []),
    job.tags.join(' ')
  ].filter(Boolean);
  
  return parts.join('\n');
}

/**
 * Fallback tag extraction using keyword matching
 * 
 * @param job - Job to extract tags from
 * @param profileSkills - Set of normalized profile skill names (optional)
 * @returns Array of matching tags
 */
function extractFallbackTags(
  job: Job,
  profileSkills?: Set<string>
): string[] {
  const text = getJobText(job).toLowerCase();
  
  // If we have profile skills, only match against those
  const keywords = profileSkills 
    ? Array.from(profileSkills)
    : FALLBACK_KEYWORDS;

  return keywords.filter(keyword => {
    // Generate multiple matching patterns for each keyword
    const baseName = keyword.toLowerCase().replace(/\.?js$/i, '');
    const patterns = [
      // Exact match with word boundaries
      `\\b${baseName}\\b`,
      // Match with .js suffix
      `\\b${baseName}\\.js\\b`,
      // Match with js suffix (no dot)
      `\\b${baseName}js\\b`,
      // Match the full keyword
      `\\b${keyword.toLowerCase()}\\b`
    ];
    
    return patterns.some(pattern => new RegExp(pattern, 'i').test(text));
  });
}

/**
 * Normalize skill name for comparison
 */
function normalizeSkill(skill: string): string {
  return skill
    .toLowerCase()
    .replace(/[^a-z0-9+#]/g, '')
    .replace(/js$/, 'js')
    .trim();
}
