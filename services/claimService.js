const mongoose = require("mongoose");
const WalletAccount = require("../models/WalletAccount");
const walletService = require("./walletService");
const referralService = require("./referralService");

function getCooldownHours() {
  const parsed = parseInt(process.env.CLAIM_COOLDOWN_HOURS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

function getCooldownMs() {
  return getCooldownHours() * 60 * 60 * 1000;
}

function getClaimPoints() {
  const parsed = parseInt(process.env.CLAIM_POINTS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function toIso(date) {
  return date ? date.toISOString() : null;
}

function computeNextClaimAt(lastClaimAt, cooldownMs = getCooldownMs()) {
  if (!lastClaimAt) return null;
  return new Date(lastClaimAt.getTime() + cooldownMs);
}

function buildStatus(account) {
  const cooldownMs = getCooldownMs();
  const cooldownHours = getCooldownHours();
  const pointsPerClaim = getClaimPoints();
  const lastClaimAt = account.lastClaimAt || null;
  const now = Date.now();

  if (!lastClaimAt) {
    return {
      canClaim: true,
      lastClaimAt: null,
      nextClaimAt: null,
      cooldownHours,
      pointsPerClaim,
    };
  }

  const nextClaimAt = computeNextClaimAt(lastClaimAt, cooldownMs);
  const canClaim = now >= nextClaimAt.getTime();

  return {
    canClaim,
    lastClaimAt: toIso(lastClaimAt),
    nextClaimAt: toIso(nextClaimAt),
    cooldownHours,
    pointsPerClaim,
  };
}

async function getStatus(userId) {
  const account = await walletService.getOrCreateForUser(userId);
  return buildStatus(account);
}

async function claim(userId) {
  const id = new mongoose.Types.ObjectId(userId);
  const cooldownMs = getCooldownMs();
  const points = getClaimPoints();
  const now = new Date();
  const cutoff = new Date(now.getTime() - cooldownMs);

  await walletService.getOrCreateForUser(userId);

  const updated = await WalletAccount.findOneAndUpdate(
    {
      userId: id,
      $or: [
        { lastClaimAt: { $exists: false } },
        { lastClaimAt: null },
        { lastClaimAt: { $lte: cutoff } },
      ],
    },
    {
      $set: { lastClaimAt: now },
      $inc: { lanaPoints: points },
    },
    { new: true }
  );

  if (!updated) {
    let account = await WalletAccount.findOne({ userId: id });
    if (!account) {
      account = await walletService.getOrCreateForUser(userId);
    }
    const nextClaimAt =
      computeNextClaimAt(account.lastClaimAt, cooldownMs) ??
      new Date(now.getTime() + cooldownMs);
    return { ok: false, nextClaimAt };
  }

  // Inviter earns a share of this claim when the claimer was referred.
  let referralShare = null;
  try {
    referralShare = await referralService.awardClaimShareToInviter(
      userId,
      points
    );
  } catch (err) {
    console.warn("Referral claim share failed:", err.message || err);
  }

  const nextClaimAt = new Date(now.getTime() + cooldownMs);
  return {
    ok: true,
    points,
    nextClaimAt,
    totalPoints: updated.lanaPoints ?? 0,
    referralShare,
  };
}

module.exports = {
  getCooldownHours,
  getCooldownMs,
  getClaimPoints,
  getStatus,
  claim,
};
