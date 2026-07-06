const mongoose = require("mongoose");
const WalletAccount = require("../models/WalletAccount");

/**
 * Fix legacy data: old schema used `walletAddress: null` + sparse unique index,
 * so the second new user hit E11000 → DUPLICATE_WALLET_ADDRESS on GET /wallet.
 */
async function migrateWalletAddressIndex() {
  const cleared = await WalletAccount.updateMany(
    { $or: [{ walletAddress: null }, { walletAddress: "" }] },
    { $unset: { walletAddress: "", addressLinkedAt: "" } }
  );
  if (cleared.modifiedCount > 0) {
    console.log(
      `Wallet migration: unset walletAddress on ${cleared.modifiedCount} account(s)`
    );
  }

  const collection = WalletAccount.collection;
  const indexes = await collection.indexes();

  for (const idx of indexes) {
    if (idx.key?.walletAddress === 1 && !idx.partialFilterExpression) {
      try {
        await collection.dropIndex(idx.name);
        console.log(`Wallet migration: dropped legacy index ${idx.name}`);
      } catch (err) {
        console.warn(
          `Wallet migration: could not drop index ${idx.name}:`,
          err.message
        );
      }
    }
  }

  await WalletAccount.syncIndexes();
  console.log("Wallet migration: walletAddress partial unique index synced");
}

module.exports = { migrateWalletAddressIndex };
