/**
 * Remove WalletAccount / Referral / check-in / task progress rows whose User was deleted.
 *
 * Usage (from lana-backend):
 *   node db/cleanupOrphanUserData.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./connect");
const User = require("../models/User");
const WalletAccount = require("../models/WalletAccount");
const Referral = require("../models/Referral");
const UserCheckIn = require("../models/UserCheckIn");
const UserTaskProgress = require("../models/UserTaskProgress");

async function deleteOrphans(Model, userIdField, label) {
  const docs = await Model.find({}).select(userIdField);
  if (docs.length === 0) {
    console.log(`${label}: nothing to scan`);
    return 0;
  }

  const ids = [...new Set(docs.map((d) => d[userIdField].toString()))];
  const existing = await User.find({ _id: { $in: ids } }).select("_id");
  const existingSet = new Set(existing.map((u) => u._id.toString()));
  const orphanIds = ids.filter((id) => !existingSet.has(id));

  if (orphanIds.length === 0) {
    console.log(`${label}: 0 orphans`);
    return 0;
  }

  const result = await Model.deleteMany({
    [userIdField]: {
      $in: orphanIds.map((id) => new mongoose.Types.ObjectId(id)),
    },
  });
  console.log(`${label}: deleted ${result.deletedCount} orphan row(s)`);
  return result.deletedCount;
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is required");
  }
  await connectDB(uri);

  await deleteOrphans(WalletAccount, "userId", "WalletAccount");
  await deleteOrphans(UserCheckIn, "userId", "UserCheckIn");
  await deleteOrphans(UserTaskProgress, "userId", "UserTaskProgress");
  await deleteOrphans(Referral, "inviteeUserId", "Referral (invitee)");
  await deleteOrphans(Referral, "inviterUserId", "Referral (inviter)");

  await mongoose.connection.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
