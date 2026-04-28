const { Model } = require("sequelize");

class Member extends Model {}

function initMember(sequelize, DataTypes) {
  Member.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      firstName: { type: DataTypes.STRING, allowNull: false },
      lastName: { type: DataTypes.STRING, allowNull: false },
      dateOfBirth: { type: DataTypes.DATEONLY, allowNull: false },
    },
    {
      sequelize,
      modelName: "Member",
      tableName: "members",
      timestamps: true,
      underscored: true,
    }
  );

  return Member;
}

module.exports = { Member, initMember };
