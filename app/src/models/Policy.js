const { Model } = require("sequelize");

class Policy extends Model {}

function initPolicy(sequelize, DataTypes) {
  Policy.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "Policy",
      tableName: "policies",
      timestamps: true,
      underscored: true,
    }
  );

  return Policy;
}

module.exports = { Policy, initPolicy };
