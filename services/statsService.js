const walletService = require("./walletService");

async function getScoreForUser(userId) {
  const account = await walletService.getOrCreateForUser(userId);
  return account.lanaPoints ?? 0;
}

module.exports = { getScoreForUser };
