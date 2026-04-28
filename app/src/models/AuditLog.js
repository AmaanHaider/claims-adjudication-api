const { Model } = require("sequelize");

class AuditLog extends Model {}

function initAuditLog(sequelize, DataTypes) {
  AuditLog.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      entityType: { type: DataTypes.STRING, allowNull: false },
      entityId: { type: DataTypes.INTEGER, allowNull: false },
      action: { type: DataTypes.STRING, allowNull: false },
      previousValue: { type: DataTypes.JSONB, allowNull: true },
      newValue: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      sequelize,
      modelName: "AuditLog",
      tableName: "audit_logs",
      timestamps: true,
      underscored: true,
    }
  );

  return AuditLog;
}

module.exports = { AuditLog, initAuditLog };
