const express = require("express");

const router = express.Router();

const memberController = require("../controllers/memberController");

router.get("/", memberController.listMembers);
router.get("/:id", memberController.getMemberById);

module.exports = router;
