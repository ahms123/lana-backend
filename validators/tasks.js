const Joi = require("joi");
const { BadRequestError } = require("../errors");

const TASK_ID_PATTERN = /^[a-z0-9_-]+$/;

const taskIdParamSchema = Joi.object({
  taskId: Joi.string()
    .trim()
    .lowercase()
    .pattern(TASK_ID_PATTERN)
    .required()
    .messages({
      "string.pattern.base": "Invalid task id",
      "any.required": "Task id is required",
    }),
});

function joiFieldErrors(error) {
  return error.details.map((detail) => ({
    field: detail.path.join(".") || "body",
    message: detail.message.replace(/"/g, ""),
  }));
}

const validateTaskIdParam = (req, res, next) => {
  const { error, value } = taskIdParamSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = joiFieldErrors(error);
    const message = errors.map((e) => e.message).join(", ");
    throw new BadRequestError(message || "Validation failed", {
      code: "VALIDATION_ERROR",
      errors,
    });
  }

  req.params = value;
  next();
};

module.exports = { validateTaskIdParam, taskIdParamSchema };
