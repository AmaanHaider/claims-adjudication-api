const express = require("express");

const router = express.Router();

const { validateClaimRequest } = require("../middleware/validateClaimRequest");
const claimController = require("../controllers/claimController");

router.post("/", validateClaimRequest, claimController.createClaim);
router.get("/", claimController.listClaims);
router.get("/:id", claimController.getClaimById);
router.post("/:id/review", claimController.reviewClaimLineItem);
router.post("/:id/pay", claimController.payClaim);
router.post("/:id/dispute", claimController.disputeClaim);

module.exports = router;
