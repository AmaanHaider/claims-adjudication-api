# Domain Model

## Overview

This system adjudicates insurance reimbursement claims. A **Member** submits a **Claim** containing multiple **ClaimLineItems**. Each line item is evaluated against the member’s active **Policy** (via **MemberPolicyEnrollment**) and the applicable **PolicyVersion** for the date of service. Coverage is represented as rows in **CoverageRule**. The adjudication result is persisted as a **ClaimDecision** per line item, with a human-readable explanation. Annual benefit usage is tracked in **UsageLedger**.

## Entities (important fields)

- **Member**
  - `id`, `firstName`, `lastName`, `dateOfBirth`
- **Policy**
  - `id`, `name`, `description`
- **PolicyVersion**
  - `id`, `policyId`, `versionName`, `effectiveFrom`, `effectiveTo`
- **MemberPolicyEnrollment**
  - `id`, `memberId`, `policyId`, `effectiveFrom`, `effectiveTo`
- **CoverageRule**
  - `id`, `policyVersionId`, `serviceType`
  - `covered` (boolean)
  - `payPercent` (0–100)
  - `annualLimitCents` (integer cents, nullable)
  - `reviewRequiredOverCents` (integer cents, nullable)
  - `deductibleApplies` (present; deductible accumulation not fully implemented)
  - `explanationTemplate` (optional)
- **Claim**
  - `id`, `memberId`, `providerName`, `diagnosisCodes[]`
  - `status` (see state machine)
  - `totalSubmittedCents`, `totalPayableCents` (money stored in cents)
  - `submittedAt`
- **ClaimLineItem**
  - `id`, `claimId`, `serviceType`, `amountCents`, `dateOfService`
  - `status` (see state machine)
- **ClaimDecision**
  - `id`, `claimId`, `claimLineItemId`, `coverageRuleId`
  - `status`, `submittedAmountCents`, `allowedAmountCents`, `payableAmountCents`, `memberResponsibilityCents`
  - `explanation`
- **UsageLedger**
  - `id`, `memberId`, `policyVersionId`, `serviceType`, `benefitYear`
  - `usedAmountCents`
- **Payment**
  - `id`, `claimId`, `amountCents`, `status`, `paidAt`
- **Dispute**
  - `id`, `claimId`, `reason`, `status`
- **AuditLog**
  - `id`, `entityType`, `entityId`, `action`, `previousValue`, `newValue`

## Relationships

- Member **has many** MemberPolicyEnrollments
- Policy **has many** MemberPolicyEnrollments
- Policy **has many** PolicyVersions
- PolicyVersion **has many** CoverageRules
- Member **has many** Claims
- Claim **has many** ClaimLineItems
- Claim **has many** ClaimDecisions
- ClaimLineItem **has many** ClaimDecisions (1 decision per line item in current flow)
- CoverageRule **has many** ClaimDecisions
- Member **has many** UsageLedger rows
- PolicyVersion **has many** UsageLedger rows
- Claim **has many** Payments
- Claim **has many** Disputes

## Coverage rule model

Coverage is represented as database rows keyed by:

- `policyVersionId` + `serviceType` (unique)

Each rule encodes:

- whether the service is covered
- the insurance pay percentage
- optional annual limit (cents)
- optional “review required over” threshold (cents)

Example rule set used in development:

- `primary_care`: covered 100%
- `specialist_visit`: covered 80%
- `physical_therapy`: covered 80%, annual limit 100000 cents
- `mri`: covered 70%, review required over 100000 cents
- `dental`: not covered

## Claim state machine

Statuses:

- `submitted`
- `under_review`
- `approved`
- `partially_approved`
- `denied`
- `paid`
- `disputed`
- `closed` (reserved for future workflows)

Transitions (high level):

- On creation, status is derived from line item decisions:
  - any `needs_review` → `under_review`
  - all approved/manual approved → `approved`
  - all denied/manual denied → `denied`
  - mix approved and denied → `partially_approved`
- `approved` / `partially_approved` → `paid` via payment endpoint
- `approved` / `partially_approved` / `denied` / `paid` → `disputed` via dispute endpoint

## Line item state machine

Statuses:

- `submitted`
- `approved`
- `denied`
- `needs_review`
- `manually_approved`
- `manually_denied`

Flow:

- On claim submission each item is adjudicated and becomes `approved`, `denied`, or `needs_review`.
- Manual review only applies to `needs_review` items and converts them to `manually_approved` or `manually_denied`.

## Adjudication workflow (conceptual)

For each submitted line item:

1. Find coverage rule by `serviceType`.
2. If no rule exists → deny.
3. If `covered=false` → deny.
4. If `reviewRequiredOverCents` exists and submitted amount is greater → `needs_review`.
5. If `annualLimitCents` exists → consult `UsageLedger` for remaining limit:
   - remaining ≤ 0 → deny
   - remaining < submitted → partially allow up to remaining
6. Compute `payableAmountCents` and `memberResponsibilityCents`.
7. Persist a `ClaimDecision` with an explanation.
8. If applicable, update `UsageLedger` for annual limit services.

## Explanation capability

Every decision includes a human-readable `explanation` that makes the outcome reviewable (why it was approved/denied/needs review, and what constraints applied).
