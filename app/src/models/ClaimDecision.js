const { Model } = require("sequelize");

const DECISION_STATUSES = ["approved", "denied", "needs_review", "manually_approved", "manually_denied"];

class ClaimDecision extends Model {}

function initClaimDecision(sequelize, DataTypes) {
  ClaimDecision.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      claimId: { type: DataTypes.INTEGER, allowNull: false },
      claimLineItemId: { type: DataTypes.INTEGER, allowNull: false },
      coverageRuleId: { type: DataTypes.INTEGER, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: false, validate: { isIn: [DECISION_STATUSES] } },
      submittedAmountCents: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
      allowedAmountCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
      payableAmountCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
      memberResponsibilityCents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      explanation: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      sequelize,
      modelName: "ClaimDecision",
      tableName: "claim_decisions",
      timestamps: true,
      underscored: true,
    }
  );

  return ClaimDecision;
}

module.exports = { ClaimDecision, DECISION_STATUSES, initClaimDecision };
