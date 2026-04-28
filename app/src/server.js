require("dotenv").config();

const { createApp } = require("./app");
const { connectToDatabase } = require("./models");

const port = Number.parseInt(process.env.PORT, 10) || 3000;
const app = createApp();

const server = app.listen(port, async () => {
  try {
    await connectToDatabase();
    // eslint-disable-next-line no-console
    console.log("Database connection established");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to connect to database");
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }

  // Intentionally minimal: logs are useful for local dev.
  // eslint-disable-next-line no-console
  console.log(`Claims Adjudication API listening on port ${port}`);
});

function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}. Shutting down...`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

