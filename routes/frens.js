const rateLimit = require("express-rate-limit");
const createProtectedRouter = require("./createProtectedRouter");
const { getFrens } = require("../controllers/frens");

const router = createProtectedRouter();

const frensReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: {
    success: false,
    message: "Too many requests, please try again later",
    code: "RATE_LIMITED",
  },
});

router.get("/", frensReadLimiter, getFrens);

module.exports = router;
