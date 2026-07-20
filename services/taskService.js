const mongoose = require("mongoose");
const Task = require("../models/Task");
const UserTaskProgress = require("../models/UserTaskProgress");
const UserCheckIn = require("../models/UserCheckIn");
const WalletAccount = require("../models/WalletAccount");
const walletService = require("./walletService");
const { NotFoundError } = require("../errors");

/** UTC calendar day key YYYY-MM-DD */
function getTodayKeyUTC(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getYesterdayKeyUTC(date = new Date()) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return getTodayKeyUTC(d);
}

/**
 * Points awarded on the next successful check-in (no cap).
 * Equals currentStreak + 1 if yesterday was checked, else 1. 0 if already today.
 */
function computeNextCheckInPoints(
  record,
  todayKey = getTodayKeyUTC(),
  yesterdayKey = getYesterdayKeyUTC()
) {
  if (!record) return 1;
  if (record.lastCheckInDay === todayKey) return 0;
  if (record.lastCheckInDay === yesterdayKey) {
    return (record.currentStreak ?? 0) + 1;
  }
  return 1;
}

function toPublicTask(task, progress) {
  const status = progress?.status || "not_started";
  return {
    id: task.taskId,
    title: task.title,
    description: task.description || "",
    status,
    startedAt: progress?.startedAt ? progress.startedAt.toISOString() : null,
    completedAt: progress?.completedAt
      ? progress.completedAt.toISOString()
      : null,
    externalUrl: task.externalUrl || null,
    rewardPoints: task.rewardPoints ?? 0,
  };
}

function toPublicCheckIn(record, todayKey = getTodayKeyUTC()) {
  if (!record) {
    return {
      checkedInToday: false,
      canCheckInToday: true,
      currentStreak: 0,
      longestStreak: 0,
      lastCheckInDay: null,
      totalCheckIns: 0,
      nextCheckInPoints: 1,
    };
  }

  const checkedInToday = record.lastCheckInDay === todayKey;
  return {
    checkedInToday,
    canCheckInToday: !checkedInToday,
    currentStreak: record.currentStreak ?? 0,
    longestStreak: record.longestStreak ?? 0,
    lastCheckInDay: record.lastCheckInDay ?? null,
    totalCheckIns: record.totalCheckIns ?? 0,
    nextCheckInPoints: computeNextCheckInPoints(record, todayKey),
  };
}

async function getLanaPointsTotal(userId) {
  const account = await WalletAccount.findOne({
    userId: new mongoose.Types.ObjectId(userId),
  }).select("lanaPoints");
  return account?.lanaPoints ?? 0;
}

async function awardCheckInPoints(userId, points) {
  await walletService.getOrCreateForUser(userId);
  const updated = await WalletAccount.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId) },
    { $inc: { lanaPoints: points } },
    { new: true }
  );
  return updated?.lanaPoints ?? points;
}

async function listForUser(userId) {
  const id = new mongoose.Types.ObjectId(userId);
  const [catalog, progressList, checkInRecord] = await Promise.all([
    Task.find({
      isActive: true,
      externalUrl: { $type: "string", $ne: "" },
    }).sort({ sortOrder: 1, taskId: 1 }),
    UserTaskProgress.find({ userId: id }),
    UserCheckIn.findOne({ userId: id }),
  ]);

  const progressMap = new Map(progressList.map((p) => [p.taskId, p]));

  return {
    tasks: catalog.map((task) =>
      toPublicTask(task, progressMap.get(task.taskId))
    ),
    checkIn: toPublicCheckIn(checkInRecord),
  };
}

/**
 * Honor-system follow: clicking start opens the link (client) and completes the task.
 * Awards rewardPoints once when transitioning to completed.
 */
async function startTask(userId, taskId) {
  const task = await Task.findOne({
    taskId,
    isActive: true,
    externalUrl: { $type: "string", $ne: "" },
  });
  if (!task) {
    throw new NotFoundError("Task not found", { code: "TASK_NOT_FOUND" });
  }

  const id = new mongoose.Types.ObjectId(userId);
  const now = new Date();
  const reward = Math.max(0, task.rewardPoints ?? 0);

  const existing = await UserTaskProgress.findOne({ userId: id, taskId });
  if (existing?.status === "completed") {
    return {
      task: toPublicTask(task, existing),
      alreadyCompleted: true,
      pointsAwarded: 0,
      totalPoints: await getLanaPointsTotal(userId),
    };
  }

  let progress;
  try {
    progress = await UserTaskProgress.findOneAndUpdate(
      {
        userId: id,
        taskId,
        status: { $ne: "completed" },
      },
      {
        $set: {
          status: "completed",
          completedAt: now,
          startedAt: existing?.startedAt || now,
        },
        $setOnInsert: {
          userId: id,
          taskId,
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    progress = await UserTaskProgress.findOne({ userId: id, taskId });
    if (progress?.status === "completed") {
      return {
        task: toPublicTask(task, progress),
        alreadyCompleted: true,
        pointsAwarded: 0,
        totalPoints: await getLanaPointsTotal(userId),
      };
    }
    throw err;
  }

  // Re-check: another request may have completed first.
  if (!progress || progress.status !== "completed") {
    const current = await UserTaskProgress.findOne({ userId: id, taskId });
    return {
      task: toPublicTask(task, current),
      alreadyCompleted: current?.status === "completed",
      pointsAwarded: 0,
      totalPoints: await getLanaPointsTotal(userId),
    };
  }

  // Only award if this transition was from non-completed (existing was not completed).
  let pointsAwarded = 0;
  let totalPoints = await getLanaPointsTotal(userId);
  if (!existing || existing.status !== "completed") {
    // Guard double-award: only credit if completedAt matches this request window
    // or use rewardPointsAwarded flag — simpler: check if we just set completed
    // and existing wasn't completed. Concurrent losers hit alreadyCompleted above.
    if (reward > 0) {
      await walletService.getOrCreateForUser(userId);
      const wallet = await WalletAccount.findOneAndUpdate(
        { userId: id },
        { $inc: { lanaPoints: reward } },
        { new: true }
      );
      pointsAwarded = reward;
      totalPoints = wallet?.lanaPoints ?? reward;
    }
  }

  return {
    task: toPublicTask(task, progress),
    alreadyCompleted: false,
    pointsAwarded,
    totalPoints,
  };
}

async function checkIn(userId) {
  const todayKey = getTodayKeyUTC();
  const yesterdayKey = getYesterdayKeyUTC();
  const id = new mongoose.Types.ObjectId(userId);

  const existing = await UserCheckIn.findOne({ userId: id });
  if (existing?.lastCheckInDay === todayKey) {
    return {
      checkIn: toPublicCheckIn(existing, todayKey),
      alreadyCheckedIn: true,
      pointsAwarded: 0,
      totalPoints: await getLanaPointsTotal(userId),
    };
  }

  let updated;
  try {
    updated = await UserCheckIn.findOneAndUpdate(
      { userId: id, lastCheckInDay: { $ne: todayKey } },
      [
        {
          $set: {
            lastCheckInDay: todayKey,
            totalCheckIns: { $add: [{ $ifNull: ["$totalCheckIns", 0] }, 1] },
            currentStreak: {
              $cond: [
                { $eq: ["$lastCheckInDay", yesterdayKey] },
                { $add: [{ $ifNull: ["$currentStreak", 0] }, 1] },
                1,
              ],
            },
          },
        },
        {
          $set: {
            longestStreak: {
              $max: [
                { $ifNull: ["$longestStreak", 0] },
                "$currentStreak",
              ],
            },
          },
        },
      ],
      { upsert: true, new: true }
    );
  } catch (err) {
    // Concurrent first check-in: two upserts race on unique userId index.
    if (err.code !== 11000) throw err;
    updated = null;
  }

  if (!updated) {
    const current = await UserCheckIn.findOne({ userId: id });
    const alreadyCheckedIn = current?.lastCheckInDay === todayKey;
    return {
      checkIn: toPublicCheckIn(current, todayKey),
      alreadyCheckedIn,
      pointsAwarded: 0,
      totalPoints: await getLanaPointsTotal(userId),
    };
  }

  // Points = new streak length (no cap). Day 1 → 1, day 8 → 8, etc.
  const pointsAwarded = Math.max(1, updated.currentStreak ?? 1);
  const totalPoints = await awardCheckInPoints(userId, pointsAwarded);

  return {
    checkIn: toPublicCheckIn(updated, todayKey),
    alreadyCheckedIn: false,
    pointsAwarded,
    totalPoints,
  };
}

module.exports = {
  getTodayKeyUTC,
  getYesterdayKeyUTC,
  computeNextCheckInPoints,
  toPublicTask,
  toPublicCheckIn,
  listForUser,
  startTask,
  checkIn,
};
