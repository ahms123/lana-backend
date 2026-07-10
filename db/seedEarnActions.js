const EarnAction = require("../models/EarnAction");

const DEFAULT_EARN_ACTIONS = [
  {
    actionId: "upgrade_speed",
    label: "Upgrade Mining Speed",
    description: "Increase your mining speed",
    category: "upgrade",
    sortOrder: 1,
    isActive: true,
  },
  {
    actionId: "upgrade_time",
    label: "Upgrade Mining Time to Claim",
    description: "Extend mining time before claim",
    category: "upgrade",
    sortOrder: 2,
    isActive: true,
  },
  {
    actionId: "super_pass",
    label: "Super Pass",
    description: "Unlock premium earn benefits",
    category: "action",
    sortOrder: 1,
    isActive: true,
  },
  {
    actionId: "partner_tasks",
    label: "Partner Tasks",
    description: "Complete partner offers to earn",
    category: "action",
    sortOrder: 2,
    isActive: true,
  },
  {
    actionId: "stake_coins",
    label: "Stake your coins or USDT",
    description: "Stake assets to earn rewards",
    category: "action",
    sortOrder: 3,
    isActive: true,
  },
];

async function seedEarnActions() {
  for (const action of DEFAULT_EARN_ACTIONS) {
    await EarnAction.findOneAndUpdate(
      { actionId: action.actionId },
      { $setOnInsert: action },
      { upsert: true, new: true }
    );
  }
  console.log(
    `Earn actions seed: ensured ${DEFAULT_EARN_ACTIONS.length} catalog action(s)`
  );
}

module.exports = { seedEarnActions, DEFAULT_EARN_ACTIONS };
