import { describe, it, expect } from "vitest";

import * as adjudicationService from "../src/services/adjudicationService.js";

function ruleFixtures() {
  return [
    {
      id: 1,
      serviceType: "primary_care",
      covered: true,
      payPercent: 100,
      annualLimitCents: null,
      reviewRequiredOverCents: null,
    },
    {
      id: 2,
      serviceType: "dental",
      covered: false,
      payPercent: 0,
      annualLimitCents: null,
      reviewRequiredOverCents: null,
    },
    {
      id: 3,
      serviceType: "mri",
      covered: true,
      payPercent: 70,
      annualLimitCents: null,
      reviewRequiredOverCents: 100000,
    },
    {
      id: 4,
      serviceType: "physical_therapy",
      covered: true,
      payPercent: 80,
      annualLimitCents: 100000,
      reviewRequiredOverCents: null,
    },
  ];
}

describe("adjudicationService (unit)", () => {
  it("primary_care is approved at 100%", () => {
    const decide = adjudicationService.adjudicateLineItem;
    expect(typeof decide).toBe("function");

    const decision = decide({
      lineItem: { serviceType: "primary_care", amountCents: 20000, dateOfService: "2026-04-10" },
      coverageRules: ruleFixtures(),
      usageLedger: [],
      benefitYear: 2026,
    });

    expect(decision.status).toBe("approved");
    expect(decision.allowedAmountCents).toBe(20000);
    expect(decision.payableAmountCents).toBe(20000);
    expect(decision.memberResponsibilityCents).toBe(0);
  });

  it("dental is denied because not covered", () => {
    const decision = adjudicationService.adjudicateLineItem({
      lineItem: { serviceType: "dental", amountCents: 15000, dateOfService: "2026-04-10" },
      coverageRules: ruleFixtures(),
      usageLedger: [],
      benefitYear: 2026,
    });

    expect(decision.status).toBe("denied");
    expect(decision.payableAmountCents).toBe(0);
  });

  it("unknown service is denied because no rule exists", () => {
    const decision = adjudicationService.adjudicateLineItem({
      lineItem: { serviceType: "unknown_service", amountCents: 10000, dateOfService: "2026-04-10" },
      coverageRules: ruleFixtures(),
      usageLedger: [],
      benefitYear: 2026,
    });

    expect(decision.status).toBe("denied");
    expect(decision.payableAmountCents).toBe(0);
  });

  it("mri over 100000 cents becomes needs_review", () => {
    const decision = adjudicationService.adjudicateLineItem({
      lineItem: { serviceType: "mri", amountCents: 120000, dateOfService: "2026-04-10" },
      coverageRules: ruleFixtures(),
      usageLedger: [],
      benefitYear: 2026,
    });

    expect(decision.status).toBe("needs_review");
    expect(decision.payableAmountCents).toBe(0);
  });

  it("physical_therapy with 85000 already used and 30000 submitted allows only 15000", () => {
    const decision = adjudicationService.adjudicateLineItem({
      lineItem: { serviceType: "physical_therapy", amountCents: 30000, dateOfService: "2026-04-10" },
      coverageRules: ruleFixtures(),
      usageLedger: [
        { serviceType: "physical_therapy", benefitYear: 2026, usedAmountCents: 85000 },
      ],
      benefitYear: 2026,
    });

    expect(decision.status).toBe("approved");
    expect(decision.allowedAmountCents).toBe(15000);
    expect(decision.payableAmountCents).toBe(12000);
    expect(decision.memberResponsibilityCents).toBe(18000);
  });

  it("physical_therapy with annual limit exhausted is denied", () => {
    const decision = adjudicationService.adjudicateLineItem({
      lineItem: { serviceType: "physical_therapy", amountCents: 30000, dateOfService: "2026-04-10" },
      coverageRules: ruleFixtures(),
      usageLedger: [
        { serviceType: "physical_therapy", benefitYear: 2026, usedAmountCents: 100000 },
      ],
      benefitYear: 2026,
    });

    expect(decision.status).toBe("denied");
    expect(decision.allowedAmountCents).toBe(0);
    expect(decision.payableAmountCents).toBe(0);
  });

  it("calculateClaimStatus returns under_review if any item needs_review", () => {
    const fn = adjudicationService.calculateClaimStatus;
    expect(typeof fn).toBe("function");
    expect(fn([{ status: "approved" }, { status: "needs_review" }])).toBe("under_review");
  });

  it("calculateClaimStatus returns partially_approved for approved + denied", () => {
    expect(adjudicationService.calculateClaimStatus([{ status: "approved" }, { status: "denied" }])).toBe(
      "partially_approved"
    );
  });

  it("calculateClaimStatus returns denied when all denied", () => {
    expect(adjudicationService.calculateClaimStatus([{ status: "denied" }, { status: "denied" }])).toBe("denied");
  });

  it("calculateClaimStatus returns approved when all approved", () => {
    expect(adjudicationService.calculateClaimStatus([{ status: "approved" }, { status: "approved" }])).toBe("approved");
  });
});
