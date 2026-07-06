const Task = require("../models/Task");

const DEFAULT_TASKS = [
  {
    taskId: "youtube",
    title: "Follow our YouTube",
    description: "Subscribe to our YouTube channel",
    sortOrder: 1,
    externalUrl: "https://www.youtube.com",
    rewardPoints: 0,
    isActive: true,
  },
  {
    taskId: "twitter",
    title: "Follow our Twitter",
    description: "Follow us on X (Twitter)",
    sortOrder: 2,
    externalUrl: "https://x.com",
    rewardPoints: 0,
    isActive: true,
  },
  {
    taskId: "telegram",
    title: "Join our Telegram",
    description: "Join the Lana Telegram community",
    sortOrder: 3,
    externalUrl: "https://telegram.org",
    rewardPoints: 0,
    isActive: true,
  },
  {
    taskId: "discord",
    title: "Join our Discord",
    description: "Join the Lana Discord server",
    sortOrder: 4,
    externalUrl: "https://discord.com",
    rewardPoints: 0,
    isActive: true,
  },
];

async function seedTasks() {
  for (const task of DEFAULT_TASKS) {
    await Task.findOneAndUpdate(
      { taskId: task.taskId },
      { $setOnInsert: task },
      { upsert: true, new: true }
    );
  }
  console.log(`Tasks seed: ensured ${DEFAULT_TASKS.length} catalog task(s)`);
}

module.exports = { seedTasks, DEFAULT_TASKS };
