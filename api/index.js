require("dotenv").config();

const { createApp } = require("../app/src/app");
const { connectToDatabase } = require("../app/src/models");

let app = null;
let dbReadyPromise = null;

function getApp() {
  if (!app) app = createApp();
  return app;
}

function ensureDatabase() {
  if (!dbReadyPromise) {
    dbReadyPromise = connectToDatabase().catch((err) => {
      // Allow retry on next invocation if initialization fails.
      dbReadyPromise = null;
      throw err;
    });
  }
  return dbReadyPromise;
}

module.exports = async function handler(req, res) {
  try {
    await ensureDatabase();
  } catch (err) {
    res.status(500).json({
      error: {
        message: "Failed to initialize database",
      },
    });
    return;
  }

  return getApp()(req, res);
};

