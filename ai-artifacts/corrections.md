# AI Suggestions Accepted / Corrected (Summary)

This file captures notable corrections and course changes made during AI-assisted development.

## Architecture and stack corrections

- Initially considered an **in-memory** persistence approach; corrected to **PostgreSQL + Sequelize** to match the assignment’s persistence and relational modeling needs.
- Considered **TypeScript / Zod / Docker** during early scaffolding; corrected to **plain JavaScript (CommonJS), manual validation, and no Docker** to match constraints.

## Test and environment corrections

- Fixed **dotenv loading** for tests so `DATABASE_URL` is available before Sequelize initializes.
- Adjusted **test timing** behavior where DB operations can exceed default hook timeouts.

## Database / Sequelize corrections

- Fixed a **Sequelize FOR UPDATE + outer join** issue by restructuring reads/writes to avoid invalid locking patterns.
- Avoided unsafe schema mutation patterns: changed seeding sync from `sync({ alter: true })` to `sync()` after observing **duplicate index errors** on hosted Postgres.
- Added an explicit short unique index name for `UsageLedger` (`usage_ledger_member_policy_service_year_uq`) to improve portability and reduce naming issues.

## Scope and documentation corrections

- Broke the large documentation task into the **exact required deliverables** and ensured content stays specific to this project.
- Ensured the adjudication path remains **deterministic** and contains **no AI calls at runtime**.
