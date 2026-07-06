const { StatusCodes } = require("http-status-codes");
const taskService = require("../services/taskService");

/**
 * GET /api/v1/tasks — catalog merged with per-user progress and check-in summary.
 */
const listTasks = async (req, res) => {
  const data = await taskService.listForUser(req.user.userId);
  res.status(StatusCodes.OK).json(data);
};

/**
 * POST /api/v1/tasks/check-in — daily check-in with atomic streak update (idempotent).
 */
const checkIn = async (req, res) => {
  const { checkIn: summary, alreadyCheckedIn } = await taskService.checkIn(
    req.user.userId
  );
  res.status(StatusCodes.OK).json({
    checkIn: summary,
    alreadyCheckedIn,
  });
};

/**
 * POST /api/v1/tasks/:taskId/start — start a catalog task (idempotent).
 */
const startTask = async (req, res) => {
  const { task, alreadyStarted } = await taskService.startTask(
    req.user.userId,
    req.params.taskId
  );
  res.status(StatusCodes.OK).json({
    task,
    alreadyStarted,
  });
};

module.exports = { listTasks, checkIn, startTask };
