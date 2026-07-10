const { StatusCodes } = require("http-status-codes");
const CustomAPIError = require("../errors/custom-api");
const { sendError } = require("../utils/errorResponse");

const isProduction = process.env.NODE_ENV === "production";

function duplicateFieldError(err) {
  const field = Object.keys(err.keyValue || {})[0] || "field";
  const codes = {
    email: "DUPLICATE_EMAIL",
    name: "DUPLICATE_NAME",
    walletAddress: "DUPLICATE_WALLET_ADDRESS",
    referralCode: "DUPLICATE_REFERRAL_CODE",
  };
  const messages = {
    email: "Email is already registered",
    name: "Username is already taken",
    walletAddress: "This wallet address is already linked to another account",
    referralCode: "Referral code conflict, please try again",
  };
  return {
    statusCode: StatusCodes.CONFLICT,
    message: messages[field] || `Duplicate value for ${field}`,
    code: codes[field] || "DUPLICATE_FIELD",
    errors: [{ field, message: messages[field] || `Duplicate value for ${field}` }],
  };
}

function mongooseValidationError(err) {
  const errors = Object.values(err.errors).map((item) => ({
    field: item.path,
    message: item.message,
  }));
  const message = errors.map((e) => e.message).join(", ");
  return {
    statusCode: StatusCodes.BAD_REQUEST,
    message: message || "Validation failed",
    code: "VALIDATION_ERROR",
    errors,
  };
}

const errorHandlerMiddleware = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  let message = err.message || "Something went wrong, try again later";
  let code = err.code;
  let errors = err.errors;

  if (err instanceof CustomAPIError) {
    statusCode = err.statusCode || statusCode;
    message = err.message || message;
    code = err.code || code;
    errors = err.errors || errors;
  }

  if (err.name === "ValidationError" && err.errors) {
    const mapped = mongooseValidationError(err);
    statusCode = mapped.statusCode;
    message = mapped.message;
    code = mapped.code;
    errors = mapped.errors;
  } else if (err.code === 11000) {
    const mapped = duplicateFieldError(err);
    statusCode = mapped.statusCode;
    message = mapped.message;
    code = mapped.code;
    errors = mapped.errors;
  } else if (err.name === "CastError") {
    statusCode = StatusCodes.NOT_FOUND;
    message = "Resource not found";
    code = "NOT_FOUND";
    errors = [{ field: "id", message: `Invalid id: ${err.value}` }];
  }

  if (statusCode === StatusCodes.INTERNAL_SERVER_ERROR && isProduction) {
    message = "Something went wrong, try again later";
    code = code || "INTERNAL_ERROR";
    errors = undefined;
  }

  if (!code && statusCode === StatusCodes.BAD_REQUEST) code = "BAD_REQUEST";
  if (!code && statusCode === StatusCodes.UNAUTHORIZED) code = "UNAUTHORIZED";
  if (!code && statusCode === StatusCodes.NOT_FOUND) code = "NOT_FOUND";
  if (!code && statusCode === StatusCodes.CONFLICT) code = "CONFLICT";

  return sendError(res, statusCode, { message, code, errors });
};

module.exports = errorHandlerMiddleware;
