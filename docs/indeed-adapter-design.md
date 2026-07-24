# Indeed Adapter Design Document

## Overview

This document outlines the strategy for implementing the Indeed job board adapter, including URL construction, anti-bot measures, data extraction, and error handling.

## URL Structure

Indeed uses query parameters for job searches:

```
https://www.indeed.com/jobs?q=QUERY&l=LOCATION&fromage=DAYS&limit=COUNT&start=OFFSET
```

### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `q` | Job title/keywords | `q=software+engineer` |
| `l` | Location | `l=san+francisco%2C+ca` |
| `fromage` | Days back (freshness) | `fromage=7` (last 7 days) |
| `limit` | Results per page | `limit=50` (max 50) |
| `start` | Pagination offset | `start=50` (page 2) |
| `sort` | Sort order | `sort=date` (most recent) |
| `remotejob` | Remote jobs only | `remotejob=032b304e06a` |

### Example URLs

```
# Software engineer jobs in San Francisco, last 7 days
https://www.indeed.com/jobs?q=software+engineer&l=san+francisco%2C+ca&fromage=7&limit=50

# Page 2 of results
https://www.indeed.com/jobs?q=software+engineer&l=san+francisco%2C+ca&fromage=7&limit=50&start=50

# Remote jobs only
https://www.indeed.com/jobs?q=software+engineer&remotejob=032b304e06a&fromage=7&limit=50
```

## Anti-Bot Measures

Indeed employs aggressive anti-scraping measures:

### Challenges
1. **Rate limiting**: Blocks IPs making too many requests
2. **User-agent detection**: Blocks non-browser user agents
3. **CAPTCHA challenges**: Presents CAPTCHAs for suspicious traffic
4. **JavaScript rendering**: Some content requires JS execution
5. **Fingerprinting**: Tracks request patterns and browser fingerprints

### Mitigation Strategies

#### 1. Conservative Rate Limiting
- **Maximum**: 1 request per minute (60 seconds between requests)
- **Recommended**: 1 request per 2-3 minutes for sustained scraping
- **Implementation**: Use exponential backoff on rate limit errors

```typescript
class RateLimiter {
  private lastRequest = 0
  private minInterval = 60000 // 60 seconds
  
  async wait(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequest
    const waitTime = Math.max(0, this.minInterval - timeSinceLastRequest)
    
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    this.lastRequest = Date.now()
  }
}
```

#### 2. User-Agent Rotation
Rotate through realistic browser user agents:

```typescript
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
]

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}
```

#### 3. Request Headers
Include realistic browser headers:

```typescript
const headers = {
  'User-Agent': getRandomUserAgent(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0'
}
```

#### 4. Proxy Rotation (Optional)
For heavy scraping, consider residential proxies:
- Services: Bright Data, Oxylabs, SmartProxy
- Cost: $500-2000/month for residential IPs
- **Recommendation**: Start without proxies, add if needed

#### 5. Headless Browser (Alternative)
If HTML parsing fails due to JS rendering:
- Use Playwright or Puppeteer
- Slower but more reliable
- Requires more resources

```typescript
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(url)
const content = await page.content()
await browser.close()
```

## Data Extraction

### HTML Structure
Indeed job listings use these CSS selectors (as of 2024):

```typescript
const SELECTORS = {
  // Job card container
  jobCard: '.job_seen_beacon',
  
  // Job title
  title: 'h2.jobTitle a',
  
  // Company name
  company: '[data-testid="company-name"]',
  
  // Location
  location: '[data-testid="text-location"]',
  
  // Salary (if available)
  salary: '.salary-snippet-container',
  
  // Job description snippet
  description: '.job-snippet',
  
  // Job URL (relative)
  jobUrl: 'h2.jobTitle a',
  
  // Posted date
  date: '.date',
  
  // Pagination
  nextPage: 'a[data-testid="pagination-page-next"]',
  totalResults: '.jobsearch-HiringDecisionCard'
}
```

### Extraction Logic

```typescript
import * as cheerio from 'cheerio'
import { Job, Source } from '@job-aggregator/shared'

function extractJobs(html: string, boardName: string): { jobs: Job[], sources: Source[] } {
  const $ = cheerio.load(html)
  const jobs: Job[] = []
  const sources: Source[] = []
  
  $(SELECTORS.jobCard).each((_, element) => {
    const card = $(element)
    
    // Extract basic info
    const title = card.find(SELECTORS.title).text().trim()
    const company = card.find(SELECTORS.company).text().trim()
    const location = card.find(SELECTORS.location).text().trim()
    const description = card.find(SELECTORS.description).text().trim()
    const date = card.find(SELECTORS.date).text().trim()
    
    // Extract job URL
    const jobUrlElement = card.find(SELECTORS.jobUrl)
    const jobPath = jobUrlElement.attr('href') || ''
    const jobId = jobUrlElement.attr('data-jk') || generateId()
    const jobUrl = `https://www.indeed.com${jobPath}`
    
    // Parse salary if available
    const salaryText = card.find(SELECTORS.salary).text().trim()
    const salaryRange = parseSalary(salaryText)
    
    // Parse location
    const parsedLocation = parseLocation(location)
    
    // Create job object
    const job: Job = {
      id: generateId(),
      title,
      company: {
        id: generateId(),
        name: company,
        website: null,
        size: null,
        industry: null
      },
      location: parsedLocation,
      salaryRange,
      description,
      requirements: [],
      tags: extractTags(description),
      postedDate: parsePostedDate(date),
      sources: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // Create source object
    const source: Source = {
      id: generateId(),
      jobId: job.id,
      board: boardName,
      externalId: jobId,
      url: jobUrl,
      scrapedAt: new Date()
    }
    
    jobs.push(job)
    sources.push(source)
  })
  
  return { jobs, sources }
}
```

### Helper Functions

```typescript
function parseSalary(salaryText: string): SalaryRange | null {
  if (!salaryText) return null
  
  // Example: "$120,000 - $160,000 a year"
  const match = salaryText.match(/\$([0-9,]+)\s*-\s*\$([0-9,]+)/)
  if (!match) return null
  
  const min = parseInt(match[1].replace(/,/g, ''))
  const max = parseInt(match[2].replace(/,/g, ''))
  
  return {
    min,
    max,
    currency: 'USD',
    period: 'year'
  }
}

function parseLocation(locationText: string): Location {
  // Example: "San Francisco, CA" or "Remote"
  const isRemote = locationText.toLowerCase().includes('remote')
  
  if (isRemote) {
    return { remote: true }
  }
  
  const parts = locationText.split(',').map(p => p.trim())
  return {
    city: parts[0] || null,
    state: parts[1] || null,
    country: 'USA',
    remote: false
  }
}

function parsePostedDate(dateText: string): Date {
  // Example: "2 days ago", "Just posted", "30+ days ago"
  const now = new Date()
  
  if (dateText.includes('Just posted') || dateText.includes('Today')) {
    return now
  }
  
  const daysMatch = dateText.match(/(\d+)\s+day/)
  if (daysMatch) {
    const days = parseInt(daysMatch[1])
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  }
  
  // Default to 7 days ago for "30+ days ago" or unknown
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
}

function extractTags(description: string): string[] {
  const keywords = [
    'react', 'node', 'typescript', 'javascript', 'python',
    'aws', 'docker', 'kubernetes', 'sql', 'postgresql',
    'mongodb', 'graphql', 'rest', 'api'
  ]
  
  const lowerDesc = description.toLowerCase()
  return keywords.filter(kw => lowerDesc.includes(kw))
}
```

## Error Handling

### Error Types

```typescript
enum IndeedErrorType {
  RATE_LIMITED = 'RATE_LIMITED',
  CAPTCHA = 'CAPTCHA',
  BLOCKED = 'BLOCKED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  NO_RESULTS = 'NO_RESULTS'
}

class IndeedError extends Error {
  constructor(
    public type: IndeedErrorType,
    message: string,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'IndeedError'
  }
}
```

### Detection Logic

```typescript
function detectError(response: Response, html: string): IndeedError | null {
  // Rate limited (429 status)
  if (response.status === 429) {
    return new IndeedError(
      IndeedErrorType.RATE_LIMITED,
      'Rate limited by Indeed',
      true
    )
  }
  
  // CAPTCHA challenge
  if (html.includes('captcha') || html.includes('Press & Hold')) {
    return new IndeedError(
      IndeedErrorType.CAPTCHA,
      'CAPTCHA challenge detected',
      false
    )
  }
  
  // IP blocked (403 status)
  if (response.status === 403) {
    return new IndeedError(
      IndeedErrorType.BLOCKED,
      'IP address blocked',
      false
    )
  }
  
  // Network errors
  if (!response.ok) {
    return new IndeedError(
      IndeedErrorType.NETWORK_ERROR,
      `HTTP ${response.status}`,
      true
    )
  }
  
  return null
}
```

### Retry Strategy

```typescript
async function scrapeWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await rateLimiter.wait()
      
      const response = await fetch(url, { headers })
      const html = await response.text()
      
      const error = detectError(response, html)
      if (error) {
        if (!error.retryable) {
          throw error
        }
        lastError = error
        continue
      }
      
      return html
    } catch (error) {
      lastError = error as Error
      
      if (attempt < maxRetries) {
        // Exponential backoff: 60s, 120s, 240s
        const backoff = 60000 * Math.pow(2, attempt - 1)
        console.warn(`Attempt ${attempt} failed, retrying in ${backoff}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoff))
      }
    }
  }
  
  throw new IndeedError(
    IndeedErrorType.NETWORK_ERROR,
    `Failed after ${maxRetries} attempts: ${lastError?.message}`,
    false
  )
}
```

## Implementation Plan

### Phase 1: Basic Scraper (MVP)
**Time**: 2 hours
**Complexity**: Medium

1. Implement `IndeedAdapter` class
2. Add rate limiter
3. Add user-agent rotation
4. Basic HTML parsing with Cheerio
5. Extract job data
6. Manual testing with sample queries

**Dependencies**:
```json
{
  "dependencies": {
    "cheerio": "^1.0.0-rc.12"
  }
}
```

### Phase 2: Robustness
**Time**: 2 hours
**Complexity**: Medium

1. Add error detection
2. Implement retry logic
3. Add exponential backoff
4. Improve parsing (handle edge cases)
5. Add logging

### Phase 3: Testing
**Time**: 2 hours
**Complexity**: High (requires current model)

1. Mock HTTP requests
2. Test with sample HTML
3. Test error scenarios
4. Test rate limiting
5. Integration tests

### Phase 4: Production Hardening
**Time**: 2 hours
**Complexity**: Medium

1. Add proxy support (optional)
2. Add metrics collection
3. Add health checks
4. Document usage
5. Add to adapter registry

## Usage Example

```typescript
import { IndeedAdapter } from './adapters/indeed-adapter.js'

const adapter = new IndeedAdapter({
  enabled: true,
  rateLimit: 60000 // 1 request per minute
})

// Search for jobs
const result = await adapter.scrapeJobs({
  query: 'software engineer',
  location: 'San Francisco, CA',
  remote: true,
  daysBack: 7,
  limit: 50
})

console.log(`Found ${result.jobs.length} jobs`)
console.log(`Errors: ${result.errors.length}`)
```

## Limitations

1. **Rate limiting**: Can only scrape ~1 page per minute
2. **Anti-bot**: May get blocked if scraping too aggressively
3. **HTML changes**: Indeed may change their HTML structure
4. **No job details**: Only extracts listing data, not full job descriptions
5. **Geographic restrictions**: Some regions may have different HTML

## Alternatives

### 1. Indeed API (Official)
- **Status**: Indeed discontinued public API in 2022
- **Alternative**: Partner API (requires business relationship)

### 2. Third-party APIs
- **Services**: RapidAPI, Jobicy, Adzuna
- **Cost**: $50-500/month
- **Pros**: Reliable, no scraping needed
- **Cons**: Expensive, limited control

### 3. Headless Browser
- **Tools**: Playwright, Puppeteer
- **Pros**: Handles JS rendering, more reliable
- **Cons**: Slower, more resources, still needs anti-bot measures

## Monitoring

Track these metrics:
- Success rate (% of successful scrapes)
- Error rate (by error type)
- Average response time
- Jobs extracted per scrape
- Rate limit hits
- CAPTCHA challenges

## Conclusion

The Indeed adapter will use conservative scraping with:
- Strict rate limiting (1 req/min)
- User-agent rotation
- Realistic headers
- Exponential backoff on errors
- Cheerio for HTML parsing

**Expected reliability**: 70-80% success rate without proxies, 90%+ with proper error handling.

**Next steps**: Implement Phase 1 (basic scraper) and test with real queries.
