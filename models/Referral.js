const mongoose = require("mongoose");

const ReferralSchema = new mongoose.Schema(
  {
    inviterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    inviteeUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    referralCodeUsed: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    /** True once the one-time signup bonus was credited to the inviter. */
    signupBonusAwarded: {
      type: Boolean,
      default: false,
    },
    /** Total points the inviter has earned from this invitee (signup + claim shares). */
    pointsEarnedFromInvitee: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Referral", ReferralSchema);
