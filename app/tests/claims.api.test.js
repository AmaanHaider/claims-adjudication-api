import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import request from "supertest";

require("dotenv").config();

const hasDatabaseUrl = typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

describe(hasDatabaseUrl ? "Claims API (integration)" : "Claims API (integration) [skipped: DATABASE_URL not set]", () => {
  if (!hasDatabaseUrl) {
    it.skip("requires DATABASE_URL to run integration tests", () => {});
    return;
  }

  const { createApp } = require("../src/app");
  const {
    sequelize,
    Member,
    Policy,
    PolicyVersion,
    MemberPolicyEnrollment,
    CoverageRule,
    UsageLedger,
  } = require("../src/models");

  const app = createApp();

  const memberId = 91001;
  const policyId = 92001;
  const policyVersionIdV1 = 93001;
  const policyVersionIdV2 = 93002;
  const policyVersionIdV3 = 93003;

  beforeAll(async () => {
    // No drops/resets. Just ensure tables exist.
    await sequelize.sync();

    await Member.upsert({
      id: memberId,
      firstName: "Test",
      lastName: "Member",
      dateOfBirth: "1990-01-01",
    });

    await Policy.upsert({
      id: policyId,
      name: "Test Policy",
      description: "Policy for API tests",
    });

    await PolicyVersion.upsert({
      id: policyVersionIdV1,
      policyId,
      versionName: "test-v1",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-03-31",
    });

    await PolicyVersion.upsert({
      id: policyVersionIdV2,
      policyId,
      versionName: "test-v2",
      effectiveFrom: "2026-04-01",
      effectiveTo: "2026-04-30",
    });

    await PolicyVersion.upsert({
      id: policyVersionIdV3,
      policyId,
      versionName: "test-v3",
      effectiveFrom: "2026-05-01",
      effectiveTo: null,
    });

    await MemberPolicyEnrollment.upsert({
      id: 94001,
      memberId,
      policyId,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
    });

    const rules = [
      // V2 rules (these power existing tests that use 2026-04-10 dates)
      { id: 95001, policyVersionId: policyVersionIdV2, serviceType: "primary_care", covered: true, payPercent: 100 },
      { id: 95002, policyVersionId: policyVersionIdV2, serviceType: "dental", covered: false, payPercent: 0 },
      {
        id: 95003,
        policyVersionId: policyVersionIdV2,
        serviceType: "mri",
        covered: true,
        payPercent: 70,
        reviewRequiredOverCents: 100000,
      },
      {
        id: 95004,
        policyVersionId: policyVersionIdV2,
        serviceType: "physical_therapy",
        covered: true,
        payPercent: 80,
        annualLimitCents: 100000,
      },

      // V1 rules (used only by the mixed-date policy-version test)
      { id: 95101, policyVersionId: policyVersionIdV1, serviceType: "dental", covered: false, payPercent: 0 },
      {
        id: 95102,
        policyVersionId: policyVersionIdV1,
        serviceType: "physical_therapy",
        covered: true,
        payPercent: 80,
        annualLimitCents: 100000,
      },

      // V3 rules (used only by the mixed-date policy-version test; differs from V1/V2)
      { id: 95301, policyVersionId: policyVersionIdV3, serviceType: "dental", covered: true, payPercent: 100 },
      {
        id: 95302,
        policyVersionId: policyVersionIdV3,
        serviceType: "physical_therapy",
        covered: true,
        payPercent: 80,
        annualLimitCents: 100000,
      },
    ];
    for (const r of rules) await CoverageRule.upsert(r);
  }, 30000);

  afterAll(async () => {
    await sequelize.close();
  }, 30000);

  it("POST /claims creates claim and decisions", async () => {
    const res = await request(app).post("/claims").send({
      memberId,
      providerName: "City Health Clinic",
      diagnosisCodes: ["M54.5"],
      lineItems: [
        { serviceType: "primary_care", amountCents: 20000, dateOfService: "2026-04-10" },
        { serviceType: "dental", amountCents: 15000, dateOfService: "2026-04-10" },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.ClaimLineItems?.length).toBe(2);
    expect(res.body.ClaimDecisions?.length).toBe(2);
  });

  it("POST /claims adjudicates each line item using policy version active on its date of service", async () => {
    // Test isolation: use a non-overlapping year/version range and create all fixtures inside the test.
    // This avoids accidentally matching pre-existing PolicyVersion rows for the same policyId.
    const isoPolicyVersionIdV1 = 93101;
    const isoPolicyVersionIdV2 = 93102;
    const isoBenefitYear = 2027;
    const isoDateV1 = "2027-02-10";
    const isoDateV2 = "2027-05-10";

    await CoverageRule.destroy({
      where: { policyVersionId: [isoPolicyVersionIdV1, isoPolicyVersionIdV2] },
    });
    await PolicyVersion.destroy({
      where: { id: [isoPolicyVersionIdV1, isoPolicyVersionIdV2] },
    });
    await UsageLedger.destroy({
      where: {
        memberId,
        policyVersionId: [isoPolicyVersionIdV1, isoPolicyVersionIdV2],
        serviceType: "physical_therapy",
        benefitYear: isoBenefitYear,
      },
    });

    await PolicyVersion.upsert({
      id: isoPolicyVersionIdV1,
      policyId,
      versionName: "test-iso-v1",
      effectiveFrom: "2027-01-01",
      effectiveTo: "2027-03-31",
    });
    await PolicyVersion.upsert({
      id: isoPolicyVersionIdV2,
      policyId,
      versionName: "test-iso-v2",
      effectiveFrom: "2027-04-01",
      effectiveTo: null,
    });

    await CoverageRule.upsert({
      id: 96101,
      policyVersionId: isoPolicyVersionIdV1,
      serviceType: "dental",
      covered: false,
      payPercent: 0,
    });
    await CoverageRule.upsert({
      id: 96102,
      policyVersionId: isoPolicyVersionIdV2,
      serviceType: "dental",
      covered: true,
      payPercent: 100,
    });
    await CoverageRule.upsert({
      id: 96103,
      policyVersionId: isoPolicyVersionIdV1,
      serviceType: "physical_therapy",
      covered: true,
      payPercent: 80,
      annualLimitCents: 100000,
    });
    await CoverageRule.upsert({
      id: 96104,
      policyVersionId: isoPolicyVersionIdV2,
      serviceType: "physical_therapy",
      covered: true,
      payPercent: 80,
      annualLimitCents: 100000,
    });

    const res = await request(app).post("/claims").send({
      memberId,
      providerName: "Multi Date Provider",
      diagnosisCodes: ["Z00.0"],
      lineItems: [
        // V1 date
        { serviceType: "dental", amountCents: 15000, dateOfService: isoDateV1 },
        { serviceType: "physical_therapy", amountCents: 10000, dateOfService: isoDateV1 },
        // V2 date
        { serviceType: "dental", amountCents: 15000, dateOfService: isoDateV2 },
        { serviceType: "physical_therapy", amountCents: 10000, dateOfService: isoDateV2 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.ClaimLineItems?.length).toBe(4);
    expect(res.body.ClaimDecisions?.length).toBe(4);

    const lineItemsById = new Map(res.body.ClaimLineItems.map((li) => [li.id, li]));
    const decisions = res.body.ClaimDecisions.map((d) => ({
      ...d,
      lineItem: lineItemsById.get(d.claimLineItemId),
    }));

    const dentalV1 = decisions.find(
      (d) => d.lineItem?.serviceType === "dental" && d.lineItem?.dateOfService === isoDateV1
    );
    const dentalV2 = decisions.find(
      (d) => d.lineItem?.serviceType === "dental" && d.lineItem?.dateOfService === isoDateV2
    );
    expect(dentalV1?.status).toBe("denied");
    expect(dentalV2?.status).toBe("approved");

    // Usage ledger must be tracked per policyVersionId.
    const ledgerRows = await UsageLedger.findAll({
      where: { memberId, serviceType: "physical_therapy", benefitYear: isoBenefitYear },
    });
    const usedByPolicyVersionId = new Map(ledgerRows.map((r) => [r.policyVersionId, r.usedAmountCents]));
    expect(usedByPolicyVersionId.get(isoPolicyVersionIdV1)).toBe(10000);
    expect(usedByPolicyVersionId.get(isoPolicyVersionIdV2)).toBe(10000);
  });

  it("GET /claims/:id returns claim with line items and decisions", async () => {
    const created = await request(app).post("/claims").send({
      memberId,
      providerName: "City Health Clinic",
      diagnosisCodes: ["M54.5"],
      lineItems: [{ serviceType: "primary_care", amountCents: 10000, dateOfService: "2026-04-10" }],
    });

    const id = created.body.id;
    const res = await request(app).get(`/claims/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.ClaimLineItems?.length).toBe(1);
    expect(res.body.ClaimDecisions?.length).toBe(1);
  });

  it("POST /claims/:id/pay rejects under_review claim", async () => {
    const created = await request(app).post("/claims").send({
      memberId,
      providerName: "Radiology Center",
      diagnosisCodes: ["R90.0"],
      lineItems: [{ serviceType: "mri", amountCents: 120000, dateOfService: "2026-04-10" }],
    });

    expect(created.status).toBe(201);
    expect(created.body.status).toBe("under_review");

    const res = await request(app).post(`/claims/${created.body.id}/pay`).send({});
    expect(res.status).toBe(422);
  });

  it("POST /claims/:id/review resolves needs_review item", async () => {
    const created = await request(app).post("/claims").send({
      memberId,
      providerName: "Radiology Center",
      diagnosisCodes: ["R90.0"],
      lineItems: [{ serviceType: "mri", amountCents: 120000, dateOfService: "2026-04-10" }],
    });

    const claimId = created.body.id;
    const lineItemId = created.body.ClaimLineItems[0].id;
    expect(created.body.ClaimLineItems[0].status).toBe("needs_review");

    const res = await request(app).post(`/claims/${claimId}/review`).send({
      lineItemId,
      decision: "approved",
      explanation: "Reviewed and approved.",
    });

    expect(res.status).toBe(200);
    expect(res.body.ClaimLineItems[0].status).toBe("manually_approved");
    expect(res.body.status).toBe("approved");
  });

  it("POST /claims/:id/review approved respects partial remaining annual limit", async () => {
    // Create a rule that triggers needs_review but is still annual-limit constrained.
    // This is the exact scenario that used to bypass annual limits during manual approval.
    await CoverageRule.upsert({
      id: 95601,
      policyVersionId: policyVersionIdV2,
      serviceType: "pt_review",
      covered: true,
      payPercent: 80,
      annualLimitCents: 30000,
      reviewRequiredOverCents: 10000,
    });

    // Set remaining annual benefit to 5000 cents (30000 limit - 25000 used).
    await UsageLedger.destroy({
      where: {
        memberId,
        policyVersionId: policyVersionIdV2,
        serviceType: "pt_review",
        benefitYear: 2026,
      },
    });
    await UsageLedger.create({
      memberId,
      policyVersionId: policyVersionIdV2,
      serviceType: "pt_review",
      benefitYear: 2026,
      usedAmountCents: 25000,
    });

    const created = await request(app).post("/claims").send({
      memberId,
      providerName: "PT Clinic",
      diagnosisCodes: ["M54.5"],
      lineItems: [{ serviceType: "pt_review", amountCents: 20000, dateOfService: "2026-04-10" }],
    });

    expect(created.status).toBe(201);
    expect(created.body.status).toBe("under_review");
    const claimId = created.body.id;
    const lineItemId = created.body.ClaimLineItems[0].id;

    const res = await request(app).post(`/claims/${claimId}/review`).send({
      lineItemId,
      decision: "approved",
      explanation: "Approved after review; apply remaining annual limit.",
    });

    expect(res.status).toBe(200);
    expect(res.body.ClaimLineItems[0].status).toBe("manually_approved");
    expect(res.body.status).toBe("approved");

    const reviewedDecision = res.body.ClaimDecisions.find((d) => d.claimLineItemId === lineItemId);
    expect(reviewedDecision.status).toBe("manually_approved");
    expect(reviewedDecision.submittedAmountCents).toBe(20000);
    expect(reviewedDecision.allowedAmountCents).toBe(5000);
    expect(reviewedDecision.payableAmountCents).toBe(4000);
    expect(reviewedDecision.memberResponsibilityCents).toBe(16000);
    expect(reviewedDecision.explanation).toBe("Approved after review; apply remaining annual limit.");

    const ledger = await UsageLedger.findOne({
      where: {
        memberId,
        policyVersionId: policyVersionIdV2,
        serviceType: "pt_review",
        benefitYear: 2026,
      },
    });
    expect(ledger.usedAmountCents).toBe(30000);
  });

  it("POST /claims/:id/review approved does not over-allow when annual limit exhausted", async () => {
    await CoverageRule.upsert({
      id: 95602,
      policyVersionId: policyVersionIdV2,
      serviceType: "pt_review_exhausted",
      covered: true,
      payPercent: 80,
      annualLimitCents: 30000,
      reviewRequiredOverCents: 10000,
    });

    await UsageLedger.destroy({
      where: {
        memberId,
        policyVersionId: policyVersionIdV2,
        serviceType: "pt_review_exhausted",
        benefitYear: 2026,
      },
    });
    await UsageLedger.create({
      memberId,
      policyVersionId: policyVersionIdV2,
      serviceType: "pt_review_exhausted",
      benefitYear: 2026,
      usedAmountCents: 30000,
    });

    const created = await request(app).post("/claims").send({
      memberId,
      providerName: "PT Clinic",
      diagnosisCodes: ["M54.5"],
      lineItems: [{ serviceType: "pt_review_exhausted", amountCents: 20000, dateOfService: "2026-04-10" }],
    });

    expect(created.status).toBe(201);
    expect(created.body.status).toBe("under_review");
    const claimId = created.body.id;
    const lineItemId = created.body.ClaimLineItems[0].id;

    const res = await request(app).post(`/claims/${claimId}/review`).send({
      lineItemId,
      decision: "approved",
      explanation: "Attempted approval after review; benefit exhausted.",
    });

    expect(res.status).toBe(200);
    expect(res.body.ClaimLineItems[0].status).toBe("manually_denied");
    expect(res.body.status).toBe("denied");

    const reviewedDecision = res.body.ClaimDecisions.find((d) => d.claimLineItemId === lineItemId);
    expect(reviewedDecision.status).toBe("manually_denied");
    expect(reviewedDecision.allowedAmountCents).toBe(0);
    expect(reviewedDecision.payableAmountCents).toBe(0);
    expect(reviewedDecision.memberResponsibilityCents).toBe(20000);
    expect(reviewedDecision.explanation).toBe("Attempted approval after review; benefit exhausted.");

    const ledger = await UsageLedger.findOne({
      where: {
        memberId,
        policyVersionId: policyVersionIdV2,
        serviceType: "pt_review_exhausted",
        benefitYear: 2026,
      },
    });
    expect(ledger.usedAmountCents).toBe(30000);
  });

  it("POST /claims/:id/pay pays approved/partially_approved claim", async () => {
    const created = await request(app).post("/claims").send({
      memberId,
      providerName: "City Health Clinic",
      diagnosisCodes: ["M54.5"],
      lineItems: [
        { serviceType: "primary_care", amountCents: 20000, dateOfService: "2026-04-10" },
        { serviceType: "dental", amountCents: 15000, dateOfService: "2026-04-10" },
      ],
    });

    expect(new Set(["approved", "partially_approved"]).has(created.body.status)).toBe(true);

    const res = await request(app).post(`/claims/${created.body.id}/pay`).send({});
    expect(res.status).toBe(200);
    expect(res.body.claim.status).toBe("paid");
    expect(res.body.payment.status).toBe("paid");
  });

  it("POST /claims/:id/dispute marks claim disputed", async () => {
    const created = await request(app).post("/claims").send({
      memberId,
      providerName: "City Health Clinic",
      diagnosisCodes: ["M54.5"],
      lineItems: [{ serviceType: "dental", amountCents: 15000, dateOfService: "2026-04-10" }],
    });

    expect(created.body.status).toBe("denied");

    const res = await request(app).post(`/claims/${created.body.id}/dispute`).send({
      reason: "I believe this should be covered.",
    });

    expect(res.status).toBe(200);
    expect(res.body.claim.status).toBe("disputed");
    expect(res.body.dispute.id).toBeTruthy();
  });
});
