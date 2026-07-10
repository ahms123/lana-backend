const mongoose = require("mongoose");

const WalletAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    lanaPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    walletAddress: {
      type: String,
      trim: true,
      lowercase: true,
      // Omit field when unlinked — do NOT default to null (breaks unique index).
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    linkedBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    addressLinkedAt: {
      type: Date,
      default: null,
    },
    lastClaimAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Unique only for real linked addresses; unlimited users may have no walletAddress field.
WalletAccountSchema.index(
  { walletAddress: 1 },
  {
    unique: true,
    partialFilterExpression: { walletAddress: { $type: "string" } },
  }
);

module.exports = mongoose.model("WalletAccount", WalletAccountSchema);
