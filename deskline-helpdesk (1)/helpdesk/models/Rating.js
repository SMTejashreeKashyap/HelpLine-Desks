const mongoose = require('mongoose');

// One rating per ticket, created after closure — referenced rather than
// embedded on Ticket because it belongs to a separate actor (the customer)
// and is optional/added later in the lifecycle.
const ratingSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    score: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

ratingSchema.index({ ticketId: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
