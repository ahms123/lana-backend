const express = require("express");
const rateLimit = require("express-rate-limit");
const createProtectedRouter = require("./createProtectedRouter");
const validate = require("../middleware/validate");
const { linkWalletSchema } = require("../validators/wallet");
const { getWallet, linkWallet, unlinkWallet } = require("../controllers/wallet");

const router = createProtectedRouter();

const linkWalletLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many wallet link attempts, please try again later",
    code: "RATE_LIMITED",
  },
});

router.get("/", getWallet);
router.post("/link", linkWalletLimiter, validate(linkWalletSchema), linkWallet);
router.delete("/link", unlinkWallet);

module.exports = router;
