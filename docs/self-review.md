# Self Review

## What is strong

- **Clear domain mapping**: members, enrollments, policy versions, rules, claims, decisions, usage ledger, payments, disputes are represented explicitly.
- **Deterministic adjudication**: rule-based outcomes with a stored explanation per decision.
- **State transitions are explicit**: claim and line item statuses are constrained to known strings and updated through controlled endpoints.
- **Transactional writes**: claim creation and lifecycle operations are wrapped in database transactions to keep related writes consistent.
- **Test coverage where it matters early**:
  - unit tests validate core adjudication behavior
  - API tests validate the claim lifecycle endpoints end-to-end
- **Swagger/OpenAPI docs**: reviewers can explore the API quickly via `/api-docs`.

## What is rough

- **Schema management**: `sequelize.sync()` is used for assignment convenience; a migration workflow would be preferable for production.
- **Policy version selection**: rule selection is intentionally simple and could be made more robust (e.g., multiple dates of service spanning different versions).
- **Deductible behavior**: `deductibleApplies` exists, but deductible accumulation is not fully implemented end-to-end.
- **Listing endpoints**: pagination/filtering is not implemented; responses can get large as data grows.

## Risks / things to flag

- **Running tests against a hosted database**: API tests use `DATABASE_URL`. Pointing to a remote DB can make tests slower and more failure-prone due to network variability.
- **Sync + indexes**: schema sync can behave differently across environments. For production, migrations should manage indexes/constraints explicitly.
- **Concurrency**: basic locking is used in lifecycle operations, but high concurrency scenarios (double-pay attempts, repeated reviews) should be hardened further.

## What I would improve next

- Introduce **migrations** (and CI checks) instead of relying on `sync()`.
- Expand **status transition tests** around repeated reviews, repeated payments, and dispute edge cases.
- Add **input validation** for lifecycle endpoints (review/pay/dispute) to standardize error shape and provide clearer client feedback.
- Add **audit logging** around key transitions (review/pay/dispute) to populate `AuditLog` with meaningful events.
