require("dotenv").config();

const {
  sequelize,
  Member,
  Policy,
  PolicyVersion,
  MemberPolicyEnrollment,
  CoverageRule,
  UsageLedger,
} = require("../models");

async function seed() {
  console.log("Seed: connecting to database");
  await sequelize.authenticate();

  if (process.env.NODE_ENV !== "production") {
    console.log("Seed: syncing models (sequelize.sync())");
    await sequelize.sync();
  } else {
    console.log("Seed: skipping sync in production");
  }

  console.log("Seed: creating/upserting member");
  await Member.upsert({
    id: 1,
    firstName: "Ava",
    lastName: "Patel",
    dateOfBirth: "1990-06-15",
  });

  console.log("Seed: creating/upserting policy/version/enrollment");
  await Policy.upsert({
    id: 1,
    name: "Gold Health Plan",
    description: "Sample policy used for local development.",
  });

  await PolicyVersion.upsert({
    id: 1,
    policyId: 1,
    versionName: "2026",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
  });

  await MemberPolicyEnrollment.upsert({
    id: 1,
    memberId: 1,
    policyId: 1,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
  });

  console.log("Seed: creating/upserting coverage rules");
  const coverageRules = [
    {
      id: 1,
      policyVersionId: 1,
      serviceType: "primary_care",
      covered: true,
      payPercent: 100,
      annualLimitCents: null,
      deductibleApplies: false,
      reviewRequiredOverCents: null,
      explanationTemplate: "Primary care is covered at 100%.",
    },
    {
      id: 2,
      policyVersionId: 1,
      serviceType: "specialist_visit",
      covered: true,
      payPercent: 80,
      annualLimitCents: null,
      deductibleApplies: false,
      reviewRequiredOverCents: null,
      explanationTemplate: "Specialist visits are covered at 80%.",
    },
    {
      id: 3,
      policyVersionId: 1,
      serviceType: "physical_therapy",
      covered: true,
      payPercent: 80,
      annualLimitCents: 100000,
      deductibleApplies: false,
      reviewRequiredOverCents: null,
      explanationTemplate: "Physical therapy is covered at 80% up to the annual limit.",
    },
    {
      id: 4,
      policyVersionId: 1,
      serviceType: "mri",
      covered: true,
      payPercent: 70,
      annualLimitCents: null,
      deductibleApplies: false,
      reviewRequiredOverCents: 100000,
      explanationTemplate: "MRI is covered at 70% and may require review over the threshold.",
    },
    {
      id: 5,
      policyVersionId: 1,
      serviceType: "dental",
      covered: false,
      payPercent: 0,
      annualLimitCents: null,
      deductibleApplies: false,
      reviewRequiredOverCents: null,
      explanationTemplate: "Dental is not covered by this policy.",
    },
  ];

  for (const rule of coverageRules) {
    await CoverageRule.upsert(rule);
  }

  console.log("Seed: creating/upserting usage ledger");
  await UsageLedger.upsert({
    id: 1,
    memberId: 1,
    policyVersionId: 1,
    serviceType: "physical_therapy",
    benefitYear: 2026,
    usedAmountCents: 0,
  });

  console.log("Seed: seed complete");
}

seed()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed: error");
    console.error(err);
    try {
      await sequelize.close();
    } catch {
      // ignore close errors
    }
    process.exit(1);
  });
