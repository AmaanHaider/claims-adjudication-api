# Claims Adjudication API

Claims processing API that adjudicates insurance claim line items against stored coverage rules and tracks claim lifecycle state.

## Features

- Submit claims with multiple line items
- Line-item adjudication with payable amount + human-readable explanation
- Annual limit tracking via a usage ledger
- Claim + line-item lifecycle actions (review, pay, dispute)
- Swagger UI for interaction

## Requirements

- Node.js (18+ recommended)
- PostgreSQL

## Setup

1) Create a `.env` (do **not** commit it). See `.env.example`.

- `DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/claims_adjudication`
- `PORT=3000` (optional)

2) Ensure Postgres is running and create the database

- Start Postgres (example using Homebrew):

```bash
brew services start postgresql
```

- Create the database (adjust user/host if needed):

```bash
createdb claims_adjudication
```

3) Install dependencies

```bash
npm install
```

4) Seed the database

```bash
npm run db:seed
```

5) Run the server

```bash
npm run dev
```

## Usage

Health check:

```bash
curl -s http://localhost:3000/health
```

Swagger UI: `http://localhost:3000/api-docs`

## Tests

Unit tests:

```bash
npm run test:unit -- --run
```

Integration/API tests require `DATABASE_URL` (they will be skipped if it's not set):

```bash
npm run test:api -- --run
```

Notes:

- API tests run against the database referenced by `DATABASE_URL`. For best reliability and speed, point this to a local Postgres database.

## AI artifacts (chat exports)

- `ai-artifacts/chat-export-*.md`
- `ai-artifacts/prompts.md`
- `ai-artifacts/corrections.md`

## Example: submit a claim

```bash
curl -s -X POST http://localhost:3000/claims \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": 1,
    "providerName": "City Health Clinic",
    "diagnosisCodes": ["M54.5"],
    "lineItems": [
      { "serviceType": "physical_therapy", "amountCents": 30000, "dateOfService": "2026-04-10" },
      { "serviceType": "dental", "amountCents": 15000, "dateOfService": "2026-04-10" },
      { "serviceType": "mri", "amountCents": 120000, "dateOfService": "2026-04-10" }
    ]
  }'
```
