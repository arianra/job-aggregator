# Development Environment Setup Guide

## Overview
This guide walks you through setting up the complete development environment for the Job Aggregator project.

---

## Prerequisites

### Required Software
1. **Node.js 20+** (LTS recommended)
2. **Docker & Docker Compose** (for PostgreSQL)
3. **Git** (version control)
4. **Code Editor** (VS Code recommended)

### Optional but Recommended
- **Postman** or **Insomnia** (API testing)
- **DBeaver** or **TablePlus** (database GUI)
- **Chrome DevTools** (frontend debugging)

---

## Step 1: Clone Repository

```bash
git clone <repository-url>
cd job-aggregator
```

---

## Step 2: Install Node.js Dependencies

### Backend
```bash
cd backend
npm install
```

**Key Dependencies:**
- `express` - Web framework
- `prisma` - Database ORM
- `cheerio` - HTML parsing (Indeed scraping)
- `axios` - HTTP client (LinkedIn API)
- `winston` - Logging
- `vitest` - Testing framework

### Frontend
```bash
cd ../frontend
npm install
```

**Key Dependencies:**
- `react` - UI library
- `zustand` - State management
- `@tanstack/react-query` - Data fetching
- `axios` - HTTP client
- `react-router-dom` - Routing
- `tailwindcss` - Styling

---

## Step 3: Set Up PostgreSQL with Docker

### Create Docker Compose File

**File:** `docker-compose.yml` (in project root)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: job-aggregator-db
    environment:
      POSTGRES_USER: job_aggregator
      POSTGRES_PASSWORD: dev_password_123
      POSTGRES_DB: job_aggregator_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U job_aggregator"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Start Database
```bash
docker-compose up -d
```

### Verify Database is Running
```bash
docker-compose ps
```

Expected output:
```
NAME                STATUS
job-aggregator-db   Up (healthy)
```

### Stop Database (when done)
```bash
docker-compose down
```

---

## Step 4: Configure Environment Variables

### Backend Environment

**File:** `backend/.env`

```bash
# Database
DATABASE_URL="postgresql://job_aggregator:dev_password_123@localhost:5432/job_aggregator_dev"

# Server
PORT=3000
NODE_ENV=development

# API Keys (Phase 1: Only RapidAPI for LinkedIn)
RAPIDAPI_KEY=your_rapidapi_key_here

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=10
```

**How to Get RapidAPI Key:**
1. Go to https://rapidapi.com/
2. Sign up for free account
3. Subscribe to "LinkedIn Jobs API" (free tier: 100 requests/day)
4. Copy your API key from dashboard
5. Paste into `.env` file

### Frontend Environment

**File:** `frontend/.env`

```bash
# API URL
VITE_API_URL=http://localhost:3000/api
```

---

## Step 5: Initialize Database Schema

### Run Prisma Migrations

```bash
cd backend

# Generate Prisma Client
npx prisma generate

# Create database tables
npx prisma db push

# (Optional) View database in Prisma Studio
npx prisma studio
```

**What This Does:**
- Creates `Job`, `Source`, `Company` tables
- Sets up relationships and indexes
- Generates TypeScript types from schema

### Verify Database Schema

```bash
# Connect to database
docker-compose exec postgres psql -U job_aggregator -d job_aggregator_dev

# List tables
\dt

# Expected output:
# public | Job
# public | Source
# public | Company

# Exit
\q
```

---

## Step 6: Start Development Servers

### Terminal 1: Backend
```bash
cd backend
npm run dev
```

**Expected Output:**
```
Server running on http://localhost:3000
Database connected
Adapters registered: indeed, linkedin
```

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```

**Expected Output:**
```
VITE v5.0.0  ready in 500 ms
➜  Local:   http://localhost:5173/
```

### Terminal 3: Database (if not already running)
```bash
docker-compose up
```

---

## Step 7: Verify Setup

### Test Backend Health Check
```bash
curl http://localhost:3000/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "adapters": ["indeed", "linkedin"],
  "rateLimiter": {
    "currentUsage": 0,
    "maxRequests": 10,
    "remainingSlots": 10
  }
}
```

### Test Frontend
1. Open browser to http://localhost:5173
2. You should see the Job Aggregator homepage
3. Check browser console for any errors

### Test API Endpoints
```bash
# Trigger a scrape
curl -X POST http://localhost:3000/api/jobs/scrape \
  -H "Content-Type: application/json" \
  -d '{"query": "software engineer", "location": "San Francisco"}'

# List jobs
curl http://localhost:3000/api/jobs
```

---

## Step 8: Run Tests

### Backend Tests
```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

**Expected Output:**
```
✓ src/adapters/indeed-adapter.test.ts (12 tests)
✓ src/services/orchestrator.test.ts (8 tests)
✓ src/routes/jobs.test.ts (6 tests)

Test Files  3 passed (3)
Tests       26 passed (26)
```

### Frontend Tests (if implemented)
```bash
cd frontend
npm test
```

---

## Common Issues & Solutions

### Issue 1: Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Issue 2: Docker Permission Denied

**Error:** `permission denied while trying to connect to the Docker daemon socket`

**Solution:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or run:
newgrp docker
```

### Issue 3: Database Connection Failed

**Error:** `Error: Can't reach database server at localhost:5432`

**Solution:**
```bash
# Check if PostgreSQL is running
docker-compose ps

# If not running, start it
docker-compose up -d

# Check logs
docker-compose logs postgres
```

### Issue 4: RapidAPI Rate Limit Exceeded

**Error:** `429 Too Many Requests` from LinkedIn API

**Solution:**
- Free tier: 100 requests/day
- Wait until quota resets (resets at midnight UTC)
- Or upgrade to paid plan ($9/month for 1000 requests/day)

### Issue 5: Node Modules Not Found

**Error:** `Cannot find module 'express'`

**Solution:**
```bash
# Reinstall dependencies
cd backend
rm -rf node_modules package-lock.json
npm install

cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

---

## Development Workflow

### Daily Development

1. **Start database:**
   ```bash
   docker-compose up -d
   ```

2. **Start backend:**
   ```bash
   cd backend
   npm run dev
   ```

3. **Start frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Make changes and test**

5. **Run tests before committing:**
   ```bash
   cd backend
   npm test
   
   cd ../frontend
   npm test
   ```

6. **Commit changes:**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push
   ```

7. **Stop services when done:**
   ```bash
   # Stop backend and frontend (Ctrl+C in terminals)
   
   # Stop database
   docker-compose down
   ```

### Database Reset (if needed)

```bash
# Stop database and remove volume
docker-compose down -v

# Restart database
docker-compose up -d

# Re-run migrations
cd backend
npx prisma db push
```

---

## Next Steps

1. **Read implementation plans:**
   - `docs/implementation-plan-phase1.md` (backend)
   - `docs/implementation-plan-phase2-frontend.md` (frontend)

2. **Start with Task 1 from Phase 1** (LinkedIn adapter)

3. **Follow each task in order**

4. **Run tests after each task**

5. **Commit frequently with descriptive messages**

---

## Additional Resources

- **Prisma Documentation:** https://www.prisma.io/docs
- **Express Documentation:** https://expressjs.com/
- **React Documentation:** https://react.dev/
- **Tailwind CSS:** https://tailwindcss.com/
- **Docker Documentation:** https://docs.docker.com/

---

## Troubleshooting Checklist

If something isn't working, verify:

- [ ] Docker is running (`docker ps`)
- [ ] PostgreSQL container is healthy (`docker-compose ps`)
- [ ] Backend server is running (`curl http://localhost:3000/api/health`)
- [ ] Frontend dev server is running (`curl http://localhost:5173`)
- [ ] Environment variables are set (`cat backend/.env`)
- [ ] Dependencies are installed (`ls node_modules`)
- [ ] Database migrations ran successfully (`npx prisma studio`)
- [ ] No errors in terminal logs
- [ ] No errors in browser console (F12)

---

## Getting Help

If you're stuck:

1. **Check logs:**
   - Backend: Terminal where `npm run dev` is running
   - Frontend: Terminal where `npm run dev` is running
   - Database: `docker-compose logs postgres`

2. **Check browser console:**
   - Open DevTools (F12)
   - Look for red error messages

3. **Verify API responses:**
   - Use Postman or browser DevTools Network tab
   - Check response status codes and bodies

4. **Review implementation plans:**
   - Each task has acceptance criteria
   - Compare your code to reference implementations

5. **Ask for help:**
   - Provide error messages
   - Share relevant code snippets
   - Describe what you expected vs. what happened
