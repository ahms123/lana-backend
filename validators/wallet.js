const Joi = require("joi");

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const linkWalletSchema = Joi.object({
  address: Joi.string()
    .trim()
    .pattern(EVM_ADDRESS_PATTERN)
    .required()
    .messages({
      "string.pattern.base": "Please provide a valid EVM wallet address (0x + 40 hex chars)",
      "any.required": "Please provide wallet address",
    }),
}).unknown(false);

module.exports = { linkWalletSchema };
