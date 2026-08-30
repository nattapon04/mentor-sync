# MentorSync — Production-Readiness Checklist

## Context

This checklist follows on from the SLA `eval_type` split and the migration-file switch already done in this codebase (see `backend/database/migrations/`, `docs/SLA_METRICS.md`). Two audits (backend handlers, frontend pages) were run to find concrete, file-level production-readiness gaps rather than generic advice. This document tracks that work as a checklist — check items off as they land, and append new items rather than rewriting ones already done (same additive discipline as the migrations themselves, see the doc-comment at the top of `backend/database/migrations/migrations.go`).

Nothing below is implemented yet.

---

## Tier 0 — Security & correctness
*Real bugs/holes, not style preferences. Do these first regardless of how far the rest of the plan goes.*

- [x] **0.1 — Add RBAC enforcement.** Today the JWT middleware (`main.go:56-58`) only checks the token is validly signed; no handler reads the `roles` claim, so any authenticated user (mentee included) can call admin-only endpoints (`CreateUser`/`DeleteUser`, `AwardBadge`, `CreateSLARule`/`DeleteSLARule`, `AssignMentee`/`UnassignMentee`).
  - Add `middleware/rbac.go`: a `RequireRole(roles ...string)` Fiber middleware reading the roles claim already present in the JWT (set in `auth_handler.go`'s `jwt.MapClaims{"roles": ...}`).
  - Apply per route group in `main.go`: admin-only → user CRUD, SLA rule CRUD; mentor-or-admin → badges, notes, evaluations, assign/unassign mentee.
  - Verify: `curl` an admin-only route with a mentee's JWT → expect 403, not 200.

- [x] **0.2 — Kill the hardcoded JWT secret fallback.** `"supersecretkey"` is duplicated in `main.go:54` and `auth_handler.go:42`, used silently if `JWT_SECRET` is unset.
  - Fold into the config package from 1.1 (or, if doing Tier 0 only, a minimal `os.Getenv("JWT_SECRET")` read once in `main.go` and passed in — but `log.Fatal` if empty instead of falling back).
  - Verify: unset `JWT_SECRET` and confirm the server refuses to start rather than booting with the public default.

- [x] **0.3 — Fix mass-assignment in `UpdateSLARule`** (`sla_handler.go:52-67`) and audit `UpdateNote`/`UpdateUser` for the same shape: loading the row then `BodyParser`-ing raw client JSON onto it lets a client overwrite `id`/`is_active`/any field.
  - Bind into a small per-handler update-DTO struct (only the fields that should be client-editable), then apply those fields explicitly to the loaded row.
  - Verify: PUT a payload containing `"is_active": false` alongside real edits to a rule that should stay active-only-via-explicit-field — confirm untouched fields can't be smuggled in.

- [x] **0.4 — Make the auto-badge goroutine crash-safe** (`evaluation_handler.go:85,116-195`): fire-and-forget after every evaluation create, ignores every DB error, no `recover()` — a panic here takes down the whole process.
  - Wrap the goroutine body in `defer func(){ if r := recover(); r != nil { /* log */ } }()`; check and log (don't ignore) the DB errors currently discarded on lines like 122, 132-134, 143.
  - Verify: temporarily force a panic in the goroutine body, confirm the server logs it and keeps serving other requests.

- [x] **0.5 — Fix the frontend Docker build's env-var wiring.** `frontend/.dockerignore` doesn't exclude `.env*`, so `COPY . .` silently bakes in whatever `NEXT_PUBLIC_API_URL` happens to be in the developer's local `.env.local` at image-build time; `docker-compose.yml`'s `environment:` for the frontend service does nothing (Next.js inlines `NEXT_PUBLIC_*` at build time, not container start).
  - Add `ARG NEXT_PUBLIC_API_URL` + `ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL` before `RUN npm run build` in `frontend/Dockerfile`.
  - Wire `build.args: NEXT_PUBLIC_API_URL` in `docker-compose.yml`'s frontend service.
  - Add `.env*` to `frontend/.dockerignore`.
  - Verify: `docker compose build frontend` with no local `.env.local` present still produces a working build pointed at the right API URL.

---

## Tier 1 — Backend structure
*Depends on Tier 0 existing (RBAC middleware, config needs). Touches every handler file — mechanical but broad.*

- [x] **1.1 — Centralize config** in the currently-empty `backend/config/` (dead scaffolding today — nothing imports it): one struct loaded once at boot (`DB_HOST/USER/PASSWORD/NAME/PORT`, `JWT_SECRET`, `PORT`, `DB_AUTO_MIGRATE`), validated with fatal errors for anything required-but-missing. Replaces the scattered `os.Getenv` calls 0.2 touched.
- [x] **1.2 — Split routing** out of `main.go` into the currently-empty `backend/routes/` (e.g. `routes/routes.go` exposing `Register(app *fiber.App)`), grouped by domain with 0.1's RBAC middleware applied per group. `main.go` becomes: load config → connect DB → migrate → `routes.Register(app)` → listen.
- [x] **1.3 — Testability**: replace the package-level `database.DB` global with a small `Handlers` struct holding `*gorm.DB`, constructed once in `main.go`/tests and passed into route registration. Add the first real test (`auth_handler_test.go` + one CRUD resource, via `httptest`) — there are currently zero `*_test.go` files in the repo.
- [x] **1.4 — Request validation**: add `go-playground/validator` (not currently a dependency), validate Create/Update DTOs (non-empty email/name, valid enum values for `metric_type`/`eval_type`/`role`) before hitting the DB.
- [x] **1.5 — Structured logging**: replace bare `log.Println` with stdlib `log/slog` (no new dependency) — leveled, structured logs for migration steps and handler errors (especially 0.4's recovered panics).
- [x] **1.6 — Consistent error responses**: one `respondError(c *fiber.Ctx, status int, msg string) error` helper used everywhere, fixing the inconsistent `fiber.StatusXxx`-constant vs. raw-int style found across `user_handler.go`/`badge_handler.go`/`note_handler.go` vs. the rest.

*Verify after this tier*: `go build ./...`, `go vet ./...`, `go test ./...`; re-run the migration smoke test (`docker compose up -d db`, `go run ./cmd/migrate`).

---

## Tier 2 — Frontend structure
*Do 2.2 and 2.3 before 2.1 — the shared types/constants need to exist before the mechanical fetch-call replacement uses them.*

- [x] **2.2 — Consolidate duplicated types** into `src/types/`: `SLARule` (3 near-duplicate declarations across `criteria/page.tsx`, `mentees/[id]/page.tsx`, `dashboard/page.tsx`), `User`/`UserModel` (2, in `admin/users/page.tsx` and `dashboard/page.tsx`), `MetricInput` (2). Introduce a shared `Evaluation` type to replace `evaluations: any[]` used everywhere today.
- [x] **2.3 — Shared constants module** (`src/lib/constants.ts`): role literals (`"admin"|"mentor"|"mentee"`) as a typed union instead of raw string comparisons scattered across `admin/users`, `layout.tsx`, `dashboard`; the duplicated time-range options (`"30"|"90"|"365"|"all"` in `dashboard`, `my-dashboard`, `reports`); pass/fail thresholds from `dashboard/page.tsx:211-212`.
- [x] **2.1 — Wire up `lib/api.ts`** (an axios client with an auth interceptor — reads `localStorage["mentor_sync_token"]`, matches `AuthContext`'s key — exists today but is never imported anywhere) and replace all ~17 hand-rolled `fetch(...) + manual Authorization header` call sites across `admin/users`, `dashboard`, `my-dashboard`, `reports`, `login`, `(main)/layout.tsx` (and `criteria`/`mentees/[id]`, touched earlier, for consistency).
- [x] **2.4 — Real error UX**: only `login/page.tsx` currently surfaces fetch errors to the user; every other page does `catch(err){ console.error(err) }` and silently no-ops. Add a minimal shared pattern (a small `useApiState` hook, or a consistent inline error banner) so a failed request is visible instead of a page quietly showing stale/empty data.
- [x] **2.5 — Frontend tests**: introduce Vitest + React Testing Library (zero test files/config exist today), one smoke test per major page plus a test for `lib/api.ts`.

*Verify after this tier*: `npx tsc --noEmit -p .`; `npx vitest run`.

---

## Tier 3 — Polish
*Cheap, do alongside whichever tier is chosen.*

- [x] **3.1** — Resolve `backend/config/` and `backend/routes/`: either they gain real content from 1.1/1.2, or (if Tier 1 is skipped) delete the empty dead scaffolding.
- [x] **3.2** — Add `backend/Makefile` (`make run`, `make migrate`, `make test`, `make lint`) and a `.golangci.yml` — no linter config exists today.
- [x] **3.3** — Decide on the JWT library duplication: app code signs with `golang-jwt/jwt/v5` directly while `gofiber/jwt/v3` transitively pulls in `golang-jwt/jwt/v4`. Not urgent; revisit once 1.1's config work touches auth.
  - Resolved: replaced `gofiber/jwt/v3` (unmaintained) with its actively-maintained successor `gofiber/contrib/jwt`, which itself depends on `golang-jwt/jwt/v5` — the same version already used to sign tokens in `auth_handler.go`. `golang-jwt/jwt/v4` is now gone from `go.mod` entirely; the whole app is on one JWT library/version. Verified live: login, valid-token access, missing/garbage-token rejection, and role-based 403s all still behave correctly.

---

## Verification summary

- Backend: `go build ./...` and `go vet ./...` after every checked box (established pattern already used this session); re-run the migration smoke test against the local `mentorsync-db` container after any schema/model touch; `go test ./...` once 1.3 lands.
- Frontend: `npx tsc --noEmit -p .` after every checked box; `npx vitest run` once 2.5 lands.
- RBAC (0.1): manual `curl` check — a mentee JWT hitting an admin-only endpoint must get 403, not 200.
