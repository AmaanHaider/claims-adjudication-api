require("dotenv").config();

let app = null;
let dbReadyPromise = null;

function requireCreateApp() {
  // Lazily load app module to avoid crashing at module init
  // if other dependencies throw during require-time in serverless.
  // (Vercel may import this file before env vars are set.)
  // eslint-disable-next-line global-require
  return require("../app/src/app").createApp;
}

function requireConnectToDatabase() {
  // Lazily load models to avoid eager Sequelize initialization on cold start.
  // eslint-disable-next-line global-require
  return require("../app/src/models").connectToDatabase;
}

function getApp() {
  if (!app) {
    const createApp = requireCreateApp();
    app = createApp();
  }
  return app;
}

function ensureDatabase() {
  if (!dbReadyPromise) {
    const connectToDatabase = requireConnectToDatabase();
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
    // eslint-disable-next-line no-console
    console.error("Vercel init failed", err);
    const detail = err && err.message ? String(err.message).slice(0, 200) : "unknown";
    res.status(500).json({
      error: {
        message: "Failed to initialize database",
        detail,
      },
    });
    return;
  }

  return getApp()(req, res);
};

