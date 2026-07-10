const { StatusCodes } = require("http-status-codes");
const earnService = require("../services/earnService");

/** GET /api/v1/earn/actions — active earn catalog for authenticated user. */
const listActions = async (req, res) => {
  const data = await earnService.listActions();
  res.status(StatusCodes.OK).json(data);
};

module.exports = { listActions };
