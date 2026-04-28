const { Sequelize } = require("sequelize");

function shouldUseSsl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const host = url.hostname;
    return host !== "localhost" && host !== "127.0.0.1";
  } catch {
    // If parsing fails, default to no SSL to avoid breaking local dev.
    return false;
  }
}

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

  const useSsl = shouldUseSsl(databaseUrl);

  return new Sequelize(databaseUrl, {
    dialect: "postgres",
    logging,
    dialectOptions: useSsl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : undefined,
  });
}

module.exports = { buildSequelize };
