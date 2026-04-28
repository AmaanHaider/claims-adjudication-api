const { Model } = require("sequelize");

const LINE_ITEM_STATUSES = [
  "submitted",
  "approved",
  "denied",
  "needs_review",
  "manually_approved",
  "manually_denied",
];

class ClaimLineItem extends Model {}

function initClaimLineItem(sequelize, DataTypes) {
  ClaimLineItem.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      claimId: { type: DataTypes.INTEGER, allowNull: false },
      serviceType: { type: DataTypes.STRING, allowNull: false },
      amountCents: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
      dateOfService: { type: DataTypes.DATEONLY, allowNull: false },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "submitted",
        validate: { isIn: [LINE_ITEM_STATUSES] },
      },
    },
    {
      sequelize,
      modelName: "ClaimLineItem",
      tableName: "claim_line_items",
      timestamps: true,
      underscored: true,
    }
  );

  return ClaimLineItem;
}

module.exports = { ClaimLineItem, LINE_ITEM_STATUSES, initClaimLineItem };
