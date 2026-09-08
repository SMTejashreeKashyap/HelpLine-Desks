const mongoose = require('mongoose');

// Tickets reference users (customerId, assignedAgentId) instead of embedding
// them, since a user record is large, shared, and updated independently.
// The status history is small and always read with its parent ticket, so it
// is embedded as a sub-array rather than a separate collection.
const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    remarks: { type: String, trim: true },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: { type: String, required: true, trim: true },
    priority: {
      type: String,
      required: true,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'On Hold', 'Resolved', 'Closed'],
      default: 'Open',
    },
    assignedAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    slaDueAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
    escalated: { type: Boolean, default: false },
    escalatedAt: { type: Date, default: null },
    escalationReason: { type: String, trim: true },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true }
);

ticketSchema.index({ customerId: 1 });
ticketSchema.index({ assignedAgentId: 1 });
ticketSchema.index({ status: 1 });

// Business-rule helper (Module 6: SLA Breach Flagging) — a ticket is
// breached if it is still open past its due date, or was resolved after it.
ticketSchema.methods.isBreached = function isBreached() {
  const compareAt = this.resolvedAt || new Date();
  return compareAt > this.slaDueAt;
};

module.exports = mongoose.model('Ticket', ticketSchema);
