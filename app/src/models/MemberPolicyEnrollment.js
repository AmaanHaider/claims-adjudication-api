const { Model } = require("sequelize");

class MemberPolicyEnrollment extends Model {}

function initMemberPolicyEnrollment(sequelize, DataTypes) {
  MemberPolicyEnrollment.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      memberId: { type: DataTypes.INTEGER, allowNull: false },
      policyId: { type: DataTypes.INTEGER, allowNull: false },
      effectiveFrom: { type: DataTypes.DATEONLY, allowNull: false },
      effectiveTo: { type: DataTypes.DATEONLY, allowNull: true },
    },
    {
      sequelize,
      modelName: "MemberPolicyEnrollment",
      tableName: "member_policy_enrollments",
      timestamps: true,
      underscored: true,
    }
  );

  return MemberPolicyEnrollment;
}

module.exports = { MemberPolicyEnrollment, initMemberPolicyEnrollment };
