const { StatusCodes } = require("http-status-codes");
const walletService = require("../services/walletService");

/**
 * GET /api/v1/wallet — wallet snapshot for authenticated user.
 */
const getWallet = async (req, res) => {
  const account = await walletService.getOrCreateForUser(req.user.userId);
  res.status(StatusCodes.OK).json({
    wallet: walletService.toPublicWallet(account),
  });
};

/**
 * POST /api/v1/wallet/link — link external EVM wallet address.
 */
const linkWallet = async (req, res) => {
  const account = await walletService.linkAddress(
    req.user.userId,
    req.body.address
  );
  res.status(StatusCodes.OK).json({
    wallet: walletService.toPublicWallet(account),
  });
};

/**
 * DELETE /api/v1/wallet/link — remove linked wallet address.
 */
const unlinkWallet = async (req, res) => {
  const account = await walletService.unlinkAddress(req.user.userId);
  res.status(StatusCodes.OK).json({
    wallet: walletService.toPublicWallet(account),
  });
};

module.exports = { getWallet, linkWallet, unlinkWallet };
