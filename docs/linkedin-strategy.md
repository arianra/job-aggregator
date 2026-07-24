# LinkedIn Scraping Strategy

## Challenge

LinkedIn is **much harder** than Indeed:
- Requires authentication (no public job search)
- Aggressive anti-bot (GraphQL API, request signing)
- Rate limits: ~100 requests/day for free accounts
- Legal risk (LinkedIn sued scrapers successfully)

## Options

### Option A: Official LinkedIn API (Recommended)
**Pros:**
- Legal, reliable, well-documented
- 1000 requests/day free tier
- No anti-bot issues

**Cons:**
- Requires LinkedIn Developer account (approval process)
- Job Search API is limited (no full job descriptions)
- Some features require paid tier

**Implementation:**
```typescript
export class LinkedInAdapter implements BoardAdapter {
  private clientId: string
  private clientSecret: string
  private accessToken?: string
  
  async scrapeJobs(query: JobSearchQuery): Promise<ScrapeResult> {
    await this.ensureAccessToken()
    
    const response = await fetch('https://api.linkedin.com/v2/jobSearch', {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    })
    
    return this.parseResponse(response)
  }
}
```

**When to use:** Production, long-term sustainability

---

### Option B: Unofficial GraphQL API (Risky)
**Pros:**
- Full data access
- No approval needed

**Cons:**
- Violates ToS (account ban risk)
- Breaks frequently (undocumented API)
- Requires session cookies + CSRF tokens
- Complex request signing

**Implementation:**
```typescript
// NOT RECOMMENDED - for reference only
export class LinkedInAdapter {
  async scrapeJobs(query: JobSearchQuery): Promise<ScrapeResult> {
    // Requires valid session cookie from browser
    const cookies = await this.getSessionCookies()
    
    const graphqlQuery = {
      query: `
        query JobSearch($keywords: String, $location: String) {
          jobs(keywords: $keywords, location: $location) {
            elements {
              title, company, location, description
            }
          }
        }
      `,
      variables: { keywords: query.query, location: query.location }
    }
    
    const response = await fetch('https://www.linkedin.com/voyager/api/graphql', {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'X-Li-Track': this.generateLiTrack(),
        'Csrf-Token': this.extractCsrfToken(cookies)
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    return this.parseResponse(response)
  }
}
```

**When to use:** NEVER in production. Only for personal experimentation.

---

### Option C: Third-Party Service (Pragmatic)
**Pros:**
- Reliable, maintained by specialists
- Handles anti-bot for you
- Legal gray area (they take the risk)

**Cons:**
- Cost ($50-200/month)
- Dependency on third party
- Data freshness varies

**Services:**
- **RapidAPI LinkedIn Jobs** ($50/month)
- **Proxycurl** ($100/month)
- **PhantomBuster** ($150/month)

**Implementation:**
```typescript
export class LinkedInAdapter implements BoardAdapter {
  private apiKey: string
  
  async scrapeJobs(query: JobSearchQuery): Promise<ScrapeResult> {
    const response = await fetch('https://rapidapi.com/linkedin-jobs', {
      headers: {
        'X-RapidAPI-Key': this.apiKey
      }
    })
    
    return this.parseResponse(response)
  }
}
```

**When to use:** MVP, when speed > cost

---

## Recommendation

**Phase 1 (MVP):** Option C (third-party service)
- Quick to implement
- Reliable
- $50/month is acceptable for MVP

**Phase 2 (Production):** Option A (official API)
- Apply for LinkedIn Developer account
- Migrate to official API
- Cancel third-party service

**Never:** Option B (unofficial GraphQL)
- Too risky, too fragile

---

## Implementation Plan

### Phase 1: Third-Party Service
1. Sign up for RapidAPI LinkedIn Jobs
2. Implement adapter using their API
3. Test with sample queries
4. Add to orchestrator

### Phase 2: Official API (Future)
1. Apply for LinkedIn Developer account
2. Implement OAuth flow
3. Migrate adapter to official API
4. Add rate limiting (1000 req/day)

---

## For Cheaper Model Implementation

**Task:** Implement LinkedIn adapter using RapidAPI

**Steps:**
1. Install axios for HTTP requests
2. Create `backend/src/adapters/linkedin-adapter.ts`
3. Follow Indeed adapter pattern
4. Use RapidAPI endpoint: `https://linkedin-jobs-api.p.rapidapi.com/active-jb-24h`
5. Parse response to match Job schema
6. Add tests (mock API responses)
7. Add to adapter registry

**Reference:** `backend/src/adapters/indeed-adapter.ts`

**API docs:** https://rapidapi.com/letscrape-6bRBa3QguO5/api/linkedin-jobs
