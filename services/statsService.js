const mongoose = require("mongoose");
const WalletAccount = require("../models/WalletAccount");
const User = require("../models/User");
const walletService = require("./walletService");

/** Only wallets whose User document still exists (ignores orphans after user deletes). */
function activeWalletsWithUserPipeline() {
  return [
    {
      $lookup: {
        from: User.collection.name,
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $match: { "user.0": { $exists: true } } },
  ];
}

async function getScoreForUser(userId) {
  const account = await walletService.getOrCreateForUser(userId);
  return account.lanaPoints ?? 0;
}

/**
 * Rank among active users only, matching leaderboard order:
 * higher lanaPoints first; ties broken by userId ascending.
 */
async function getMyStats(userId) {
  const id = new mongoose.Types.ObjectId(userId);
  const score = await getScoreForUser(userId);

  const result = await WalletAccount.aggregate([
    ...activeWalletsWithUserPipeline(),
    {
      $match: {
        $or: [
          { lanaPoints: { $gt: score } },
          { lanaPoints: score, userId: { $lt: id } },
        ],
      },
    },
    { $count: "count" },
  ]);

  return { score, rank: (result[0]?.count ?? 0) + 1 };
}

/**
 * Top players among active users only. Dense ranks 1..n in score order.
 */
async function getLeaderboard(limit) {
  const rows = await WalletAccount.aggregate([
    ...activeWalletsWithUserPipeline(),
    { $sort: { lanaPoints: -1, userId: 1 } },
    { $limit: limit },
    {
      $project: {
        userId: 1,
        lanaPoints: 1,
        name: { $arrayElemAt: ["$user.name", 0] },
      },
    },
  ]);

  return rows.map((row, index) => ({
    id: row.userId.toString(),
    name: row.name,
    score: row.lanaPoints ?? 0,
    rank: index + 1,
  }));
}

module.exports = { getScoreForUser, getMyStats, getLeaderboard };
