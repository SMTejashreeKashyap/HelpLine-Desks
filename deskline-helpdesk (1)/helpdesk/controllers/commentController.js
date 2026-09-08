const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { assertTicketVisible } = require('./ticketController');

// POST /api/tickets/:id/comments
const addComment = asyncHandler(async (req, res) => {
  const { message, isInternal } = req.body;

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw new ApiError(404, 'Ticket not found', 'NOT_FOUND');
  await assertTicketVisible(ticket, req.user);

  // Module 8: only agents/managers may create internal notes; customers
  // can never mark — or see — a note as internal.
  const wantsInternal = Boolean(isInternal);
  if (wantsInternal && req.user.role === 'customer') {
    throw new ApiError(403, 'Customers cannot create internal notes', 'FORBIDDEN');
  }

  const comment = await Comment.create({
    ticketId: ticket._id,
    authorId: req.user._id,
    message,
    isInternal: wantsInternal,
  });

  res.status(201).json({ success: true, message: 'Comment added successfully', data: comment });
});

// GET /api/tickets/:id/comments
const listComments = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw new ApiError(404, 'Ticket not found', 'NOT_FOUND');
  await assertTicketVisible(ticket, req.user);

  const filter = { ticketId: ticket._id };
  // Module 8: internal notes are stripped out entirely for customers, not
  // just hidden client-side.
  if (req.user.role === 'customer') filter.isInternal = false;

  const comments = await Comment.find(filter)
    .sort({ createdAt: 1 })
    .populate('authorId', 'name role');

  res.status(200).json({ success: true, message: 'Comments retrieved', data: comments });
});

module.exports = { addComment, listComments };
