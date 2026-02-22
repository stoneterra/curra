# Local Tooling Setup (Mac)

Last updated: 2026-02-22

This project currently needs Node.js + pnpm to run build/test scripts.

## 1) Install Xcode CLI tools

```bash
xcode-select --install
```

## 2) Install Homebrew (if missing)

Check:

```bash
brew --version
```

If missing:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## 3) Install Node.js 20 and pnpm

```bash
brew install node@20
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm -v
node -v
```

## 4) Install PostgreSQL client tools

```bash
brew install postgresql@16
psql --version
```

## 5) Optional: run Postgres locally with Docker

```bash
docker --version
docker run --name curra-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=curra \
  -p 5432:5432 \
  -d postgres:16
```

## 6) Install project dependencies (from repo root)

```bash
pnpm install
```

## 7) Run typecheck/build

```bash
pnpm typecheck
pnpm build
```

## 8) Run API service (scaffold)

```bash
pnpm --filter @curra/curra-api dev
```

## 9) Persistence mode config

Default is in-memory:

```bash
export CURRA_PERSISTENCE_MODE=memory
```

Postgres-backed mode:

```bash
export CURRA_PERSISTENCE_MODE=postgres
export DATABASE_URL=\"postgres://postgres:postgres@localhost:5432/curra\"
```

Then apply migrations in your SQL tool using:

1. `/Users/stoneatwine/Curra Project/services/curra-api/src/db/migrations/0001_init.sql`
2. `/Users/stoneatwine/Curra Project/services/curra-api/src/db/migrations/0002_payroll_run_metadata.sql`
3. `/Users/stoneatwine/Curra Project/services/curra-api/src/db/migrations/0003_event_consumption_log.sql`

Or run migrations directly:

```bash
pnpm --filter @curra/curra-api migrate
```

## 10) Eversend sandbox env (worker)

Set these before running workers with external connector enabled:

```bash
export EVERSEND_BASE_URL="https://api.eversend.co/v1"
export EVERSEND_CLIENT_ID="<sandbox-client-id>"
export EVERSEND_CLIENT_SECRET="<sandbox-client-secret>"
export EVERSEND_WEBHOOK_SECRET="<sandbox-webhook-secret>"
export EVERSEND_SOURCE_WALLET="<sandbox-source-wallet-id>"
export CURRA_PAYOUT_PROVIDER="eversend"
export CURRA_REQUIRE_EXTERNALS=true
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/curra"
export CURRA_DISBURSEMENT_CONSUMER_NAME="netpay-disbursement-worker"
export CURRA_DISBURSEMENT_POLL_INTERVAL_MS=5000
export CURRA_DISBURSEMENT_BATCH_SIZE=20
```

For provider-switch demo without external API calls:

```bash
export CURRA_PAYOUT_PROVIDER="manual"
```

Run workers:

```bash
pnpm --filter @curra/curra-workers dev
```
