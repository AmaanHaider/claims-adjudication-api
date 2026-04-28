# Claims Adjudication API - Project Context

## What We Are Building

We are building an API-only Claims Adjudication System for an insurance company.

Members submit reimbursement claims with medical expense line items. The system checks each line item against the member's active insurance policy and returns:

- whether the service is covered
- how much insurance pays
- how much the member owes
- whether manual review is needed
- why the decision was made
- the overall claim status

This is not a frontend app. This is not an AI-powered app. This is a deterministic rule-based backend API.

## Final Tech Stack

- Node.js
- Express
- PostgreSQL
- Sequelize
- Vitest
- Supertest
- Swagger/OpenAPI
- Plain JavaScript using MVC structure

Do not use:

- TypeScript
- Zod
- Docker
- Prisma
- frontend framework
- AI in the adjudication path

## Architecture

Use MVC plus services.

Request flow:

```text
Express route
-> controller
-> service
-> domain/adjudication logic
-> Sequelize models
-> PostgreSQL
```

Main layers:

```text
routes/
Defines API endpoints.

controllers/
Handles request and response only. No business logic.

services/
Contains business logic and orchestration.

models/
Sequelize models and associations.

middleware/
Validation and error handling.

tests/
Vitest and Supertest tests.
```

## Project Structure

```text
app/
  src/
    app.js
    server.js

    config/
      database.js

    models/
      Member.js
      Policy.js
      PolicyVersion.js
      CoverageRule.js
      MemberPolicyEnrollment.js
      Claim.js
      ClaimLineItem.js
      ClaimDecision.js
      UsageLedger.js
      Dispute.js
      Payment.js
      AuditLog.js
      index.js

    routes/
      claimRoutes.js
      memberRoutes.js
      policyRoutes.js

    controllers/
      claimController.js
      memberController.js
      policyController.js

    services/
      claimService.js
      policyService.js
      adjudicationService.js
      usageLedgerService.js
      reviewService.js
      paymentService.js

    middleware/
      validateClaimRequest.js
      errorHandler.js

    seed/
      seedData.js

    docs/
      swagger.js

  tests/
    adjudication.test.js
    claims.api.test.js

docs/
  domain-model.md
  decisions.md
  self-review.md

ai-artifacts/
  prompts.md
  corrections.md
  chat-summary.md

README.md
```

## Domain Model

### Member

A person covered by insurance.

Fields:

- id
- firstName
- lastName
- dateOfBirth
- createdAt
- updatedAt

### Policy

Insurance plan identity.

Example:

- Gold Health Plan

Fields:

- id
- name
- description

### PolicyVersion

Rules change over time. Claims should be adjudicated against the policy version active on the date of service.

Fields:

- id
- policyId
- versionName
- effectiveFrom
- effectiveTo

### MemberPolicyEnrollment

Connects a member to a policy.

Fields:

- id
- memberId
- policyId
- effectiveFrom
- effectiveTo

### CoverageRule

The actual coverage rule.

Fields:

- id
- policyVersionId
- serviceType
- covered
- payPercent
- annualLimitCents
- deductibleApplies
- reviewRequiredOverCents
- explanationTemplate

Example rules:

- primary_care: covered 100%
- specialist_visit: covered 80%
- physical_therapy: covered 80%, annual limit $1000
- mri: covered 70%, needs review over $1000
- dental: not covered

### Claim

A reimbursement request submitted by a member.

Fields:

- id
- memberId
- providerName
- diagnosisCodes
- status
- totalSubmittedCents
- totalPayableCents
- submittedAt

### ClaimLineItem

One expense inside a claim.

Fields:

- id
- claimId
- serviceType
- amountCents
- dateOfService
- status

### ClaimDecision

Decision for one claim line item.

Fields:

- id
- claimId
- claimLineItemId
- coverageRuleId
- status
- submittedAmountCents
- allowedAmountCents
- payableAmountCents
- memberResponsibilityCents
- explanation

### UsageLedger

Tracks how much of a yearly benefit has already been used.

Fields:

- id
- memberId
- policyVersionId
- serviceType
- benefitYear
- usedAmountCents

### Dispute

Represents a member disputing a claim decision.

Fields:

- id
- claimId
- reason
- status
- createdAt

### Payment

Represents payment of an approved claim.

Fields:

- id
- claimId
- amountCents
- status
- paidAt

### AuditLog

Tracks important changes.

Fields:

- id
- entityType
- entityId
- action
- previousValue
- newValue
- createdAt

## Claim Statuses

Use these claim statuses:

```text
submitted
under_review
approved
partially_approved
denied
paid
disputed
closed
```

Status rules:

```text
If any line item needs_review -> claim is under_review
If all line items approved -> claim is approved
If all line items denied -> claim is denied
If mix of approved and denied -> claim is partially_approved
If approved/partially approved claim is paid -> claim is paid
If member disputes -> claim is disputed
```

## Line Item Statuses

Use these line item statuses:

```text
submitted
approved
denied
needs_review
manually_approved
manually_denied
```

## Main API Endpoints

```text
GET /health

GET /members
GET /members/:id

GET /policies
GET /policies/:id

POST /claims
GET /claims
GET /claims/:id

POST /claims/:id/review
POST /claims/:id/pay
POST /claims/:id/dispute
```

## POST /claims Workflow

Input example:

```json
{
  "memberId": 1,
  "providerName": "City Health Clinic",
  "diagnosisCodes": ["M54.5"],
  "lineItems": [
    {
      "serviceType": "physical_therapy",
      "amountCents": 30000,
      "dateOfService": "2026-04-10"
    },
    {
      "serviceType": "dental",
      "amountCents": 15000,
      "dateOfService": "2026-04-10"
    },
    {
      "serviceType": "mri",
      "amountCents": 120000,
      "dateOfService": "2026-04-10"
    }
  ]
}
```

Workflow:

```text
1. Validate request body manually.
2. Find member.
3. Find member's active policy enrollment.
4. Find active policy version for date of service.
5. Load coverage rules.
6. Create claim with status submitted.
7. Create claim line items.
8. Adjudicate each line item.
9. Save claim decisions.
10. Update usage ledger for approved payable amounts.
11. Calculate claim total payable.
12. Calculate overall claim status.
13. Return claim with line item decisions and explanations.
```

## Adjudication Logic

For each line item:

```text
1. Find coverage rule by serviceType.
2. If no rule exists:
   deny with explanation "No coverage rule exists for this service type."

3. If rule.covered is false:
   deny with explanation "This service is not covered by the member's policy."

4. If reviewRequiredOverCents exists and amount exceeds it:
   mark needs_review with explanation.

5. If annualLimitCents exists:
   check UsageLedger for member + serviceType + benefitYear.
   remaining = annualLimit - alreadyUsed.

   If remaining <= 0:
     deny with explanation "Annual limit exhausted."

   If remaining < submitted amount:
     approve only remaining amount as allowed amount.

6. Apply payPercent:
   payable = allowedAmount * payPercent
   memberResponsibility = submittedAmount - payable

7. Return approved decision with explanation.
```

Important: use cents for money. Do not use floating dollar amounts for storage.

## Edge Cases To Handle

Must handle:

```text
unknown service type -> denied
not covered service -> denied
annual limit exhausted -> denied
annual limit partially remaining -> partial approval
MRI over threshold -> needs_review
claim with approved + denied items -> partially_approved
claim with any needs_review item -> under_review
cannot pay under_review claim
cannot pay denied claim
can dispute approved, partially_approved, or denied claim
manual review can approve or deny needs_review items
```

## Tests

Use TDD where possible.

### Unit Tests with Vitest

Create tests for adjudication logic:

```text
covered primary care is approved at 100%
dental is denied because it is not covered
unknown service is denied because no rule exists
MRI over $1000 becomes needs_review
physical therapy respects annual limit
physical therapy partially approves when only some limit remains
physical therapy is denied when annual limit is exhausted
mixed approved and denied items produce partially_approved claim
any needs_review item produces under_review claim
```

### API Tests with Supertest

Create tests for:

```text
POST /claims creates claim and decisions
GET /claims/:id returns claim with line items and decisions
POST /claims/:id/pay pays approved claim
POST /claims/:id/pay rejects under_review claim
POST /claims/:id/review resolves needs_review item
POST /claims/:id/dispute marks claim disputed
```

## Documentation Required

Create these files:

```text
docs/domain-model.md
docs/decisions.md
docs/self-review.md
ai-artifacts/prompts.md
ai-artifacts/corrections.md
ai-artifacts/chat-summary.md
README.md
```

### domain-model.md

Explain:

- entities
- relationships
- claim state machine
- line item state machine
- how coverage rules work
- how usage ledger tracks annual limits

### decisions.md

Explain:

- why API only
- why Node/Express
- why PostgreSQL
- why Sequelize
- why no frontend
- why no AI inside adjudication
- why deterministic rule engine
- what was intentionally skipped

### self-review.md

Include:

- what is strong
- what is rough
- known limitations
- what to improve next

### ai-artifacts

Include:

- prompts used
- AI suggestions accepted
- AI suggestions rejected
- corrections made by developer

## Coding Style

Keep code simple and explainable.

Do:

- use clear function names
- keep controllers thin
- keep business logic in services
- write deterministic rule logic
- return clear explanations
- use transactions when creating claims and decisions
- use Sequelize associations cleanly

Avoid:

- overengineering
- frontend
- authentication
- payment gateway integration
- real medical coding database
- AI calls in claim decisions
- huge generic CRUD system with weak adjudication logic

## First Build Steps

Build in this order:

```text
1. Install dependencies.
2. Configure Express app.
3. Configure Sequelize/PostgreSQL.
4. Define models and associations.
5. Add seed data for members, policies, versions, coverage rules, and usage ledger.
6. Write adjudication unit tests first.
7. Implement adjudicationService.
8. Implement claimService.
9. Add claim routes/controllers.
10. Add API tests.
11. Add review/pay/dispute endpoints.
12. Add Swagger docs.
13. Write README and required docs.
14. Make clean git commits after each major step.
```

## Commit Plan

Use meaningful commits:

```text
1. Scaffold API project structure
2. Add Sequelize models and database setup
3. Add seed policy and member data
4. Add adjudication tests and rule engine
5. Add claim submission API
6. Add claim lifecycle endpoints
7. Add API tests and Swagger docs
8. Add assignment documentation and AI artifacts
```

## Final Goal

The final project should let a reviewer run the API locally, submit a claim, and see line-level decisions like:

```json
{
  "claimStatus": "under_review",
  "totalSubmittedCents": 165000,
  "totalPayableCents": 24000,
  "lineItems": [
    {
      "serviceType": "physical_therapy",
      "status": "approved",
      "payableAmountCents": 24000,
      "explanation": "Physical therapy is covered at 80%. The submitted amount is within the remaining annual limit."
    },
    {
      "serviceType": "dental",
      "status": "denied",
      "payableAmountCents": 0,
      "explanation": "Dental is not covered by this policy."
    },
    {
      "serviceType": "mri",
      "status": "needs_review",
      "payableAmountCents": 0,
      "explanation": "MRI claims over $1000 require manual review."
    }
  ]
}
```

This project should show strong domain modeling, clear rule representation, state management, explanation capability, and honest engineering trade-offs.
