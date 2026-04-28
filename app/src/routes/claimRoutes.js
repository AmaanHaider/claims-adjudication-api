const express = require("express");

const router = express.Router();

// Endpoints will be implemented in later steps.
router.use((req, res) => {
  res.status(501).json({ error: { message: "Not implemented" } });
});

module.exports = router;
