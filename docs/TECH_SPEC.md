# MentorSync - Technical Specification (Tech Lead)

## 1. Architecture Overview
MentorSync is a containerized web application utilizing a decoupled client-server architecture.
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide Icons, Recharts.
- **Backend**: Go (Golang) 1.25 using Fiber v2 framework.
- **Database**: PostgreSQL 15, managed via GORM (Go Object Relational Mapper).
- **Deployment**: Docker & Docker Compose (Standalone mode for Next.js, Alpine for Go).

### Backend package layout
- `config`: loads and validates all environment variables once at boot (`config.Load()`), failing fast on anything required-but-missing instead of surfacing a confusing failure later.
- `database` / `database/migrations`: connection setup and versioned schema/seed migrations (see section 6).
- `models`: GORM structs.
- `handlers`: HTTP handlers as methods on a `*handlers.Handlers` struct (holds `*gorm.DB` and the JWT secret) — dependencies are injected at construction (`handlers.New(db, jwtSecret)`) rather than read from a package-level global, which is what makes handler logic testable (see `handlers/*_test.go`, run against a per-test transaction on the local Postgres).
- `middleware`: shared Fiber middleware, currently `RequireRole(...)` for role-based route guards.
- `routes`: wires every route onto the Fiber app (`routes.Register(app, h)`), grouped by domain with role guards applied per docs/BA_REQUIREMENTS.md.
- `main.go`: thin bootstrap — load config, connect DB, migrate, construct handlers, register routes, listen.
- Request validation uses `go-playground/validator` struct tags on input DTOs (`handlers.bindAndValidate`); error responses go through one `respondError` helper for a consistent `{"error": "..."}` shape and named status constants.
- Logging is structured via stdlib `log/slog` (JSON handler), not `log.Println`.

## 2. Database Schema (GORM)

### `User`
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `password_hash` (String)
- `name` (String)
- `department` (String) - e.g., "Engineering", "QA"
- `roles` (JSONB) - Array of roles: `["admin", "mentor", "mentee"]`

### `SLARule`
- `id` (UUID, Primary Key)
- `name` (String)
- `metric_type` (String) - `quality`, `velocity`, `soft_skill`
- `eval_type` (String) - `ticket`, `sprint`, or `both` (default `both`); see [`docs/SLA_METRICS.md`](./SLA_METRICS.md) for measurement criteria per rule
- `target_value` (String) - e.g., "<= 24h", "100%"
- `scope` (String) - e.g., "global", "Engineering"
- `is_active` (Boolean)

### `JiraEvaluation`
- `id` (UUID, Primary Key)
- `mentee_id` (UUID, FK -> User)
- `evaluator_id` (UUID, FK -> User)
- `jira_ticket_id` (String)
- `created_at` (Timestamp)

### `EvaluationMetric`
- `id` (UUID, Primary Key)
- `evaluation_id` (UUID, FK -> JiraEvaluation)
- `sla_rule_id` (UUID, FK -> SLARule)
- `value_numeric` (Float, Nullable)
- `value_string` (String) - e.g., "Pass", "Fail", "N/A"
- `comment` (String)

### `EarnedBadge`
- `id` (UUID, Primary Key)
- `mentee_id` (UUID, FK -> User)
- `awarded_by_id` (UUID, FK -> User)
- `badge_type` (String) - e.g., "zero_defect", "one_shot"
- `created_at` (Timestamp)

### `GeneralNote`
- `id` (UUID, Primary Key)
- `mentee_id` (UUID, FK -> User)
- `author_id` (UUID, FK -> User)
- `note_type` (String) - `positive`, `neutral`, `constructive`
- `message` (Text)

## 3. API Design (RESTful)
Base URL: `http://localhost:8000/api`
Authentication: JWT via `Authorization: Bearer <token>` header. Beyond a valid token, some routes also require a role — enforced by `middleware.RequireRole` (see `routes/routes.go`), not just checked client-side:

- **Auth**: `POST /auth/login` (unprotected)
- **Users**: `GET /users`, `GET /users/:id` (any authenticated role); `POST/PUT/DELETE /users` (admin only); `POST /users/:mentorId/assign-mentee`, `/unassign-mentee` (mentor or admin); `PUT /users/:id/preferences` (any authenticated role)
- **SLA Rules**: `GET /sla-rules` (any authenticated role; supports `?scope=` and `?eval_type=` filtering, `eval_type=both` rules always match); `POST/PUT/DELETE /sla-rules` (mentor or admin)
- **Evaluations**: `GET /evaluations` (any authenticated role; supports `?mentee_id=` filtering); `POST/DELETE /evaluations` (mentor or admin)
- **Badges**: `GET /badges` (any authenticated role); `POST/DELETE /badges` (mentor or admin)
- **Notes**: `GET /notes` (any authenticated role); `POST/PUT/DELETE /notes` (mentor or admin)
- **Reports**: `GET /reports/team` (mentor or admin)

*Note: The `CreateEvaluation` endpoint uses a Database Transaction to ensure the `JiraEvaluation` and its associated `EvaluationMetric`s are created atomically.*

## 4. Frontend State & Context
- `AuthContext`: Manages JWT, User Session, Role-Based Access Control (RBAC), and `isInitialized` state to prevent premature redirects.
- `LanguageContext`: Manages i18n (`en`, `th`) via a static dictionary.
- `ThemeContext`: Manages Tailwind themes (`light`, `dark`, `ocean`) via CSS variables.

## 5. Build & Deployment
- **Backend Build**: Compiles to a statically linked Linux binary (`CGO_ENABLED=0 GOOS=linux`) to run in a scratch/alpine container, as a non-root user.
- **Backend dev commands**: `backend/Makefile` — `make run` (start the API), `make migrate` (apply migrations as a standalone step), `make test`, `make vet`, `make lint` (runs `golangci-lint`, config in `backend/.golangci.yml`), `make build`, `make tidy`.
- **Frontend Build**: Uses Next.js `output: "standalone"` to reduce container size. Tracing output is copied to the final Alpine node image.
- **Frontend tests**: `npm test` (Vitest + React Testing Library, config in `frontend/vitest.config.ts`).
- **Compose**: Run `docker-compose up -d --build` to spin up `postgres`, `backend`, and `frontend` services.

## 6. Database Migrations
Schema and seed data are managed by versioned migrations in `backend/database/migrations/` (using [gormigrate](https://github.com/go-gormigrate/gormigrate)), not `gorm.AutoMigrate` at boot.

- **Adding a change**: append a new `*gormigrate.Migration{ID: "...", Migrate: ...}` entry to `all()` in `migrations.go`. **Never edit a migration that may have already run anywhere** (a teammate's machine, staging, prod) — add a new one instead, so existing data/schema is never dropped or rewritten.
- **Seeding**: use `seedUserIfMissing` / `seedSLARuleIfMissing` (in `seed_data.go`) so seed migrations are idempotent and safe to re-run.
- **Local dev / single-instance deploys**: migrations run automatically on API server boot (`main.go`), unless `DB_AUTO_MIGRATE=false`.
- **Production / multi-replica deploys**: set `DB_AUTO_MIGRATE=false` on the API server and run the standalone `migrate` binary (`go run ./cmd/migrate`, or the `migrate` binary built into the Docker image) as a one-off step before rolling out — avoids multiple replicas racing to migrate concurrently.
