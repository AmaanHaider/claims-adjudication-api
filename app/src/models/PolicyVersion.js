const { Model } = require("sequelize");

class PolicyVersion extends Model {}

function initPolicyVersion(sequelize, DataTypes) {
  PolicyVersion.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      policyId: { type: DataTypes.INTEGER, allowNull: false },
      versionName: { type: DataTypes.STRING, allowNull: false },
      effectiveFrom: { type: DataTypes.DATEONLY, allowNull: false },
      effectiveTo: { type: DataTypes.DATEONLY, allowNull: true },
    },
    {
      sequelize,
      modelName: "PolicyVersion",
      tableName: "policy_versions",
      timestamps: true,
      underscored: true,
    }
  );

  return PolicyVersion;
}

module.exports = { PolicyVersion, initPolicyVersion };
