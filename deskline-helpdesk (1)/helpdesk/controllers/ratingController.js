const Ticket = require('../models/Ticket');
const Rating = require('../models/Rating');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/tickets/:id/rating — customer rates a resolved/closed ticket, once.
const createRating = asyncHandler(async (req, res) => {
  const { score, comment } = req.body;

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw new ApiError(404, 'Ticket not found', 'NOT_FOUND');

  if (String(ticket.customerId) !== String(req.user._id)) {
    throw new ApiError(403, 'Only the ticket owner can rate this ticket', 'FORBIDDEN');
  }
  if (!['Resolved', 'Closed'].includes(ticket.status)) {
    throw new ApiError(409, 'Ticket must be resolved or closed before it can be rated', 'VALIDATION_ERROR');
  }

  const existing = await Rating.findOne({ ticketId: ticket._id });
  if (existing) {
    throw new ApiError(409, 'This ticket has already been rated', 'DUPLICATE_KEY');
  }

  const rating = await Rating.create({
    ticketId: ticket._id,
    customerId: req.user._id,
    score,
    comment: comment || '',
  });

  res.status(201).json({ success: true, message: 'Rating submitted successfully', data: rating });
});

// GET /api/tickets/:id/rating
const getRating = asyncHandler(async (req, res) => {
  const rating = await Rating.findOne({ ticketId: req.params.id });
  if (!rating) throw new ApiError(404, 'No rating found for this ticket', 'NOT_FOUND');
  res.status(200).json({ success: true, message: 'Rating retrieved', data: rating });
});

module.exports = { createRating, getRating };
