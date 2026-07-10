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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Referral", ReferralSchema);
