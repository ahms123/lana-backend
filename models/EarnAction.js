const mongoose = require("mongoose");

const CATEGORIES = ["upgrade", "action"];

const EarnActionSchema = new mongoose.Schema(
  {
    actionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      enum: CATEGORIES,
      required: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    externalUrl: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

EarnActionSchema.index({ isActive: 1, category: 1, sortOrder: 1 });

module.exports = mongoose.model("EarnAction", EarnActionSchema);
module.exports.CATEGORIES = CATEGORIES;
