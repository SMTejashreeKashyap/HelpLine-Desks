const Joi = require('joi');

const createTicketSchema = Joi.object({
  subject: Joi.string().min(3).max(150).required(),
  description: Joi.string().min(5).required(),
  category: Joi.string().min(2).max(60).required(),
  priority: Joi.string().valid('Low', 'Medium', 'High', 'Urgent').required(),
});

const assignTicketSchema = Joi.object({
  agentId: Joi.string().hex().length(24).required(),
});

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid('Open', 'In Progress', 'On Hold', 'Resolved', 'Closed')
    .required(),
  remarks: Joi.string().max(500).allow('', null),
});

const escalateSchema = Joi.object({
  reason: Joi.string().min(3).max(300).required(),
});

module.exports = {
  createTicketSchema,
  assignTicketSchema,
  updateStatusSchema,
  escalateSchema,
};
