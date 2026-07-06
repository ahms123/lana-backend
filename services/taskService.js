const mongoose = require("mongoose");
const Task = require("../models/Task");
const UserTaskProgress = require("../models/UserTaskProgress");
const UserCheckIn = require("../models/UserCheckIn");
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
  };
}

async function listForUser(userId) {
  const id = new mongoose.Types.ObjectId(userId);
  const [catalog, progressList, checkInRecord] = await Promise.all([
    Task.find({ isActive: true }).sort({ sortOrder: 1, taskId: 1 }),
    UserTaskProgress.find({ userId: id }),
    UserCheckIn.findOne({ userId: id }),
  ]);

  const progressMap = new Map(progressList.map((p) => [p.taskId, p]));

  return {
    tasks: catalog.map((task) => toPublicTask(task, progressMap.get(task.taskId))),
    checkIn: toPublicCheckIn(checkInRecord),
  };
}

async function startTask(userId, taskId) {
  const task = await Task.findOne({ taskId, isActive: true });
  if (!task) {
    throw new NotFoundError("Task not found", { code: "TASK_NOT_FOUND" });
  }

  const id = new mongoose.Types.ObjectId(userId);
  let progress = await UserTaskProgress.findOne({ userId: id, taskId });
  let alreadyStarted = Boolean(
    progress &&
      (progress.status === "started" || progress.status === "completed")
  );

  if (!progress) {
    try {
      progress = await UserTaskProgress.create({
        userId: id,
        taskId,
        status: "started",
        startedAt: new Date(),
      });
      alreadyStarted = false;
    } catch (err) {
      if (err.code !== 11000) throw err;
      progress = await UserTaskProgress.findOne({ userId: id, taskId });
      alreadyStarted = Boolean(
        progress &&
          (progress.status === "started" || progress.status === "completed")
      );
    }
  } else if (progress.status === "not_started") {
    progress.status = "started";
    progress.startedAt = progress.startedAt || new Date();
    await progress.save();
    alreadyStarted = false;
  }

  return {
    task: toPublicTask(task, progress),
    alreadyStarted,
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
    };
  }

  const updated = await UserCheckIn.findOneAndUpdate(
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

  if (!updated) {
    const current = await UserCheckIn.findOne({ userId: id });
    return {
      checkIn: toPublicCheckIn(current, todayKey),
      alreadyCheckedIn: true,
    };
  }

  return {
    checkIn: toPublicCheckIn(updated, todayKey),
    alreadyCheckedIn: false,
  };
}

module.exports = {
  getTodayKeyUTC,
  getYesterdayKeyUTC,
  toPublicTask,
  toPublicCheckIn,
  listForUser,
  startTask,
  checkIn,
};
