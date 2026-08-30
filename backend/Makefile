.PHONY: run migrate test lint build tidy vet

# Run the API server (schema/seed migrations run automatically unless DB_AUTO_MIGRATE=false).
run:
	go run .

# Apply pending database migrations as a standalone step (see cmd/migrate and
# docs/TECH_SPEC.md section 6) — use this for production/multi-replica deploys instead of
# relying on `run`'s DB_AUTO_MIGRATE convenience path.
migrate:
	go run ./cmd/migrate

test:
	go test ./...

vet:
	go vet ./...

lint:
	golangci-lint run ./...

build:
	go build ./...

tidy:
	go mod tidy
