const { Sequelize } = require("sequelize");

function buildSequelize() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const logging =
    process.env.NODE_ENV === "test"
      ? false
      : process.env.SEQUELIZE_LOGGING === "true"
        ? console.log
        : false;

  return new Sequelize(databaseUrl, {
    dialect: "postgres",
    logging,
  });
}

module.exports = { buildSequelize };
