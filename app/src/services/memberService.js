const { Member, MemberPolicyEnrollment, Policy, PolicyVersion, CoverageRule } = require("../models");

async function listMembers() {
  return await Member.findAll({
    order: [["id", "ASC"]],
    include: [
      {
        model: MemberPolicyEnrollment,
        include: [
          { model: Policy, include: [{ model: PolicyVersion, include: [{ model: CoverageRule }] }] },
        ],
      },
    ],
  });
}

async function getMemberById(id) {
  const member = await Member.findByPk(id, {
    include: [
      {
        model: MemberPolicyEnrollment,
        include: [
          { model: Policy, include: [{ model: PolicyVersion, include: [{ model: CoverageRule }] }] },
        ],
      },
    ],
  });
  if (!member) {
    const err = new Error("Member not found");
    err.status = 404;
    throw err;
  }
  return member;
}

module.exports = { listMembers, getMemberById };

