const rateLimit = require("express-rate-limit");
const createProtectedRouter = require("./createProtectedRouter");
const { validateTaskIdParam } = require("../validators/tasks");
const { listTasks, checkIn, startTask } = require("../controllers/tasks");

const router = createProtectedRouter();

const checkInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: "Too many check-in attempts, please try again later",
    code: "RATE_LIMITED",
  },
});

const startTaskLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: {
    success: false,
    message: "Too many task start attempts, please try again later",
    code: "RATE_LIMITED",
  },
});

router.get("/", listTasks);
router.post("/check-in", checkInLimiter, checkIn);
router.post("/:taskId/start", startTaskLimiter, validateTaskIdParam, startTask);

module.exports = router;
