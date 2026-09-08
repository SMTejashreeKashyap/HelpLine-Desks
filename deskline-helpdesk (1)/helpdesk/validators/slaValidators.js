const Joi = require('joi');

const createSlaRuleSchema = Joi.object({
  category: Joi.string().min(2).max(60).required(),
  priority: Joi.string().valid('Low', 'Medium', 'High', 'Urgent').required(),
  resolutionHours: Joi.number().integer().min(1).max(720).required(),
});

const updateSlaRuleSchema = Joi.object({
  resolutionHours: Joi.number().integer().min(1).max(720).required(),
});

module.exports = { createSlaRuleSchema, updateSlaRuleSchema };
