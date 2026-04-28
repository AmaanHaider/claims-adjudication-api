const { Op } = require("sequelize");

const {
  sequelize,
  Claim,
  ClaimLineItem,
  ClaimDecision,
  CoverageRule,
  UsageLedger,
  Payment,
  Dispute,
} = require("../models");

const { calculateClaimStatus } = require("./adjudicationService");

function getBenefitYear(dateOfService) {
  return Number(String(dateOfService).slice(0, 4));
}

async function reviewClaimLineItem({ claimId, lineItemId, decision, explanation }) {
  const normalized = String(decision || "").toLowerCase();
  if (normalized !== "approved" && normalized !== "denied") {
    const err = new Error("decision must be approved or denied");
    err.status = 400;
    throw err;
  }

  if (typeof explanation !== "string" || explanation.trim().length === 0) {
    const err = new Error("explanation is required");
    err.status = 400;
    throw err;
  }

  return await sequelize.transaction(async (t) => {
    const claim = await Claim.findByPk(claimId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!claim) {
      const err = new Error("Claim not found");
      err.status = 404;
      throw err;
    }

    const lineItem = await ClaimLineItem.findOne({
      where: { id: lineItemId, claimId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!lineItem) {
      const err = new Error("Line item not found on claim");
      err.status = 404;
      throw err;
    }

    if (lineItem.status !== "needs_review") {
      const err = new Error("Only needs_review line items can be reviewed");
      err.status = 422;
      throw err;
    }

    const existingDecision = await ClaimDecision.findOne({
      where: { claimId, claimLineItemId: lineItemId },
      transaction: t,
    });

    let coverageRule = null;
    if (existingDecision?.coverageRuleId) {
      coverageRule = await CoverageRule.findByPk(existingDecision.coverageRuleId, { transaction: t });
    }

    const submittedAmountCents = lineItem.amountCents;

    if (normalized === "approved") {
      const payPercent = coverageRule ? Number(coverageRule.payPercent) || 0 : 0;
      const allowedAmountCents = submittedAmountCents;
      const payableAmountCents = Math.round((allowedAmountCents * payPercent) / 100);

      await lineItem.update({ status: "manually_approved" }, { transaction: t });

      if (existingDecision) {
        await existingDecision.update(
          {
            status: "manually_approved",
            allowedAmountCents,
            payableAmountCents,
            memberResponsibilityCents: submittedAmountCents - payableAmountCents,
            explanation,
          },
          { transaction: t }
        );
      } else {
        await ClaimDecision.create(
          {
            claimId,
            claimLineItemId: lineItemId,
            coverageRuleId: coverageRule?.id ?? null,
            status: "manually_approved",
            submittedAmountCents,
            allowedAmountCents,
            payableAmountCents,
            memberResponsibilityCents: submittedAmountCents - payableAmountCents,
            explanation,
          },
          { transaction: t }
        );
      }

      // Update annual limit usage ledger (tracks allowed amount usage).
      if (coverageRule && coverageRule.annualLimitCents !== null && coverageRule.annualLimitCents !== undefined) {
        const benefitYear = getBenefitYear(lineItem.dateOfService);
        const existingLedger = await UsageLedger.findOne({
          where: {
            memberId: claim.memberId,
            policyVersionId: coverageRule.policyVersionId,
            serviceType: lineItem.serviceType,
            benefitYear,
          },
          transaction: t,
        });
        if (existingLedger) {
          await existingLedger.update(
            { usedAmountCents: existingLedger.usedAmountCents + allowedAmountCents },
            { transaction: t }
          );
        } else {
          await UsageLedger.create(
            {
              memberId: claim.memberId,
              policyVersionId: coverageRule.policyVersionId,
              serviceType: lineItem.serviceType,
              benefitYear,
              usedAmountCents: allowedAmountCents,
            },
            { transaction: t }
          );
        }
      }
    } else {
      await lineItem.update({ status: "manually_denied" }, { transaction: t });

      if (existingDecision) {
        await existingDecision.update(
          {
            status: "manually_denied",
            allowedAmountCents: 0,
            payableAmountCents: 0,
            memberResponsibilityCents: submittedAmountCents,
            explanation,
          },
          { transaction: t }
        );
      } else {
        await ClaimDecision.create(
          {
            claimId,
            claimLineItemId: lineItemId,
            coverageRuleId: coverageRule?.id ?? null,
            status: "manually_denied",
            submittedAmountCents,
            allowedAmountCents: 0,
            payableAmountCents: 0,
            memberResponsibilityCents: submittedAmountCents,
            explanation,
          },
          { transaction: t }
        );
      }
    }

    const refreshed = await Claim.findByPk(claimId, {
      transaction: t,
      include: [{ model: ClaimLineItem }, { model: ClaimDecision }],
    });

    const totalPayableCents = refreshed.ClaimDecisions.reduce((sum, d) => {
      if (d.status === "approved" || d.status === "manually_approved") return sum + d.payableAmountCents;
      return sum;
    }, 0);

    const newStatus = calculateClaimStatus(refreshed.ClaimDecisions.map((d) => ({ status: d.status })));

    await refreshed.update({ totalPayableCents, status: newStatus }, { transaction: t });

    return await Claim.findByPk(claimId, {
      transaction: t,
      include: [{ model: ClaimLineItem }, { model: ClaimDecision }],
    });
  });
}

async function payClaim({ claimId }) {
  return await sequelize.transaction(async (t) => {
    const claim = await Claim.findByPk(claimId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!claim) {
      const err = new Error("Claim not found");
      err.status = 404;
      throw err;
    }

    if (claim.status === "under_review" || claim.status === "denied") {
      const err = new Error("Claim cannot be paid in its current status");
      err.status = 422;
      throw err;
    }

    if (claim.status !== "approved" && claim.status !== "partially_approved") {
      const err = new Error("Only approved or partially_approved claims can be paid");
      err.status = 422;
      throw err;
    }

    const payment = await Payment.create(
      {
        claimId,
        amountCents: claim.totalPayableCents,
        status: "paid",
        paidAt: new Date(),
      },
      { transaction: t }
    );

    await claim.update({ status: "paid" }, { transaction: t });

    return { claim, payment };
  });
}

async function disputeClaim({ claimId, reason }) {
  if (typeof reason !== "string" || reason.trim().length === 0) {
    const err = new Error("reason is required");
    err.status = 400;
    throw err;
  }

  return await sequelize.transaction(async (t) => {
    const claim = await Claim.findByPk(claimId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!claim) {
      const err = new Error("Claim not found");
      err.status = 404;
      throw err;
    }

    const allowed = new Set(["approved", "partially_approved", "denied", "paid"]);
    if (!allowed.has(claim.status)) {
      const err = new Error("Claim cannot be disputed in its current status");
      err.status = 422;
      throw err;
    }

    const dispute = await Dispute.create(
      {
        claimId,
        reason,
        status: "open",
      },
      { transaction: t }
    );

    await claim.update({ status: "disputed" }, { transaction: t });

    return { claim, dispute };
  });
}

module.exports = {
  reviewClaimLineItem,
  payClaim,
  disputeClaim,
};
