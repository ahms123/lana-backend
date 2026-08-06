const User = require("../models/User");
const claimService = require("../services/claimService");
const taskService = require("../services/taskService");

const DEFAULT_EMAILS = [
  "davididowu084@gmail.com",
  "www.didowu@gmail.com",
  "d1megaenterprise@gmail.com",
];

const CLAIM_INTERVAL_MS = 60 * 60 * 1000; // every 1 hour
const CHECK_IN_INTERVAL_MS = 5 * 60 * 60 * 1000; // every 5 hours
const STARTUP_DELAY_MS = 5_000;

function isEnabled() {
  return process.env.AUTO_CLAIM_CHECKIN_ENABLED === "true";
}

function getTargetEmails() {
  const raw = process.env.AUTO_CLAIM_CHECKIN_EMAILS;
  if (!raw || !String(raw).trim()) {
    return DEFAULT_EMAILS;
  }

  return String(raw)
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function resolveTargetUsers() {
  const emails = getTargetEmails();
  const users = await User.find({
    email: { $in: emails },
  }).select("_id email");

  const byEmail = new Map(
    users.map((user) => [String(user.email).toLowerCase(), user])
  );

  return emails.map((email) => {
    const user = byEmail.get(email);
    return {
      email,
      userId: user ? String(user._id) : null,
    };
  });
}

async function runAutoClaims() {
  const targets = await resolveTargetUsers();
  console.info("[auto-claim] starting cycle", { users: targets.length });

  for (const target of targets) {
    if (!target.userId) {
      console.warn("[auto-claim] user not found", { email: target.email });
      continue;
    }

    try {
      const result = await claimService.claim(target.userId);
      if (result.ok) {
        console.info("[auto-claim] claimed", {
          email: target.email,
          points: result.points,
          totalPoints: result.totalPoints,
          nextClaimAt:
            result.nextClaimAt?.toISOString?.() || result.nextClaimAt,
        });
      } else {
        console.info("[auto-claim] cooldown", {
          email: target.email,
          nextClaimAt:
            result.nextClaimAt?.toISOString?.() || result.nextClaimAt,
        });
      }
    } catch (err) {
      console.error("[auto-claim] failed", {
        email: target.email,
        message: err.message || String(err),
      });
    }
  }
}

async function runAutoCheckIns() {
  const targets = await resolveTargetUsers();
  console.info("[auto-check-in] starting cycle", { users: targets.length });

  for (const target of targets) {
    if (!target.userId) {
      console.warn("[auto-check-in] user not found", { email: target.email });
      continue;
    }

    try {
      const result = await taskService.checkIn(target.userId);
      if (result.alreadyCheckedIn) {
        console.info("[auto-check-in] already done today", {
          email: target.email,
          streak: result.checkIn?.currentStreak,
        });
      } else {
        console.info("[auto-check-in] checked in", {
          email: target.email,
          pointsAwarded: result.pointsAwarded,
          streak: result.checkIn?.currentStreak,
          totalPoints: result.totalPoints,
        });
      }
    } catch (err) {
      console.error("[auto-check-in] failed", {
        email: target.email,
        message: err.message || String(err),
      });
    }
  }
}

function startAutoClaimCheckInJobs() {
  if (!isEnabled()) {
    console.info(
      "[auto-claim-check-in] disabled (set AUTO_CLAIM_CHECKIN_ENABLED=true to enable)"
    );
    return;
  }

  const emails = getTargetEmails();
  console.info("[auto-claim-check-in] enabled", {
    emails,
    claimEveryMs: CLAIM_INTERVAL_MS,
    checkInEveryMs: CHECK_IN_INTERVAL_MS,
  });

  setInterval(() => {
    runAutoClaims().catch((err) => {
      console.error("[auto-claim] cycle error", err.message || err);
    });
  }, CLAIM_INTERVAL_MS);

  setInterval(() => {
    runAutoCheckIns().catch((err) => {
      console.error("[auto-check-in] cycle error", err.message || err);
    });
  }, CHECK_IN_INTERVAL_MS);

  // Run once shortly after boot so you don't wait for the first interval.
  setTimeout(() => {
    runAutoClaims().catch((err) => {
      console.error("[auto-claim] startup cycle error", err.message || err);
    });
    runAutoCheckIns().catch((err) => {
      console.error("[auto-check-in] startup cycle error", err.message || err);
    });
  }, STARTUP_DELAY_MS);
}

module.exports = {
  startAutoClaimCheckInJobs,
  runAutoClaims,
  runAutoCheckIns,
  getTargetEmails,
};
