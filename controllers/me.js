const User = require("../models/User");
const { StatusCodes } = require("http-status-codes");
const { UnauthenticatedError } = require("../errors");
const { toPublicUser } = require("../utils/publicUser");
const statsService = require("../services/statsService");

/**
 * GET /api/v1/me — current user profile (LANA-201).
 */
const getMe = async (req, res) => {
  const user = await User.findById(req.user.userId).select("-password");
  if (!user) {
    throw new UnauthenticatedError("Authentication invalid");
  }
  res.status(StatusCodes.OK).json({ user: toPublicUser(user) });
};

/**
 * PATCH /api/v1/me — partial profile update (allowed: name).
 */
const patchMe = async (req, res) => {
  const user = await User.findById(req.user.userId).select("-password");
  if (!user) {
    throw new UnauthenticatedError("Authentication invalid");
  }

  if (req.body.name !== undefined) {
    user.name = req.body.name;
  }

  await user.save();

  res.status(StatusCodes.OK).json({ user: toPublicUser(user) });
};

/**
 * GET /api/v1/me/stats — rank and score for authenticated user.
 */
const getStats = async (req, res) => {
  const { rank, score } = await statsService.getMyStats(req.user.userId);
  res.status(StatusCodes.OK).json({ rank, score });
};

module.exports = { getMe, patchMe, getStats };
