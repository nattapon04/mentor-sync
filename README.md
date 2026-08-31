# MentorSync

A developer mentorship & SLA tracking platform. Mentors configure SLA metrics (per ticket, per sprint, or both), evaluate mentees against them, award gamified badges, and leave quick feedback notes — mentees get a personal performance dashboard, and admins/mentors get team-wide reports.

## Stack

- **Backend**: Go 1.25, [Fiber v2](https://gofiber.io/), [GORM](https://gorm.io/) over PostgreSQL 15
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Recharts
- **Auth**: JWT with role-based access control (admin / mentor / mentee)
- **Migrations**: versioned, additive-only migrations via [gormigrate](https://github.com/go-gormigrate/gormigrate) (see `docs/TECH_SPEC.md#6-database-migrations`)
- **Tests**: Go's `testing` package (backend) + Vitest/React Testing Library (frontend)

## Features

- SLA rule configuration scoped to a department or global, and to ticket-level, sprint-level, or both (`docs/SLA_METRICS.md` documents what each default metric measures and how to score it)
- Per-ticket and per-sprint mentee evaluations, with automatic badge awards (e.g. 3 consecutive clean tickets → "Zero Defect")
- Manual badge awarding and quick feedback notes (positive / neutral / constructive)
- Team dashboard, personal mentee dashboard, and aggregated department reports
- English/Thai UI (`th`/`en`) and light/dark/ocean themes

## Getting started

### Docker Compose (recommended)

```bash
docker-compose up -d --build
```

This starts Postgres, the API (`:8000`), and the frontend (`:3000`), and runs pending migrations automatically on backend boot.

### Local dev

**Backend** (needs a local Postgres — `docker-compose up -d db` works for this too):

```bash
cd backend
cp .env.example .env   # fill in DB_* and JWT_SECRET
make run                # or: go run .
```

**Frontend**:

```bash
cd frontend
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` to your backend's `/api` URL (e.g. `http://localhost:8000/api`).

### Default login (fresh/seeded database only)

`docker-compose.yml` sets `SEED_USER_PASSWORD=password`, so on a local Docker Compose setup the seeded accounts log in with `admin@mentorsync.com` / `password` (also `mentor@mentorsync.com`, `mentee@mentorsync.com`). Running the backend outside Docker Compose without `SEED_USER_PASSWORD` set generates a random one-time password for these accounts and logs it once instead — check your server's log output. Never set `SEED_USER_PASSWORD=password` on a deploy reachable from outside your machine.

## Backend commands

```bash
make run       # start the API server
make migrate   # apply pending DB migrations as a standalone step
make test      # go test ./...
make vet       # go vet ./...
make lint      # golangci-lint run ./... (config: backend/.golangci.yml)
make build     # go build ./...
```

## Frontend commands

```bash
npm run dev    # dev server
npm run build  # production build
npm test       # vitest run
npm run lint   # eslint
```

## Project docs

- [`docs/BA_REQUIREMENTS.md`](docs/BA_REQUIREMENTS.md) — roles, business rules, user journeys
- [`docs/TECH_SPEC.md`](docs/TECH_SPEC.md) — architecture, schema, API design, migrations
- [`docs/SLA_METRICS.md`](docs/SLA_METRICS.md) — every default SLA metric and how to score it
- [`docs/PRODUCTION_READINESS_CHECKLIST.md`](docs/PRODUCTION_READINESS_CHECKLIST.md) — the hardening checklist this codebase was built against
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — how the app is deployed (Vercel/Render/Neon), required env vars, and gotchas hit along the way
