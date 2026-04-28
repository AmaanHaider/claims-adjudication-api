const { buildSequelize } = require("../config/database");
const { DataTypes } = require("sequelize");

const { initMember } = require("./Member");
const { initPolicy } = require("./Policy");
const { initPolicyVersion } = require("./PolicyVersion");
const { initMemberPolicyEnrollment } = require("./MemberPolicyEnrollment");
const { initCoverageRule } = require("./CoverageRule");
const { initClaim } = require("./Claim");
const { initClaimLineItem } = require("./ClaimLineItem");
const { initClaimDecision } = require("./ClaimDecision");
const { initUsageLedger } = require("./UsageLedger");
const { initDispute } = require("./Dispute");
const { initPayment } = require("./Payment");
const { initAuditLog } = require("./AuditLog");

const sequelize = buildSequelize();

const Member = initMember(sequelize, DataTypes);
const Policy = initPolicy(sequelize, DataTypes);
const PolicyVersion = initPolicyVersion(sequelize, DataTypes);
const MemberPolicyEnrollment = initMemberPolicyEnrollment(sequelize, DataTypes);
const CoverageRule = initCoverageRule(sequelize, DataTypes);
const Claim = initClaim(sequelize, DataTypes);
const ClaimLineItem = initClaimLineItem(sequelize, DataTypes);
const ClaimDecision = initClaimDecision(sequelize, DataTypes);
const UsageLedger = initUsageLedger(sequelize, DataTypes);
const Dispute = initDispute(sequelize, DataTypes);
const Payment = initPayment(sequelize, DataTypes);
const AuditLog = initAuditLog(sequelize, DataTypes);

// Associations
Member.hasMany(MemberPolicyEnrollment, { foreignKey: "memberId" });
MemberPolicyEnrollment.belongsTo(Member, { foreignKey: "memberId" });

Policy.hasMany(MemberPolicyEnrollment, { foreignKey: "policyId" });
MemberPolicyEnrollment.belongsTo(Policy, { foreignKey: "policyId" });

Policy.hasMany(PolicyVersion, { foreignKey: "policyId" });
PolicyVersion.belongsTo(Policy, { foreignKey: "policyId" });

PolicyVersion.hasMany(CoverageRule, { foreignKey: "policyVersionId" });
CoverageRule.belongsTo(PolicyVersion, { foreignKey: "policyVersionId" });

Member.hasMany(Claim, { foreignKey: "memberId" });
Claim.belongsTo(Member, { foreignKey: "memberId" });

Claim.hasMany(ClaimLineItem, { foreignKey: "claimId" });
ClaimLineItem.belongsTo(Claim, { foreignKey: "claimId" });

Claim.hasMany(ClaimDecision, { foreignKey: "claimId" });
ClaimDecision.belongsTo(Claim, { foreignKey: "claimId" });

ClaimLineItem.hasMany(ClaimDecision, { foreignKey: "claimLineItemId" });
ClaimDecision.belongsTo(ClaimLineItem, { foreignKey: "claimLineItemId" });

CoverageRule.hasMany(ClaimDecision, { foreignKey: "coverageRuleId" });
ClaimDecision.belongsTo(CoverageRule, { foreignKey: "coverageRuleId" });

Member.hasMany(UsageLedger, { foreignKey: "memberId" });
UsageLedger.belongsTo(Member, { foreignKey: "memberId" });

PolicyVersion.hasMany(UsageLedger, { foreignKey: "policyVersionId" });
UsageLedger.belongsTo(PolicyVersion, { foreignKey: "policyVersionId" });

Claim.hasMany(Dispute, { foreignKey: "claimId" });
Dispute.belongsTo(Claim, { foreignKey: "claimId" });

Claim.hasMany(Payment, { foreignKey: "claimId" });
Payment.belongsTo(Claim, { foreignKey: "claimId" });

async function connectToDatabase() {
  await sequelize.authenticate();
  return sequelize;
}

module.exports = {
  sequelize,
  connectToDatabase,
  Member,
  Policy,
  PolicyVersion,
  MemberPolicyEnrollment,
  CoverageRule,
  Claim,
  ClaimLineItem,
  ClaimDecision,
  UsageLedger,
  Dispute,
  Payment,
  AuditLog,
};
