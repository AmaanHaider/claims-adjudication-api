# Engineering Decisions

## Scope built

Implemented endpoints:

- `GET /health`
- Claims:
  - `POST /claims`
  - `GET /claims`
  - `GET /claims/:id`
  - `POST /claims/:id/review`
  - `POST /claims/:id/pay`
  - `POST /claims/:id/dispute`
- Members:
  - `GET /members`
  - `GET /members/:id`
- Policies:
  - `GET /policies`
  - `GET /policies/:id`

API documentation:

- Swagger UI at `/api-docs`
- OpenAPI JSON at `/api-docs.json`

## Tech stack decisions

- **Node.js + Express**: simple, common REST stack for an API-only assignment.
- **PostgreSQL + Sequelize**: relational modeling for policies, versions, rules, claims, and ledgers with transactional writes.
- **Vitest**: fast unit test runner for deterministic adjudication logic.
- **Supertest**: end-to-end API testing against the Express app.
- **Swagger/OpenAPI**: reviewer-friendly endpoint documentation and examples.

## Why API-only

- The goal is adjudication behavior, state transitions, and persistence—UI would add scope without improving evaluation of backend design.

## Why PostgreSQL + Sequelize

- The domain is naturally relational: members ↔ enrollments ↔ policies ↔ versions ↔ rules; claims ↔ line items ↔ decisions; usage ledger; payments; disputes.
- Sequelize provides model definitions, associations, and transactions without building a full SQL layer from scratch.

## Why deterministic rule engine (no AI at runtime)

- Adjudication must be explainable, reproducible, and auditable.
- The system returns explicit explanations and uses fixed rules stored as DB rows (coverage rules linked to policy versions).

## Coverage rule representation

- Coverage is represented as `CoverageRule` rows keyed by `policyVersionId + serviceType`.
- Rules encode:
  - `covered` (boolean)
  - `payPercent` (0–100)
  - optional `annualLimitCents`
  - optional `reviewRequiredOverCents`
  - optional `explanationTemplate`

This keeps adjudication logic simple while allowing policy changes over time via `PolicyVersion`.

## Important implementation choices

- **Line-item policy version resolution**:
  - Claim submission resolves policy version **per line item** using each line item’s `dateOfService`.
  - This allows a single claim spanning policy changes to adjudicate each line item against the correct version’s rules.
- **Usage ledger semantics**:
  - `UsageLedger.usedAmountCents` tracks approved `allowedAmountCents`, not insurer-paid amount.
  - This was chosen because annual benefit exhaustion is typically about covered usage consumed against a benefit cap, not only the carrier payment after coinsurance.
- **Manual review as a state transition, not a new decision engine**:
  - Review currently changes `needs_review` items to `manually_approved` or `manually_denied`.
  - Manual approval reuses the same adjudication constraints as automatic adjudication (e.g. annual limits), so reviewed approval may be partial or may result in `manually_denied` when no benefit remains.

## State management decisions

- **Line item status** is derived from adjudication or manual review:
  - `approved` / `denied` / `needs_review` on submission
  - `manually_approved` / `manually_denied` via review endpoint
- **Claim status** is derived from line item decisions:
  - any `needs_review` → `under_review`
  - all approved/manual approved → `approved`
  - all denied/manual denied → `denied`
  - mix approved and denied → `partially_approved`
  - `approved`/`partially_approved` can become `paid`
  - `approved`/`partially_approved`/`denied`/`paid` can become `disputed`

## Persistence and testing trade-offs

- **Transactions** are used for claim creation and lifecycle operations to keep related writes consistent (claim, line items, decisions, usage ledger, payments, disputes).
- **Sequelize sync for assignment simplicity**:
  - Local setup and development seed use `sequelize.sync()` to create/update tables without requiring a migration workflow.
  - **Production should use explicit migrations** to control schema changes safely.
- **Tests use configured `DATABASE_URL`**:
  - Integration/API tests run against the database referenced by `DATABASE_URL`.
  - If `DATABASE_URL` points to a hosted DB (e.g. Railway), tests may be noticeably slower than local Postgres.

## What was not built (intentional)

- Authentication/authorization
- A real payment processor integration
- Real medical coding validation (ICD/CPT validation, provider networks)
- Full deductible accumulation logic (field exists; end-to-end deductible math not implemented)
- A full migrations workflow (sync used instead, per assignment simplicity)
- Admin tooling / backoffice UI
- Audit-log writes for lifecycle transitions

## Assumptions

- Money is stored in cents (integers), not floating-point dollars.
- Coverage rules are determined by `serviceType` and the active policy version selected during claim submission.
- Manual review is only supported for items currently in `needs_review`.
- Claim payment is only allowed when the claim is `approved` or `partially_approved`.
- Disputes are allowed for `approved`, `partially_approved`, `denied`, and `paid` claims.

## Future extensions

- Add migrations and schema versioning.
- Add authentication and role-based access (member vs reviewer vs finance).
- Improve deductible handling and accumulators (per member, per policy year).
- Add richer dispute workflow states and audit logging for state changes.
- Add filtering/pagination for list endpoints.
- Expand tests and fixtures around policy-version changes over time.
- Expand manual review edge-case coverage (annual-limit exhaustion, repeated reviews).
