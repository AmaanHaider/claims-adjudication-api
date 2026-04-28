# Claims Adjudication API

API-only claims adjudication system (deterministic, rule-based).

This submission focuses on domain modeling, adjudication logic, lifecycle state handling, and explainable decisions. It intentionally does not include a frontend.

## Stack

- Node.js + Express
- PostgreSQL + Sequelize
- Vitest + Supertest
- Swagger/OpenAPI

## Environment variables

Create a `.env` file (do **not** commit it). See `.env.example`.

- **`DATABASE_URL`**: PostgreSQL connection string
  - Local example: `postgres://USER:PASSWORD@localhost:5432/claims_adjudication`
  - Hosted (e.g. Railway): use the provided `DATABASE_URL`
- **`PORT`** (optional): defaults to `3000`

Note: integration/API tests use your configured `DATABASE_URL`. If it points to a hosted DB, tests may be slower.

## Install

```bash
npm install
```

## Seed the database

This assignment uses `sequelize.sync()` for setup simplicity (production should use migrations).

```bash
npm run db:seed
```

## Run the server

```bash
npm run dev
```

Health check:

```bash
curl -s http://localhost:3000/health
```

## Swagger / OpenAPI

When the server is running:

- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/api-docs.json`

## Run tests

```bash
npm test -- --run
```

## What is implemented

- Claim submission with multiple line items
- Policy/version resolution per line item using each line item's `dateOfService`
- Line-item adjudication against stored coverage rules
- Claim and line-item lifecycle states
- Human-readable explanations on decisions
- Manual review, payment, and dispute endpoints
- Swagger/OpenAPI documentation

## Known limitations

- `AuditLog` is modeled but not yet populated by lifecycle actions.
- Deductible behavior is represented in the rule model but not fully implemented end to end.
- Integration tests use the configured `DATABASE_URL`, so a hosted Postgres instance can make test runs slower than local development.

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
