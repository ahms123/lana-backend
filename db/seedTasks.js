const Task = require("../models/Task");

/**
 * Catalog social tasks. Empty / null externalUrl → hidden in the app.
 * Seed uses $set so URL and reward updates apply on server restart.
 */
const DEFAULT_TASKS = [
  {
    taskId: "telegram_channel",
    title: "Join Telegram Channel",
    description: "Follow LanaVarse on Telegram",
    sortOrder: 1,
    externalUrl: "https://t.me/lana_varse",
    rewardPoints: 5,
    isActive: true,
  },
  {
    taskId: "telegram_group",
    title: "Join Telegram Group",
    description: "Join the LanaVarse Telegram group",
    sortOrder: 2,
    externalUrl: "https://t.me/+Ld_0gZyNY-A0MmNk",
    rewardPoints: 5,
    isActive: true,
  },
  {
    taskId: "youtube",
    title: "Follow our YouTube",
    description: "Subscribe to our YouTube channel",
    sortOrder: 3,
    externalUrl: "https://www.youtube.com/@LanaVarse",
    rewardPoints: 5,
    isActive: true,
  },
  {
    taskId: "twitter",
    title: "Follow our Twitter",
    description: "Follow us on X (Twitter)",
    sortOrder: 4,
    externalUrl: "https://x.com/lanavarse",
    rewardPoints: 5,
    isActive: true,
  },
  {
    taskId: "discord",
    title: "Join our Discord",
    description: "Join the Lana Discord server",
    sortOrder: 5,
    externalUrl: "https://discord.gg/9zpHdWA4E",
    rewardPoints: 5,
    isActive: true,
  },
];

async function seedTasks() {
  for (const task of DEFAULT_TASKS) {
    await Task.findOneAndUpdate(
      { taskId: task.taskId },
      { $set: task },
      { upsert: true, new: true },
    );
  }
  console.log(`Tasks seed: synced ${DEFAULT_TASKS.length} catalog task(s)`);
}

module.exports = { seedTasks, DEFAULT_TASKS };
