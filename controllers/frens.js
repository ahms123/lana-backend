const { StatusCodes } = require("http-status-codes");
const frensService = require("../services/frensService");

/**
 * GET /api/v1/frens — leaderboard, invited list, stable invitation link.
 */
const getFrens = async (req, res) => {
  const data = await frensService.getFrensForUser(req.user.userId);
  res.status(StatusCodes.OK).json(data);
};

module.exports = { getFrens };
