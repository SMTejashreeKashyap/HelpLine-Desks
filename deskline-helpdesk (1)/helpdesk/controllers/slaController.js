const SlaRule = require('../models/SlaRule');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/sla-rules — manager/admin configures a category+priority mapping
const createSlaRule = asyncHandler(async (req, res) => {
  const { category, priority, resolutionHours } = req.body;

  const existing = await SlaRule.findOne({ category, priority });
  if (existing) {
    throw new ApiError(409, 'An SLA rule for this category and priority already exists', 'DUPLICATE_KEY');
  }

  const rule = await SlaRule.create({ category, priority, resolutionHours });
  res.status(201).json({ success: true, message: 'SLA rule created successfully', data: rule });
});

// GET /api/sla-rules
const listSlaRules = asyncHandler(async (req, res) => {
  const rules = await SlaRule.find().sort({ category: 1, priority: 1 });
  res.status(200).json({ success: true, message: 'SLA rules retrieved', data: rules });
});

// PUT /api/sla-rules/:id
const updateSlaRule = asyncHandler(async (req, res) => {
  const rule = await SlaRule.findByIdAndUpdate(
    req.params.id,
    { resolutionHours: req.body.resolutionHours },
    { new: true, runValidators: true }
  );
  if (!rule) throw new ApiError(404, 'SLA rule not found', 'NOT_FOUND');
  res.status(200).json({ success: true, message: 'SLA rule updated successfully', data: rule });
});

// DELETE /api/sla-rules/:id
const deleteSlaRule = asyncHandler(async (req, res) => {
  const rule = await SlaRule.findByIdAndDelete(req.params.id);
  if (!rule) throw new ApiError(404, 'SLA rule not found', 'NOT_FOUND');
  res.status(200).json({ success: true, message: 'SLA rule deleted successfully', data: null });
});

module.exports = { createSlaRule, listSlaRules, updateSlaRule, deleteSlaRule };
