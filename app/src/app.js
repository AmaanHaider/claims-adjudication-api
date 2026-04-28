const express = require("express");
const morgan = require("morgan");

const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { mountSwagger } = require("./docs/swagger");

const claimRoutes = require("./routes/claimRoutes");
const memberRoutes = require("./routes/memberRoutes");
const policyRoutes = require("./routes/policyRoutes");

function createApp() {
  const app = express();

  app.disable("x-powered-by");

  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  mountSwagger(app);

  // Basic route wiring (implementation will come later)
  app.use("/claims", claimRoutes);
  app.use("/members", memberRoutes);
  app.use("/policies", policyRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
