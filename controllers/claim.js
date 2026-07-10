const { StatusCodes } = require("http-status-codes");
const claimService = require("../services/claimService");

/**
 * GET /api/v1/claim — claim eligibility and cooldown for authenticated user.
 */
const getClaimStatus = async (req, res) => {
  const status = await claimService.getStatus(req.user.userId);
  res.status(StatusCodes.OK).json(status);
};

/**
 * POST /api/v1/claim — award points if cooldown elapsed (race-safe).
 */
const postClaim = async (req, res) => {
  const result = await claimService.claim(req.user.userId);

  if (!result.ok) {
    return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
      success: false,
      message: "Claim not available yet",
      code: "CLAIM_COOLDOWN",
      nextClaimAt: result.nextClaimAt.toISOString(),
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    points: result.points,
    nextClaimAt: result.nextClaimAt.toISOString(),
    totalPoints: result.totalPoints,
  });
};

module.exports = { getClaimStatus, postClaim };
