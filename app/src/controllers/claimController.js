const claimService = require("../services/claimService");
const lifecycleService = require("../services/lifecycleService");

async function createClaim(req, res, next) {
  try {
    const claim = await claimService.createClaim(req.body);
    res.status(201).json(claim);
  } catch (err) {
    next(err);
  }
}

async function listClaims(req, res, next) {
  try {
    const claims = await claimService.listClaims();
    res.status(200).json(claims);
  } catch (err) {
    next(err);
  }
}

async function getClaimById(req, res, next) {
  try {
    const claim = await claimService.getClaimById(Number(req.params.id));
    res.status(200).json(claim);
  } catch (err) {
    next(err);
  }
}

async function reviewClaimLineItem(req, res, next) {
  try {
    const claimId = Number(req.params.id);
    const { lineItemId, decision, explanation } = req.body || {};
    const updated = await lifecycleService.reviewClaimLineItem({
      claimId,
      lineItemId: Number(lineItemId),
      decision,
      explanation,
    });
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

async function payClaim(req, res, next) {
  try {
    const claimId = Number(req.params.id);
    const result = await lifecycleService.payClaim({ claimId });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function disputeClaim(req, res, next) {
  try {
    const claimId = Number(req.params.id);
    const { reason } = req.body || {};
    const result = await lifecycleService.disputeClaim({ claimId, reason });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createClaim,
  listClaims,
  getClaimById,
  reviewClaimLineItem,
  payClaim,
  disputeClaim,
};
