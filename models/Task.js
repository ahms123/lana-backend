const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
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
    rewardPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", TaskSchema);
