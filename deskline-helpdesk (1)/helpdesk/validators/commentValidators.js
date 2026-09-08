const Joi = require('joi');

const createCommentSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required(),
  isInternal: Joi.boolean().optional(),
});

module.exports = { createCommentSchema };
