const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const Referral = require("../models/Referral");
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
  const base =
    process.env.INVITE_BASE_URL || "https://lana.app/invite";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}ref=${encodeURIComponent(referralCode)}`;
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
  return User.findOne({ referralCode: normalized }).select("_id referralCode name");
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

  try {
    return await Referral.create({
      inviterUserId: inviter._id,
      inviteeUserId: inviteeId,
      referralCodeUsed: inviter.referralCode,
    });
  } catch (err) {
    if (err.code === 11000) {
      return null;
    }
    throw err;
  }
}

module.exports = {
  generateReferralCode,
  normalizeReferralCode,
  buildInvitationLink,
  ensureReferralCode,
  findInviterByCode,
  assertReferralCodeValidIfPresent,
  attributeReferralOnRegister,
};
