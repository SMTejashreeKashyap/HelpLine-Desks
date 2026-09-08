const SlaRule = require('../models/SlaRule');
const ApiError = require('./ApiError');

// Default resolution windows used only if no admin-configured SlaRule
// exists yet for a given category+priority — keeps ticket creation working
// out of the box while still favouring configured rules (Module 10).
const DEFAULT_HOURS_BY_PRIORITY = {
  Urgent: 4,
  High: 24,
  Medium: 72,
  Low: 120,
};

async function calculateSlaDueDate(category, priority) {
  const rule = await SlaRule.findOne({ category, priority });
  const hours = rule ? rule.resolutionHours : DEFAULT_HOURS_BY_PRIORITY[priority];

  if (!hours) {
    throw new ApiError(400, `No SLA rule or default found for priority "${priority}"`, 'VALIDATION_ERROR');
  }

  const dueAt = new Date();
  dueAt.setHours(dueAt.getHours() + hours);
  return dueAt;
}

module.exports = { calculateSlaDueDate, DEFAULT_HOURS_BY_PRIORITY };
