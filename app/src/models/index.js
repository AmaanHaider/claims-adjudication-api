const { buildSequelize } = require("../config/database");

const sequelize = buildSequelize();

async function connectToDatabase() {
  await sequelize.authenticate();
  return sequelize;
}

module.exports = {
  sequelize,
  connectToDatabase,
};
