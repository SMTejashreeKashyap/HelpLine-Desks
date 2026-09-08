const Ticket = require('../models/Ticket');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { calculateSlaDueDate } = require('../utils/slaCalculator');

// Module 4: Ticket Status Workflow — explicit allowed transitions instead
// of accepting any status update, so a ticket can't silently jump from
// Open straight to Closed or resurrect a Closed ticket.
const ALLOWED_TRANSITIONS = {
  Open: ['In Progress'],
  'In Progress': ['On Hold', 'Resolved'],
  'On Hold': ['In Progress'],
  Resolved: ['Closed', 'In Progress'],
  Closed: [],
};

function ticketAccessScope(user) {
  if (user.role === 'customer') return { customerId: user._id };
  if (user.role === 'agent') return { assignedAgentId: user._id };
  return {}; // manager sees everything
}

async function assertTicketVisible(ticket, user) {
  if (user.role === 'manager') return;
  if (user.role === 'customer' && String(ticket.customerId) === String(user._id)) return;
  if (user.role === 'agent' && ticket.assignedAgentId && String(ticket.assignedAgentId) === String(user._id)) return;
  throw new ApiError(403, 'You do not have access to this ticket', 'FORBIDDEN');
}

// POST /api/tickets  — Module 2: Ticket Creation Module (customer only)
const createTicket = asyncHandler(async (req, res) => {
  const { subject, description, category, priority } = req.body;
  const slaDueAt = await calculateSlaDueDate(category, priority);

  const ticket = await Ticket.create({
    subject,
    description,
    category,
    priority,
    customerId: req.user._id,
    slaDueAt,
    statusHistory: [{ status: 'Open', changedBy: req.user._id, remarks: 'Ticket created' }],
  });

  res.status(201).json({ success: true, message: 'Ticket created successfully', data: ticket });
});

// GET /api/tickets — role-scoped list with optional filters
const listTickets = asyncHandler(async (req, res) => {
  const scope = ticketAccessScope(req.user);
  const filter = { ...scope };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.priority) filter.priority = req.query.priority;

  const tickets = await Ticket.find(filter)
    .sort({ createdAt: -1 })
    .populate('customerId', 'name email')
    .populate('assignedAgentId', 'name email');

  res.status(200).json({ success: true, message: 'Tickets retrieved', data: tickets });
});

// GET /api/tickets/breached — Module 6: SLA Breach Flagging
const listBreachedTickets = asyncHandler(async (req, res) => {
  const scope = ticketAccessScope(req.user);
  const now = new Date();

  const tickets = await Ticket.find({
    ...scope,
    status: { $ne: 'Closed' },
    $or: [
      { resolvedAt: null, slaDueAt: { $lt: now } },
      { resolvedAt: { $ne: null }, $expr: { $gt: ['$resolvedAt', '$slaDueAt'] } },
    ],
  })
    .sort({ slaDueAt: 1 })
    .populate('customerId', 'name email')
    .populate('assignedAgentId', 'name email');

  res.status(200).json({ success: true, message: 'Breached tickets retrieved', data: tickets });
});

// GET /api/tickets/:id
const getTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id)
    .populate('customerId', 'name email')
    .populate('assignedAgentId', 'name email');

  if (!ticket) throw new ApiError(404, 'Ticket not found', 'NOT_FOUND');
  await assertTicketVisible(ticket, req.user);

  res.status(200).json({
    success: true,
    message: 'Ticket retrieved',
    data: { ...ticket.toObject(), breached: ticket.isBreached() },
  });
});

// PUT /api/tickets/:id/assign — Module 3: Ticket Assignment Engine (manager only)
const assignTicket = asyncHandler(async (req, res) => {
  const { agentId } = req.body;

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw new ApiError(404, 'Ticket not found', 'NOT_FOUND');
  if (ticket.status === 'Closed') {
    throw new ApiError(409, 'Cannot assign a closed ticket', 'VALIDATION_ERROR');
  }

  const agent = await User.findOne({ _id: agentId, role: 'agent' });
  if (!agent) throw new ApiError(400, 'agentId does not belong to a valid agent', 'VALIDATION_ERROR');

  ticket.assignedAgentId = agent._id;
  if (ticket.status === 'Open') ticket.status = 'In Progress';
  ticket.statusHistory.push({
    status: ticket.status,
    changedBy: req.user._id,
    remarks: `Assigned to ${agent.name}`,
  });
  await ticket.save();

  res.status(200).json({ success: true, message: 'Ticket assigned successfully', data: ticket });
});

// PUT /api/tickets/:id/status — Module 4: Ticket Status Workflow (agent/manager)
const updateStatus = asyncHandler(async (req, res) => {
  const { status, remarks } = req.body;

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw new ApiError(404, 'Ticket not found', 'NOT_FOUND');
  await assertTicketVisible(ticket, req.user);

  if (req.user.role === 'customer') {
    throw new ApiError(403, 'Customers cannot change ticket status', 'FORBIDDEN');
  }

  const allowedNext = ALLOWED_TRANSITIONS[ticket.status] || [];
  if (!allowedNext.includes(status)) {
    throw new ApiError(
      409,
      `Cannot move ticket from "${ticket.status}" to "${status}"`,
      'VALIDATION_ERROR'
    );
  }

  ticket.status = status;
  if (status === 'Resolved') ticket.resolvedAt = new Date();
  if (status === 'In Progress' && ticket.resolvedAt) ticket.resolvedAt = null; // reopened

  ticket.statusHistory.push({ status, changedBy: req.user._id, remarks: remarks || '' });
  await ticket.save();

  res.status(200).json({ success: true, message: 'Status updated successfully', data: { status: ticket.status } });
});

// PUT /api/tickets/:id/escalate — Module 9: Escalation Workflow
const escalateTicket = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw new ApiError(404, 'Ticket not found', 'NOT_FOUND');
  await assertTicketVisible(ticket, req.user);

  if (req.user.role === 'customer') {
    throw new ApiError(403, 'Customers cannot escalate tickets', 'FORBIDDEN');
  }
  if (['Resolved', 'Closed'].includes(ticket.status)) {
    throw new ApiError(409, 'Cannot escalate a resolved or closed ticket', 'VALIDATION_ERROR');
  }

  ticket.escalated = true;
  ticket.escalatedAt = new Date();
  ticket.escalationReason = reason;
  ticket.statusHistory.push({
    status: ticket.status,
    changedBy: req.user._id,
    remarks: `Escalated: ${reason}`,
  });
  await ticket.save();

  res.status(200).json({ success: true, message: 'Ticket escalated successfully', data: ticket });
});

module.exports = {
  createTicket,
  listTickets,
  listBreachedTickets,
  getTicket,
  assignTicket,
  updateStatus,
  escalateTicket,
  ticketAccessScope,
  assertTicketVisible,
};
