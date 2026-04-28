function findCoverageRule(coverageRules, serviceType) {
  if (!Array.isArray(coverageRules)) return null;
  return coverageRules.find((r) => r && r.serviceType === serviceType) || null;
}

function findUsedAmount(usageLedger, serviceType, benefitYear) {
  if (!Array.isArray(usageLedger)) return 0;
  const row =
    usageLedger.find(
      (u) => u && u.serviceType === serviceType && Number(u.benefitYear) === Number(benefitYear)
    ) || null;
  return row && Number.isFinite(row.usedAmountCents) ? row.usedAmountCents : 0;
}

function makeDecision({
  status,
  submittedAmountCents,
  allowedAmountCents,
  payableAmountCents,
  explanation,
  coverageRuleId = null,
}) {
  return {
    status,
    submittedAmountCents,
    allowedAmountCents,
    payableAmountCents,
    memberResponsibilityCents: submittedAmountCents - payableAmountCents,
    explanation,
    coverageRuleId,
  };
}

function adjudicateLineItem({ lineItem, coverageRules, usageLedger, benefitYear, options = {} }) {
  const submittedAmountCents = Number(lineItem?.amountCents) || 0;
  const serviceType = lineItem?.serviceType;
  const ignoreReviewThreshold = options && options.ignoreReviewThreshold === true;

  const rule = findCoverageRule(coverageRules, serviceType);
  if (!rule) {
    return makeDecision({
      status: "denied",
      submittedAmountCents,
      allowedAmountCents: 0,
      payableAmountCents: 0,
      explanation: "No coverage rule exists for this service type.",
    });
  }

  if (rule.covered === false) {
    return makeDecision({
      status: "denied",
      submittedAmountCents,
      allowedAmountCents: 0,
      payableAmountCents: 0,
      explanation: "This service is not covered by the member's policy.",
      coverageRuleId: rule.id ?? null,
    });
  }

  if (
    !ignoreReviewThreshold &&
    Number.isFinite(rule.reviewRequiredOverCents) &&
    rule.reviewRequiredOverCents !== null &&
    submittedAmountCents > rule.reviewRequiredOverCents
  ) {
    return makeDecision({
      status: "needs_review",
      submittedAmountCents,
      allowedAmountCents: 0,
      payableAmountCents: 0,
      explanation: "This claim exceeds the review threshold and requires manual review.",
      coverageRuleId: rule.id ?? null,
    });
  }

  let allowedAmountCents = submittedAmountCents;

  if (Number.isFinite(rule.annualLimitCents) && rule.annualLimitCents !== null) {
    const alreadyUsed = findUsedAmount(usageLedger, serviceType, benefitYear);
    const remaining = rule.annualLimitCents - alreadyUsed;

    if (remaining <= 0) {
      return makeDecision({
        status: "denied",
        submittedAmountCents,
        allowedAmountCents: 0,
        payableAmountCents: 0,
        explanation: "Annual limit exhausted.",
        coverageRuleId: rule.id ?? null,
      });
    }

    if (remaining < submittedAmountCents) {
      allowedAmountCents = remaining;
    }
  }

  const payPercent = Number(rule.payPercent) || 0;
  const payableAmountCents = Math.round((allowedAmountCents * payPercent) / 100);

  return makeDecision({
    status: "approved",
    submittedAmountCents,
    allowedAmountCents,
    payableAmountCents,
    explanation:
      allowedAmountCents < submittedAmountCents
        ? "Approved up to the remaining annual limit."
        : "Approved per coverage rules.",
    coverageRuleId: rule.id ?? null,
  });
}

function calculateClaimStatus(lineItemDecisions) {
  const items = Array.isArray(lineItemDecisions) ? lineItemDecisions : [];
  const statuses = items.map((d) => d?.status).filter(Boolean);

  if (statuses.some((s) => s === "needs_review")) return "under_review";

  const approvedSet = new Set(["approved", "manually_approved"]);
  const deniedSet = new Set(["denied", "manually_denied"]);

  if (statuses.length > 0 && statuses.every((s) => approvedSet.has(s))) return "approved";
  if (statuses.length > 0 && statuses.every((s) => deniedSet.has(s))) return "denied";

  const hasApproved = statuses.some((s) => approvedSet.has(s));
  const hasDenied = statuses.some((s) => deniedSet.has(s));
  if (hasApproved && hasDenied) return "partially_approved";

  // Fallback for incomplete/mixed states (not required by current tests).
  return "submitted";
}

module.exports = {
  adjudicateLineItem,
  calculateClaimStatus,
};
