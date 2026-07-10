const WalletAccount = require("../models/WalletAccount");
const walletService = require("./walletService");

async function getScoreForUser(userId) {
  const account = await walletService.getOrCreateForUser(userId);
  return account.lanaPoints ?? 0;
}

async function getMyStats(userId) {
  const score = await getScoreForUser(userId);
  const higherCount = await WalletAccount.countDocuments({
    lanaPoints: { $gt: score },
  });
  return { score, rank: higherCount + 1 };
}

module.exports = { getScoreForUser, getMyStats };
