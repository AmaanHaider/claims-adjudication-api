const { Model } = require("sequelize");

const DISPUTE_STATUSES = ["open", "under_review", "resolved", "closed"];

class Dispute extends Model {}

function initDispute(sequelize, DataTypes) {
  Dispute.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      claimId: { type: DataTypes.INTEGER, allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "open",
        validate: { isIn: [DISPUTE_STATUSES] },
      },
    },
    {
      sequelize,
      modelName: "Dispute",
      tableName: "disputes",
      timestamps: true,
      underscored: true,
    }
  );

  return Dispute;
}

module.exports = { Dispute, DISPUTE_STATUSES, initDispute };
