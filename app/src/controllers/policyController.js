const policyReadService = require("../services/policyReadService");

async function listPolicies(req, res, next) {
  try {
    const policies = await policyReadService.listPolicies();
    res.status(200).json(policies);
  } catch (err) {
    next(err);
  }
}

async function getPolicyById(req, res, next) {
  try {
    const policy = await policyReadService.getPolicyById(Number(req.params.id));
    res.status(200).json(policy);
  } catch (err) {
    next(err);
  }
}

module.exports = { listPolicies, getPolicyById };
