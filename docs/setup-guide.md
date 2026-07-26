# Job Aggregator — Setup Guide

## Overview

This guide walks you through setting up the complete development environment for the Job Aggregator project.

**Last updated:** 2026-07-25

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
git clone https://github.com/arianra/job-aggregator.git
cd job-aggregator
```

---

## Step 2: Install Node.js Dependencies

The project uses npm workspaces to manage three packages:

- `shared/` — TypeScript interfaces (shared between frontend and backend)
- `backend/` — Express API server with Prisma ORM
- `frontend/` — React app with Vite and Tailwind CSS

Install all dependencies from the root:

```bash
npm install
```

This installs dependencies for all three workspaces.

**Key Backend Dependencies:**

- `express` — Web framework
- `prisma` — Database ORM
- `axios` — HTTP client (ATS APIs)
- `winston` — Logging
- `vitest` — Testing framework

**Key Frontend Dependencies:**

- `react` — UI library
- `zustand` — State management
- `@tanstack/react-query` — Data fetching
- `axios` — HTTP client
- `react-router-dom` — Routing
- `tailwindcss` — Styling

---

## Step 3: Set Up PostgreSQL with Docker

### Start Database

```bash
docker compose up -d
```

This starts a PostgreSQL 15 container with:

- Container name: `job-aggregator-db`
- Port: 5432
- User: `job_aggregator`
- Password: `dev_password_only`
- Database: `job_aggregator`

### Verify Database is Running

```bash
docker compose ps
```

Expected output:

```
NAME                STATUS
job-aggregator-db   Up (healthy)
```

### Stop Database (when done)

```bash
docker compose down
```

---

## Step 4: Configure Environment Variables

### Backend Environment

**File:** `backend/.env`

```bash
# Database (required)
DATABASE_URL="postgresql://job_aggregator:*PASSWORD_REMOVED_FROM_HISTORY@localhost:5432/job_aggregator"

# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Qwen AI (optional — for resume parsing)
QWEN_API_KEY=your-qwen-api-key-here

# Logging
LOG_LEVEL=info
```

**Qwen API Key (Optional):**

- The system works without it, but resume parsing won't be as good
- To get a key: https://dashscope.aliyuncs.com/
- Sign up for Alibaba Cloud, get API key for Qwen model

### Frontend Environment

**File:** `frontend/.env`

```bash
# API URL
VITE_API_URL=http://localhost:3000/api
```

---

## Step 5: Initialize Database Schema

### Generate Prisma Client and Push Schema

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

- Creates tables: `Job`, `Source`, `Company`, `Profile`, `Match`, `Application`, `Board`
- Sets up relationships and indexes
- Generates TypeScript types from schema

### Verify Database Schema

```bash
# Connect to database
docker compose exec postgres psql -U job_aggregator -d job_aggregator

# List tables
\dt

# Expected output:
# public | Application
# public | Board
# public | Company
# public | Job
# public | Match
# public | Profile
# public | Source

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
Registered adapter: Greenhouse (greenhouse)
Registered adapter: Lever (lever)
Registered adapter: Ashby (ashby)
Registered adapter: Workday (workday)
Seeded sample data (3 jobs, 5 sources, 1 profile)
```

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

**Expected Output:**

```
VITE v5.4.21  ready in 500 ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Terminal 3: Database (if not already running)

```bash
docker compose up
```

---

## Step 7: Verify Setup

### Test Backend Health Check

```bash
curl http://localhost:3000/health
```

**Expected Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-07-25T19:30:00.000Z",
  "uptime": 12.345,
  "database": "configured"
}
```

### Test Frontend

1. Open browser to http://localhost:5173
2. You should see the Job Aggregator dashboard
3. Check browser console for any errors

### Test API Endpoints

```bash
# List jobs
curl http://localhost:3000/api/jobs?page=1&pageSize=10

# Trigger a search (this calls all 4 ATS adapters)
curl -X POST http://localhost:3000/api/jobs/search \
  -H "Content-Type: application/json" \
  -d '{"keywords": "engineer", "location": "San Francisco", "limit": 25}'

# View your profile
curl http://localhost:3000/api/profile

# Upload a resume
curl -X POST http://localhost:3000/api/profile/upload \
  -F "resume=@/path/to/your/resume.pdf"
```

---

## Step 8: Run Tests

### Backend Tests

```bash
cd backend

# Run all tests (296 tests across 15 files)
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

**Expected Output:**

```
✓ src/adapters/__tests__/greenhouse-adapter.test.ts (18 tests)
✓ src/adapters/__tests__/lever-adapter.test.ts (38 tests)
✓ src/adapters/__tests__/ashby-adapter.test.ts (45 tests)
✓ src/adapters/__tests__/workday-adapter.test.ts (47 tests)
✓ src/services/__tests__/scorer.test.ts (10 tests)
✓ src/services/__tests__/deduplicator.test.ts (12 tests)
... (15 test files total)

Test Files  15 passed (15)
Tests       296 passed (296)
Duration    35.09s
```

### Frontend Tests

Frontend tests don't exist yet. This is a known gap.

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
docker compose ps

# If not running, start it
docker compose up -d

# Check logs
docker compose logs postgres
```

### Issue 4: Qwen API Key Not Configured

**Warning:** `[profile] Qwen API key not configured — skipping AI parsing`

**Solution:**

- This is fine for testing — resume upload still works
- To enable AI parsing, get a Qwen API key from https://dashscope.aliyuncs.com/
- Add it to `backend/.env`: `QWEN_API_KEY=your-key-here`

### Issue 5: Node Modules Not Found

**Error:** `Cannot find module 'express'`

**Solution:**

```bash
# Reinstall dependencies from root
rm -rf node_modules
npm install
```

### Issue 6: Board Table FK Constraint Error

**Error:** `Foreign key constraint failed on Source.board → Board.name`

**Solution:**
This is a known bug — the `Board` table needs to be populated. Workaround:

```bash
cd backend
# Insert board rows manually (or fix index.ts to do this on startup)
npx prisma studio
# Add rows to Board table: greenhouse, lever, ashby, workday
```

---

## Development Workflow

### Daily Development

1. **Start database:**

   ```bash
   docker compose up -d
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
   docker compose down
   ```

### Database Reset (if needed)

```bash
# Stop database and remove volume
docker compose down -v

# Restart database
docker compose up -d

# Re-run migrations
cd backend
npx prisma db push

# Seed sample data (happens automatically on backend start)
npm run dev
```

---

## Next Steps

1. **Read the workflow guide:** [WORKFLOW.md](WORKFLOW.md) — how to actually use the system
2. **Read the audit:** [AUDIT.md](AUDIT.md) — expert assessment of the codebase
3. **Check the roadmap:** [TODO.md](TODO.md) — what's done, what's next
4. **Upload your resume** — Profile page → upload PDF/DOCX/TXT
5. **Configure preferences** — Use `PUT /api/profile` API (UI editing not yet available)
6. **Search for jobs** — Jobs page → enter keywords, location, click "Search"
7. **Review scored jobs** — Dashboard shows score distribution, click jobs to see breakdown
8. **Apply and track** — Save or mark applied, track through pipeline

---

## Additional Resources

- **Prisma Documentation:** https://www.prisma.io/docs
- **Express Documentation:** https://expressjs.com/
- **React Documentation:** https://react.dev/
- **Tailwind CSS:** https://tailwindcss.com/
- **Docker Documentation:** https://docs.docker.com/
- **Vitest:** https://vitest.dev/

---

## Troubleshooting Checklist

If something isn't working, verify:

- [ ] Docker is running (`docker ps`)
- [ ] PostgreSQL container is healthy (`docker compose ps`)
- [ ] Backend server is running (`curl http://localhost:3000/health`)
- [ ] Frontend dev server is running (`curl http://localhost:5173`)
- [ ] Environment variables are set (`cat backend/.env`)
- [ ] Dependencies are installed (`ls node_modules`)
- [ ] Database migrations ran successfully (`npx prisma studio`)
- [ ] No errors in terminal logs
- [ ] No errors in browser console (F12)
- [ ] Board table has rows (workaround for FK constraint bug)

---

## Getting Help

If you're stuck:

1. **Check logs:**
   - Backend: Terminal where `npm run dev` is running
   - Frontend: Terminal where `npm run dev` is running
   - Database: `docker compose logs postgres`

2. **Check browser console:**
   - Open DevTools (F12)
   - Look for red error messages

3. **Verify API responses:**
   - Use Postman or browser DevTools Network tab
   - Check response status codes and bodies

4. **Review documentation:**
   - [WORKFLOW.md](WORKFLOW.md) — how to use the system
   - [AUDIT.md](AUDIT.md) — known issues and recommendations
   - [TODO.md](TODO.md) — what's done, what's next

5. **Ask for help:**
   - Provide error messages
   - Share relevant code snippets
   - Describe what you expected vs. what happened
