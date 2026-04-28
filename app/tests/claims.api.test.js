import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import request from "supertest";

require("dotenv").config();

const { createApp } = require("../src/app");
const { sequelize, Member, Policy, PolicyVersion, MemberPolicyEnrollment, CoverageRule } = require("../src/models");

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

describe("Claims API (integration)", () => {
  const app = createApp();

  const memberId = 91001;
  const policyId = 92001;
  const policyVersionId = 93001;

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
      id: policyVersionId,
      policyId,
      versionName: "test",
      effectiveFrom: "2026-01-01",
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
      { id: 95001, policyVersionId, serviceType: "primary_care", covered: true, payPercent: 100 },
      { id: 95002, policyVersionId, serviceType: "dental", covered: false, payPercent: 0 },
      { id: 95003, policyVersionId, serviceType: "mri", covered: true, payPercent: 70, reviewRequiredOverCents: 100000 },
      { id: 95004, policyVersionId, serviceType: "physical_therapy", covered: true, payPercent: 80, annualLimitCents: 100000 },
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
