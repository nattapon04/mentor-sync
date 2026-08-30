# MentorSync — Production Deployment

## Current setup (free tier)

| Layer | Provider | URL |
|---|---|---|
| Frontend | [Vercel](https://vercel.com) | https://mentor-sync-virid.vercel.app |
| Backend | [Render](https://render.com) — Web Service, Docker runtime | https://mentor-sync.onrender.com |
| Database | [Neon](https://neon.tech) — Postgres, **direct** (non-pooler) endpoint | — |

Repo: `nattapon04/mentor-sync`. Both Render and Vercel auto-deploy on every push to `main` (no staging environment) — a push to `main` goes live immediately on both.

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
