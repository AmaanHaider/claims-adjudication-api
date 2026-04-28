const { Model } = require("sequelize");

class UsageLedger extends Model {}

function initUsageLedger(sequelize, DataTypes) {
  UsageLedger.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      memberId: { type: DataTypes.INTEGER, allowNull: false },
      policyVersionId: { type: DataTypes.INTEGER, allowNull: false },
      serviceType: { type: DataTypes.STRING, allowNull: false },
      benefitYear: { type: DataTypes.INTEGER, allowNull: false },
      usedAmountCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    },
    {
      sequelize,
      modelName: "UsageLedger",
      tableName: "usage_ledger",
      timestamps: true,
      underscored: true,
      indexes: [{ unique: true, fields: ["member_id", "policy_version_id", "service_type", "benefit_year"] }],
    }
  );

  return UsageLedger;
}

module.exports = { UsageLedger, initUsageLedger };
