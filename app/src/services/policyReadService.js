const { Policy, PolicyVersion, CoverageRule, MemberPolicyEnrollment, Member } = require("../models");

async function listPolicies() {
  return await Policy.findAll({
    order: [["id", "ASC"]],
    include: [
      { model: PolicyVersion, include: [{ model: CoverageRule }] },
      { model: MemberPolicyEnrollment, include: [{ model: Member }] },
    ],
  });
}

async function getPolicyById(id) {
  const policy = await Policy.findByPk(id, {
    include: [
      { model: PolicyVersion, include: [{ model: CoverageRule }] },
      { model: MemberPolicyEnrollment, include: [{ model: Member }] },
    ],
  });
  if (!policy) {
    const err = new Error("Policy not found");
    err.status = 404;
    throw err;
  }
  return policy;
}

module.exports = { listPolicies, getPolicyById };

