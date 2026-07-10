const rateLimit = require("express-rate-limit");
const createProtectedRouter = require("./createProtectedRouter");
const { getClaimStatus, postClaim } = require("../controllers/claim");

const router = createProtectedRouter();

const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many claim attempts, please try again later",
    code: "RATE_LIMITED",
  },
});

router.get("/", getClaimStatus);
router.post("/", claimLimiter, postClaim);

module.exports = router;
