const mongoose = require("mongoose");

const STATUSES = ["not_started", "started", "completed"];

const UserTaskProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    taskId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "started",
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

UserTaskProgressSchema.index({ userId: 1, taskId: 1 }, { unique: true });

module.exports = mongoose.model("UserTaskProgress", UserTaskProgressSchema);
module.exports.STATUSES = STATUSES;
