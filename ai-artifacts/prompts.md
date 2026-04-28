# AI Prompts Used (Summary)

This file summarizes notable prompt themes used during development.

## Understanding the assignment

- “Summarize the required backend scope and constraints (API-only, deterministic adjudication, no frontend).”

## Choosing the stack

- “Pick a pragmatic stack for a Node API with relational data and explainability (Node.js, Express, PostgreSQL, Sequelize).”
- “Select a testing approach (Vitest for units, Supertest for API).”

## Planning the API-only architecture

- “Propose an MVC + services layout where controllers remain thin and business logic lives in services.”
- “List endpoints and state transitions for claims, review, pay, dispute.”

## Designing the DB / domain model

- “Translate the domain entities into Sequelize models, fields, and associations.”
- “Represent coverage rules and policy versions so rules can change over time.”
- “Model money in cents and define enum-like status validations.”

## Creating and using project context

- “Write a single source-of-truth context doc (project structure, statuses, adjudication rules, endpoint list).”

## Debugging environment/runtime issues

- “Make `DATABASE_URL` work for both local Postgres and hosted Postgres; handle SSL safely.”
- “Investigate and fix test environment configuration issues (dotenv loading, timeouts).”
- “Reduce schema sync/index issues across environments.”

## Adding Swagger/docs

- “Add Swagger/OpenAPI and document endpoints, request/response shapes, and status rules.”
