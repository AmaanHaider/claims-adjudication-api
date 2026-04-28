const { Op } = require("sequelize");

const {
  sequelize,
  Member,
  PolicyVersion,
  MemberPolicyEnrollment,
  CoverageRule,
  Claim,
  ClaimLineItem,
  ClaimDecision,
  UsageLedger,
} = require("../models");

const { adjudicateLineItem, calculateClaimStatus } = require("./adjudicationService");

function getBenefitYear(dateOfService) {
  return Number(String(dateOfService).slice(0, 4));
}

async function createClaim({ memberId, providerName, diagnosisCodes, lineItems }) {
  return await sequelize.transaction(async (t) => {
    const member = await Member.findByPk(memberId, { transaction: t });
    if (!member) {
      const err = new Error("Member not found");
      err.status = 404;
      throw err;
    }

    const enrollmentByDate = new Map(); // dateOfService -> MemberPolicyEnrollment
    const policyVersionByPolicyAndDate = new Map(); // `${policyId}:${dateOfService}` -> PolicyVersion
    const coverageRulesByPolicyVersionId = new Map(); // policyVersionId -> CoverageRule[]
    const usageLedgerByPolicyVersionId = new Map(); // policyVersionId -> Map(`${serviceType}:${benefitYear}` -> UsageLedger)

    async function getEnrollmentForDate(dateOfService) {
      const key = String(dateOfService);
      if (enrollmentByDate.has(key)) return enrollmentByDate.get(key);

      const enrollment = await MemberPolicyEnrollment.findOne({
        where: {
          memberId,
          effectiveFrom: { [Op.lte]: key },
          [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: key } }],
        },
        transaction: t,
      });

      if (!enrollment) {
        const err = new Error("No active policy enrollment for member");
        err.status = 422;
        throw err;
      }

      enrollmentByDate.set(key, enrollment);
      return enrollment;
    }

    async function getPolicyVersionForDate(policyId, dateOfService) {
      const dateKey = String(dateOfService);
      const key = `${policyId}:${dateKey}`;
      if (policyVersionByPolicyAndDate.has(key)) return policyVersionByPolicyAndDate.get(key);

      const policyVersion = await PolicyVersion.findOne({
        where: {
          policyId,
          effectiveFrom: { [Op.lte]: dateKey },
          [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: dateKey } }],
        },
        transaction: t,
        order: [["effectiveFrom", "DESC"]],
      });

      if (!policyVersion) {
        const err = new Error("No active policy version for date of service");
        err.status = 422;
        throw err;
      }

      policyVersionByPolicyAndDate.set(key, policyVersion);
      return policyVersion;
    }

    async function getCoverageRulesForPolicyVersion(policyVersionId) {
      if (coverageRulesByPolicyVersionId.has(policyVersionId)) {
        return coverageRulesByPolicyVersionId.get(policyVersionId);
      }

      const rules = await CoverageRule.findAll({
        where: { policyVersionId },
        transaction: t,
      });
      coverageRulesByPolicyVersionId.set(policyVersionId, rules);
      return rules;
    }

    async function getUsageLedgerMap(policyVersionId) {
      if (!usageLedgerByPolicyVersionId.has(policyVersionId)) {
        usageLedgerByPolicyVersionId.set(policyVersionId, new Map());
      }
      return usageLedgerByPolicyVersionId.get(policyVersionId);
    }

    async function ensureUsageLedgerRowLoaded({
      policyVersionId,
      serviceType,
      benefitYear,
    }) {
      const map = await getUsageLedgerMap(policyVersionId);
      const key = `${serviceType}:${benefitYear}`;
      if (map.has(key)) return map.get(key);

      const existing = await UsageLedger.findOne({
        where: { memberId, policyVersionId, serviceType, benefitYear },
        transaction: t,
      });
      if (existing) {
        map.set(key, existing);
        return existing;
      }

      // Cache a sentinel so repeated checks don't re-query.
      map.set(key, null);
      return null;
    }

    const totalSubmittedCents = lineItems.reduce((sum, li) => sum + li.amountCents, 0);

    const claim = await Claim.create(
      {
        memberId,
        providerName,
        diagnosisCodes,
        status: "submitted",
        totalSubmittedCents,
        totalPayableCents: 0,
        submittedAt: new Date(),
      },
      { transaction: t }
    );

    const createdLineItems = [];
    const createdDecisions = [];

    for (const li of lineItems) {
      const dateOfService = String(li.dateOfService);
      const benefitYear = getBenefitYear(dateOfService);

      const enrollment = await getEnrollmentForDate(dateOfService);
      const policyVersion = await getPolicyVersionForDate(enrollment.policyId, dateOfService);
      const coverageRules = await getCoverageRulesForPolicyVersion(policyVersion.id);

      // Ensure this specific (policyVersionId, serviceType, benefitYear) usage row is loaded/cached.
      await ensureUsageLedgerRowLoaded({
        policyVersionId: policyVersion.id,
        serviceType: li.serviceType,
        benefitYear,
      });

      const ledgerMap = await getUsageLedgerMap(policyVersion.id);
      const usageLedger = [...ledgerMap.values()].filter(Boolean).map((r) => r.toJSON());

      const cli = await ClaimLineItem.create(
        {
          claimId: claim.id,
          serviceType: li.serviceType,
          amountCents: li.amountCents,
          dateOfService,
          status: "submitted",
        },
        { transaction: t }
      );

      const decision = adjudicateLineItem({
        lineItem: li,
        coverageRules,
        usageLedger,
        benefitYear,
      });

      // Keep line item status aligned with decision status for initial adjudication.
      await cli.update({ status: decision.status }, { transaction: t });

      const cd = await ClaimDecision.create(
        {
          claimId: claim.id,
          claimLineItemId: cli.id,
          coverageRuleId: decision.coverageRuleId,
          status: decision.status,
          submittedAmountCents: decision.submittedAmountCents,
          allowedAmountCents: decision.allowedAmountCents,
          payableAmountCents: decision.payableAmountCents,
          memberResponsibilityCents: decision.memberResponsibilityCents,
          explanation: decision.explanation,
        },
        { transaction: t }
      );

      // Update usage ledger only when approved (annual limits depend on usedAmountCents).
      if (decision.status === "approved") {
        const rule = coverageRules.find((r) => r.serviceType === li.serviceType);
        if (rule && rule.annualLimitCents !== null && rule.annualLimitCents !== undefined) {
          const ledgerMapForPolicyVersion = await getUsageLedgerMap(policyVersion.id);
          const key = `${li.serviceType}:${benefitYear}`;
          const existing = ledgerMapForPolicyVersion.get(key);
          if (existing) {
            await existing.update(
              { usedAmountCents: existing.usedAmountCents + decision.allowedAmountCents },
              { transaction: t }
            );
          } else {
            const created = await UsageLedger.create(
              {
                memberId,
                policyVersionId: policyVersion.id,
                serviceType: li.serviceType,
                benefitYear,
                usedAmountCents: decision.allowedAmountCents,
              },
              { transaction: t }
            );
            ledgerMapForPolicyVersion.set(key, created);
          }
        }
      }

      createdLineItems.push(cli);
      createdDecisions.push(cd);
    }

    const totalPayableCents = createdDecisions.reduce(
      (sum, d) => sum + (d.status === "approved" ? d.payableAmountCents : 0),
      0
    );

    const status = calculateClaimStatus(createdDecisions.map((d) => ({ status: d.status })));

    await claim.update({ status, totalPayableCents }, { transaction: t });

    return await Claim.findByPk(claim.id, {
      transaction: t,
      include: [
        { model: ClaimLineItem },
        { model: ClaimDecision },
      ],
    });
  });
}

async function listClaims() {
  return await Claim.findAll({
    order: [["id", "DESC"]],
    include: [{ model: ClaimLineItem }, { model: ClaimDecision }],
  });
}

async function getClaimById(id) {
  const claim = await Claim.findByPk(id, {
    include: [{ model: ClaimLineItem }, { model: ClaimDecision }],
  });
  if (!claim) {
    const err = new Error("Claim not found");
    err.status = 404;
    throw err;
  }
  return claim;
}

module.exports = {
  createClaim,
  listClaims,
  getClaimById,
};
