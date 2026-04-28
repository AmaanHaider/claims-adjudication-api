const { Model } = require("sequelize");

const CLAIM_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "partially_approved",
  "denied",
  "paid",
  "disputed",
  "closed",
];

class Claim extends Model {}

function initClaim(sequelize, DataTypes) {
  Claim.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      memberId: { type: DataTypes.INTEGER, allowNull: false },
      providerName: { type: DataTypes.STRING, allowNull: false },
      diagnosisCodes: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "submitted",
        validate: { isIn: [CLAIM_STATUSES] },
      },
      totalSubmittedCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      totalPayableCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      submittedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "Claim",
      tableName: "claims",
      timestamps: true,
      underscored: true,
    }
  );

  return Claim;
}

module.exports = { Claim, CLAIM_STATUSES, initClaim };
