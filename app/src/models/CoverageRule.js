const { Model } = require("sequelize");

class CoverageRule extends Model {}

function initCoverageRule(sequelize, DataTypes) {
  CoverageRule.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      policyVersionId: { type: DataTypes.INTEGER, allowNull: false },
      serviceType: { type: DataTypes.STRING, allowNull: false },
      covered: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      payPercent: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 0, max: 100 },
      },
      annualLimitCents: { type: DataTypes.INTEGER, allowNull: true },
      deductibleApplies: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      reviewRequiredOverCents: { type: DataTypes.INTEGER, allowNull: true },
      explanationTemplate: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "CoverageRule",
      tableName: "coverage_rules",
      timestamps: true,
      underscored: true,
      indexes: [{ unique: true, fields: ["policy_version_id", "service_type"] }],
    }
  );

  return CoverageRule;
}

module.exports = { CoverageRule, initCoverageRule };
