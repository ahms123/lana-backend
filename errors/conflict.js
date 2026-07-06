const { StatusCodes } = require("http-status-codes");
const CustomAPIError = require("./custom-api");

class ConflictError extends CustomAPIError {
  constructor(message, options = {}) {
    super(message, options);
    this.statusCode = StatusCodes.CONFLICT;
    this.code = options.code || "CONFLICT";
  }
}

module.exports = ConflictError;
