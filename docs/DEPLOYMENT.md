# MentorSync — Production Deployment

## Current setup (free tier)

| Layer | Provider | URL |
|---|---|---|
| Frontend | [Vercel](https://vercel.com) | https://mentor-sync-virid.vercel.app |
| Backend | [Render](https://render.com) — Web Service, Docker runtime | https://mentor-sync.onrender.com |
| Database | [Neon](https://neon.tech) — Postgres, **direct** (non-pooler) endpoint | — |

Repo: `nattapon04/mentor-sync`. Both Render and Vercel auto-deploy on every push to `main` (no staging environment) — a push to `main` goes live immediately on both.

## Step-by-step: deploying from scratch

Do these in order — each later step needs an output from the one before it.

### 1. Neon (Postgres)

1. Sign up at https://neon.tech (GitHub login is fastest).
2. Create a project (any name, e.g. `mentorsync`).
3. On the project's **Connect**/**Connection Details** page, get the connection string, or switch the view to **Parameters**/`.env` if available to get the fields individually.
4. From it, pull out `user`, `password`, `database`, and **host** — use the **direct** host (no `-pooler` in it); if you only have the pooled one, just drop the `-pooler` segment. See gotcha #3 below for why.

### 2. Render (Backend)

1. Sign up at https://render.com, connect your GitHub account.
2. New → Web Service → select the repo.
3. **Root Directory**: `backend` · **Runtime**: Docker · **Plan**: Free · **Health Check Path**: `/api/health`.
4. Environment variables:
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT=5432`, `DB_SSLMODE=require` (from step 1)
   - `JWT_SECRET` — a long random string
   - `CORS_ALLOW_ORIGINS=*` (temporary — locked down in step 4)
5. Deploy, then note the URL Render gives you (e.g. `https://<service>.onrender.com`).
6. Once it's up, confirm with `curl https://<service>.onrender.com/api/health` — expect `{"status":"success", ...}`.

### 3. Vercel (Frontend)

1. Sign up at https://vercel.com, connect GitHub.
2. Import the repo, set **Root Directory**: `frontend`.
3. Environment variable: `NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com/api`.
4. Deploy, note the resulting URL (e.g. `https://<project>.vercel.app`).

### 4. Lock down CORS

Back in Render, change `CORS_ALLOW_ORIGINS` from `*` to the exact Vercel origin from step 3 (no trailing slash), e.g.:

```
CORS_ALLOW_ORIGINS=https://<project>.vercel.app
```

Saving triggers an automatic redeploy. Verify with a preflight check:

```bash
curl -s -i -X OPTIONS "https://<render-service>.onrender.com/api/auth/login" \
  -H "Origin: https://<project>.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" | grep -i access-control-allow-origin
```

It should echo back the Vercel origin; the same request with an unrelated `Origin` should return no `access-control-allow-origin` header at all.

### 5. Smoke test

Open the Vercel URL and confirm the login page renders, then log in with a real account (see README's "Default login" section for the seeded admin on a fresh database) and confirm the dashboard loads data from the backend without CORS errors in the browser console.

## Backend (Render)

- **Root Directory**: `backend` · **Runtime**: Docker · **Health Check Path**: `/api/health`
- Environment variables (set in Render dashboard, not committed):
  - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT=5432`, `DB_SSLMODE=require` — from Neon. Use the **direct** host (no `-pooler` in the hostname), not the pooled one — see gotcha below.
  - `JWT_SECRET` — long random string.
  - `CORS_ALLOW_ORIGINS=https://mentor-sync-virid.vercel.app` — locked to the exact frontend origin (was temporarily `*` during initial setup).
  - `DB_AUTO_MIGRATE` is unset → defaults to `true` (see `backend/config/config.go`), so pending migrations run automatically on every boot/deploy. This is fine as long as Render runs a single instance; if this ever scales to multiple concurrent instances, switch to `DB_AUTO_MIGRATE=false` and run `cmd/migrate` as a separate pre-deploy step instead, to avoid concurrent migration runs.

## Frontend (Vercel)

- **Root Directory**: `frontend`
- Environment variable: `NEXT_PUBLIC_API_URL=https://mentor-sync.onrender.com/api`
- `next.config.ts` sets `output: "standalone"` **only when not building on Vercel** (`process.env.VERCEL` is unset locally/in Docker, set to `1` by Vercel's own build). `standalone` output is required by `frontend/Dockerfile` for self-hosting but conflicts with Vercel's own build/output tracing — see gotcha below.

## Gotchas hit during first deploy (fixed, keep in mind for the future)

1. **`backend/.gitignore` accidentally excluded `cmd/migrate` source.** A bare `migrate` pattern (no leading `/`) matches a directory of that name at any depth, not just the intended `backend/migrate` compiled binary — so `backend/cmd/migrate/main.go` was silently never committed, and Render's Docker build failed with `stat /app/cmd/migrate: directory not found`. Fixed by anchoring the patterns (`/server`, `/migrate`). **Lesson**: unanchored gitignore patterns can silently swallow source directories that happen to share a name with a build artifact — anchor with a leading `/` when the intent is "only this exact path."
2. **`output: "standalone"` breaks Vercel builds.** It's needed for `frontend/Dockerfile`'s multi-stage copy (`COPY --from=builder /app/.next/standalone ./`), but Vercel does its own output tracing/optimization and standalone mode conflicts with it, failing with `ENOENT: .next/next-server.js.nft.json`. Fixed by making it conditional on `process.env.VERCEL`.
3. **Neon's pooled connection string (hostname with `-pooler`)** uses PgBouncer transaction-mode pooling, which can conflict with how GORM/pgx handle prepared statements (intermittent `prepared statement does not exist` errors). Since Render's free tier runs a single instance, there's no need for connection pooling — use Neon's **direct** host instead. Revisit if this ever scales to multiple backend instances hitting Neon concurrently.

## Rotating secrets / redeploying manually

- Render and Vercel dashboards both have a manual "Redeploy latest commit" action if auto-deploy needs to be re-triggered without a new push.
- Changing an env var in either dashboard triggers an automatic redeploy with the new value.
