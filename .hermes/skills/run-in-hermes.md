# Running Job Aggregator in Hermes (dev servers + preview pane)

Full-stack launch so the app can be reviewed in the Hermes desktop **preview pane**.
The canonical checkout is **WSL-native** (`/home/aria/projects/job-aggregator` on ext4).
Everything below runs under WSL — never from the Windows side or the `D:\` backup copy.

This recipe exists because ad-hoc launches keep hitting the same three traps:

1. **Login-shell PATH.** Hermes background jobs must launch WSL with `wsl bash -lc`
   (login shell), not `bash -c`, or nvm's node/npx are missing and npm dies with
   `Error: Maximum call stack size exceeded`.
2. **Process survival.** Each server must be its own tracked Hermes background job,
   launched with explicit NVM sourcing + `exec` + absolute `/home/aria/...` paths.
   A naive `&`-backgrounded process inside a one-shot `wsl bash -c` dies the moment
   that bash exits.
3. **Docker → Postgres race.** On a cold start, `docker compose up -d` + `npm run dev`
   in one shot loses the race: the backend boots before Postgres is healthy and Prisma
   exits with `P1001 Can't reach database server`. Docker Desktop also has to be
   started manually from Windows first.

## Exact launch sequence

1. **Start Docker Desktop** (manual, from Windows; daemon + CLI then work from WSL):
   ```bash
   powershell.exe -NoProfile -Command \
     "Start-Process 'C:\Users\aria\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe'"
   ```

2. **Wait for Postgres to be healthy** (not just "container started"):
   ```bash
   wsl -d Ubuntu -- bash -lc \
     'docker inspect -f "{{.State.Health.Status}}" job-aggregator-db'
   # must return: healthy
   ```

3. **Launch the backend** as a tracked Hermes background job:
   ```bash
   wsl -d Ubuntu -- bash -lc \
     'export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; \
      cd /home/aria/projects/job-aggregator/backend && exec npx tsx src/index.ts'
   ```

4. **Launch the frontend** as a separate tracked Hermes background job:
   ```bash
   wsl -d Ubuntu -- bash -lc \
     'export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; \
      cd /home/aria/projects/job-aggregator/frontend && exec npx vite --port 5173 --host'
   ```

5. **Verify health** from the Windows host (confirms WSL2 localhost forwarding too):
   ```bash
   curl.exe -s -m 5 http://localhost:3000/api/health   # backend: storage:"PrismaStorage (PostgreSQL)"
   curl.exe -s -m 5 http://localhost:5173/api/health   # via frontend proxy — must reach backend
   ```

6. **Open the preview pane** in the Hermes desktop app:
   - `open_preview http://localhost:5173` (label e.g. "job-aggregator")

## Sanity checks

- Backend log should show `PrismaStorage connected (PostgreSQL)`, the 5 adapters, and
  `🚀 Backend running on http://localhost:3000`.
- Frontend log should show `VITE ... ready` and `Local: http://localhost:5173/`.
- To confirm the UI truly renders (not just "server up"), load it in a real browser and
  assert **0 console/JS errors**; dashboard metrics (Total Jobs / Applications) come from
  the live DB, so non-zero counts prove the API→DB path is working.
- Distinguish **live** jobs from stale ones: if a background job's launch used
  `bash -c` or exited with Prisma `P1001`, it is superseded — the current job has
  `bash -lc` in its command and is still `running`.

## Shut down

Kill the two tracked background jobs (frontend + backend). Keep Postgres (`docker compose
down`) running if you want the dev DB warm; stop it to free port 5432.