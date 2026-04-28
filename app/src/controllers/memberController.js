const memberService = require("../services/memberService");

async function listMembers(req, res, next) {
  try {
    const members = await memberService.listMembers();
    res.status(200).json(members);
  } catch (err) {
    next(err);
  }
}

async function getMemberById(req, res, next) {
  try {
    const member = await memberService.getMemberById(Number(req.params.id));
    res.status(200).json(member);
  } catch (err) {
    next(err);
  }
}

module.exports = { listMembers, getMemberById };
