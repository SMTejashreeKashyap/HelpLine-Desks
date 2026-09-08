const mongoose = require('mongoose');

// A ticket can accumulate many comments over its lifetime and comments are
// queried independently (paginated, filtered by isInternal), so they live
// in their own collection referencing ticketId rather than being embedded
// as an ever-growing array on the ticket document.
const commentSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: { type: String, required: true, trim: true },
    // Module 8: Internal Notes — visible to agents/managers only, never the customer.
    isInternal: { type: Boolean, default: false },
  },
  { timestamps: true }
);

commentSchema.index({ ticketId: 1 });

module.exports = mongoose.model('Comment', commentSchema);
