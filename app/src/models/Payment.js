const { Model } = require("sequelize");

const PAYMENT_STATUSES = ["pending", "paid", "failed"];

class Payment extends Model {}

function initPayment(sequelize, DataTypes) {
  Payment.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      claimId: { type: DataTypes.INTEGER, allowNull: false },
      amountCents: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "pending",
        validate: { isIn: [PAYMENT_STATUSES] },
      },
      paidAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "Payment",
      tableName: "payments",
      timestamps: true,
      underscored: true,
    }
  );

  return Payment;
}

module.exports = { Payment, PAYMENT_STATUSES, initPayment };
