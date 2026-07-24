import { BoardAdapter, JobSearchQuery, ScrapeResult, Job, Source } from '@job-aggregator/shared'
import * as cheerio from 'cheerio'
import { randomUUID } from 'crypto'

/**
 * Indeed job board adapter
 * Implements conservative scraping with rate limiting and error handling
 */
export class IndeedAdapter implements BoardAdapter {
  readonly boardId = 'indeed'
  readonly boardName = 'Indeed'
  
  private lastRequestTime = 0
  private readonly minRequestInterval = 60000 // 60 seconds between requests
  
  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
  ]

  private readonly selectors = {
    jobCard: '.job_seen_beacon',
    title: 'h2.jobTitle a',
    company: '[data-testid="company-name"]',
    location: '[data-testid="text-location"]',
    salary: '.salary-snippet-container',
    description: '.job-snippet',
    jobUrl: 'h2.jobTitle a',
    date: '.date'
  }

  async searchJobs(query: JobSearchQuery): Promise<ScrapeResult> {
    const startTime = Date.now()
    const errors: string[] = []
    
    try {
      // Build search URL
      const url = this.buildSearchUrl(query)
      
      // Rate limiting
      await this.waitForRateLimit()
      
      // Fetch page
      const html = await this.fetchWithRetry(url, 3)
      
      // Extract jobs
      const { jobs, sources } = this.extractJobs(html)
      
      return {
        jobs,
        sources,
        errors,
        metadata: {
          totalFound: jobs.length,
          scrapedAt: new Date(),
          duration: Date.now() - startTime,
          url
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(errorMessage)
      
      return {
        jobs: [],
        sources: [],
        errors,
        metadata: {
          totalFound: 0,
          scrapedAt: new Date(),
          duration: Date.now() - startTime
        }
      }
    }
  }

  private buildSearchUrl(query: JobSearchQuery): string {
    const params = new URLSearchParams()
    
    if (query.query) {
      params.set('q', query.query)
    }
    
    if (query.location) {
      params.set('l', query.location)
    }
    
    if (query.daysBack) {
      params.set('fromage', query.daysBack.toString())
    }
    
    if (query.remote) {
      params.set('remotejob', '032b304e06a')
    }
    
    // Always use these defaults
    params.set('limit', (query.limit || 50).toString())
    params.set('sort', 'date')
    
    return `https://www.indeed.com/jobs?${params.toString()}`
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    const waitTime = Math.max(0, this.minRequestInterval - timeSinceLastRequest)
    
    if (waitTime > 0) {
      console.log(`Indeed: Rate limiting, waiting ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    this.lastRequestTime = Date.now()
  }

  private async fetchWithRetry(url: string, maxRetries: number): Promise<string> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: this.getHeaders()
        })
        
        if (response.status === 429) {
          throw new Error('Rate limited by Indeed')
        }
        
        if (response.status === 403) {
          throw new Error('IP address blocked')
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const html = await response.text()
        
        // Check for CAPTCHA
        if (html.includes('captcha') || html.includes('Press & Hold')) {
          throw new Error('CAPTCHA challenge detected')
        }
        
        return html
      } catch (error) {
        lastError = error as Error
        
        if (attempt < maxRetries) {
          // Exponential backoff: 60s, 120s, 240s
          const backoff = 60000 * Math.pow(2, attempt - 1)
          console.warn(`Indeed: Attempt ${attempt} failed, retrying in ${backoff}ms... (${lastError.message})`)
          await new Promise(resolve => setTimeout(resolve, backoff))
        }
      }
    }
    
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`)
  }

  private getHeaders(): HeadersInit {
    return {
      'User-Agent': this.getRandomUserAgent(),
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
  }

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)]
  }

  private extractJobs(html: string): { jobs: Job[], sources: Source[] } {
    const $ = cheerio.load(html)
    const jobs: Job[] = []
    const sources: Source[] = []
    
    $(this.selectors.jobCard).each((_, element) => {
      try {
        const card = $(element)
        
        // Extract basic info
        const title = card.find(this.selectors.title).text().trim()
        const company = card.find(this.selectors.company).text().trim()
        const location = card.find(this.selectors.location).text().trim()
        const description = card.find(this.selectors.description).text().trim()
        const date = card.find(this.selectors.date).text().trim()
        
        // Skip if no title (invalid card)
        if (!title) {
          return
        }
        
        // Extract job URL and ID
        const jobUrlElement = card.find(this.selectors.jobUrl)
        const jobPath = jobUrlElement.attr('href') || ''
        const jobId = jobUrlElement.attr('data-jk') || randomUUID()
        const jobUrl = `https://www.indeed.com${jobPath}`
        
        // Parse salary if available
        const salaryText = card.find(this.selectors.salary).text().trim()
        const salaryRange = this.parseSalary(salaryText)
        
        // Parse location
        const parsedLocation = this.parseLocation(location)
        
        // Create job object
        const job: Job = {
          id: randomUUID(),
          title,
          company: {
            id: randomUUID(),
            name: company,
            website: null,
            size: null,
            industry: null
          },
          location: parsedLocation,
          salaryRange,
          description,
          requirements: [],
          tags: this.extractTags(description),
          postedDate: this.parsePostedDate(date),
          sources: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
        
        // Create source object
        const source: Source = {
          id: randomUUID(),
          jobId: job.id,
          board: this.boardId,
          externalId: jobId,
          url: jobUrl,
          scrapedAt: new Date()
        }
        
        jobs.push(job)
        sources.push(source)
      } catch (error) {
        console.warn(`Indeed: Failed to parse job card:`, error)
      }
    })
    
    return { jobs, sources }
  }

  private parseSalary(salaryText: string): Job['salaryRange'] | null {
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

  private parseLocation(locationText: string): Job['location'] {
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

  private parsePostedDate(dateText: string): Date {
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

  private extractTags(description: string): string[] {
    const keywords = [
      'react', 'node', 'typescript', 'javascript', 'python',
      'aws', 'docker', 'kubernetes', 'sql', 'postgresql',
      'mongodb', 'graphql', 'rest', 'api', 'java', 'golang',
      'ruby', 'rails', 'vue', 'angular', 'next', 'nuxt'
    ]
    
    const lowerDesc = description.toLowerCase()
    return keywords.filter(kw => lowerDesc.includes(kw))
  }
}
