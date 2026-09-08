const mongoose = require('mongoose');

// Small, admin-configured lookup table — referenced by category+priority
// rather than embedded, since many tickets share the same rule and it is
// edited independently of any single ticket (Module 10).
const slaRuleSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true },
    priority: {
      type: String,
      required: true,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
    },
    resolutionHours: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

slaRuleSchema.index({ category: 1, priority: 1 }, { unique: true });

module.exports = mongoose.model('SlaRule', slaRuleSchema);
