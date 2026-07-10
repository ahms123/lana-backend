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
  const wallets = await WalletAccount.find({})
    .sort({ lanaPoints: -1, userId: 1 })
    .limit(limit)
    .select("userId lanaPoints");

  if (wallets.length === 0) {
    return [];
  }

  const userIds = wallets.map((w) => w.userId);
  const users = await User.find({ _id: { $in: userIds } }).select("name");
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  return wallets
    .map((wallet, index) => {
      const user = userMap.get(wallet.userId.toString());
      if (!user) return null;
      return toPublicFrenUser(user, wallet.lanaPoints ?? 0, index + 1);
    })
    .filter(Boolean);
}

async function getMyRank(userId) {
  const myScore = await statsService.getScoreForUser(userId);
  const higherCount = await WalletAccount.countDocuments({
    lanaPoints: { $gt: myScore },
  });
  return { myScore, myRank: higherCount + 1 };
}

async function buildInvitedList(inviterUserId) {
  const id = new mongoose.Types.ObjectId(inviterUserId);
  const referrals = await Referral.find({ inviterUserId: id })
    .sort({ createdAt: -1 })
    .select("inviteeUserId");

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
      return toPublicFrenUser(user, walletMap.get(key) ?? 0, null);
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
