const mongoose = require("mongoose");
const User = require("../models/User");
const WalletAccount = require("../models/WalletAccount");
const Referral = require("../models/Referral");
const referralService = require("./referralService");
const statsService = require("./statsService");

function getLeaderboardLimit() {
  const parsed = parseInt(process.env.LEADERBOARD_LIMIT, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

function toPublicFrenUser(user, score, rank = null) {
  return {
    id: user._id.toString(),
    name: user.name,
    score,
    rank,
  };
}

async function buildLeaderboard(limit) {
  const rows = await statsService.getLeaderboard(limit);
  return rows.map((row) =>
    toPublicFrenUser({ _id: row.id, name: row.name }, row.score, row.rank)
  );
}

async function getMyRank(userId) {
  const { score, rank } = await statsService.getMyStats(userId);
  return { myScore: score, myRank: rank };
}

async function buildInvitedList(inviterUserId) {
  const id = new mongoose.Types.ObjectId(inviterUserId);
  const referrals = await Referral.find({ inviterUserId: id })
    .sort({ createdAt: -1 })
    .select("inviteeUserId pointsEarnedFromInvitee");

  if (referrals.length === 0) {
    return [];
  }

  const inviteeIds = referrals.map((r) => r.inviteeUserId);
  const [users, wallets] = await Promise.all([
    User.find({ _id: { $in: inviteeIds } }).select("name"),
    WalletAccount.find({ userId: { $in: inviteeIds } }).select(
      "userId lanaPoints"
    ),
  ]);

  const walletMap = new Map(
    wallets.map((w) => [w.userId.toString(), w.lanaPoints ?? 0])
  );
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  return referrals
    .map((referral) => {
      const key = referral.inviteeUserId.toString();
      const user = userMap.get(key);
      if (!user) return null;
      return {
        id: user._id.toString(),
        name: user.name,
        score: walletMap.get(key) ?? 0,
        rank: null,
        pointsEarned: referral.pointsEarnedFromInvitee ?? 0,
      };
    })
    .filter(Boolean);
}

async function getFrensForUser(userId) {
  const referralCode = await referralService.ensureReferralCode(userId);
  const limit = getLeaderboardLimit();

  const [leaderboard, invited, rankInfo] = await Promise.all([
    buildLeaderboard(limit),
    buildInvitedList(userId),
    getMyRank(userId),
  ]);

  return {
    invitationLink: referralService.buildInvitationLink(referralCode),
    referralCode,
    myRank: rankInfo.myRank,
    myScore: rankInfo.myScore,
    leaderboard,
    invited,
  };
}

module.exports = {
  getLeaderboardLimit,
  getFrensForUser,
};
