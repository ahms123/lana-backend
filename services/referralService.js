const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const Referral = require("../models/Referral");
const WalletAccount = require("../models/WalletAccount");
const walletService = require("./walletService");
const { NotFoundError, BadRequestError } = require("../errors");

const CODE_LENGTH = 10;
const CODE_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function generateReferralCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
}

function normalizeReferralCode(code) {
  return code.trim().toLowerCase();
}

function buildInvitationLink(referralCode) {
  const base = process.env.INVITE_BASE_URL || "https://lana.app/invite";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}ref=${encodeURIComponent(referralCode)}`;
}

function getSignupBonusPoints() {
  const parsed = parseInt(process.env.REFERRAL_SIGNUP_BONUS, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10;
}

/** Percent of invitee claim points awarded to inviter (default 5). */
function getClaimSharePercent() {
  const parsed = parseFloat(process.env.REFERRAL_CLAIM_SHARE_PERCENT);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5;
}

function computeClaimSharePoints(claimPoints) {
  const share = Math.floor((claimPoints * getClaimSharePercent()) / 100);
  return share > 0 ? share : 0;
}

/**
 * Lazy-generate a stable referral code on first use (no bulk backfill).
 */
async function ensureReferralCode(userId) {
  const user = await User.findById(userId).select("referralCode");
  if (!user) {
    throw new NotFoundError("User not found", { code: "USER_NOT_FOUND" });
  }
  if (user.referralCode) {
    return user.referralCode;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateReferralCode();
    try {
      const updated = await User.findOneAndUpdate(
        { _id: user._id, referralCode: { $in: [null, undefined] } },
        { $set: { referralCode: code } },
        { new: true }
      );
      if (updated?.referralCode) {
        return updated.referralCode;
      }
      const current = await User.findById(user._id).select("referralCode");
      if (current?.referralCode) {
        return current.referralCode;
      }
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }

  throw new Error("Failed to generate referral code");
}

async function findInviterByCode(referralCode) {
  const normalized = normalizeReferralCode(referralCode);
  if (!normalized) return null;
  return User.findOne({ referralCode: normalized }).select(
    "_id referralCode name"
  );
}

function invalidReferralError() {
  return new BadRequestError(
    "Invalid referral code. Leave the field empty if you don’t have one.",
    {
      code: "INVALID_REFERRAL_CODE",
      errors: [
        {
          field: "referralCode",
          message:
            "Invalid referral code. Leave the field empty if you don’t have one.",
        },
      ],
    }
  );
}

/**
 * If a code is provided, it must resolve to an existing inviter.
 * Call before creating the user so a bad code does not create an orphan account.
 * Empty / omitted code is allowed (optional referral).
 */
async function assertReferralCodeValidIfPresent(referralCode) {
  if (referralCode == null || typeof referralCode !== "string") {
    return null;
  }
  const normalized = normalizeReferralCode(referralCode);
  if (!normalized) {
    return null;
  }

  const inviter = await findInviterByCode(normalized);
  if (!inviter) {
    throw invalidReferralError();
  }
  return inviter;
}

async function creditInviterPoints(inviterUserId, points) {
  if (!points || points <= 0) return;
  await walletService.getOrCreateForUser(inviterUserId);
  await WalletAccount.findOneAndUpdate(
    { userId: inviterUserId },
    { $inc: { lanaPoints: points } }
  );
}

/**
 * One-time signup bonus to inviter when a referral row is created.
 */
async function awardSignupBonus(referral) {
  const bonus = getSignupBonusPoints();
  if (!referral || bonus <= 0) return null;

  const updated = await Referral.findOneAndUpdate(
    {
      _id: referral._id,
      signupBonusAwarded: { $ne: true },
    },
    {
      $set: { signupBonusAwarded: true },
      $inc: { pointsEarnedFromInvitee: bonus },
    },
    { new: true }
  );

  if (!updated) return null;

  await creditInviterPoints(updated.inviterUserId, bonus);
  return { points: bonus, inviterUserId: updated.inviterUserId };
}

/**
 * Record inviter → invitee on register.
 * Assumes assertReferralCodeValidIfPresent already ran when a code was sent.
 */
async function attributeReferralOnRegister(inviteeUserId, referralCode) {
  if (!referralCode || typeof referralCode !== "string") {
    return null;
  }

  const normalized = normalizeReferralCode(referralCode);
  if (!normalized) {
    return null;
  }

  const inviter = await findInviterByCode(normalized);
  if (!inviter) {
    throw invalidReferralError();
  }

  const inviteeId = new mongoose.Types.ObjectId(inviteeUserId);
  if (inviter._id.equals(inviteeId)) {
    throw invalidReferralError();
  }

  let referral;
  try {
    referral = await Referral.create({
      inviterUserId: inviter._id,
      inviteeUserId: inviteeId,
      referralCodeUsed: inviter.referralCode,
      signupBonusAwarded: false,
      pointsEarnedFromInvitee: 0,
    });
  } catch (err) {
    if (err.code === 11000) {
      return null;
    }
    throw err;
  }

  await awardSignupBonus(referral);
  return referral;
}

/**
 * When an invitee successfully claims, credit inviter with a % of those points.
 */
async function awardClaimShareToInviter(inviteeUserId, claimPoints) {
  const share = computeClaimSharePoints(claimPoints);
  if (share <= 0) return null;

  const inviteeId = new mongoose.Types.ObjectId(inviteeUserId);
  const referral = await Referral.findOneAndUpdate(
    { inviteeUserId: inviteeId },
    { $inc: { pointsEarnedFromInvitee: share } },
    { new: true }
  );

  if (!referral) return null;

  await creditInviterPoints(referral.inviterUserId, share);
  return {
    points: share,
    inviterUserId: referral.inviterUserId.toString(),
  };
}

module.exports = {
  generateReferralCode,
  normalizeReferralCode,
  buildInvitationLink,
  getSignupBonusPoints,
  getClaimSharePercent,
  computeClaimSharePoints,
  ensureReferralCode,
  findInviterByCode,
  assertReferralCodeValidIfPresent,
  attributeReferralOnRegister,
  awardClaimShareToInviter,
};
