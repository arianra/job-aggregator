/**
 * Query parameters for job search
 */
export interface JobQuery {
  /** Keywords to search for (e.g., "software engineer", "react") */
  keywords?: string;

  /** Location filter (e.g., "San Francisco, CA", "Remote") */
  location?: string;

  /** Maximum number of results to return */
  limit?: number;

  /** How far back to search (e.g., "1d", "7d", "30d") */
  dateSincePosted?: string;

  /** Job type filter (e.g., "full-time", "part-time", "contract") */
  jobType?: string;

  /** Experience level (e.g., "entry", "mid", "senior") */
  experienceLevel?: string;

  /** Salary minimum */
  salaryMin?: number;

  /** Salary maximum */
  salaryMax?: number;

  /** Remote only */
  remote?: boolean;
}
