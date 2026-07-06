const mongoose = require("mongoose");
const WalletAccount = require("../models/WalletAccount");
const { ConflictError } = require("../errors");

const EVM_ADDRESS_REGEX = /^0x[a-f0-9]{40}$/;

function normalizeAddress(address) {
  return address.trim().toLowerCase();
}

function isValidEvmAddress(address) {
  return EVM_ADDRESS_REGEX.test(normalizeAddress(address));
}

function toPublicWallet(account) {
  const address = account.walletAddress || null;
  return {
    address,
    lanaPoints: account.lanaPoints ?? 0,
    walletBalance: account.walletBalance ?? 0,
    linkedBalance: account.linkedBalance ?? 0,
    isLinked: Boolean(address),
  };
}

async function getOrCreateForUser(userId) {
  const id = new mongoose.Types.ObjectId(userId);
  return WalletAccount.findOneAndUpdate(
    { userId: id },
    {
      $setOnInsert: {
        userId: id,
        lanaPoints: 0,
        walletBalance: 0,
        linkedBalance: 0,
      },
    },
    { upsert: true, new: true }
  );
}

async function linkAddress(userId, rawAddress) {
  const address = normalizeAddress(rawAddress);

  const existingForAddress = await WalletAccount.findOne({ walletAddress: address });
  if (
    existingForAddress &&
    existingForAddress.userId.toString() !== userId.toString()
  ) {
    throw new ConflictError(
      "This wallet address is already linked to another account",
      {
        code: "DUPLICATE_WALLET_ADDRESS",
        errors: [
          {
            field: "address",
            message: "This wallet address is already linked to another account",
          },
        ],
      }
    );
  }

  const account = await getOrCreateForUser(userId);

  if (account.walletAddress === address) {
    return account;
  }

  account.walletAddress = address;
  account.addressLinkedAt = new Date();
  await account.save();
  return account;
}

async function unlinkAddress(userId) {
  const id = new mongoose.Types.ObjectId(userId);
  const account = await getOrCreateForUser(userId);
  if (!account.walletAddress) {
    return account;
  }

  await WalletAccount.updateOne(
    { userId: id },
    { $unset: { walletAddress: "", addressLinkedAt: "" } }
  );

  account.walletAddress = undefined;
  account.addressLinkedAt = undefined;
  return account;
}

module.exports = {
  normalizeAddress,
  isValidEvmAddress,
  toPublicWallet,
  getOrCreateForUser,
  linkAddress,
  unlinkAddress,
};
