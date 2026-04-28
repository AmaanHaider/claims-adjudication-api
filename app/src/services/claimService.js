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

    // Use earliest date of service as the policy/rules anchor (keeps scope tight).
    const anchorDate = [...lineItems]
      .map((li) => li.dateOfService)
      .sort()[0];

    const enrollment = await MemberPolicyEnrollment.findOne({
      where: {
        memberId,
        effectiveFrom: { [Op.lte]: anchorDate },
        [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: anchorDate } }],
      },
      transaction: t,
    });

    if (!enrollment) {
      const err = new Error("No active policy enrollment for member");
      err.status = 422;
      throw err;
    }

    const policyVersion = await PolicyVersion.findOne({
      where: {
        policyId: enrollment.policyId,
        effectiveFrom: { [Op.lte]: anchorDate },
        [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: anchorDate } }],
      },
      transaction: t,
      order: [["effectiveFrom", "DESC"]],
    });

    if (!policyVersion) {
      const err = new Error("No active policy version for date of service");
      err.status = 422;
      throw err;
    }

    const coverageRules = await CoverageRule.findAll({
      where: { policyVersionId: policyVersion.id },
      transaction: t,
    });

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

    // Load usage ledger rows for the benefit years/service types involved (simple: by serviceType+year).
    const uniquePairs = new Map();
    for (const li of lineItems) {
      uniquePairs.set(`${li.serviceType}:${getBenefitYear(li.dateOfService)}`, {
        serviceType: li.serviceType,
        benefitYear: getBenefitYear(li.dateOfService),
      });
    }

    const ledgerRows = await UsageLedger.findAll({
      where: {
        memberId,
        policyVersionId: policyVersion.id,
        [Op.or]: [...uniquePairs.values()].map((p) => ({
          serviceType: p.serviceType,
          benefitYear: p.benefitYear,
        })),
      },
      transaction: t,
    });

    const ledgerByKey = new Map(
      ledgerRows.map((r) => [`${r.serviceType}:${r.benefitYear}`, r])
    );

    for (const li of lineItems) {
      const cli = await ClaimLineItem.create(
        {
          claimId: claim.id,
          serviceType: li.serviceType,
          amountCents: li.amountCents,
          dateOfService: li.dateOfService,
          status: "submitted",
        },
        { transaction: t }
      );

      const benefitYear = getBenefitYear(li.dateOfService);

      const decision = adjudicateLineItem({
        lineItem: li,
        coverageRules,
        usageLedger: ledgerRows.map((r) => r.toJSON()),
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
          const key = `${li.serviceType}:${benefitYear}`;
          const existing = ledgerByKey.get(key);
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
            ledgerByKey.set(key, created);
            ledgerRows.push(created);
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
