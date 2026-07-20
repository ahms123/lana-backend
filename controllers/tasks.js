const { StatusCodes } = require("http-status-codes");
const taskService = require("../services/taskService");

/**
 * GET /api/v1/tasks — catalog merged with per-user progress and check-in summary.
 * Only active tasks with a non-empty externalUrl are returned.
 */
const listTasks = async (req, res) => {
  const data = await taskService.listForUser(req.user.userId);
  res.status(StatusCodes.OK).json(data);
};

/**
 * POST /api/v1/tasks/check-in — daily check-in with streak points (idempotent).
 * Awards points equal to the new streak (no cap). Already-checked-in returns 0 points.
 */
const checkIn = async (req, res) => {
  const { checkIn: summary, alreadyCheckedIn, pointsAwarded, totalPoints } =
    await taskService.checkIn(req.user.userId);
  res.status(StatusCodes.OK).json({
    checkIn: summary,
    alreadyCheckedIn,
    pointsAwarded,
    totalPoints,
  });
};

/**
 * POST /api/v1/tasks/:taskId/start — open/follow task (honor system).
 * Completes the task and awards rewardPoints once; client opens externalUrl.
 */
const startTask = async (req, res) => {
  const { task, alreadyCompleted, pointsAwarded, totalPoints } =
    await taskService.startTask(req.user.userId, req.params.taskId);
  res.status(StatusCodes.OK).json({
    task,
    alreadyCompleted,
    alreadyStarted: alreadyCompleted, // legacy alias
    pointsAwarded,
    totalPoints,
  });
};

module.exports = { listTasks, checkIn, startTask };
