const EarnAction = require("../models/EarnAction");

function toPublicAction(doc) {
  return {
    id: doc.actionId,
    label: doc.label,
    description: doc.description || "",
    category: doc.category,
    sortOrder: doc.sortOrder ?? 0,
    externalUrl: doc.externalUrl || null,
  };
}

async function listActions() {
  const catalog = await EarnAction.find({ isActive: true })
    .sort({ category: 1, sortOrder: 1, actionId: 1 })
    .lean();

  return {
    actions: catalog.map(toPublicAction),
  };
}

module.exports = {
  toPublicAction,
  listActions,
};
